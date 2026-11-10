import test from "node:test";
import assert from "node:assert/strict";
import { getAllHistoricalIndicators,getAllHistoricalIndicatorsWithNowcast,getHistoricalIndicators,historicalInputContext,
  computeEmpiricalCarbonIntensityDeclineRate } from "../server/calculation/historicalIndicators";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { setTimeout as delay } from "node:timers/promises";

test("captured historical getters and empirical decline share isolated deterministic inputs",async()=>{
  const baseline=getAllHistoricalIndicators();
  const first=baseline[0],last=baseline.at(-1)!;
  const make=(factor:number)=>[
    {...last,carbonIntensityKgPerGDP:first.carbonIntensityKgPerGDP*factor,isNowcast:false},
    {...first,isNowcast:false},
    {...last,year:last.year+1,carbonIntensityKgPerGDP:999,isNowcast:true},
  ];
  const before=JSON.stringify(baseline);
  const values=await Promise.all([0.5,0.8].map((factor,index)=>
    historicalInputContext.run(make(factor),async()=>{
      await delay(index?1:5);
      const expected=100*(1-factor**(1/(last.year-first.year)));
      assert.ok(Math.abs(computeEmpiricalCarbonIntensityDeclineRate()-expected)<1e-12);
      assert.equal(getAllHistoricalIndicators().length,2);
      assert.deepEqual(getAllHistoricalIndicatorsWithNowcast().map(r=>r.year),[first.year,last.year,last.year+1]);
      assert.equal(getHistoricalIndicators(last.year)?.carbonIntensityKgPerGDP,first.carbonIntensityKgPerGDP*factor);
      const rows=getAllHistoricalIndicators();rows[0].carbonIntensityKgPerGDP=0;
      assert.equal(getHistoricalIndicators(first.year)?.carbonIntensityKgPerGDP,first.carbonIntensityKgPerGDP);
      return computeEmpiricalCarbonIntensityDeclineRate();
    })));
  assert.notEqual(values[0],values[1]);
  assert.equal(JSON.stringify(getAllHistoricalIndicators()),before);
});
test("invalid and contradictory captured histories reject instead of loading current rows",()=>{
  const row={...getAllHistoricalIndicators()[0],isNowcast:false};
  for(const data of [[],[row,row],[{...row,carbonIntensityKgPerGDP:NaN}],[{...row,isNowcast:true}]])
    for(const getter of [getAllHistoricalIndicators,getAllHistoricalIndicatorsWithNowcast])
      assert.throws(()=>historicalInputContext.run(data,getter),/Captured|captured/);
  assert.throws(()=>historicalInputContext.run([row,{...row,year:row.year+1,isNowcast:true,evGrowthRate:NaN}],
    getAllHistoricalIndicatorsWithNowcast),/Invalid captured/);
  assert.throws(()=>runWithOverrideRows([{indicatorKey:"carbonIntensityKgPerGDP",year:row.year,
    value:row.carbonIntensityKgPerGDP+1,source:"isolated test",method:"manual"}],()=>
      historicalInputContext.run([row],()=>getAllHistoricalIndicators())),/Conflicting/);
});

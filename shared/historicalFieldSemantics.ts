import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { projectionFieldSemantics } from "./projectionFieldSemantics";
function copy(id:string,newId:string,patch:Partial<OutputFieldSemantic>={}):OutputFieldSemantic {
  const field=projectionFieldSemantics.find(f=>f.id===`projection.${id}`);
  if(!field) throw new Error(`Missing underlying projection definition: ${id}`);
  return {...field,id:newId,...patch};
}
const history={
  source:"historicalRecalculation/categoryHistoricalTrend; retained model/data content hashes, not original publication vintages",
  period:"One reconstruction per retained input/nowcast year; each simulation starts at that row year and ends2100",
  scope:"Current-code historical reconstruction, NOT forecasts issued at those historical dates",
  asOfRule:"Empirical intensity decline uses retained historical rows through the reference year; publication availability remains unknown",
  uncertainty:"Historical trend:1000 emissions draws; category histories:500; temperature summaries independently resample10000 draws. No calibrated coverage",
};
const contextCategory={
  ...history,source:"calculateCategoryProjection; fixed category interventions, not fitted parameters",
  period:"API category scenarios use2024 through2100",
  asOfRule:"Selected2024 baseline row and current/request-selected retained history; not original-vintage availability",
  uncertainty:"1000 emissions members and1000 PDF draws;10000 separate temperature-summary draws; not calibrated",
};
const inputConversion="Growth fractions multiplied by100; target coverage=0.9*policyCoverage; acceleration=1; intensity CAGR through row.year. Missing finance/CO2 inputs default respectively to0.27,0.9,3.4,33.4,390,2.0 in historical converters; category interventions apply literal configured changes";
const historical:OutputFieldSemantic[]=[
  copy("emissionsTrajectory[].year","historical.year",{...history,meaning:"Reference input year of each reconstructed scenario",formula:"resolved input row.year"}),
  ...(["median","p10","p90"] as const).map(q=>copy(`temperatureDistribution.${q}`,`historical.${q}`,{
    ...history,formula:`${inputConversion}; `+projectionFieldSemantics.find(f=>f.id===`projection.temperatureDistribution.${q}`)!.formula.replace("PDF N=10000","PDF N=1000"),
  })),
  copy("metrics.reductionRate","historical.reductionRate",history),
  copy("metrics.netZeroYear","historical.netZeroYear",history),
  copy("calculation.validation","historical.isNowcast",{...history,role:"Calculated",meaning:"Input row is an extrapolated extension; false is not original-vintage certification",
    unit:"boolean",formula:"Boolean(inputRow.isNowcast)",dependencies:["inputRow.isNowcast"]}),
];
const category:OutputFieldSemantic[]=[
  copy("calculation.scenario","category.category",{...contextCategory,meaning:"Category intervention identifier",formula:"technology | policy | corporate | socioeconomic | financial | emissions"}),
  copy("calculation.scenario","category.categoryName",{...contextCategory,meaning:"Display label of the configured intervention",
    formula:"technology=>Technology; policy=>Policy; corporate=>Corporate; socioeconomic=>Socioeconomic; financial=>Financial Flows; emissions=>Emissions Outcomes"}),
  copy("temperatureDistribution.median","category.temperatureRise",{...contextCategory,
    formula:projectionFieldSemantics.find(f=>f.id==="projection.temperatureDistribution.median")!.formula.replace("PDF N=10000","PDF N=1000")}),
  copy("metrics.reductionRate","category.reductionRate",contextCategory),
  copy("metrics.netZeroYear","category.netZeroYear",contextCategory),
  ...projectionFieldSemantics.filter(f=>f.id.startsWith("projection.emissionsTrajectory[]")).map(f=>({
    ...f,...contextCategory,id:f.id.replace("projection.emissionsTrajectory[]","category.trajectory[]"),
  })),
  ...(["temperature","probability"] as const).map(key=>copy(`temperatureDistribution.pdf[].${key}`,`category.temperatureDistribution[].${key}`,{
    ...contextCategory,formula:projectionFieldSemantics.find(f=>f.id===`projection.temperatureDistribution.pdf[].${key}`)!.formula.replace("PDF N=10000","PDF N=1000"),
  })),
];
const categoryHistory:OutputFieldSemantic[]=[
  ...historical.filter(f=>["historical.year","historical.isNowcast"].includes(f.id)).map(f=>({...f,id:f.id.replace("historical.","categoryHistory.")})),
  ...["all","technology","policy","corporate","socioeconomic","financial","emissions"].flatMap(group=>
    ["median","reductionRate","netZeroYear"].map(key=>{
      const field=historical.find(f=>f.id===`historical.${key}`)!;
      return {...field,id:`categoryHistory.${group}.${key}`,
        meaning:`${group} scenario: ${field.meaning}`,
        formula:`${group==="all"?"Unmodified historical converter":`applyCategoryModifications(historical converter,${group})`}; ${field.formula.replace("PDF N=1000","PDF N=500")}`,
        uncertainty:"500 emissions/PDF draws per scenario; separate10000 summary draws; conditional diagnostic, not calibrated"};
    })),
];
export const historicalFieldSemantics=[...historical,...category,...categoryHistory];

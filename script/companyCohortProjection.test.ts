import test from "node:test";
import assert from "node:assert/strict";
import {projectCompanyCohorts,type CompanyCohortInput} from "../server/calculation/companyCohortProjection";
import {stageCompanyOperatingInTransaction as stage,decideCompanyOperatingInTransaction as decide,projectReviewedCompanyInTransaction as project} from "../server/snapshots/companyOperatingReview";
import {materialLeaves} from "../server/calculation/companyProjectionAsOf";
import {packCompanySource} from "../server/calculation/companySourceArchive";
import {contentHash} from "../server/calculation/analysisManifest";
import {expectedSnapshotGuards} from "../server/snapshots/guards";
import {PgDialect} from "drizzle-orm/pg-core";
export function cohortFixture():CompanyCohortInput{
 const source={hash:"a".repeat(64),locator:"isolated conditional fixture",publishedAt:"2025-01-01T00:00:00Z",
  year:2027,periodStart:"2027-01-01",periodEnd:"2027-12-31",geography:"fixture",unit:"MWh",kind:"conditional-assumption" as const};
 const coordinate={issuer:"42",unitId:"unit",year:2027,scope:"1" as const,gas:"CO2" as const,geography:"fixture",channel:"operational" as const};
 return {version:"company-cohort-input-1",companyId:"42",cutoff:"2026-01-01T00:00:00Z",years:[2027],cells:[coordinate],
 scenarios:[{id:"a",specification:{boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",
 timing:"commission-at-year-start-retire-before-year-service",evidenceIds:["fixture"],
 cohorts:[{id:"asset",commissionedYear:2027,retiredYear:2028,installedUnits:1,annualDegradation:0,
 capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:100,evidenceIds:["fixture"]}],
 years:[{year:2027,utilization:1,pricePerServiceUsd:1,variableCostPerServiceUsd:0,fixedCashCostUsd:0,
 constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,cashTaxUsd:0,
 increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}]},
 physical:[{...coordinate,cohortId:"asset",activityChannel:"service",intensity:2,intensityDenominator:"MWh",intensityNumerator:"tonnes-native-gas",
 ownership:.5,basis:"full-unit-before-ownership",activitySource:source,intensitySource:{...source,unit:"tonnes-CO2/MWh",gas:"CO2",scope:"1"}}]}]};
}
test("future activity comes from real cohort computation; complete declared range and population",()=>{
 const x=cohortFixture(),r=projectCompanyCohorts(x);
 assert.equal(r.covered.scenarios[0].rows![0].emissionsTonnes,100);
 x.scenarios.push({...structuredClone(x.scenarios[0]),id:"missing",physical:[]});
 const missing=projectCompanyCohorts(x);assert.equal(missing.covered.ranges[0].min,null);
 assert.deepEqual(missing.covered.ranges[0].missingScenarioIds,["missing"]);
 const y=cohortFixture();y.scenarios[0].physical[0].cohortId="forged";
 assert.throws(()=>projectCompanyCohorts(y),/Missing genuine/);
});
test("partial-calendar degrading service feeds finite accrual and cash without a renewal claim",()=>{
 for(const storage of [false,true]){
  const x=cohortFixture(),s=x.scenarios[0],c=s.specification.cohorts[0],y=s.specification.years[0],evidenceIds=["fixture"];
  s.specification.timing="utc-civil-day-service";
  Object.assign(c,{retiredYear:2027,annualDegradation:.1,servicePerInstalledUnitPerYear:365,
   capacityUnit:storage?"kWh-storage":"MW",serviceUnit:storage?"kWh-delivered":"MWh",
   dated:{commissionedOn:"2027-07-01",retiredOn:"2027-10-01",degradationDayBasis:365.25,roundTripEfficiency:.8}});
  Object.assign(y,{pricePerServiceUsd:10,variableCostPerServiceUsd:.2,constructionCashUsd:20,...(storage?{chargeEnergyPriceUsdPerKwh:2}:{})});
  const service=Array.from({length:92},(_,day)=>Math.pow(.9,day/365.25)).reduce((a,b)=>a+b,0);
  const paidEnergy=storage?service*1.25:0,accruedEnergy=paidEnergy*2,paidVariable=service*.1;
  const distribution=service*10-paidVariable-paidEnergy;
  const unit=storage?"kWh-delivered":"MWh",p=s.physical[0];
  p.intensityDenominator=unit;p.activitySource.unit=unit;p.intensitySource.unit=`tonnes-CO2/${unit}`;
  s.finiteAccounting={
   ledger:{version:"cohort-cash-ledger-1",currency:"USD",claimantId:"fixture-project",claim:"declared-project-common-distribution-not-whole-equity",distributionRightsEvidenceId:"fixture",
    years:[{year:2027,openingReceivables:0,closingReceivables:0,collections:service*10,
     openingOtherWorkingCapital:0,closingOtherWorkingCapital:0,openingUnpaidTax:0,closingUnpaidTax:0,taxAccrual:0,
     openingDebt:0,closingDebt:0,openingNonCommonLiability:0,closingNonCommonLiability:0,nonCommonAccrual:0,
     operatingFixedCash:0,holdingCash:0,transactionCash:0,openingCash:0,closingCash:0,commonContribution:20,commonDistribution:distribution,evidenceIds}]},
   declaration:{version:"dated-project-cash-1",valuationOn:"2027-01-01",discountRate:.1,convention:"ACT/365.25",claimantId:"fixture-project"},
   timing:(["commonContribution","construction","collections","variableCost","energyCost","commonDistribution"] as const).map(component=>({year:2027,component,
    allocations:[{on:component==="commonContribution"?"2027-06-30":component==="construction"?"2027-07-01":"2027-12-01",fraction:1,evidenceIds}]})),
   accrual:{version:"dated-accrual-2",claimantId:"fixture-project",payables:[{year:2027,opening:0,closing:paidVariable+paidEnergy}],
    operatingSettlements:{otherWorkingCapitalBasis:"excludes-receivables-payables-and-tax",alreadyCashPaidComponents:["construction"],
     years:[{year:2027,variableCost:paidVariable,energyCost:paidEnergy,evidenceIds}]},
    entries:[{id:"sales",on:"2027-09-30",kind:"revenue",usd:service*10,evidenceIds},
     {id:"cost",on:"2027-09-30",kind:"payable",usd:service*.2+accruedEnergy,evidenceIds}]}
  };
  const r=projectCompanyCohorts(x),m=r.members[0];
  assert.ok(Math.abs(m.physical.rows[0].service-service)<1e-9);
  assert.equal(m.physical.rows[0].closing,0);
  assert.equal(m.finiteAccounting.periodicValueUsd,null);
  assert.equal(m.finiteAccounting.version,"finite-cohort-accrual-1");
  assert.equal(m.finiteAccounting.physicalParentHash,m.parentResultHash);
  assert.ok(Math.abs(m.finiteAccounting.accrualDays.at(-1).cash)<1e-9);
  assert.equal(r.covered.scenarios[0].status,"conditional");
  if(storage)assert.ok(Math.abs(m.physical.rows[0].chargeEnergyKwh-service/0.8)<1e-9);
  s.finiteAccounting.timing[0].allocations[0].on="2027-08-01";
  assert.throws(()=>projectCompanyCohorts(x),/funding/);
 }
});
test("renewal enters company projection with matching physical source and full assumption identity",()=>{
 const x=cohortFixture(),s=x.scenarios[0],base=structuredClone(s.physical[0]);
 x.years=[2027,2028];
 s.specification.years=[2027,2028].map(year=>({...s.specification.years[0],year,replacementCashUsd:10}));
 s.specification.cohorts=[2026,2027,2028].map(year=>({...s.specification.cohorts[0],
  id:String(year),commissionedYear:year,retiredYear:year+1}));
 x.cells=x.years.map(year=>({...x.cells[0],year}));
 s.physical=x.years.map(year=>({...structuredClone(base),year,cohortId:String(year),
  activitySource:{...base.activitySource,year,periodStart:`${year}-01-01`,periodEnd:`${year}-12-31`},
  intensitySource:{...base.intensitySource,year,periodStart:`${year}-01-01`,periodEnd:`${year}-12-31`}}));
 s.renewal={version:"periodic-renewal-1",claim:"conditional-project-common-residual",
  specification:structuredClone(s.specification),cycleYears:1,discountRate:.1,
  openingAgeStock:[1],closingAgeStock:[1],openingDebtUsd:0,closingDebtUsd:0,
  openingWorkingCapitalUsd:0,closingWorkingCapitalUsd:0,openingUnpaidTaxUsd:0,closingUnpaidTaxUsd:0,
  replacementCostPerUnitUsd:10,evidenceIds:["fixture"]};
 const result=projectCompanyCohorts(x);
 assert.ok(Math.abs(result.members[0].renewal.conditionalPeriodicProjectValueUsd-900)<1e-9);
 assert.equal(result.modelVersions[0].renewal,"periodic-renewal-1");
 assert.equal(result.assumptionHash,contentHash(x.scenarios));
 s.renewal.specification.years[0].pricePerServiceUsd=2;
 assert.throws(()=>projectCompanyCohorts(x),/Swapped renewal/);
});
for(const liquidation of [false,true])test(`actual operating lifecycle with isolated memory transport, liquidation=${liquidation}: approvals, retained code/result/source, conflicts; NOT PostgreSQL proof`,async()=>{
 const records=new Map<string,{kind:string;payload:any}>(),dialect=new PgDialect();
 const identity={companyId:"42",isin:"ZZ0000000010"},now="2026-01-02T00:00:00Z";
 const tx:any={execute:async(q:any)=>{
  const {sql,params:p}=dialect.sqlToQuery(q);const s=sql.replace(/\s+/g," ");let rows:any[]=[];
  if(s.includes("FROM pg_trigger"))rows=expectedSnapshotGuards.map(g=>({...g,schema:"public",functionSchema:"public",enabled:"O",internal:false}));
  else if(s.includes("pg_advisory"))rows=[];
  else if(s.includes("SELECT isin FROM cv_companies"))rows=[{isin:identity.isin}];
  else if(s.includes("INSERT INTO cv_analysis_snapshots")){
   if(!records.has(String(p[0]))){records.set(String(p[0]),{kind:String(p[1]),payload:null});rows=[{id:p[0]}];}
  }else if(s.includes("INSERT INTO cv_analysis_chunks"))records.get(String(p[0]))!.payload=JSON.parse(String(p[1]));
  else if(s.includes("s.chunk_count,c.ordinal,c.payload")){const r=records.get(String(p[0]));if(r&&r.kind===p[1])rows=[{chunk_count:1,ordinal:0,payload:structuredClone(r.payload)}];}
  else if(s.includes("c.payload->>'proposalId'"))rows=[...records].filter(([,r])=>r.kind==="company-operating-decision"&&r.payload.proposalId===p[0]).map(([id])=>({id}));
  else if(s.includes("transaction_timestamp"))rows=[{now}];
  else if(s.includes("FROM financial_reviews"))rows=[{status:"approved",payload:{identity},reviewed_at:now}];
  else throw Error("Unimplemented isolated SQL transport");
  return {rows};
 }};
 try{
  const input=cohortFixture();
  if(liquidation)input.scenarios[0].specification.liquidation={
   version:"cohort-liquidation-1",policy:"finite-liquidation",currency:"USD",cashBoundary:"undistributed-at-cutoff",
   openingCashDistributionOn:"2028-01-01",postHorizonService:"none-offline",discountRate:.08,
   evidenceIds:["fixture"],transactionCostsUsd:0,holdingCostsUsd:0,
   opening:{cash:0,workingCapital:0,unpaidTax:0,debt:0,nonCommonLiability:0},
   subsequentAccrual:{tax:0,interest:0,remediation:0},
   dispositions:[{cohortId:"asset",units:1,on:"2028-01-01",retirementLiability:4,remediationLiability:0}],
   payments:[{id:"sale",on:"2028-01-01",kind:"salvage",usd:2,cohortId:"asset",evidenceIds:["fixture"]},
    {id:"retire",on:"2028-01-01",kind:"retirement",usd:4,cohortId:"asset",evidenceIds:["fixture"]}]
  };
  const claims=Object.entries(materialLeaves(input)).map(([path,value])=>({
   path,valueHash:contentHash(value),value,locator:path,unit:"synthetic declared field",period:"2027",geography:"fixture",
   basis:"assumption" as const,availableAt:input.cutoff,method:"isolated fixture",dependencies:[]}));
  const source=packCompanySource({version:"company-operating-source-1",...identity,url:"https://example.invalid/fixture",
   publisher:"Synthetic",publishedAt:input.cutoff,retrievedAt:input.cutoff,content:"fixture",contentHash:contentHash("fixture"),licence:"Synthetic",claims});
  const evidence=claims.map(c=>({path:c.path,valueHash:c.valueHash,availableAt:c.availableAt,basis:c.basis,sourceArchiveId:source.id}));
  const id=await stage(tx,input,evidence,[source.payload],identity,input.cutoff);
  const decision=await decide(tx,id,"approved","synthetic-review");
  assert.equal((await decide(tx,id,"approved","synthetic-review")).id,decision.id);
  await assert.rejects(()=>decide(tx,id,"rejected","synthetic-review"),/Conflicting/);
  await assert.rejects(()=>project(tx,decision.id,input.cutoff),/Approval unavailable/);
  const result=await project(tx,decision.id,"2026-02-01T00:00:00Z");
  assert.equal(result.covered.scenarios[0].rows[0].emissionsTonnes,100);
  const proposal=records.get(id)!.payload;
  assert.equal(proposal.producer.modelVersion,"company-cohort-projection-2");
  assert.equal(proposal.producer.inputVersion,input.version);
  assert.equal(proposal.producer.assumptionHash,contentHash(input.scenarios));
  assert.deepEqual(proposal.producer.modelVersions,result.modelVersions);
  assert.ok(records.get(proposal.producer.codeId)!.payload.files["server/calculation/cohortLiquidation.ts"]);
  if(liquidation){
   assert.equal(result.members[0].physical.liquidation.commonResidual,-2);
   assert.equal(result.members[0].physical.liquidation.unfundedShortfall,true);
  }
  for(const dependency of [proposal.producer.codeId,proposal.producer.resultId,source.id,decision.financialIdentityArchive]){
   const saved=records.get(dependency)!;
   records.delete(dependency);
   await assert.rejects(()=>project(tx,decision.id,"2026-02-01T00:00:00Z"),/corrupt/);
   records.set(dependency,saved);
   const original=structuredClone(saved.payload);
   saved.payload.injected="alteration";
   await assert.rejects(()=>project(tx,decision.id,"2026-02-01T00:00:00Z"),/corrupt/);
   saved.payload=original;
  }
 }finally{records.clear();assert.equal(records.size,0);}
});

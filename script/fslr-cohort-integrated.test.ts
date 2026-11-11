import{test}from"node:test";
import assert from"node:assert/strict";
import{datedCashPv,rowFcfeFromFundedCash,historicalFslrCashBridge,integrateFslrSourceCohorts}from"../server/calculation/fslrCohortIntegratedLedger";
test("Dated receipts are not uniformly stub-prorated; same-year cash still discounted",()=>{
  const legs=[{date:"2025-03-31",cashUsd:100,kind:"synthetic",dateIsAssumption:true}];
  const pv=datedCashPv(legs,"2025-02-21",.1);
  assert.ok(pv<100&&pv>98);assert.equal(datedCashPv([...legs,{...legs[0],cashUsd:-100}],"2025-02-21",.1),0);
});
test("Precutoff cash refuses as distributable post-cutoff cash",()=>{
  assert.throws(()=>datedCashPv([{date:"2025-01-31",cashUsd:100,kind:"synthetic",dateIsAssumption:true}],"2025-02-21",.1),/after cutoff/);
});
test("Funded cash route does not add recognized policy credit or a second haircut",()=>{
  const y={nonClimateRevenue:1000,climateRevenue:0,operatingMarginBeforeClimateCostsAndCredits:.1,
    climateOperatingCost:0,depreciation:10,otherNonCash:0,cashPolicyCredit:95,recognizedPolicyCredit:100,
    closingReceivables:50,openingReceivables:45,increaseOtherOperatingWorkingCapital:7,interestPaid:3,
    cashTax:20,otherOperatingCash:0,capitalSpend:40,debtProceeds:12,debtRepayments:10,nonCommonCashClaims:2};
  assert.equal(rowFcfeFromFundedCash(y),130);
  assert.equal(rowFcfeFromFundedCash({...y,cashPolicyCredit:0}),35);
});
test("Other grant cash cannot be invented from income plus receivable adjustment",()=>{
  const l:any={fiserv:{cashUsd:60},operatingCashFlowUsd:80,incomeGrants2024ByExpenseUsd:[40,2,1],
    governmentGrantsReceivableCfoEffectUsd:25,priorCurrentGrantReceivableUsd:60,priorNoncurrentGrantReceivableUsd:10,
    currentGrantReceivableUsd:50,noncurrentGrantReceivableUsd:12,incomeGrants2023Usd:60,governmentGrantReceivableCfoEffect2023Usd:-60};
  const r=historicalFslrCashBridge(l,5);assert.equal(r.cfoLessSelectedCreditCashUsd,15);
  assert.equal(r.unallocatedGrantBridgeResidualUsd,3);assert.equal(r.residualIsNotObservedOtherGrantCash,true);
  assert.equal(r.priorYearAllIncomeGrantPlusGrantCfoAdjustmentUsd,0);
});
test("Independent synthetic whole-cash integration replaces overlapping cohort cash once",()=>{
  const rows=Array.from({length:16},(_,i)=>{
    const year=2026+i,cashPolicyCredit=year<=2032?95:0;
    return{year,cashFlowDate:`${year}-12-31`,nonClimateRevenue:1000,climateRevenue:0,operatingMarginBeforeClimateCostsAndCredits:.1,
      climateOperatingCost:0,depreciation:10,otherNonCash:0,cashPolicyCredit,recognizedPolicyCredit:year<=2032?100:0,
      closingReceivables:50,openingReceivables:45,increaseOtherOperatingWorkingCapital:7,interestPaid:3,cashTax:20,
      otherOperatingCash:0,capitalSpend:40,debtProceeds:12,debtRepayments:10,nonCommonCashClaims:2,fcfe:35+cashPolicyCredit};
  });
  const baseline:any={built:{engineInput:{referenceDate:"2025-02-21",currency:"USD",firstYear:2026,terminalGrowth:.025,
    discountRate:.1,baseFcfe:-1,years:rows.slice(0,5),continuation:{years:rows.slice(5,15),terminalYear:rows[15]},
    stub:{cashFlows:[{date:"2025-12-31",fcfe:100}]}},
    ledger:{years:rows.slice(0,5),continuationYears:rows.slice(5,15),terminalYear:rows[15]}},
    assessed:{forward:{forwardWholeEquity:10000}}};
  const facts:any={transfers:[
    {id:"syntheticVisa",generationYear:2024,faceUsd:10,contractProceedsUsd:9.5,receipts:[{year:2024,cashUsd:6.5},{year:2025,cashUsd:3}]},
    {id:"syntheticJune",generationYear:2025,faceUsd:30,contractProceedsUsd:28.5,receipts:[{year:2025,cashUsd:28.5}]},
    {id:"syntheticOct",generationYear:2025,faceUsd:20,contractProceedsUsd:19,receipts:[{year:2025,cashUsd:16.5},{year:2026,cashUsd:2.5}]}
  ],treasuryCashOnly:{cashUsd:1,generationYear:2024}};
  const args={baseline,parameters:{fslrForecastCredit2025:100,fslrCashPerFaceCredit:.95,fslrCreditReceivableYears:.25},facts};
  const pre=integrateFslrSourceCohorts({...args,visaTiming:"pre-cutoff-reserved"});
  const post=integrateFslrSourceCohorts({...args,visaTiming:"post-cutoff-march31"});
  assert.equal(pre.annualRows[0].fcfe,121.625);assert.equal(pre.annualRows[0].increaseOtherOperatingWorkingCapital,7);
  assert.equal(pre.annualRows[0].recognizedPolicyCredit,100);assert.equal(pre.terminalFcfeUnchanged,35);
  assert.equal(pre.conditionalUnmatched2025ForecastCreditFaceUsd,50);
  assert.ok(Math.abs((post.finiteCashDeltaPvUsd-pre.finiteCashDeltaPvUsd)-
    3/1.1**(38/365.25))<1e-10);
  assert.equal(pre.secondDiscountOrExcessCashAdditionUsd,0);
  assert.equal(pre.technicalOriginalIssuerCompletion,false);
});

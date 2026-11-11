import{readFileSync}from"node:fs";import{createHash}from"node:crypto";import assert from"node:assert/strict";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Separate mandatory private-primary validation only");
const root="generated-artifacts/company-operating-corpus/fslr-cohort-integrated-v1";
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),hash=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const latest=read(`${root}/latest.json`),f=read(latest.freezePath),r=read(latest.reportPath);
assert.equal(hash(latest.freezePath),latest.freezeSha256);assert.equal(hash(latest.reportPath),latest.reportSha256);
for(const p of [...f.preserve,...f.code])assert.equal(hash(p.path),p.sha256);
assert.ok(Date.parse(f.frozenAt)<=Date.parse(r.calculatedAt));assert.equal(r.cases.length,2);
// Independent source parse and direct cash/PV rebuild, no production module/old issuer kernel import.
const html=readFileSync(f.primaryPath,"utf8"),text=html.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\$\s+/g,"$").replace(/\s+/g," ");
assert.ok(text.includes("two agreements with Fiserv"));assert.ok(text.includes("full cash proceeds during the year ended December 31, 2024"));
assert.ok(text.includes("operating activities during 2024 was primarily driven by proceeds from the sale of Section 45X tax credits"));
const grossCash=659.7e6+616e6;assert.equal(r.history.selected2024CreditCashUsd,grossCash);
assert.equal(r.history.cfoLessSelectedCreditCashUsd,1217999e3-grossCash);
assert.equal(r.history.unallocatedGrantBridgeResidualUsd,(1009451+4186+484+270300)*1000-grossCash);
assert.equal(r.history.cashflowVersusBookMovementUnattributedUsd,270300e3-((659745+152208)-(403759+157570))*1000);
assert.equal(r.history.priorYearAllIncomeGrantPlusGrantCfoAdjustmentUsd,0);
const params=f.parameters,b=f.baseline,e=b.built.engineInput,day=(date:string)=>(Date.parse(date+"T00:00:00Z")-Date.parse(e.referenceDate+"T00:00:00Z"))/86400000/365.25;
const discount=(amount:number,date:string)=>amount/(1+e.discountRate)**day(date);
const oldNet=(701.9e6+699.7e6)*params.fslrCashPerFaceCredit,carry=oldNet*.25,firstCash=oldNet-carry,fraction=day("2025-12-31");
assert.equal(params.fslrCreditReceivableYears,.25);
const expectedNoVisa=discount(-firstCash*fraction+1241.1e6,"2025-12-31")-
  discount(carry,"2026-12-31")+discount(95.2e6,"2026-02-28")+discount(117.6e6,"2026-01-31");
const sourceRows=[...e.years,...e.continuation.years,e.continuation.terminalYear];
for(const c of r.cases){
  const visaExtra=c.visaTiming==="post-cutoff-march31"?discount(202.6e6,"2025-03-31"):0;
  assert.ok(Math.abs(c.finiteCashDeltaPvUsd-expectedNoVisa-visaExtra)<.00001);
  assert.ok(Math.abs(c.conditionalIntegratedWholeEquityUsd-b.assessed.forward.forwardWholeEquity-c.finiteCashDeltaPvUsd)<.00001);
  assert.equal(c.conditionalUnmatched2025ForecastCreditFaceUsd,273.4e6);
  assert.equal(c.source2026PriorCreditCashUsd,212.8e6);
  for(let i=0;i<sourceRows.length;i++){
    const old=sourceRows[i],y=c.annualRows[i];
    for(const k of ["recognizedPolicyCredit","openingReceivables","closingReceivables","increaseOtherOperatingWorkingCapital",
      "capitalSpend","debtProceeds","debtRepayments","cashTax","interestPaid","nonCommonCashClaims"])assert.equal(y[k],old[k]);
    const core=(old.nonClimateRevenue+old.climateRevenue)*old.operatingMarginBeforeClimateCostsAndCredits-old.climateOperatingCost;
    const oldFcfe=core+old.depreciation+old.otherNonCash+old.cashPolicyCredit-old.closingReceivables+old.openingReceivables-
      old.increaseOtherOperatingWorkingCapital-old.interestPaid-old.cashTax+old.otherOperatingCash-old.capitalSpend+
      old.debtProceeds-old.debtRepayments-old.nonCommonCashClaims;
    assert.ok(Math.abs(y.fcfe-oldFcfe-(old.year===2026?212.8e6-carry:0))<.0001);
    assert.ok(Math.abs(y.cashRebuildResidualUsd)<.0001);
  }
  assert.equal(c.terminalFcfeUnchanged,b.built.ledger.terminalYear.fcfe);
  assert.equal(c.secondDiscountOrExcessCashAdditionUsd,0);assert.equal(c.recognitionIncomeOrTaxOrOtherWcAdjustmentUsd,0);
  assert.equal(c.oldIssuerKernelExecutions,0);assert.equal(c.technicalOriginalIssuerCompletion,false);
}
assert.equal(r.ownerReview,"pending-not-requested");assert.equal(r.qualifiedOriginalIssuers,0);
const quarter=readFileSync("generated-artifacts/company-operating-corpus/issuer-cash-collections-v1/fslr-2026q3.html","utf8").replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\s+/g," ");
assert.ok(quarter.includes("we produced 4.3 GW and sold 4.1 GW"));assert.equal(f.assumptions.actualUsEligibleWatts,null);
console.log(JSON.stringify({privatePrimaryValidation:"pass",priorHashGuards:f.preserve.length,
  sourceCashIntegrationCases:2,annualFundedCashRows:r.cases.reduce((s:number,c:any)=>s+c.annualRows.length,0),
  independentDatedPvAndAnnualCashRebuilds:2,historicalGrantResidualsExplicit:true,
  unchangedCoreDebtReinvestmentTaxWcTerminal:true,technicalOriginalIssuerCompletion:false,qualifiedOriginalIssuers:0}));

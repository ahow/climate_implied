import{readFileSync}from"node:fs";
import{createHash}from"node:crypto";
import assert from"node:assert/strict";
import{extractFy2024UkLaw,qualifyPermitUnits,extractOriginalXomPlan,extractBaytownFunding,qualifiedPlanEnvelope}
  from"../server/calculation/xomSourceInputQualification";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Mandatory private-primary validation required");
const dir="generated-artifacts/company-operating-corpus/xom-source-inputs-v1";
const read=(p:string)=>JSON.parse(readFileSync(p,"utf8")),sha=(p:string)=>createHash("sha256").update(readFileSync(p)).digest("hex");
const l=read(`${dir}/latest.json`),f=read(l.freezePath),r=read(l.reportPath);
assert.equal(sha(l.freezePath),r.freezeHash);assert.ok(Date.parse(f.frozenAt)<=Date.parse(r.qualifiedAt));
assert.equal(sha(f.receiptPath),f.receiptSha256);
for(const s of [...f.preserve,...f.code,...f.sourceReceipts.attempts.filter((a:any)=>a.path)])
  assert.equal(sha(s.path),s.sha256,`Changed source/code/protected ${s.path}`);
const src=(name:string)=>readFileSync(f.sourceReceipts.attempts.find((s:any)=>s.name===name&&s.status===200).path,"utf8");
const law=extractFy2024UkLaw(src("ukets-article4-fy2024.xml"),src("ukets-schedule2-fy2024.xml"),src("ukets-full-fy2024.xml"));
assert.deepEqual(law,r.law);
assert.equal(law.madeDate,"2020-11-11");assert.equal(law.tonnesCo2ePerAllowance,1);
let units=0,uncovered=0;
for(const p of f.retainedPermitEvidence.permits){
  const q=qualifyPermitUnits(p,law);assert.deepEqual(q,r.permits.find((x:any)=>x.permitId===p.permitId));
  // Independent legal mass/unit calculation, NOT the old carbon-cost kernel.
  assert.equal(q.requiredSurrenderUnits,p.recordedCoveredEmissions);
  assert.equal(q.uncoveredUnitsBeforeBankOrTransfers,Math.max(0,p.recordedCoveredEmissions-p.allocationDelivered));
  assert.equal(q.statutorySurrenderDue,`${p.period+1}-04-30`);assert.equal(q.verifiedReportDue,`${p.period+1}-03-31`);
  assert.equal(q.nativeCo2Tonnes,null);assert.equal(q.actualCashPurchaseDates,null);assert.equal(q.actualPurchasedUnits,null);
  assert.deepEqual(q.statutoryGasesForListedRegistryActivities,["CO2"]);
  units+=q.requiredSurrenderUnits;uncovered+=q.uncoveredUnitsBeforeBankOrTransfers;
}
assert.equal(units,3070057);assert.equal(uncovered,1560945);assert.equal(r.selectedPermitAggregate.deliveredUka,1509112);
assert.deepEqual(extractOriginalXomPlan(src("xom-plan-2030.html")),r.corporatePlan);
assert.deepEqual(extractBaytownFunding(src("xom-adnoc-baytown.html")),r.baytown);
assert.deepEqual(qualifiedPlanEnvelope(r.corporatePlan),r.planEnvelope);
assert.deepEqual(r.planEnvelope.netCashCapexArithmeticEnvelopeUsd,[(27+5*28)*1e9,(29+5*33)*1e9]);
assert.equal(r.corporatePlan.ccsFeePerTonne,null);assert.equal(r.corporatePlan.ccsOnlyCapitalBudget,null);
assert.equal(r.baytown.exxonFinalEquityFraction,null);assert.equal(r.baytown.paidContributionUsd,null);
assert.equal(r.baytown.expectedHydrogenVolume.gas,"hydrogen");
assert.equal(r.newPublicRequests,16);assert.equal(r.newFinancialScenarioGrids,0);assert.equal(r.valuationScoringPerformed,false);
assert.equal(r.qualifiedOriginalIssuers,0);
console.log(JSON.stringify({status:"passed",newPublicRequests:16,http200:r.http200,http404:r.http404,
  legalGasRows:3,permitUnitAndCalendarChecks:2,corporatePlanAndFundingSources:2,
  independentUncoveredUnits:uncovered,sourceHashChecks:f.sourceReceipts.attempts.length,
  protectedPriorFiles:f.preserve.length,newFinancialGrids:0,oldKernelsExecuted:false,
  qualifiedOriginalIssuers:0,freezeHash:sha(l.freezePath),reportHash:sha(l.reportPath)},null,2));

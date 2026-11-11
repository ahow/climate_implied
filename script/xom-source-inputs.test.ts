import{test}from"node:test";
import assert from"node:assert/strict";
import{extractFy2024UkLaw,qualifyPermitUnits,extractOriginalXomPlan,extractBaytownFunding,qualifiedPlanEnvelope}
  from"../server/calculation/xomSourceInputQualification";
// Synthetic miniature documents; NO private files, network or frozen kernel execution.
const date="2024-12-31";
const article=`<root URI="/${date}">total specified emissions (in tonnes of carbon dioxide equivalent)</root>`;
const schedule=`<root URI="/${date}"><table>
<tr><td>Combustion of fuels on a site where units operate</td><td>Carbon dioxide</td></tr>
<tr><td>Refining of mineral oil</td><td>Carbon dioxide</td></tr>
<tr><td>Production of hydrogen and synthesis gas</td><td>Carbon dioxide</td></tr></table></root>`;
const full=`<root URI="/${date}"><ukm:Made Date="2020-11-11"/>
<P1 id="article-18"><Text>An allowance is an allowance to emit 1 tonne of carbon dioxide equivalent.
Allowances may be held only in accounts in the registry.</Text></P1>
<P2 id="schedule-6-paragraph-4-3"><Text>Must surrender allowances equal to the installation's reportable emissions
on or before 30th April in the following year</Text></P2>
<P2 id="schedule-6-paragraph-4-2"><Text>Report on or before 31st March in the following year</Text></P2></root>`;
const plan=`<article>December 11, 2024 $27-$29 billion of cash capex in 2025
$28-$33 billion annually in 2026-2030 up to $30 billion
Low Carbon Solutions business to grow earnings contributions by $2 billion in 2030 versus 2024
Lower emissions cash capex includes cash capex attributable to carbon capture and storage, hydrogen, lithium, biofuels.
Planned spend is from 2025-2030.
Other investing activities including collection of advances; reduced by Inflows from noncontrolling interests for major projects</article>`;
const baytown=`<article>September 04, 2024 ADNOC will acquire a 35% equity stake in the
proposed low-carbon hydrogen and ammonia production facility in Baytown, Texas.
Contingent on supportive government policy and necessary regulatory permits,
1 billion cubic feet (bcf) daily 98% final investment decision (FID) is expected in 2025 with anticipated startup in 2029.</article>`;
test("Qualified statutory1UKA/tCO2e and calendar do not invent paid price, bank or native gas",()=>{
  const law=extractFy2024UkLaw(article,schedule,full);
  const p=qualifyPermitUnits({permitId:"UK-E-IN-12019",operator:"Esso Petroleum Company Limited",period:2024,
    reportedUnit:"tCO2e",recordedCoveredEmissions:100,allocationDelivered:60,allocationUnit:"UKA",
    regulatedActivity:"COMBUSTION_OF_FUELS"},law);
  assert.equal(p.requiredSurrenderUnits,100);assert.equal(p.uncoveredUnitsBeforeBankOrTransfers,40);
  assert.equal(p.statutorySurrenderDue,"2025-04-30");
  assert.deepEqual(p.statutoryGasesForListedRegistryActivities,["CO2"]);
  assert.equal(p.nativeCo2Tonnes,null);assert.equal(p.actualUncommittedBankUnits,null);
  assert.equal(p.actualPurchasedUnits,null);assert.equal(p.cashSettlementYear,null);
  assert.equal(p.incrementalCostValuationPermitted,false);
});
test("Law point date, gas annex, exact operator and unknown activity cannot silently fall back",()=>{
  assert.throws(()=>extractFy2024UkLaw(article.replace(date,"2026-01-01"),schedule,full),/point-in-time/);
  assert.throws(()=>extractFy2024UkLaw(article,schedule.replaceAll("Carbon dioxide","Nitrous oxide"),full),/activity gas/);
  const law=extractFy2024UkLaw(article,schedule,full);
  assert.throws(()=>qualifyPermitUnits({permitId:"UK-E-IN-12019",operator:"ExxonMobil Chemical Limited",period:2024,
    reportedUnit:"tCO2e",recordedCoveredEmissions:1,allocationDelivered:0,allocationUnit:"UKA",regulatedActivity:"UNKNOWN"},law),/operator/);
});
test("Source net cash-capex envelope is167-194bn, not gross or a CCS allocation",()=>{
  const p=extractOriginalXomPlan(plan),q=qualifiedPlanEnvelope(p);
  assert.deepEqual(q.netCashCapexArithmeticEnvelopeUsd,[167e9,194e9]);
  assert.equal(q.grossCapitalEnvelopeUsd,null);assert.equal(q.ccsOnlyCapitalAllocationUsd,null);
  assert.equal(q.endpointsAreJointIssuerGuidance,false);
  assert.equal(q.lcsEarningsNotCcsFcfe,2e9);
  assert.equal(q.fullCcsCashValuationStatus,"refused-missing-project-economics");
  assert.equal(p.ccsFeePerTonne,null);
  assert.ok(p.lowerEmissionScope.includes("lithium"));
});
test("Announced35% stake/98% CO2 removal never become paid equity,65% XOM cash or CO2 tonnes",()=>{
  const p=extractBaytownFunding(baytown);
  assert.equal(p.announcedEquityFraction,.35);assert.equal(p.exxonFinalEquityFraction,null);
  assert.equal(p.transactionClosedObserved,null);assert.equal(p.paidContributionUsd,null);
  assert.equal(p.expectedHydrogenVolume.gas,"hydrogen");
  assert.equal(p.expectedHydrogenVolume.standardStateDisclosed,false);
  assert.equal(p.absoluteCo2CapturedTonnesPerYear,null);
  assert.equal(p.actualCommissioningObserved,null);
});
test("Missing financial qualifiers and point-in-time publication clauses are explicit refusals",()=>{
  assert.throws(()=>extractOriginalXomPlan(plan.replace("reduced by Inflows","inclusive of Inflows")),/Missing source/);
  assert.throws(()=>extractBaytownFunding(baytown.replace("September 04, 2024","September 04, 2026")),/Missing source/);
});

import{test}from"node:test";
import assert from"node:assert/strict";
import{extractCfFy2024Projects,corroborateYazooAnnouncement,examineCfAgreementAndExhibits,
  extractHistoricalEprSite,sourceBoundCaptureCapacity}from"../server/calculation/xomCounterpartyPermitInputs";
// Synthetic tiny fixtures only. No private corpus/market data or network in public CI.
const annual=`Construction of the dehydration and compression unit at our Donaldsonville complex is in advanced stages, with an estimated total cost of approximately $200 million over the life of the project.
Construction of the dehydration and compression unit at our Yazoo City complex is expected to cost approximately $100 million over the life of the project.
For each facility we have contracted with ExxonMobil to transport and sequester.
At Donaldsonville, CCS is expected to commence in 2025 up to approximately 2 million metric tons of CO2.
At Yazoo City, CCS is expected to commence in 2028 up to approximately 500,000 metric tons of CO2.
EXHIBIT INDEX 10.1 Synthetic unrelated employment agreement`;
const announcement=`July 25, 2024 Yazoo City, Mississippi signed a definitive commercial agreement with ExxonMobil.
Sequestration is expected to start in 2028. CF Industries will invest approximately $100 million.
up to 500,000 metric tons of CO2 expects the project to qualify for tax credits under Section 45Q`;
const epr=`Synthetic cover\fNotice of variation and consolidation
The Environmental Permitting (England and Wales) Regulations 2016 EPR/BR6996IC
Esso Petroleum Company, Limited company registration number 00026538
Registered office Leatherhead to operate a regulated facility at Esso Refinery Marsh Lane Fawley Southampton Hampshire SO45 1TX
The notice shall take effect from 04/03/2019`;
test("Source metric CO2 volumes/capture capital do not become XOM service economics",()=>{
  const p=extractCfFy2024Projects(annual),q=sourceBoundCaptureCapacity(p);
  assert.equal(q.totalMatureAnnualCapacityUpperMetricTonnes,2500000);
  assert.equal(q.cfCaptureUnitCapitalApproxUsd,300e6);
  assert.deepEqual(q.conditionalYears2025To2029.map(x=>x.conditionalPhysicalCapacityUpperMetricTonnes),[2e6,2e6,2e6,2.5e6,2.5e6]);
  assert.equal(q.cumulativeFiveYearCapacityUpperMetricTonnes,11e6);
  assert.deepEqual(q.atStatedUpperCapacityCfCapitalUsdPerAnnualMetricTonne.map(x=>x.value),[100,200]);
  assert.equal(q.aggregateCfCapitalUsdPerAnnualMetricTonne,120);
  assert.ok(q.conditionalYears2025To2029.every(x=>x.commonCashRevenue===null&&x.observedOrMinimumBillableVolume===null));
  assert.equal(q.xomProjectCashValue,null);assert.equal(p[0].xomCapital,null);
});
test("Ambiguous original tons/nativeCO2e and missing metric qualifier rejected",()=>{
  assert.throws(()=>extractCfFy2024Projects(annual.replaceAll("metric tons","tons")),/primary clause/);
  const p=extractCfFy2024Projects(annual);
  assert.throws(()=>sourceBoundCaptureCapacity([{...p[0],massUnit:"tCO2e"} as any,p[1]]),/bound invalid/);
});
test("Counterparty agreement/45Q expectation is not executed-entity/credit-price proof",()=>{
  const p=extractCfFy2024Projects(annual),q=corroborateYazooAnnouncement(announcement,p[1]);
  assert.equal(q.expected45QByIssuer,true);assert.equal(q.currentLegalEligibilityCertified,false);
  assert.equal(q.feePerTonne,null);assert.equal(q.creditBeneficiaryContractAllocation,null);
  assert.equal(q.signedOperatingLegalEntitiesIdentified,false);
});
test("Exhibit-index search is bounded to exact retrieved filings",()=>{
  const q=examineCfAgreementAndExhibits(annual,2024);
  assert.equal(q.matchingNamedAgreementDescriptions,0);assert.equal(q.feeSchedule,null);
  assert.match(q.scope,/NOT proof/);
  assert.throws(()=>examineCfAgreementAndExhibits(annual.replace("EXHIBIT INDEX","ANNEX"),2024),/index absent/);
  assert.throws(()=>examineCfAgreementAndExhibits(annual+" ExxonMobil agreement",2024),/actual linked contract/);
  const original=`References to tons refer to short tons and references to tonnes refer to metric tons.
  capacity to dehydrate and compress up to 2 million tons per year of CO2;
  definitive CO2 offtake agreement with ExxonMobil to transport and permanently sequester. EXHIBIT INDEX unrelated`;
  const p=examineCfAgreementAndExhibits(original,2022);
  assert.equal(p.original2022ReportedCapacityShortTonsPerYear,2e6);
  assert.equal(p.original2022CapacityMetricTonnesPerYear,null);
  assert.throws(()=>examineCfAgreementAndExhibits(original.replace("short tons","long tons"),2022),/primary clause/);
});
test("Actual regulated EPR site is not registered office or UKETS11402 proof",()=>{
  const q=extractHistoricalEprSite(epr);
  assert.match(q.regulatedFacilityAddress,/Fawley/);assert.doesNotMatch(q.regulatedFacilityAddress,/Leatherhead/);
  assert.equal(q.page,2);assert.equal(q.effectiveDate,"2019-03-04");assert.equal(q.certifiedCurrentAtFy2024,false);
  assert.equal(q.ukEts11402SiteQualified,false);assert.equal(q.mappedUkEtsPermitId,null);
  assert.equal(q.nativeCo2Tonnes,null);assert.equal(q.ukEtsGasMonitoringBoundaryQualified,false);
});

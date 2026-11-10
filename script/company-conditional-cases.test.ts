import assert from "node:assert/strict";
import test from "node:test";
import { calculateCcsOperatingChannel, ccsDeliveryAssumptions, issuerCaseDecisions, buildFplSolarCases, calculateFplSolarCohort, fplPublicCashBaseline } from "../server/calculation/companyConditionalCases";

function fixture() {
  return {
    sourceTextHash: "a".repeat(64), availableAt: "2026-11-10T03:50:00.323Z",
    knowledgeCutoff: "2026-11-10T04:00:00.000Z", firstYear: 2027,
    contractedAnnualTonnes: 9_000_000,
    members: ccsDeliveryAssumptions.map(m => ({ ...m, annualContractDeliveryFraction: [...m.annualContractDeliveryFraction] })),
  };
}
test("CCS operating throughput and monetary derivatives reconcile without fabricated pricing", () => {
  const result = calculateCcsOperatingChannel(fixture());
  const staged = result.members.find(m => m.id === "staged-execution")!;
  assert.deepEqual(staged.years.map(y => y.deliveredTonnes), [2_250_000, 4_500_000, 6_750_000, 9_000_000, 9_000_000]);
  assert.equal(staged.totalDeliveredTonnes, 31_500_000);
  assert.equal(result.members.find(m => m.id === "full-contract-delivery")!.totalDeliveredTonnes, 45_000_000);
  assert.equal(result.members.find(m => m.id === "policy-or-permit-failure")!.totalDeliveredTonnes, 0);
  for (const m of result.members) for (const y of m.years) {
    assert.equal(y.revenueSensitivityUsdPerUsdPerTonne, y.deliveredTonnes);
    assert.equal(y.variableCostSensitivityUsdPerUsdPerTonne, -y.deliveredTonnes);
  }
  assert.equal(result.issuerFcfe, null);
  assert.equal(result.issuerGrowth, null);
  assert.equal(result.avoidedEmissions, null);
  assert.equal(result.probabilityWeights, null);
  assert.equal(result.productionEligible, false);
});
test("canonical inputs are deterministic and sensitivity ordering has no meaning", () => {
  const a = fixture(), b = fixture();
  b.members.reverse();
  assert.deepEqual(calculateCcsOperatingChannel(a), calculateCcsOperatingChannel(b));
  b.members[0].annualContractDeliveryFraction[0] = 0.5;
  assert.notEqual(calculateCcsOperatingChannel(a).inputHash, calculateCcsOperatingChannel(b).inputHash);
});
test("refuses unsupported chronology, fractions, duplicates, nonfinite and incomplete inputs", () => {
  const x = fixture();
  assert.throws(() => calculateCcsOperatingChannel({ ...x, firstYear: 2026 }));
  assert.throws(() => calculateCcsOperatingChannel({ ...x, knowledgeCutoff: "2025-01-01T00:00:00.000Z" }));
  assert.throws(() => calculateCcsOperatingChannel({ ...x, contractedAnnualTonnes: Infinity }));
  assert.throws(() => calculateCcsOperatingChannel({ ...x, members: [x.members[0], x.members[0]] }));
  assert.throws(() => calculateCcsOperatingChannel({ ...x, approved: true }));
  x.members[0].annualContractDeliveryFraction[0] = 1.1;
  assert.throws(() => calculateCcsOperatingChannel(x));
  x.members[0].annualContractDeliveryFraction = [0, 0, 0, 0];
  assert.throws(() => calculateCcsOperatingChannel(x));
});
test("all requested issuers retain substantive mechanisms and exact blockers", () => {
  assert.deepEqual(issuerCaseDecisions.map(c => c.symbol), ["NEE", "XOM", "CAT"]);
  for (const decision of issuerCaseDecisions) {
    assert.ok(decision.missingInputs.length >= 5);
    assert.ok(decision.rejectedMappings.length >= 3);
  }
});

test("FPL solar cohort produces actual annual asset, funding and allowed-return arithmetic", () => {
  const result = buildFplSolarCases(), first = result.members[0];
  assert.equal(first.capex, 2_223_080_000);
  const b = fplPublicCashBaseline;
  assert.equal(b.currentAssetCashChange + b.currentLiabilityCashChange,
    result.baselineDiagnostics.currentOperatingAssetLiabilityCashContribution);
  assert.equal(b.operatingCashFlow - b.capitalExpenditure - b.nuclearFuelPurchases, -402e6);
  assert.equal(b.longTermDebtIssued - b.longTermDebtRetired + b.commercialPaperChange, 1_664e6);
  for (const y of first.years) {
    assert.ok(Math.abs(y.openingNetPlant - y.depreciation - y.closingNetPlant) < 1);
    assert.equal(y.allowedEquityEarnings, y.averageNetPlant * 0.596 * 0.1095);
    assert.ok(Math.abs(y.assumedNewDebtFunding + y.assumedNewEquityFunding - y.capitalSpend) < 1);
  }
  assert.ok(Math.abs(first.years[4].closingNetPlant - (first.capex - 5 * first.capex / 30)) < 1e-5);
  assert.equal(first.productionEligible, false);
  assert.ok(first.omittedCashInputs.includes("working capital"));
});
test("lag, admission and renewal assumptions alter solar outputs, not observed baseline", () => {
  const [timely, lag, noRenewal] = buildFplSolarCases().members;
  assert.equal(lag.years[0].allowedEquityEarnings, 0);
  assert.equal(lag.years[0].capitalSpend, timely.capex);
  assert.ok(Math.abs(lag.years[1].allowedEquityEarnings / timely.years[1].allowedEquityEarnings - 0.75) < 1e-12);
  assert.equal(noRenewal.years[3].allowedEquityEarnings, 0);
  assert.equal(noRenewal.years[4].depreciationRecoveryComponent, 0);
  assert.ok(noRenewal.years[4].depreciation > 0);
  assert.notEqual(lag.inputHash, timely.inputHash);
  assert.throws(() => calculateFplSolarCohort({ ...timely.inputs, admittedNetRateBaseFraction: 1.1 }));
  assert.throws(() => calculateFplSolarCohort({ ...timely.inputs, costUsdPerKw: Infinity }));
  assert.throws(() => calculateFplSolarCohort({ ...timely.inputs, bookLifeYears: 0 }));
});

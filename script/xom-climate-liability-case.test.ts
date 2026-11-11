import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { buildXomPermitClimateCash, integrateXomClimateCash, extractXomClimateEvidence,
  type XomClimateEvidence, type ClimateForwardAssumptions } from "../server/calculation/xomClimateLiabilityCase";
// Engineering-only numbers, no private primary files, observed issuer rows or network.
const evidence: XomClimateEvidence = {
  permits: [{ installationId: 1, permitId: "SYNTHETIC-1", operator: "Synthetic fixture", installationName: "Synthetic",
    regulator: "EA", jurisdiction: "England", regulatedActivity: "Engineering-only", period: 2024, reportedUnit: "tCO2e",
    recordedCoveredEmissions: 100, allocationEntitlement: 20, allocationDelivered: 20, allocationUnit: "UKA",
    votingOwnershipPercent: 100, ownershipBasis: "Direct or indirect voting securities; NOT a measured equity-emissions allocation",
    actualUncommittedBankUnits: null, nativeCo2Tonnes: null, corporateGhgScope: null, globalCoverageShare: null }],
  emissionsDefinition: "Synthetic unit fixture", subsidiaryAsOf: "2024-12-31",
  excludedChemicalPermit: { id: 2, reason: "Engineering fixture excluded" }, informationContext: "revised-history" };
const assumptions: ClimateForwardAssumptions = {
  disclosure: "conditional-forward-stress-not-observed", priceIncrementGbpPerUka: 10, forwardUsdPerGbp: 2,
  allocationFractionOf2024Delivered: 1, openingUncommittedBankUnits: { "SYNTHETIC-1": 0 },
  allowancesPerReportedTco2e: 1, passThroughFraction: .5, passThroughLagYears: 1,
  marginalCashTaxReliefFraction: 0, commonCashBurdenFraction: 1,
  cashTiming: "Purchases in emissions year; units earmarked for later surrender; surplus bank excludes earmarked obligation" };
const index = Array.from({ length: 16 }, (_, i) => ({ year: 2026 + i, nominalPriceIndex: 1.025 ** i }));
test("Synthetic workbook parser preserves rich-text tCO2e, exact permit/legal joins and voting-only ownership", async () => {
  const allocation = new ExcelJS.Workbook(), compliance = new ExcelJS.Workbook();
  const a = allocation.addWorksheet("Data"), e = compliance.addWorksheet("Data");
  a.addRow(["Account Holder Name", "Installation ID", "Installation Name", "Permit ID", "Regulator",
    "Regulated activity", "Allocation Entitlement_2024", "Allocation Delivered_2024"]);
  e.addRow(["Operator ID", "Permit ID or Monitoring plan ID", "Account Holder Name", "Regulator",
    "Account type", "Installation name", "Recorded emissions 2024"]);
  [1000118, 1000119].forEach((id, i) => {
    const permit = i === 0 ? "UK-E-IN-12019" : "UK-E-IN-11402", name = `Engineering fixture ${i}`;
    a.addRow(["Esso Petroleum Company Limited", id, name, permit, "EA", "Fixture activity", 20, 20]);
    e.addRow([id, permit, "Esso Petroleum Company Limited", "EA", "OPERATOR_HOLDING_ACCOUNT", name, 100 + i]);
  });
  const d = compliance.addWorksheet("Field Categorisation");
  d.getRow(3).values = ["Variable", "Description"];
  d.getCell("A4").value = "Recorded emissions [year]";
  d.getCell("B4").value = { richText: [{ text: "Indicates the verified emissions in " },
    { font: { bold: true }, text: "tonnes of carbon dioxide equivalent greenhouse gas emissions (tCO2e)" }] };
  const html = "<h1>ENGINEERING FIXTURE: Subsidiaries of the Registrant December 31, 2024</h1>" +
    "<p>Percentage of Voting Securities Owned Directly or Indirectly by Registrant</p>" +
    "<table><tr><td>Esso Petroleum Company Limited</td><td>100</td><td>United Kingdom</td></tr></table>";
  const parsed = await extractXomClimateEvidence(Buffer.from(await allocation.xlsx.writeBuffer()),
    Buffer.from(await compliance.xlsx.writeBuffer()), html);
  assert.equal(parsed.permits[1].recordedCoveredEmissions, 101);
  assert.equal(parsed.permits[0].reportedUnit, "tCO2e");
  assert.equal(parsed.permits[0].nativeCo2Tonnes, null);
  assert.equal(parsed.permits[0].corporateGhgScope, null);
  assert.equal(parsed.permits[0].votingOwnershipPercent, 100);
  assert.equal(parsed.permits[0].actualUncommittedBankUnits, null);
});
test("Exact units, geography and explicit unknown-bank boundary reject silent conversions/fallbacks", () => {
  assert.throws(() => buildXomPermitClimateCash({ ...evidence,
    permits: [{ ...evidence.permits[0], reportedUnit: "tCO2" as "tCO2e" }] }, index, assumptions), /unit/);
  assert.throws(() => buildXomPermitClimateCash(evidence, index,
    { ...assumptions, openingUncommittedBankUnits: {} }), /opening bank/);
  assert.throws(() => buildXomPermitClimateCash({ ...evidence, permits: [...evidence.permits, ...evidence.permits] },
    index, assumptions), /disjoint/);
});
test("Independent cash-increment and lagged pass-through accrual/AR bridge", () => {
  const built = buildXomPermitClimateCash(evidence, index, assumptions);
  let previousRecovery = 0;
  built.rows.forEach((r, i) => {
    const gross = (100 - 20) * 10 * 2 * 1.025 ** i;
    assert.ok(Math.abs(r.incrementalGrossCostUsd - gross) < 1e-9);
    assert.ok(Math.abs(r.incrementalOperatingCashUsd - (-gross + previousRecovery)) < 1e-9);
    assert.ok(Math.abs(r.incrementalOperatingProfitUsd - r.passReceivablesIncreaseUsd - r.incrementalOperatingCashUsd) < 1e-9);
    previousRecovery = gross * .5;
  });
  assert.equal(built.observedFxClaimed, false);
  assert.equal(built.sourceGlobalCoveredShare, null);
});
test("Bank-first settlement conserves units and never fabricates sales or infinite free terminal funding", () => {
  const partial = buildXomPermitClimateCash(evidence, index,
    { ...assumptions, openingUncommittedBankUnits: { "SYNTHETIC-1": 120 } });
  assert.equal(partial.rows[0].permits[0].purchasedUnits, 0);
  assert.equal(partial.rows[0].permits[0].closingUncommittedBankUnits, 40);
  assert.equal(partial.rows[1].permits[0].purchasedUnits, 40);
  assert.equal(partial.terminalDepletionUnpriced, false);
  const excessive = buildXomPermitClimateCash(evidence, index,
    { ...assumptions, openingUncommittedBankUnits: { "SYNTHETIC-1": 2000 } });
  assert.equal(excessive.terminalDepletionUnpriced, true);
  assert.throws(() => integrateXomClimateCash({}, excessive), /depletion/);
});
test("Independent funded operating rebuild, original stub and terminal dated PV", () => {
  const climate = buildXomPermitClimateCash(evidence, index, assumptions);
  const rows = index.map(({ year }, i) => ({
    year, cashFlowDate: `${year}-12-31`, operatingProfit: 10000 * 1.025 ** i, depreciation: 500,
    revenue: 20000 * 1.025 ** i, nonClimateRevenue: 20000 * 1.025 ** i, climateRevenue: 0,
    operatingProfitBeforeClimate: 10000 * 1.025 ** i, climateOperatingCost: 0,
    openingReceivables: 4000 * 1.025 ** i, closingReceivables: 4100 * 1.025 ** i,
    otherNonCash: 0, otherOperatingCash: 0, recognizedPolicyCredit: 0, cashPolicyCredit: 0,
    receivablesIncrease: 100, increaseOtherOperatingWorkingCapital: 50, interestPaid: 50, cashTax: 100,
    capitalSpend: 1000, debtProceeds: 100, debtRepayments: 100, nonCommonCashClaims: 0,
    fcfe: 10000 * 1.025 ** i - 800 }));
  // Ensure ALL original baseline flows are terminal-steady, not only revenue.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i], f = 1.025 ** i;
    for (const key of ["depreciation", "receivablesIncrease", "increaseOtherOperatingWorkingCapital", "interestPaid",
      "cashTax", "capitalSpend", "debtProceeds", "debtRepayments"] as const) r[key] *= f;
    r.fcfe = 9200 * f;
  }
  const baseline = { engineInput: { symbol: "XOM", currency: "USD", referenceDate: "2025-01-31",
    discountRate: .10, terminalGrowth: .025, stub: { cashFlows: [{ date: "2025-12-31", fcfe: 10 }] } },
    ledger: { years: rows.slice(0, 5), continuationYears: rows.slice(5, 15), terminalYear: rows[15] } };
  const result = integrateXomClimateCash(baseline, climate);
  const t = (y: number) => (Date.parse(`${y}-12-31`) - Date.parse("2025-01-31")) / (86400000 * 365.25);
  let expected = 10 / 1.1 ** t(2025);
  for (let i = 0; i < 16; i++) {
    const gross = 1600 * 1.025 ** i, cashPass = i === 0 ? 0 : 800 * 1.025 ** (i - 1);
    const manual = 9200 * 1.025 ** i - gross + cashPass;
    assert.ok(Math.abs(result.rows[i].fcfe - manual) < 1e-8);
    expected += i < 15 ? manual / 1.1 ** t(2026 + i) : manual / .075 / 1.1 ** t(2040);
  }
  assert.ok(Math.abs(result.forwardWholeEquity! - expected) < 1e-7);
  assert.equal(result.reverseScoringPerformed, false);
});
test("Future allocation loss and FX are labelled sensitivities, never observed price/banking facts", () => {
  const baseline = buildXomPermitClimateCash(evidence, index, { ...assumptions, passThroughFraction: 0 });
  const lost = buildXomPermitClimateCash(evidence, index,
    { ...assumptions, passThroughFraction: 0, allocationFractionOf2024Delivered: 0, forwardUsdPerGbp: 3 });
  assert.equal(lost.rows[0].incrementalOperatingCashUsd / baseline.rows[0].incrementalOperatingCashUsd, 100 / 80 * 3 / 2);
  assert.equal(lost.qualifiedOriginalIssuers, 0);
});

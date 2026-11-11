import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { unpackDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import { runWithIsolatedCompanyCarbonCache } from "../server/climateValuation/companyCarbonCache";
import { monetaryContext, type MonetaryContext } from "../server/financialData/workbookMoney";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { positivePE } from "../server/climateValuation/valuationStatistics";
import { computeMonthlyReturns, computeSignalScores, computeBenchmarkReturn, calculateLegacyBacktest as legacyBacktest } from "../server/climateValuation/backtestCalculator";
import { calculateBacktest as mountedBacktest } from "../server/climateValuation/walkForwardBacktest";
import { walkForward } from "../server/climateValuation/walkForward";
import { monthlyMoneyUnavailable, MonetaryUnavailableError } from "../server/financialData/workbookMoneyConsumers";
import { calculateTotalBasedCarbonPrice, computeGroupAggregates } from "../server/climateValuation/carbonPriceCalculator";
import { computeTercilesOnTheFly } from "../server/climateValuation/tercileCalculator";
import { calculateSDGGrowthDifferential } from "../server/climateValuation/sdgGrowthCalculator";
import { calculateDecarbBands } from "../server/climateValuation/decarbBandCalculator";
import { calculateDecarbTerciles } from "../server/climateValuation/decarbTercileCalculator";
import { readWorkbookMoneyAudit, buildWorkbookMoneyAuditWorkbook } from "../server/financialData/workbookMoneyExport";
import XLSX from "xlsx";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private retained-data audit only; no DB/provider writes or original-study reruns");
const dir = "generated-artifacts/workbook-money-consumers-v2";
const root = "generated-artifacts/workbook-money-audit-v1";
const inputPath = "generated-artifacts/overlay-replay/inputs-e392fe851d5120164358873540db9db7a852cc05b46659c43a1919ca641e82a8.json";
const json = (p: string) => JSON.parse(readFileSync(p, "utf8")), hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function main() {
  const previousFreezePath = `${root}/frozen-before-private-validation.json`, previous = json(previousFreezePath);
  const parentIntegrationPins: Record<string, string> = {
    "server/financialData/workbookMoneyExport.ts": "891b1a931e57943e797e529237e4fd062d46214c6fbc3e0b9c87b516e90aef2e",
    "server/workbookMoneyAuditApi.ts": "8a6c7d08abbc57402683012c200b8c27c440c78cdb423fca8ef3d16484bb48bc"
  };
  const parentIntegrationChanges: { path: string; old: string; current: string }[] = [];
  for (const p of [...previous.code, ...previous.source]) {
    const current = hash(p.path);
    if (current !== p.sha256 && parentIntegrationPins[p.path] === current)
      parentIntegrationChanges.push({ path: p.path, old: p.sha256, current });
    else assert.equal(current, p.sha256, "Earlier computational guard/source not retuned");
  }
  const priorAudit = json(`${root}/private-audit.json`), priorSummary = await readWorkbookMoneyAudit();
  assert.equal(hash(priorAudit.workbook), priorAudit.sourceId);
  const sourceHashBefore = hash(inputPath), source = json(inputPath), workbook = source.workbook;
  assert.equal(workbook.id, "271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac");
  const codePaths = ["server/financialData/workbookMoneyConsumers.ts", "server/calculation/companyCoverage.ts",
    "server/climateValuation/backtestCalculator.ts", "server/climateValuation/walkForward.ts",
    "server/climateValuation/walkForwardBacktest.ts", "server/climateValuation/valuationStatistics.ts",
    "script/fixtures/verifiedSyntheticMoney.ts", "script/workbook-money-consumers.test.ts"];
  const freezePath = `${dir}/frozen-before-full-private-audit.json`;
  if (!existsSync(freezePath)) writeFileSync(freezePath, JSON.stringify({
    version: "workbook-money-consumers-2", code: codePaths.map(path => ({ path, sha256: hash(path) })),
    source: [{ path: inputPath, sha256: sourceHashBefore }, { path: previousFreezePath, sha256: hash(previousFreezePath) },
      { path: `${root}/private-audit.json`, sha256: hash(`${root}/private-audit.json`) },
      ...parentIntegrationChanges.map(p => ({ path: p.path, sha256: p.current }))],
    parentIntegrationChanges,
    protocol: "Full actual retained 2442-company/470341-row workbook snapshot, not old protected valuation rerun. Current consumers only: raw native amounts/RI/zeros unchanged; no currency/magnitude/profile guesses; no authorized FX receipts. Unknown weights withhold entire backtest, not zero wealth/returns. Reported dimensionless positivePE preserved; rawMC/Profit fallback requires exact source qualification. No new future assumptions, score/grid, source publication backdating or approval."
  }, null, 2) + "\n", { flag: "wx" });
  const freeze = json(freezePath);
  for (const p of [...freeze.code, ...freeze.source]) assert.equal(hash(p.path), p.sha256);
  const actual = unpackDataset(workbook.id, workbook.chunks);
  assert.equal(actual.companies.length, 2442); assert.equal(actual.timeSeries.length, 470341);
  const nativeFingerprint = () => {
    const digest = createHash("sha256");
    for (const r of actual.timeSeries) digest.update(JSON.stringify([r.id, r.companyId, r.date.toISOString(),
      r.marketCap, r.netProfit, r.priceEarnings, r.totalReturnIndex]) + "\n");
    return digest.digest("hex");
  };
  const beforeNativeFingerprint = nativeFingerprint();
  let reportedPositivePeCount = 0, withheldRawFallbackCount = 0, rawProfitZeros = 0, lastDate = "";
  const byCompany = new Map<number, typeof actual.timeSeries>();
  for (const row of actual.timeSeries) {
    const date = row.date.toISOString().slice(0, 10); if (date > lastDate) lastDate = date;
    const series = byCompany.get(row.companyId) ?? []; series.push(row); byCompany.set(row.companyId, series);
    if (row.netProfit === 0) rawProfitZeros++;
    if (row.priceEarnings !== null && Number.isFinite(row.priceEarnings) && row.priceEarnings > 0) {
      assert.equal(positivePE(row), row.priceEarnings); reportedPositivePeCount++;
    } else if (row.marketCap !== null && row.marketCap > 0 && row.netProfit !== null && row.netProfit > 0) {
      assert.equal(positivePE(row), null); withheldRawFallbackCount++;
    }
  }
  assert.ok(reportedPositivePeCount > 0); assert.ok(withheldRawFallbackCount > 0);
  const observations = actual.timeSeries.filter(r => r.date.toISOString().startsWith(lastDate));
  const c = companyCoverage({ companies: actual.companies, observations, reviews: [], observationDate: lastDate,
    informationCutoff: priorAudit.capturedAt, sourceId: workbook.id });
  const validNativeCount = observations.filter(r => typeof r.marketCap === "number" && Number.isFinite(r.marketCap) && r.marketCap > 0).length;
  assert.ok(validNativeCount > 0); assert.equal(c.fullWorkbook.metrics.marketCap.availableCount, validNativeCount);
  assert.equal(c.fullWorkbook.metrics.marketCap.states.present, validNativeCount);
  assert.equal(c.fullWorkbook.metrics.marketCap.knownTotal, null);
  assert.equal(c.fullWorkbook.metrics.marketCap.operatingGeography.knownValue, null);
  assert.equal(c.eligibleKnownValueCoverage.marketCap, null);
  const currentIdentityContext: MonetaryContext = { cutoff: priorAudit.capturedAt, targetCurrency: "USD", cells: [], fx: [],
    identities: priorAudit.journal.exactAccepted.map((r: any) => ({ companyId: r.payload.identity.companyId, isin: r.payload.identity.isin,
      reviewId: r.id, status: "approved", reviewedAt: new Date(r.reviewed_at).toISOString() })) };
  const accepted = actual.timeSeries.find(r => currentIdentityContext.identities.some(i => i.companyId === r.companyId) &&
    r.marketCap !== null && r.marketCap > 0 && r.netProfit !== null && r.netProfit > 0)!;
  assert.ok(accepted);
  monetaryContext.run(currentIdentityContext, () => {
    assert.equal(positivePE({ ...accepted, priceEarnings: null }), null);
    assert.equal(computeGroupAggregates([accepted], false, false, 0).totalMarketCap, null);
  });
  const monthly = computeMonthlyReturns(byCompany); assert.equal(monthly.size, 0); assert.ok(monthlyMoneyUnavailable(monthly));
  assert.throws(() => walkForward(monthly, new Map(), .02), MonetaryUnavailableError);
  assert.equal(computeSignalScores(actual.companies, "carbon_intensity", byCompany).size, 0);
  const firstNative = observations.find(r => r.marketCap !== null && r.marketCap > 0)!;
  assert.throws(() => computeBenchmarkReturn([{ companyId: firstNative.companyId, monthKey: "2026-01", marketCap: firstNative.marketCap!, monthlyReturn: 0 }]), MonetaryUnavailableError);
  process.env.NODE_ENV = "test";
  const consumers: Record<string, number> = {}, backtests: any[] = [];
  await runWithIsolatedCompanyCarbonCache({ get: async () => undefined, putIfAbsent: async () => {} }, () => {},
    () => runWithReplayWorkbook(workbook, () => snapshotContext.run({ id: workbook.id,
      companyCount: 2442, observationCount: 470341 } as SnapshotHeader, async () => {
        consumers.carbonPrice = (await calculateTotalBasedCarbonPrice(0, "absolute", false, false, 0)).length;
        consumers.peTerciles = (await computeTercilesOnTheFly("absolute", false)).length;
        consumers.sdgGrowth = (await calculateSDGGrowthDifferential()).length;
        consumers.targetBands = (await calculateDecarbBands()).length;
        consumers.targetTerciles = (await calculateDecarbTerciles("absolute")).length;
        backtests.push(await legacyBacktest("carbon_intensity", 2));
        backtests.push(await mountedBacktest("carbon_intensity", 2));
      })));
  for (const count of Object.values(consumers)) assert.equal(count, 0);
  for (const b of backtests) {
    assert.deepEqual(b.series, []); assert.equal(b.summary.realizedTrackingErrorPct, null); assert.equal(b.summary.tiltScale, null);
    assert.match(b.summary.warnings.join(" "), /monetary weights unconverted/);
  }
  const bytes = buildWorkbookMoneyAuditWorkbook(priorSummary), book = XLSX.read(bytes, { type: "buffer" });
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets["Safe source counts"]), priorSummary.sheets);
  assert.equal(hash(inputPath), sourceHashBefore); assert.equal(hash(priorAudit.workbook), priorAudit.sourceId);
  assert.equal(nativeFingerprint(), beforeNativeFingerprint, "All actual in-memory native money, reported P/E, dates and RI unchanged");
  const receipt = { version: "workbook-money-consumers-2", passed: true, actualWorkbookCompanyCount: 2442, actualWorkbookObservationCount: 470341,
    currentNativeSourceDate: lastDate, currentRawCapitalisationAvailableCount: validNativeCount, currentRawCapitalisationStatesPreserved: true,
    coverageKnownCapitalisationTotal: null, coverageCapitalisationWeightedShares: null, priorWorksheetProfitTrueZerosPreserved: 16,
    priorWorksheetSameMonthCrossDatePairsPreserved: 192, retainedSnapshotRawProfitZeroCount: rawProfitZeros,
    independentReportedPositivePePreservedCount: reportedPositivePeCount, unqualifiedNativeRatioFallbackWithheldCount: withheldRawFallbackCount,
    actualCurrentApprovedIdentityCount: currentIdentityContext.identities.length, sourceQualifiedMoneyConversions: 0, authorizedDatedFx: 0,
    currentAcceptedIdentityWithoutCellCurrencyStillWithheld: true, nominalTotalConsumers: consumers,
    actualLegacyAndMountedBacktestsWithheld: 2, directWalkAndBenchmarkRefuseUnknownRatherThanReturnZero: true,
    actualNativeAmountsAndRawInputBytesUnchanged: true, actualNativeInMemoryMoneyAndRiFingerprintUnchanged: true,
    priorSafeXlsxBinaryReadbackPassed: true, originalComputationalAuditGuardUnchanged: true,
    parentOnlyApiExportIntegrationChanges: parentIntegrationChanges,
    futureEconomicAssumptions: 0, protectedScientificValuationOr14BundlesRerun: false, original14BundlePinsChanged: false,
    approvalProviderPurchaseDbMutationCalls: 0, pendingReviewOnly: true,
    inputFileSha256: sourceHashBefore, workbookSnapshotId: workbook.id, newFreezeSha256: hash(freezePath) };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });

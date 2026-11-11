import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { unpackDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import { monetaryContext } from "../server/financialData/workbookMoney";
import { computeMonthlyReturns, calculateLegacyBacktest } from "../server/climateValuation/backtestCalculator";
import { calculateBacktest } from "../server/climateValuation/walkForwardBacktest";
import { walkForward } from "../server/climateValuation/walkForward";
import { MonetaryUnavailableError, monthlyMoneyUnavailable } from "../server/financialData/workbookMoneyConsumers";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { positivePE } from "../server/climateValuation/valuationStatistics";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Private retained-source consumer validation only; no provider/DB writes");
const dir = "generated-artifacts/workbook-money-consumers-v3", previousDir = "generated-artifacts/workbook-money-consumers-v2";
const inputPath = "generated-artifacts/overlay-replay/inputs-e392fe851d5120164358873540db9db7a852cc05b46659c43a1919ca641e82a8.json";
const json = (p: string) => JSON.parse(readFileSync(p, "utf8")), hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function main() {
  const oldFreeze = json(`${previousDir}/frozen-before-full-private-audit.json`);
  const archived = json(`${previousDir}/immutable-consumer-source-archive.json`);
  assert.equal(archived.files.length, oldFreeze.code.length);
  for (const file of archived.files) {
    assert.equal(createHash("sha256").update(file.contents).digest("hex"), file.sha256);
    assert.equal(oldFreeze.code.find((p: any) => p.path === file.path)?.sha256, file.sha256);
    if (file.path !== "server/climateValuation/walkForward.ts") assert.equal(hash(file.path), file.sha256);
  }
  assert.equal(hash(`${previousDir}/mandatory-private-receipt.json`), "c8f220d39af60fbcded75986afda733b740f1506b218aaff38c15d73c52337b8");
  for (const file of oldFreeze.source) assert.equal(hash(file.path), file.sha256);
  const originalGuards = json("generated-artifacts/workbook-money-audit-v1/frozen-before-private-validation.json");
  for (const file of originalGuards.code)
    if (!["server/financialData/workbookMoneyExport.ts", "server/workbookMoneyAuditApi.ts"].includes(file.path))
      assert.equal(hash(file.path), file.sha256, "Original nominal consumer/monetary qualification guards retained");
  const priorAudit = json("generated-artifacts/workbook-money-audit-v1/private-audit.json");
  assert.equal(hash(priorAudit.workbook), priorAudit.sourceId);
  const code = ["server/climateValuation/walkForward.ts", "server/calculation/pairedResearchPipeline.ts",
    "server/financialData/workbookMoneyConsumers.ts", "script/company-carbon-cache.test.ts",
    "script/next-valuation-evidence.test.ts", "script/paired-research-pipeline.test.ts", "script/track-b-admission.test.ts",
    "script/walk-forward-weight-contract.test.ts", "script/validate-workbook-money-integration-private.ts"];
  const sources = [inputPath, `${previousDir}/frozen-before-full-private-audit.json`,
    `${previousDir}/immutable-consumer-source-archive.json`, `${previousDir}/mandatory-private-receipt.json`, priorAudit.workbook];
  const freezePath = `${dir}/frozen-before-private-integration.json`;
  if (!existsSync(freezePath)) writeFileSync(freezePath, JSON.stringify({
    version: "workbook-money-integration-3", code: code.map(path => ({ path, sha256: hash(path) })),
    source: sources.map(path => ({ path, sha256: hash(path) })),
    contract: "Monetary walkForward remains source-qualified. A separate constructor accepts only companyId/sector/dimensionless returns and derives equal-sector fractions, with no marketCap or supplied numeric weight. Research requires an explicit frozen longOnlyKernelWeighting; absent choice preserves guarded cap weighting and reports its unavailability without aborting independent endpoints. Constraint variants remain separately source-cap guarded. No currency proof synthesized from a protocol currency or strategy choice. Prior unit2 code/results archived unchanged."
  }, null, 2) + "\n", { flag: "wx" });
  for (const file of [...json(freezePath).code, ...json(freezePath).source]) assert.equal(hash(file.path), file.sha256);
  const input = json(inputPath), actual = unpackDataset(input.workbook.id, input.workbook.chunks);
  const fingerprint = () => {
    const digest = createHash("sha256");
    for (const r of actual.timeSeries) digest.update(JSON.stringify([r.id, r.companyId, r.date.toISOString(),
      r.marketCap, r.netProfit, r.priceEarnings, r.totalReturnIndex]) + "\n");
    return digest.digest("hex");
  };
  const before = fingerprint(), sourceHash = hash(inputPath);
  assert.equal(actual.companies.length, 2442); assert.equal(actual.timeSeries.length, 470341);
  const grouped = new Map<number, typeof actual.timeSeries>();
  let reportedPe = 0, withheldRatios = 0, zeros = 0, latest = "";
  for (const r of actual.timeSeries) {
    const rows = grouped.get(r.companyId) ?? []; rows.push(r); grouped.set(r.companyId, rows);
    const day = r.date.toISOString().slice(0, 10); if (day > latest) latest = day;
    if (r.netProfit === 0) zeros++;
    if (r.priceEarnings !== null && Number.isFinite(r.priceEarnings) && r.priceEarnings > 0) {
      assert.equal(positivePE(r), r.priceEarnings); reportedPe++;
    } else if (r.marketCap !== null && r.marketCap > 0 && r.netProfit !== null && r.netProfit > 0) {
      assert.equal(positivePE(r), null); withheldRatios++;
    }
  }
  assert.equal(reportedPe, 390215); assert.equal(withheldRatios, 1255); assert.equal(zeros, 16);
  const current = actual.timeSeries.filter(r => r.date.toISOString().startsWith(latest));
  const coverage = companyCoverage({ companies: actual.companies, observations: current, reviews: [],
    observationDate: latest, informationCutoff: priorAudit.capturedAt, sourceId: input.workbook.id });
  assert.equal(coverage.fullWorkbook.metrics.marketCap.availableCount, 2437);
  assert.equal(coverage.fullWorkbook.metrics.marketCap.knownTotal, null);
  const monthly = computeMonthlyReturns(grouped);
  assert.equal(monthly.size, 0); assert.ok(monthlyMoneyUnavailable(monthly));
  assert.throws(() => walkForward(monthly, new Map(), .02), MonetaryUnavailableError);
  // Independent nonempty actual-source refusal. Returns come from consecutive
  // retained RI observations, never invented zero returns or USD assumptions.
  const sample = Array.from(grouped.values()).map(rows => rows.filter(r => r.marketCap !== null && r.marketCap > 0 &&
    r.totalReturnIndex !== null && r.totalReturnIndex > 0).sort((a, b) => +a.date - +b.date)).find(rows => rows.length >= 2)!;
  const [previous, next] = sample;
  assert.throws(() => walkForward(new Map([[next.date.toISOString().slice(0, 7), [{
    companyId: previous.companyId, marketCap: previous.marketCap!, monthlyReturn: next.totalReturnIndex! / previous.totalReturnIndex! - 1,
  }]]]), new Map(), .02), MonetaryUnavailableError);
  const approved = priorAudit.journal.exactAccepted.map((r: any) => ({ companyId: r.payload.identity.companyId,
    isin: r.payload.identity.isin, reviewId: r.id, status: "approved" as const, reviewedAt: new Date(r.reviewed_at).toISOString() }));
  assert.equal(approved.length, 1);
  const approvedSample = actual.timeSeries.find(r => approved.some((i: any) => i.companyId === r.companyId) &&
    r.marketCap !== null && r.marketCap > 0 && r.netProfit !== null && r.netProfit > 0)!;
  monetaryContext.run({ cutoff: priorAudit.capturedAt, targetCurrency: "USD", identities: approved, cells: [], fx: [] },
    () => assert.equal(positivePE({ ...approvedSample, priceEarnings: null }), null));
  const responses = await runWithReplayWorkbook(input.workbook, () => snapshotContext.run({
    id: input.workbook.id, companyCount: 2442, observationCount: 470341 } as SnapshotHeader,
  async () => [await calculateLegacyBacktest("carbon_intensity", 2), await calculateBacktest("carbon_intensity", 2)]));
  for (const result of responses) {
    assert.deepEqual(result.series, []); assert.equal(result.summary.realizedTrackingErrorPct, null);
    assert.equal(result.summary.tiltScale, null); assert.match(result.summary.warnings.join(" "), /monetary weights unconverted/);
  }
  assert.equal(fingerprint(), before); assert.equal(hash(inputPath), sourceHash);
  for (const file of [...json(freezePath).code, ...json(freezePath).source]) assert.equal(hash(file.path), file.sha256);
  const receipt = { version: "workbook-money-integration-3", passed: true, actualCompanies: 2442, actualRows: 470341,
    currentRawCapitalisationAvailableCount: 2437, capitalisationTotal: null, capitalisationWeightedShares: null,
    reportedDimensionlessPositivePePreserved: reportedPe, unsupportedNativeFallbacksWithheld: withheldRatios, rawProfitZerosPreserved: zeros,
    approvedIdentityWithoutMoneyMetadataStillWithheld: true, authorizedDatedFx: 0, qualifiedMoneyConversions: 0,
    legacyAndMountedSourceCapBacktestsUnavailable: 2, independentNonemptyActualRiCapInputRejected: true,
    actualNativeMoneyRiDatesReportedPeFingerprintAndPrivateBytesUnchanged: true,
    previousUnit2SourceArchiveAndResultUnchanged: true, priorFiveNominalConsumerGuardSourcesAndEvidenceRetainedWithoutRerun: true,
    sourceCapIsNotDimensionlessStrategy: true, protected14PinsCanonicalLedgersOrProviderDbWritesChanged: false,
    pendingReviewOnly: true, originalIssuerQualification: "0/3 unchanged", freezeSha256: hash(freezePath) };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });

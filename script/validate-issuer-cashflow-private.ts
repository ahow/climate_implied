import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contentHash } from "../server/calculation/analysisManifest";
import { pairSourcedCompanyCase } from "../server/calculation/companyCaseEvidence";
import { authenticatePrimaryIssuerCashflow } from "../server/calculation/issuerCashflowCase";

if (process.env.NODE_ENV === "production") throw new Error("Private evidence validation only");
const root = "generated-artifacts/company-operating-corpus/issuer-cashflow-v1";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const latest = read(`${root}/latest.json`), report = read(latest.reportPath), freeze = read(latest.freezePath);
assert.equal(sha(readFileSync(latest.freezePath)), report.freezeHash);
assert.ok(Date.parse(report.frozenAt) <= Date.parse(report.calculatedAt));
assert.equal(report.results.length, 6);
assert.equal(report.blockedSources.length, 0);
for (const [path, expected] of Object.entries(freeze.modelCode))
  assert.equal(sha(readFileSync(path)), expected, `Current experimental code must match its new freeze: ${path}`);
for (const path of ["reportPath", "freezePath"])
  assert.equal(sha(readFileSync(report.preserved[path])), report.preserved[path === "reportPath" ? "reportHash" : "freezeHash"]);
assert.equal(report.preserved.schedules, 10);
assert.equal(report.preserved.annualRows, 50);
assert.equal(report.preserved.pinnedCodeAssertions.length, 3);
for (const source of report.preserved.pinnedCodeAssertions)
  assert.equal(sha(readFileSync(source.path)), source.sha256);
for (const p of freeze.preparations) {
  assert.equal(sha(readFileSync(p.receipt.path)), p.receipt.sha256);
  assert.equal(p.facts.fiscalEnd, "2024-12-31");
  assert.equal(p.sourceAuthentication.successorJoined, false);
  const primary = authenticatePrimaryIssuerCashflow(readFileSync(p.receipt.path, "utf8"), p.facts);
  assert.equal(primary.annual("us-gaap:NetCashProvidedByUsedInOperatingActivities"), p.facts.operatingCashFlow);
  assert.equal(primary.read("dei:EntityCommonStockSharesOutstanding",
    { annual: false, expected: p.market.shares }).value, p.market.shares);
  assert.equal(p.market.sharesDate, p.market.priceDate);
  assert.equal(p.market.priceDate, p.market.referenceDate);
}
for (const r of report.results) {
  const frozenScenario = freeze.preparations.flatMap((p: any) => p.scenarios).find((s: any) => s.id === r.id);
  assert.equal(contentHash(r.scenario), contentHash(frozenScenario));
  assert.equal(r.ledger.years.length, 5);
  assert.equal(r.ledger.continuationYears.length, 10);
  assert.ok(r.ledger.terminalYear);
  assert.equal(r.ledger.specification.baseFcfe, r.scenario.observation.historicalBaseFcfe);
  assert.equal(r.ledger.specification.informationContext.mode, "revised-history-conditional");
  assert.ok(r.scenario.observation.availableAt.slice(0, 10) > r.ledger.specification.referenceDate);
  const contractPath = latest.reportPath.replace(/report\.json$/, `${r.id}-contract.json`);
  const replay = pairSourcedCompanyCase(read(contractPath));
  assert.deepEqual(replay.assessment.gaps, r.assessmentGaps);
  if (r.symbol === "FSLR") {
    assert.equal(replay.assessment.status, "dependency-ready-conditional-case");
    assert.equal(replay.pairing?.pairing, "conditional-same-basis-whole-equity");
    assert.ok(replay.pairing && "relativeRepricingError" in replay.pairing &&
      replay.pairing.relativeRepricingError < 1e-8);
    assert.equal(replay.assessment.identityApproved, false);
    assert.equal(replay.assessment.productionEligible, false);
    assert.equal(r.ledger.terminalYear.recognizedPolicyCredit, 0);
    assert.equal(r.ledger.terminalYear.cashPolicyCredit, 0);
  } else {
    assert.equal(replay.assessment.status, "blocked");
    assert.equal(replay.pairing, null);
    assert.equal(r.forward, null);
  }
}
assert.equal(report.actualMarketPairs, 2);
assert.deepEqual(report.uniquePairedIssuers, ["FSLR"]);
assert.equal(report.completeApprovedIssuerCases, 0);
console.log(JSON.stringify({ status: "passed", selectedFy2024Issuers: 3, primarySecAuthentications: 3,
  exactDatePriceShareMatches: 3, distinctHistoricalQuoteDates: 2, revisedHistoryCases: 6,
  fullAnnualRows: 30, continuationOperatingRows: 60, terminalOperatingRows: 6, explicitStubs: 6,
  actualSameBasisConditionalPairs: 2, distinctPairedIssuers: 1, blockedIssuerCases: 4,
  unchangedRetainedFslrCases: 10, unchangedRetainedFslrRows: 50, pinnedCodeAssertions: 3,
  completeApprovedIssuerCases: 0, historicalPointInTimeClaims: 0, prospectiveSignalClaims: 0 }));

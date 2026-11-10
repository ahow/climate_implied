/** Explicit local-only validation: required private evidence must exist; never a CI test. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildCompanyFilingPair } from "../server/calculation/companyFilingPair";
import { contentHash } from "../server/calculation/analysisManifest";
import { calculateFslrFrozenFullCashflow } from "../server/calculation/fslrFullCashflowCase";

const root = "generated-artifacts/company-operating-corpus/primary-filings";
const report = JSON.parse(readFileSync(`${root}/readiness-report.json`, "utf8"));
assert.equal(report.cases.length, 3);
assert.equal(report.executedWholeEquityPairs, 0);
for (const c of report.cases) {
  const digest = createHash("sha256").update(readFileSync(`${root}/${c.facts.symbol}-2024.pdf`)).digest("hex");
  assert.equal(digest, c.facts.sourceHash);
  assert.equal(buildCompanyFilingPair(c.facts).status, "blocked");
  assert.equal(c.bridge.workingCapitalDeductedAgain, false);
  assert.equal(c.bridge.manufacturingCreditsAddedAgain, false);
}
assert.deepEqual(report.cases.map((c: any) => c.baseFcfe), [-255437000, 169000000, 25722000000]);
const attempt = JSON.parse(readFileSync(`${root}/market-reference-attempt.json`, "utf8"));
assert.equal(attempt.attempts.length, 3);
assert.equal(attempt.maximumRequests, 9);
assert.equal(attempt.executedActualPairs, 0);
assert.equal(attempt.unchangedAssumptions, true);
for (const c of attempt.attempts) {
  assert.equal(c.requests.length, 3);
  assert.equal(c.executedActualPairs, 0);
  for (const r of c.requests) {
    assert.ok(["/stable/profile", "/stable/quote", "/stable/balance-sheet-statement"].includes(r.endpoint));
    assert.ok(!JSON.stringify(r).includes("apikey"));
    if (r.retainedFieldsHash) assert.equal(r.retainedFieldsHash,
      createHash("sha256").update(JSON.stringify(r.selectedRows)).digest("hex"));
  }
}
assert.equal(attempt.attempts.flatMap((c: any) => c.requests).filter((r: any) => r.status === "success").length, 9);
assert.equal(attempt.attempts.filter((c: any) => c.quoteDate).length, 3);
const shares = JSON.parse(readFileSync(`${root}/share-review/report.json`, "utf8"));
assert.equal(shares.observations.length, 4);
assert.equal(shares.checks.filter((c: any) => c.status === "blocked").length, 4);
assert.equal(shares.matchedQuoteShareReferences, 0);
assert.equal(shares.actualWholeEquityPairs, 0);
assert.equal(shares.completeIssuerCases, 0);
assert.equal(shares.succession.effectiveDate, "2026-07-01");
assert.equal(shares.succession.identityApproved, false);
assert.equal(shares.succession.automaticTickerJoin, false);
assert.equal(shares.succession.successor.cik, "0002115436");
for (const r of shares.receipts) {
  assert.equal(createHash("sha256").update(readFileSync(r.path)).digest("hex"), r.sha256);
}
const q3 = readFileSync(`${root}/share-review/XOM-2026Q3.txt`, "utf8");
assert.ok(q3.includes("4,079,222,444"));
assert.ok(q3.includes("each outstanding share of EMC common stock"));
assert.ok(q3.includes("became the successor registrant"));
assert.equal(shares.observations[3].evidence.sha256, shares.receipts[1].sha256);
assert.ok(shares.observations[3].evidence.capturedAt.startsWith("2026-11-10"));
const fslrRoot = "generated-artifacts/company-operating-corpus/fslr-full-cashflow";
const latest = JSON.parse(readFileSync(`${fslrRoot}/latest.json`, "utf8"));
const full = JSON.parse(readFileSync(latest.reportPath, "utf8"));
const frozenBytes = readFileSync(latest.freezePath);
const frozen = JSON.parse(frozenBytes.toString("utf8"));
assert.equal(createHash("sha256").update(frozenBytes).digest("hex"), full.freezeReceipt.sha256);
assert.equal(contentHash(frozen), full.frozenAssumptionHash);
assert.equal(full.freezeReceipt.persistedBeforeCalculation, true);
assert.ok(full.freezeReceipt.frozenAt <= full.calculatedAt);
assert.deepEqual(frozen.scenarios, full.cases.map((c: any) => c.assumptions));
for (const source of full.freezeReceipt.codeSources)
  assert.equal(createHash("sha256").update(readFileSync(source.path)).digest("hex"), source.sha256);
assert.equal(createHash("sha256").update(readFileSync(full.policySource.pdf)).digest("hex"), full.policySource.sha256);
assert.equal(contentHash(readFileSync(full.source.path, "utf8")), full.source.sourceHash);
const rebuilt = calculateFslrFrozenFullCashflow(frozen);
assert.deepEqual(rebuilt.cases, full.cases);
assert.equal(full.cashSchedulesExecuted, 10);
assert.equal(full.annualRowsExecuted, 50);
assert.equal(full.actualMarketPairs, 0);
assert.equal(full.completeApprovedIssuerCases, 0);
assert.equal(full.terminalValue, null);
assert.deepEqual(full.cases[0].diagnostics.map((d: any) => d.statutoryCreditPhaseDown), [1, 1, 1, .75, .5]);
assert.ok(full.cases[1].ledger.years[0].fcfe < 0);
assert.ok(full.cases[1].ledger.years[4].fcfe < 0);
for (const c of full.cases) for (const r of c.reconciliations) assert.ok(Math.abs(r.residual) <= 1e-5);
console.log("Private validation passed: three filing hashes, nine successful FMP calls/three dated quotes, four primary share observations, review-only XOM succession, frozen primary-input FSLR schedules (10 scenarios/50 annual rows) with statutory phase-down; actual pairs and complete cases remain zero.");

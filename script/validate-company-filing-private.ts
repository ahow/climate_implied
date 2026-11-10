/** Explicit local-only validation: required private evidence must exist; never a CI test. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildCompanyFilingPair } from "../server/calculation/companyFilingPair";

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
console.log("Private validation passed: three actual filing hashes/accounting refusals and nine bounded provider receipts; actual pairs remain zero.");

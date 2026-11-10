import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
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
// Synthetic market fixture tests algebra/guards only, never saved as a real observation.
const facts = { ...report.cases[2].facts, accountingCaveats: [] };
const market = {
  symbol: facts.symbol, cik: facts.cik, security: facts.security, currency: "USD",
  referenceDate: "2025-03-01", priceDate: "2025-03-01", sharesDate: "2025-03-01",
  price: 100, shares: 4e9, sourceUrl: "https://example.invalid/test-only",
  sourceHash: "a".repeat(64), observedAt: "2025-03-02T00:00:00.000Z",
  usageAuthorization: "Synthetic algebra unit test only",
  sharesBasis: "total-common-outstanding-not-diluted-or-float",
};
const pair = buildCompanyFilingPair(facts, market);
assert.equal(pair.status, "executed-diagnostic-only");
assert.equal(pair.pairs.length, 9);
for (const p of pair.pairs) {
  assert.equal(p.implied.status, "conditional-solution");
  assert.ok(p.repricingError !== null && p.repricingError < 1e-8);
}
assert.throws(() => buildCompanyFilingPair(facts, { ...market, sharesDate: "2025-02-28" }), /reference date/);
assert.throws(() => buildCompanyFilingPair(facts, { ...market, cik: "0000000000" }), /identity/);
assert.equal(buildCompanyFilingPair(report.cases[2].facts, market).status, "blocked");
assert.equal(buildCompanyFilingPair({ ...facts, operatingCashFlow: 1 }, market).status, "blocked");
console.log("Company filing integrity, missing-link gates and nine synthetic paired repricings passed; actual executed pairs remain zero.");
if (existsSync(`${root}/market-reference-attempt.json`)) {
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
  console.log("Bounded authorized-provider attempt report gates passed.");
}

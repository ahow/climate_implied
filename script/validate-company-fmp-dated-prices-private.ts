import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { primaryDatedQuoteTargets, inspectFmpDatedUnadjustedRows, publicSourceReceipt } from "./company-dated-market-source-contract";

if (process.env.NODE_ENV === "production") throw new Error("Private source validation only");
const root = "generated-artifacts/company-operating-corpus/dated-market-sources";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const report = read(`${root}/fmp-dated-price-attempt.json`);
assert.equal(report.endpoint, "historical-price-eod/non-split-adjusted");
assert.equal(report.requests, 3);
assert.equal(report.retries, 0);
assert.equal(report.stoppedOn403, false);
assert.equal(report.documentation.sha256, sha(report.documentation.path));
const shareReport = read("generated-artifacts/company-operating-corpus/primary-filings/share-review/report.json");
const targets = primaryDatedQuoteTargets(shareReport.observations).filter(t => t.symbol !== "XOM" || t.cik === "0000034088");
assert.equal(report.receipts.length, 3);
assert.equal(report.candidates.length, 3);
for (let i = 0; i < 3; i++) {
  const r = report.receipts[i], t = targets[i];
  assert.equal(r.httpStatus, 200);
  assert.deepEqual(r.params, { symbol: t.symbol, from: t.quoteDateRequired, to: t.quoteDateRequired });
  assert.equal(r.sha256, sha(r.path));
  assert.equal(r.primarySharesSourceHash, t.shareSourceHash);
  assert.equal(t.shareSourceHash, sha(`generated-artifacts/company-operating-corpus/primary-filings/${t.symbol}-2024.pdf`));
  const candidate = inspectFmpDatedUnadjustedRows(read(r.path), t);
  assert.deepEqual(report.candidates[i], candidate);
  assert.equal(candidate.status, "same-date-price-primary-shares-candidate");
  assert.equal(candidate.currency, null);
  assert.equal(candidate.identityApproved, false);
}
assert.equal(report.actualValuationPairs, 0);
assert.equal(report.newAssumptionsFrozen, false);
assert.deepEqual(read(`${root}/fmp-public-receipts.json`), report.receipts.map(publicSourceReceipt));
console.log("Actual FMP source validation passed: 3/3 granted HTTP200, exact primary share dates, literal adjClose fields, retained raw hashes and original primary CIK/class sources. Missing response currency/units/CIK/class explicitly retained; no valuation/approval.");

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { primaryDatedQuoteTargets, publicSourceReceipt } from "./company-dated-market-source-contract";

if (process.env.NODE_ENV === "production") throw new Error("Private retained-source validation only");
const root = "generated-artifacts/company-operating-corpus/dated-market-sources";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const report = read(`${root}/discovery-report.json`);
const shares = read("generated-artifacts/company-operating-corpus/primary-filings/share-review/report.json");
assert.deepEqual(report.primaryShareDates, primaryDatedQuoteTargets(shares.observations));
assert.deepEqual(report.primaryShareDates.map((t: any) => [t.symbol, t.cik, t.quoteDateRequired]), [
  ["FSLR", "0001274494", "2025-02-21"], ["NEE", "0000753308", "2025-01-31"],
  ["XOM", "0000034088", "2025-01-31"], ["XOM", "0002115436", "2026-09-30"],
]);
for (const receipt of report.receipts) if (receipt.path && existsSync(receipt.path))
  assert.equal(createHash("sha256").update(readFileSync(receipt.path)).digest("hex"), receipt.sha256);
const find = (id: string) => report.receipts.find((r: any) => r.id === id);
assert.equal(find("NEE-issuer-historical").httpStatus, 200);
assert.equal(find("XOM-issuer-historical").httpStatus, 200);
assert.equal(find("XOM-public-tool-access").httpStatus, 403);
assert.equal(find("XOM-primary-date-quote"), undefined, "403 stopped before historical data");
assert.equal(find("NEE-public-session").status, "transport-error");
assert.equal(find("NEE-primary-date-quote"), undefined, "No session/token, no dated data request");
assert.equal(report.fmpRequests, 0, "FMP historical access was not tested, not described as denied");
assert.equal(report.exactDateQuoteShareCandidates, 0);
assert.equal(report.valuationRuns, 0);
assert.deepEqual(read(`${root}/public-receipts.json`), report.receipts.map(publicSourceReceipt));
console.log("Actual retained-source validation passed: four exact-date primary share targets, distinct XOM CIK/classes, byte hashes, issuer-page access versus denied/unobserved historical-data access, stop-on-403 and sanitized public receipts. No FMP requests or valuation runs.");

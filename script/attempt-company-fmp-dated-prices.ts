/** Authorized bounded source attempt only: at most three fixed daily requests,
 * no retries, stop on403, no new valuation assumptions or calculations. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fmpRequest } from "../server/financialData/provider";
import { primaryDatedQuoteTargets, inspectFmpDatedUnadjustedRows, publicSourceReceipt } from "./company-dated-market-source-contract";

if (process.env.NODE_ENV === "production") throw new Error("Private development source attempt only");
const root = "generated-artifacts/company-operating-corpus/dated-market-sources";
mkdirSync(root, { recursive: true });
const reportPath = `${root}/fmp-dated-price-attempt.json`;
if (existsSync(reportPath)) {
  const retained = JSON.parse(readFileSync(reportPath, "utf8"));
  console.log(JSON.stringify({ status: "retained-no-retry", receipts: retained.receipts.map(publicSourceReceipt) }));
  process.exit(0);
}
const documentation = readFileSync(`${root}/official-fmp-docs.md`, "utf8");
const endpoint = "historical-price-eod/non-split-adjusted";
if (!documentation.includes(`https://financialmodelingprep.com/stable/${endpoint}?symbol=AAPL`) ||
    !documentation.includes("without adjustments for stock splits"))
  throw new Error("Retained official documentation does not establish the fixed endpoint's unadjusted semantics");
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
const shareReport = JSON.parse(readFileSync("generated-artifacts/company-operating-corpus/primary-filings/share-review/report.json", "utf8"));
const targets = primaryDatedQuoteTargets(shareReport.observations).filter(t =>
  t.symbol !== "XOM" || t.cik === "0000034088");
if (targets.length !== 3 || targets.map(t => `${t.symbol}:${t.quoteDateRequired}`).join(",") !==
    "FSLR:2025-02-21,NEE:2025-01-31,XOM:2025-01-31")
  throw new Error("Primary share target plan changed; requires separate review");
const receipts: Record<string, unknown>[] = [], candidates: unknown[] = [];
let stoppedOn403 = false;
for (const target of targets) {
  const id = `${target.symbol}-fmp-exact-primary-date`, startedAt = new Date().toISOString();
  if (stoppedOn403) {
    receipts.push({ id, requestedQuoteDate: target.quoteDateRequired, capturedAt: startedAt,
      status: "not-requested-after-provider-403", httpStatus: null, sha256: null });
    continue;
  }
  const params = { symbol: target.symbol, from: target.quoteDateRequired, to: target.quoteDateRequired };
  let raw: string | null = null;
  try {
    const rows = await fmpRequest(endpoint, params, body => { raw = body; });
    const path = `${root}/${id}-raw.json`;
    if (raw === null) throw new Error("Expected private raw response capture");
    writeFileSync(path, raw);
    const candidate = inspectFmpDatedUnadjustedRows(rows, target);
    candidates.push(candidate);
    receipts.push({ id, endpoint, params, requestedQuoteDate: target.quoteDateRequired,
      startedAt, capturedAt: new Date().toISOString(), status: candidate.status, httpStatus: 200,
      sha256: sha(raw), path, returnedRows: rows.length, sourceCik: target.cik,
      primarySharesSourceHash: target.shareSourceHash });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = /^FMP HTTP \d{3}$/.test(message) || [
      "FMP credential is not configured", "FMP request failed or timed out", "FMP returned invalid JSON",
      "FMP returned an unexpected response",
    ].includes(message) ? message : "Source attempt failed; unsafe details suppressed";
    stoppedOn403 = message === "FMP HTTP 403";
    if (raw !== null) writeFileSync(`${root}/${id}-raw.json`, raw);
    receipts.push({ id, endpoint, params, requestedQuoteDate: target.quoteDateRequired, startedAt,
      capturedAt: new Date().toISOString(), status: safe,
      httpStatus: /^FMP HTTP \d{3}$/.test(message) ? Number(message.slice(-3)) : null,
      sha256: raw === null ? null : sha(raw) });
  }
  // Persist after every attempt so a rerun cannot silently repeat paid calls.
  writeFileSync(reportPath, JSON.stringify({ receipts, candidates, stoppedOn403, inProgress: true }, null, 2) + "\n");
}
const report = { assembledAt: new Date().toISOString(), endpoint, maximumRequests: 3, retries: 0,
  requests: receipts.filter(r => r.status !== "not-requested-after-provider-403").length,
  documentation: { url: "https://site.financialmodelingprep.com/developer/docs",
    path: `${root}/official-fmp-docs.md`, sha256: sha(documentation) },
  receipts, candidates, stoppedOn403, actualValuationPairs: 0, approvals: 0,
  newAssumptionsFrozen: false, noSubscriptionBillingOrPlanChange: true,
  licence: "Raw provider/source data privately retained; no redistribution permission inferred" };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
const publicReceipts = receipts.map(publicSourceReceipt);
writeFileSync(`${root}/fmp-public-receipts.json`, JSON.stringify(publicReceipts, null, 2) + "\n");
console.log(JSON.stringify({ receipts: publicReceipts }));

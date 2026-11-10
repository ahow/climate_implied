import { readFileSync, writeFileSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
import { buildFslrIssuerFiveYear } from "../server/calculation/issuerConditionalFiveYear";

// Local/private artifacts only. No database, collector, approvals or production writes.
if (process.env.NODE_ENV === "production") throw new Error("Private development calculation only");
const root = "generated-artifacts/company-operating-corpus";
const source = readFileSync(`${root}/FSLR-2025-results.md`, "utf8");
for (const marker of [
  "February 24, 2026", "$4.9B", "$5.2B", "$2.4B", "$2.6B", "$610M", "$635M",
  "$2.10 billion to $2.19 billion", "$0.8B", "$1.0B",
  "529,216", "44,131", "81,762", "38,569", "15,013", "215,979", "282,593",
]) if (!source.includes(marker)) throw new Error(`Missing evidence locator: ${marker}`);
// Observation/freeze are current, never filesystem modification time or backdated publication time.
const observedAt = new Date().toISOString();
const result = buildFslrIssuerFiveYear({
  sourceHash: contentHash(source), observedAt, frozenAt: observedAt,
  firstYear: Math.max(2027, new Date(observedAt).getUTCFullYear() + 1),
});
const report = {
  ...result,
  source: {
    publishedDate: "2026-02-24", publishedAt: null, observedAt,
    url: "https://investor.firstsolar.com/news/news-details/2026/First-Solar-Inc--Announces-Fourth-Quarter-and-Full-Year-2025-Financial-Results-and-2026-Guidance/default.aspx",
    licence: "Public issuer disclosure retained privately; no redistribution grant assumed",
    locators: "2026 guidance; FY2025 consolidated cash flows and GAAP/non-GAAP reconciliation; December 2025 balance sheet debt",
  },
  target: { requestedIssuers: 3, executedConditionalIssuerBoundaries: 1, filingVerifiedCases: 0,
    approvedCases: 0, fullEquityValuationPairs: 0 },
  unchanged: ["completed beta", "common-eight failure", "Gordon primary", "no empirical refit"],
};
writeFileSync(`${root}/FSLR-five-year-conditional-results.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ status: result.status, pv: result.members.map(m => ({ id: m.id, pv: m.fiveYearFcfePv })),
  delta: result.stressMinusBaseFiveYearPv, target: report.target }));

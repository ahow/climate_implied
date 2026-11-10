/** Bounded public-document review, not a collector or identity-approval operation. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { primaryCommonSharesSchema, reviewCompanyShareReference } from "../server/calculation/companyShareEvidence";

if (process.env.NODE_ENV === "production") throw new Error("Private development review only");
const root = "generated-artifacts/company-operating-corpus/primary-filings";
const out = `${root}/share-review`;
mkdirSync(out, { recursive: true });
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const prior = JSON.parse(readFileSync(`${root}/readiness-report.json`, "utf8"));
const market = JSON.parse(readFileSync(`${root}/market-reference-attempt.json`, "utf8"));
const receipts: unknown[] = [];
const observations = prior.cases.map((c: any) => {
  const text = readFileSync(`${root}/${c.facts.symbol}-2024.txt`, "utf8");
  const count = c.disclosedMarketFacts.shares;
  const token = count.toLocaleString("en-US");
  const line = text.split("\n").findIndex(l => l.includes(token));
  if (line < 0) throw new Error(`Missing exact cover shares: ${c.facts.symbol}`);
  const bytes = readFileSync(`${root}/${c.facts.symbol}-2024.pdf`);
  if (sha(bytes) !== c.facts.sourceHash) throw new Error("Filing byte hash changed");
  return primaryCommonSharesSchema.parse({
    symbol: c.facts.symbol, cik: c.facts.cik, issuer: c.facts.issuer,
    effectiveDate: c.disclosedMarketFacts.sharesDate,
    classes: [{ security: c.facts.security, outstanding: count, precision: "exact",
      issued: null, treasury: null }],
    allCommonClassesCovered: true,
    evidence: { url: c.facts.sourceUrl, sha256: c.facts.sourceHash,
      capturedAt: c.facts.observedAt, publishedDate: c.facts.documentDate,
      publicationBasis: "signed-report-date", locator: `Form 10-K cover; text line ${line + 1}` },
  });
});

// Issuer-hosted SEC filing, discovered from issuer's filing index. No paid API.
const accession = "0002115436-26-000020";
const indexUrl = "https://investor.exxonmobil.com/sec-filings/all-sec-filings";
const url = `${indexUrl}/content/${accession}/${accession}.pdf`;
for (const [sourceUrl, path] of [[indexUrl, `${out}/XOM-index.html`], [url, `${out}/XOM-2026Q3.pdf`]]) {
  execFileSync("curl", ["--fail", "--location", "--silent", "--show-error",
    "--max-time", "60", sourceUrl, "-o", path]);
  receipts.push({ url: sourceUrl, path, capturedAt: new Date().toISOString(),
    sha256: sha(readFileSync(path)), status: "success" });
}
const capturedAt = (receipts[1] as { capturedAt: string }).capturedAt;
const index = readFileSync(`${out}/XOM-index.html`, "utf8");
if (!index.includes(`10-Q filing published on Nov 2, 2026`) || !index.includes(accession))
  throw new Error("Issuer filing index no longer confirms publication; retain prior evidence and review");
execFileSync("pdftotext", ["-layout", `${out}/XOM-2026Q3.pdf`, `${out}/XOM-2026Q3.txt`]);
const text = readFileSync(`${out}/XOM-2026Q3.txt`, "utf8");
const required = ["4,079,222,444", "Outstanding as of September 30, 2026",
  "On July 1, 2026", "became the successor registrant", "which were cancelled",
  "did not change the Corporation's consolidated business, operations, assets, liabilities, or"];
for (const token of required) if (!text.includes(token)) throw new Error(`Missing primary succession/share token: ${token}`);
const locate = (token: string) => text.split("\n").findIndex(l => l.includes(token)) + 1;
const xomEvidence = { url, sha256: sha(readFileSync(`${out}/XOM-2026Q3.pdf`)),
  capturedAt, publishedDate: "2026-11-02", publicationBasis: "issuer-filing-index",
  locator: `10-Q cover line ${locate("4,079,222,444")}; Note 1 lines ${locate("On July 1, 2026")}–${locate("did not change the Corporation's consolidated business, operations, assets, liabilities, or") + 1}` };
observations.push(primaryCommonSharesSchema.parse({
  symbol: "XOM", cik: "0002115436", issuer: "ExxonMobil Holdings Corporation",
  effectiveDate: "2026-09-30",
  classes: [{ security: "Common Stock, par value $0.001 per share", outstanding: 4079222444,
    precision: "exact", issued: null, treasury: null }],
  allCommonClassesCovered: true, evidence: xomEvidence,
}));
const succession = {
  status: "primary-supported-candidate-for-review-only", effectiveDate: "2026-07-01",
  predecessor: { name: "Exxon Mobil Corporation", cik: "0000034088", commonPar: "without par value" },
  successor: { name: "ExxonMobil Holdings Corporation", cik: "0002115436", commonPar: "$0.001" },
  exchange: "NYSE", tickerContinued: "XOM", exchangeRatio: "one outstanding predecessor common for one successor common",
  treasuryTreatment: "Predecessor treasury shares cancelled; no change to total equity.",
  financialBasis: "Note 1 explicitly states consolidated business, operations, assets, liabilities and financial reporting basis unchanged.",
  source: xomEvidence,
  isinEvidence: "Provider US30233Q1085 differs from historical US30231G1022; primary filing does not authenticate either ISIN. ISIN/class bridge still needs review.",
  identityApproved: false, automaticTickerJoin: false,
  nextAction: "Review primary succession, CIK/accession and class/ISIN history through existing workflow; do not auto-accept or overwrite old issuer facts.",
};
const checks = observations.map(o => {
  const a = market.attempts.find((a: any) => a.symbol === o.symbol);
  const p = a.requests.find((r: any) => r.endpoint === "/stable/profile").selectedRows[0];
  const old = prior.cases.find((c: any) => c.facts.symbol === o.symbol);
  return reviewCompanyShareReference(o, { symbol: o.symbol, cik: p.cik,
    security: o.symbol === "XOM" ? "Common Stock, par value $0.001 per share" : old.facts.security,
    priceDate: a.quoteDate.slice(0, 10) });
});
const report = {
  generatedAt: new Date().toISOString(), receipts, observations, checks, succession,
  additionalPrimaryFacts: [
    { symbol: "FSLR", date: "2024-12-31", issuedAndOutstanding: 107060281,
      evidence: "FY2024 balance sheet, common stock line; exact number, not EPS weighted average",
      sourceHash: prior.cases[0].facts.sourceHash, treasuryTreatment: "No separate treasury count asserted from absence of a row." },
    { symbol: "NEE", effectiveDate: "2020-10-26", split: "4-for-1",
      evidence: "FY2024 issuer purchases footnote (c): four-for-one stock split effective October 26, 2020",
      sourceHash: prior.cases[1].facts.sourceHash, adjustment: "Historical fact only; do not apply split twice to already adjusted price or shares." },
    { symbol: "XOM", date: "2024-12-31", issuedRoundedMillions: 8019,
      treasuryRoundedMillions: 3666, outstandingDerivedRoundedMillions: 4353,
      sourceHash: prior.cases[2].facts.sourceHash,
      evidence: "FY2024 balance sheet common stock and common stock held in treasury rows; not an exact share observation." },
    { symbol: "XOM", date: "2026-09-30", issuedRoundedMillions: 4112,
      treasuryRoundedMillions: 33, outstandingRoundedMillions: 4079,
      sourceHash: xomEvidence.sha256, evidence: "Q3 common stock share activity, page 7; July redomicile cancels 3,907 million treasury shares. Rounded table is not cover count." },
  ],
  providerAssessment: { successfulCalls: market.attempts.flatMap((a: any) => a.requests).filter((r: any) => r.status === "success").length,
    datedQuotes: market.attempts.filter((a: any) => a.quoteDate).length,
    diagnosis: "Successful responses with evidence/identity/date gaps, NOT provider failure. No further FMP calls." },
  corporateActionCoverage: "Known sourced split and redomicile only; not a complete event history through quote date. No assertion that other events did not occur.",
  matchedQuoteShareReferences: checks.filter(c => c.status !== "blocked").length,
  actualWholeEquityPairs: 0, completeIssuerCases: 0, requestedIssuerCases: 3,
  forecastGap: "No complete issuer-wide climate-linked 2027–2031 revenue, margin, collections, tax, working-capital, capex and financing schedules evidenced for all three issuers; no coefficients or terminal assumptions invented.",
  noApprovals: true, noProductionWrites: true,
};
writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ path: `${out}/report.json`, observations: observations.length,
  blockedChecks: checks.filter(c => c.status === "blocked").length,
  successfulProviderCalls: report.providerAssessment.successfulCalls, datedQuotes: report.providerAssessment.datedQuotes,
  succession: succession.status, actualWholeEquityPairs: 0, completeIssuerCases: "0/3" }));

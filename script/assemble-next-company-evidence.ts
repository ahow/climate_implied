/** Private source assembly only: no forecast/study rerun, provider calls,
 * identity mutation, approvals, or central ledger writes. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { assessSourcedCompanyCase } from "../server/calculation/companyCaseEvidence";
import { filingFactsSchema } from "../server/calculation/companyFilingPair";
import { contentHash } from "../server/calculation/analysisManifest";

if (process.env.NODE_ENV === "production") throw new Error("Private development evidence assembly only");
const root = "generated-artifacts/company-operating-corpus";
const primary = `${root}/primary-filings`, output = `${root}/next-company-evidence`;
mkdirSync(output, { recursive: true });
const sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const prior = read(`${primary}/readiness-report.json`);
const market = read(`${primary}/market-reference-attempt.json`);
const shares = read(`${primary}/share-review/report.json`);
const latest = read(`${root}/fslr-full-cashflow/latest.json`);
const retained = read(latest.reportPath);

// Optional bounded, free public primary attempts. No FMP endpoint expansion,
// retries, subscription purchases, or speculative historical quotes.
const publicationAttempts: Record<string, unknown>[] = [];
if (process.argv.includes("--primary-publication-attempt")) {
  for (const c of prior.cases) {
    const facts = filingFactsSchema.parse(c.facts);
    const url = `https://data.sec.gov/submissions/CIK${facts.cik}.json`;
    const startedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "CompanyEvidenceReview/1.0", Accept: "application/json" } });
      const body = await response.text(), path = `${output}/${facts.symbol}-submissions-response.txt`;
      writeFileSync(path, body);
      let annual: unknown[] = [];
      let parseStatus = "not-parsed-http-error";
      if (response.ok) {
        try {
          const submission = JSON.parse(body);
          if (String(submission.cik).padStart(10, "0") !== facts.cik)
            throw new Error("SEC submission issuer mismatch");
          const recent = submission.filings?.recent;
          if (!recent || !Array.isArray(recent.form)) throw new Error("Recent filing arrays missing");
          annual = recent.form.flatMap((form: string, i: number) =>
            form === "10-K" && recent.reportDate?.[i] === facts.fiscalEnd ? [{
              accessionNumber: recent.accessionNumber?.[i], filingDate: recent.filingDate?.[i],
              acceptanceDateTime: recent.acceptanceDateTime?.[i], reportDate: recent.reportDate?.[i],
              primaryDocument: recent.primaryDocument?.[i],
            }] : []);
          parseStatus = annual.length ? "selected-fy2024-publication-candidates" :
            "no-selected-fy2024-row-in-recent-array-older-files-not-requested";
        } catch { parseStatus = "unexpected-json-or-missing-recent-arrays"; }
      }
      publicationAttempts.push({ symbol: facts.symbol, url, startedAt, completedAt: new Date().toISOString(),
        httpStatus: response.status, path, sha256: sha(body), parseStatus, annual,
        status: response.ok ? "response-retained-requires-review" : "http-error-no-publication-inference" });
    } catch (error) {
      publicationAttempts.push({ symbol: facts.symbol, url, startedAt, completedAt: new Date().toISOString(),
        status: "transport-error", errorType: error instanceof Error ? error.name : "UnknownError" });
    }
  }
  writeFileSync(`${output}/publication-attempts.json`, JSON.stringify(publicationAttempts, null, 2) + "\n");
} else {
  // A later assembly retains the real attempt history instead of erasing it.
  try { publicationAttempts.push(...read(`${output}/publication-attempts.json`)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}

const notes: Record<string, { label: string; token: string; amount: number; unit: number; interpretation: string }[]> = {
  FSLR: [
    { label: "Property, plant and equipment acquisitions funded by liabilities", token: "185,618", amount: 185618, unit: 1000,
      interpretation: "Noncash investing disclosure, not additional current cash capex; future settlement timing needs evidence." },
  ],
  NEE: [
    { label: "Proceeds from differential membership investors", token: "2,257", amount: 2257, unit: 1e6,
      interpretation: "Non-common financing, not automatic recurring common FCFE or debt proceeds." },
    { label: "Payments to differential membership investors", token: "(740)", amount: -740, unit: 1e6,
      interpretation: "Observed non-common distribution; full claim allocation still required." },
    { label: "Cash paid (received) for income taxes", token: "(760)", amount: -760, unit: 1e6,
      interpretation: "Historical net tax refund; do not invent recurring refunds. Existing annual engine cashTax is nonnegative." },
    { label: "Cash paid for interest", token: "2,737", amount: 2737, unit: 1e6,
      interpretation: "Consolidated net-of-capitalized cash interest; not FPL-only interest or forecast coupon." },
  ],
  XOM: [
    { label: "Additional investments and advances", token: "(3,299)", amount: -3299, unit: 1e6,
      interpretation: "Separate investing outflow omitted from selected PP&E-only bridge; not silently substituted as capex." },
    { label: "Cash dividends to noncontrolling interests", token: "(658)", amount: -658, unit: 1e6,
      interpretation: "Observed non-common cash claim; selected historical bridge is not silently rewritten." },
    { label: "Changes in noncontrolling interests", token: "(791)", amount: -791, unit: 1e6,
      interpretation: "Separate financing cash outflow; requires claim classification rather than an automatic common-equity deduction." },
  ],
};
const capturedAt = new Date().toISOString();
const cases = (prior.cases as { facts: unknown; baseFcfe: number }[]).map(c => {
  const facts = filingFactsSchema.parse(c.facts);
  const raw = readFileSync(`${primary}/${facts.symbol}-2024.pdf`);
  const text = readFileSync(`${primary}/${facts.symbol}-2024.txt`, "utf8");
  if (sha(raw) !== facts.sourceHash || sha(text) !== facts.textHash) throw new Error("Selected filing byte/text hash mismatch");
  const lines = text.split("\n");
  const incrementalFacts = notes[facts.symbol].map(row => {
    const line = lines.reduce((found, s, i) =>
      s.includes(row.label) && s.includes(row.token) ? i : found, -1);
    // Failed locator is recorded field-by-field, never manufactured or hidden.
    return { ...row, amountUsd: line < 0 ? null : row.amount * row.unit,
      status: line < 0 ? "locator-not-found-no-amount-certified" : "retained-primary-row-located",
      locator: line < 0 ? null : `FY2024 cash flow/supplemental statement, text line ${line + 1}`,
      sourceHash: facts.sourceHash };
  });
  const attempt = market.attempts.find((a: any) => a.symbol === facts.symbol);
  const publication = publicationAttempts.find(a => a.symbol === facts.symbol);
  const annual = publication?.annual as { filingDate: string; acceptanceDateTime: string;
    accessionNumber: string; reportDate: string }[] | undefined;
  let verifiedPublication = false;
  if (publication?.httpStatus === 200 && typeof publication.path === "string" && annual?.length === 1) {
    const rawMetadata = readFileSync(publication.path, "utf8");
    if (sha(rawMetadata) !== publication.sha256) throw new Error("SEC metadata response hash mismatch");
    const metadata = JSON.parse(rawMetadata), recent = metadata.filings?.recent;
    const i = recent?.accessionNumber?.indexOf(annual[0].accessionNumber) ?? -1;
    verifiedPublication = String(metadata.cik).padStart(10, "0") === facts.cik && i >= 0 &&
      recent.form[i] === "10-K" && recent.reportDate[i] === facts.fiscalEnd &&
      recent.filingDate[i] === facts.documentDate &&
      recent.acceptanceDateTime[i] === annual[0].acceptanceDateTime;
  }
  const contract = {
    version: "sourced-company-case-1", facts,
    referenceAt: capturedAt, informationCutoff: capturedAt, assessmentMode: "prospective-conditional",
    frozenAt: capturedAt, evidence: [], financialBasisEvidenceIds: [],
    financialCashflow: null, stub: null, terminal: null, market: null,
    unresolvedClaims: [...facts.accountingCaveats,
      ...(verifiedPublication ? [
        "SEC submissions metadata now supplies selected FY2024 acceptance; mirrored filing bytes still require accession/content authentication review.",
      ] : ["FY2024 public availability remains unverified; see exact source attempt."]),
      "Retained November 9 last close may be used in a labelled prospective conditional comparison; exact same-date primary shares and complete cash/terminal evidence remain missing.",
      ...(facts.symbol === "XOM" ? ["Primary July 2026 successor CIK/class differs from FY2024 predecessor; no automatic XOM ticker join."] : [])],
  };
  const assessment = assessSourcedCompanyCase(contract);
  writeFileSync(`${output}/${facts.symbol}-dependency-contract.json`, JSON.stringify(contract, null, 2) + "\n");
  return { symbol: facts.symbol, selectedFiscalEnd: facts.fiscalEnd,
    baseFcfe: c.baseFcfe, documentDate: facts.documentDate, actualCapturedAt: facts.observedAt,
    sourceHash: facts.sourceHash, textHash: facts.textHash,
    financialPublicAvailability: verifiedPublication ? {
      status: "primary-sec-metadata-located-not-mirror-byte-authentication",
      ...annual![0], sourceHash: publication!.sha256,
      sourceCapturedAt: publication!.completedAt, automaticApproval: false,
    } : null,
    publicationAttempt: publicationAttempts.find(a => a.symbol === facts.symbol) ?? { status: "not-attempted" },
    primaryShareObservations: shares.observations.filter((s: any) => s.symbol === facts.symbol),
    providerRequests: attempt.requests.map((r: any) => ({ endpoint: r.endpoint, params: r.params,
      observedAt: r.observedAt, status: r.status, responseHash: r.responseHash,
      missingFields: ["sharesOutstanding", "sharesDate"].filter(k =>
        !r.selectedRows?.some((row: any) => Object.hasOwn(row, k))) })),
    existingQuoteAt: attempt.quoteDate, quoteShareMatch: false,
    incrementalFacts, assessment };
});
if (contentHash(readFileSync(retained.source.path, "utf8")) !== retained.source.sourceHash)
  throw new Error("Retained distinct FSLR FY2025 source hash mismatch");
if (retained.cashSchedulesExecuted !== 10 || retained.annualRowsExecuted !== 50)
  throw new Error("Retained FSLR schedule count changed; review without rerunning");
const report = {
  version: "next-company-source-assembly-1", capturedAt, cases,
  retainedDistinctFslr: { reportPath: latest.reportPath, reportHash: sha(readFileSync(latest.reportPath)),
    freezePath: latest.freezePath, freezeHash: sha(readFileSync(latest.freezePath)),
    sourceHash: retained.source.sourceHash, publishedDate: retained.source.publishedDate,
    sourceHashConvention: "contentHash(canonical JSON string), not raw-file SHA256",
    actualCaptureAt: retained.source.originalCaptureAt, referenceDate: retained.referenceDate,
    firstYear: retained.firstYear, annualRows: retained.annualRowsExecuted,
    basis: "Unaudited FY2025 issuer release/2026 guidance; not selected FY2024 filings",
    reexecuted: false, wholeEquityPairs: 0, sustainableTerminal: null,
    missingStub: "Reference-to-2026-12-31 cash flows and complete coverage evidence absent; first full annual row is 2027." },
  requestedSourcedCases: 3, actualMarketPairs: 0, completeApprovedIssuerCases: 0,
  noNewFmpRequests: true, noForecastReruns: true, noProductionWrites: true,
  privateRawLicence: "Retained privately under source-specific disclosure/provider permissions; no raw redistribution licence asserted.",
};
writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ path: `${output}/report.json`, cases: cases.map(c => ({
  symbol: c.symbol, incrementalRowsLocated: c.incrementalFacts.filter(f => f.status === "retained-primary-row-located").length,
  dependencyGaps: c.assessment.gaps.length })),
  primaryPublicationAttempts: publicationAttempts.map(a => ({ symbol: a.symbol, status: a.status, httpStatus: a.httpStatus })),
  retainedFslrAnnualRows: 50, actualPairs: 0, completeCases: "0/3" }));

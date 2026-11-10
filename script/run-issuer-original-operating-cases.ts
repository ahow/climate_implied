import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { authenticatePrimaryIssuerCashflow } from "../server/calculation/issuerCashflowCase";
import { extractOriginalIssuerInputs, buildOriginalIssuerOperatingCase, assessOriginalIssuerOperatingCase,
  originalIssuerAssumptions } from "../server/calculation/issuerOriginalOperatingCase";

if (process.env.NODE_ENV === "production") throw new Error("Private original-range conditional assessment only");
if (!process.argv.includes("--private-primary")) throw new Error("Explicit --private-primary required; code-only CI must not read private filings");
const root = "generated-artifacts/company-operating-corpus", outputRoot = `${root}/issuer-original-v3`;
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const latest = read(`${root}/issuer-cashflow-reconciliation-v2/latest.json`);
const audited = read(latest.reportPath);
const oldLatest = read(`${root}/issuer-cashflow-v1/latest.json`), oldFreeze = read(oldLatest.freezePath);
const oldReport = read(oldLatest.reportPath);
const originalLatest = read(`${root}/fslr-full-cashflow/latest.json`);
const originalReport = read(originalLatest.reportPath);
const policy = originalReport.policySource;
if (sha(policy.pdf) !== policy.sha256) throw new Error("Retained primary statutory source changed");
const policyText = readFileSync(policy.text, "utf8");
for (const phrase of ["75 percent", "50 percent", "25 percent", "2030", "2031", "2032"])
  if (!policyText.includes(phrase)) throw new Error(`Primary statutory phase-down locator absent: ${phrase}`);
const supplementReceipts = read(`${outputRoot}/supplements/receipts.json`);
const fundingAttempts = read(`${outputRoot}/funding-sources/receipts.json`);
const frozenAt = new Date().toISOString();
const preserve = [{ path: latest.reportPath, sha256: sha(latest.reportPath) },
  { path: latest.freezePath, sha256: sha(latest.freezePath) },
  { path: oldLatest.reportPath, sha256: sha(oldLatest.reportPath) },
  { path: oldLatest.freezePath, sha256: sha(oldLatest.freezePath) },
  { path: originalLatest.reportPath, sha256: sha(originalLatest.reportPath) },
  { path: originalLatest.freezePath, sha256: sha(originalLatest.freezePath) },
  ...oldReport.preserved.pinnedCodeAssertions.map((p: any) => ({ path: p.path, sha256: p.sha256 }))];
const prepared = audited.results.map((result: any) => {
  const p = oldFreeze.preparations.find((p: any) => p.facts.symbol === result.symbol);
  const source = result.source;
  if (sha(source.path) !== source.sha256 || sha(p.quoteReceipt.path) !== p.quoteReceipt.sha256)
    throw new Error("Existing primary/dated quote bytes changed");
  const cover = supplementReceipts.receipts.find((r: any) => r.symbol === result.symbol && r.path?.endsWith("-8k.html"));
  const supplemental = supplementReceipts.receipts.find((r: any) => r.symbol === result.symbol && r.path?.includes("-exhibit-1."));
  for (const receipt of [cover, supplemental]) {
    if (!receipt || receipt.httpStatus !== 200 || sha(receipt.path) !== receipt.sha256)
      throw new Error("Missing authenticated SEC supplement bytes");
  }
  if (!cover.url.startsWith("https://www.sec.gov/Archives/edgar/data/") ||
      cover.url.slice(0, cover.url.lastIndexOf("/")) !== supplemental.url.slice(0, supplemental.url.lastIndexOf("/")))
    throw new Error("Supplement must be same-accession SEC primary exhibit");
  const coverHtml = readFileSync(cover.path, "utf8");
  if (!coverHtml.includes(new URL(supplemental.url).pathname.split("/").at(-1)!) ||
      !coverHtml.includes(source.identity.cik))
    throw new Error("SEC cover CIK/exhibit linkage absent");
  const html = readFileSync(source.path, "utf8"), primary = authenticatePrimaryIssuerCashflow(html, source.identity);
  const shares = primary.read("dei:EntityCommonStockSharesOutstanding", { annual: false, expected: p.market.shares });
  const context = html.match(new RegExp(`<xbrli:context id="${shares.context}">([\\s\\S]*?)<\\/xbrli:context>`))?.[1];
  if (!context?.includes(`<xbrli:instant>${p.market.sharesDate}</xbrli:instant>`) ||
      p.market.priceDate !== p.market.sharesDate || p.market.currency !== primary.primaryFinancialCurrency)
    throw new Error("Exact primary shares/price date or currency mismatch");
  const input = extractOriginalIssuerInputs(html, readFileSync(supplemental.path, "utf8"), result.reconciliation,
    { primaryHash: source.sha256, supplementHash: supplemental.sha256, publishedAt: p.receipt.availableAt });
  return { symbol: result.symbol, input, source, supplemental, cover,
    shareClaim: { id: shares.id, context: shares.context, value: shares.value },
    quoteReceipt: p.quoteReceipt, market: { ...p.market, datedReferenceReviewed: true },
    historicalBaseFcfe: p.scenarios[0].engineInput.baseFcfe };
});
const dir = `${outputRoot}/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
mkdirSync(dir, { recursive: true });
const freeze = { version: originalIssuerAssumptions.version, frozenAt, prepared, preserve,
  assumptions: originalIssuerAssumptions, policy, policyTextHash: sha(policy.text),
  newPrimaryAttempts: { maximumRequests: 10, requests: supplementReceipts.requests + fundingAttempts.requests,
    receipts: [...supplementReceipts.receipts, ...fundingAttempts.receipts] },
  code: ["server/calculation/issuerOriginalOperatingCase.ts", "script/run-issuer-original-operating-cases.ts",
    "server/calculation/companyFullCashflowCase.ts", "server/calculation/issuerCashflowCase.ts",
    "server/calculation/issuerCashflowReconciliation.ts"].map(path => ({ path, sha256: sha(path) })),
  noMarketFitting: "Market price/shares never enter the operating builder; only later same-path valuation comparison",
  qualification: "Zero original qualified issuers until all source/activity/funding/basis/reverse criteria genuinely met; no automatic promotion from a mathematical pair" };
const freezePath = `${dir}/frozen-before-outcomes.json`;
writeFileSync(freezePath, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
const cases = prepared.flatMap((p: any) => originalIssuerAssumptions.terminalGrowthRange.flatMap(terminalGrowth =>
  (["source-conditioned", "constraint"] as const).map(variant => {
    const options = { terminalGrowth, variant, referenceDate: p.market.referenceDate,
      frozenAt, historicalBaseFcfe: p.historicalBaseFcfe };
    try {
      const built = buildOriginalIssuerOperatingCase(p.input, options);
      const assessed = assessOriginalIssuerOperatingCase(built, p.market);
      const path = `${dir}/${built.id}.json`;
      writeFileSync(path, JSON.stringify({ symbol: p.symbol, options, built, assessed }, null, 2) + "\n", { flag: "wx" });
      return { symbol: p.symbol, id: built.id, options, path, sha256: sha(path),
        fiveYearRows: built.ledger.years.length, fadeRows: built.ledger.continuationYears.length,
        terminalRows: built.ledger.terminalYear ? 1 : 0, stubRows: built.engineInput.stub.cashFlows.length,
        terminalFunding: built.terminalFunding, requiredCommonContributions: built.requiredCommonContributions,
        pairing: assessed.pairing, gaps: assessed.gaps, economicGaps: built.economicGaps,
        forwardWholeEquity: assessed.forward?.forwardWholeEquity ?? null,
        reverseProof: "reverseProof" in assessed ? assessed.reverseProof : null,
        qualifiedOriginalCases: 0 };
    } catch (error) {
      return { symbol: p.symbol, options, calculationError: error instanceof Error ? error.message : "Calculation failed",
        qualifiedOriginalCases: 0 };
    }
  })));
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Prior experiment changed");
const report = { version: freeze.version, frozenAt, calculatedAt: new Date().toISOString(),
  freezePath, freezeHash: sha(freezePath), cases, preserve,
  primaryFactsFromPriorReconciliation: 166,
  additionalFundingClaims: prepared.reduce((s: number, p: any) => s + p.input.additionalClaims.length, 0),
  fullPathCandidateCases: cases.filter((c: any) => c.path).length,
  canonicalSamePathPairs: cases.filter((c: any) => c.pairing === "conditional-same-basis-whole-equity").length,
  signedCertifiedSamePathPairs: cases.filter((c: any) => c.pairing === "signed-explicit-conditional-same-basis").length,
  originalQualifiedIssuers: 0, originalQualifiedPairs: 0,
  newNetworkRequests: supplementReceipts.requests + fundingAttempts.requests, newProviderRequests: 0,
  preservedFslrOriginal10Cases50Rows: true, maintenanceBenchmarksNotRerun: true,
  noActualFutureClaims: true, originalEarningsRoeAdapterNotReplaced: true,
  productionEligible: false, identityApproved: false, ownerApproved: false };
const reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${outputRoot}/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
console.log(JSON.stringify({ reportPath, freezePath, cases: report.fullPathCandidateCases,
  canonicalSamePathPairs: report.canonicalSamePathPairs, additionalFundingClaims: report.additionalFundingClaims,
  signedCertifiedSamePathPairs: report.signedCertifiedSamePathPairs,
  originalQualifiedIssuers: 0, newNetworkRequests: report.newNetworkRequests,
  results: cases.map((c: any) => ({ symbol: c.symbol, variant: c.options.variant, g: c.options.terminalGrowth,
    pairing: c.pairing, terminalFcfe: c.terminalFunding?.terminalFcfe, gaps: c.gaps, error: c.calculationError })) }));

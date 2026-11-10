/** Read retained authenticated primary reports only. No provider/collector/DB calls.
 * New source audit version; never overwrites or reruns either old FSLR experiment. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractIssuerCashflowReconciliation, calculateIssuerFundingConstraints,
  reviewIssuerActivityPolicy } from "../server/calculation/issuerCashflowReconciliation";

if (process.env.NODE_ENV === "production") throw new Error("Private issuer source reconciliation only");
const root = "generated-artifacts/company-operating-corpus";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const v1 = read(`${root}/issuer-cashflow-v1/latest.json`);
const v1Report = read(v1.reportPath), v1Freeze = read(v1.freezePath);
const preserved = [{ path: v1.reportPath, sha256: sha(v1.reportPath) },
  { path: v1.freezePath, sha256: sha(v1.freezePath) },
  { path: v1Report.preserved.reportPath, sha256: v1Report.preserved.reportHash },
  { path: v1Report.preserved.freezePath, sha256: v1Report.preserved.freezeHash },
  ...v1Report.preserved.pinnedCodeAssertions.map((s: any) => ({ path: s.path, sha256: s.sha256 }))];
for (const p of preserved) if (sha(p.path) !== p.sha256) throw new Error("Retained experiment integrity mismatch");
if (v1Report.preserved.schedules !== 10 || v1Report.preserved.annualRows !== 50)
  throw new Error("Retained distinct FSLR 10/50 invariant changed");
const frozenAt = new Date().toISOString();
const output = `${root}/issuer-cashflow-reconciliation-v2/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
mkdirSync(output, { recursive: true });
const sources = v1Freeze.preparations.map((p: any) => ({
  identity: { symbol: p.facts.symbol, cik: p.facts.cik, security: p.facts.security, fiscalEnd: p.facts.fiscalEnd },
  path: p.receipt.path, sha256: p.receipt.sha256, url: p.receipt.url,
  availableAt: p.receipt.availableAt, capturedAt: p.receipt.capturedAt,
  selectedHistoricalBaseFcfe: p.scenarios[0].engineInput.baseFcfe,
}));
const freeze = { version: "issuer-primary-cash-reconciliation-2", frozenAt, sources, preserved,
  originalTerminalGrowthRange: [.025, .04], newMarketValuationsPermitted: false,
  restriction: "Reconcile primary history and quantify source-budget constraints. No added project yield, asset turnover, life or CCS tariff to force a positive terminal or pair.",
  code: ["server/calculation/issuerCashflowReconciliation.ts", "script/assemble-issuer-cashflow-reconciliation.ts"]
    .map(path => ({ path, sha256: sha(path) })) };
const freezePath = `${output}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
const results = sources.map((source: any) => {
  try {
    if (sha(source.path) !== source.sha256) throw new Error("Primary content hash mismatch");
    const html = readFileSync(source.path, "utf8");
    const reconciliation = extractIssuerCashflowReconciliation(html, source.identity);
    const activityPolicy = reviewIssuerActivityPolicy(html, source.identity);
    const fundingConstraints = calculateIssuerFundingConstraints(reconciliation);
    return { symbol: source.identity.symbol, source, reconciliation, activityPolicy, fundingConstraints,
      qualifiedOriginalTerminalCases: 0, qualifiedOriginalMarketPairs: 0 };
  } catch (error) {
    return { symbol: source.identity.symbol, source, blocked: true,
      error: error instanceof Error ? error.message : "Reconciliation failed",
      qualifiedOriginalTerminalCases: 0, qualifiedOriginalMarketPairs: 0 };
  }
});
for (const p of preserved) if (sha(p.path) !== p.sha256) throw new Error("Retained experiment changed");
const report = { version: freeze.version, frozenAt, calculatedAt: new Date().toISOString(),
  freezePath, freezeHash: sha(freezePath), results, preserved,
  newlyQualifiedOriginalIssuerCases: 0, newlyQualifiedOriginalMarketPairs: 0,
  retainedV1Pairs: "Two zero-growth cash benchmarks only; NOT original 2.5–4% terminal/full climate-linked completion",
  olderFslrCases: 10, olderFslrRows: 50, neitherExperimentRerun: true,
  newNetworkRequests: 0, providerRequests: 0, productionEligible: false, identityApproved: false, ownerApproved: false };
const reportPath = `${output}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${root}/issuer-cashflow-reconciliation-v2/latest.json`,
  JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
console.log(JSON.stringify({ reportPath, freezePath, newlyQualifiedOriginalPairs: 0,
  results: results.map((r: any) => ({ symbol: r.symbol, sourceRows: r.reconciliation?.rows.length ?? 0,
    residuals: r.reconciliation?.residuals ?? null, blocked: r.blocked ?? false, error: r.error ?? null })),
  oldFslrCases: 10, oldFslrRows: 50, oldZeroGrowthBenchmarkPairs: 2, newNetworkRequests: 0 }));

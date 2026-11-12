/** Exact implemented attachment routes, including the deliberately denied
 * private review route. This is transport coverage, not source acceptance.
 */
export const serverDownloadRegistry = [
  { source: "server/headlineDrilldownApi.ts", paths: ["/api/headline-drilldown/contributions/export.json", "/api/headline-drilldown/contributions/export.xlsx", "/api/headline-drilldown/sensitivities/export.json", "/api/headline-drilldown/sensitivities/export.xlsx"], kind: "indicators", claim: "Derived selected retained native headline drilldown; parent identity is not native identity of this derived output; no regional proxy or scientific acceptance", availability: "verified-retained-public-native-parent-required" },
  { source: "server/producerDownload.ts", paths: ["/api/analysis/results/:id/export.json"], kind: "valuation", claim: "Exact verified retained completed response; not recalculation or scientific acceptance", availability: "verified-retained-producer-required" },
  { source: "server/warmingValidationReferenceApi.ts", paths: ["/api/reference/warming-validation/export.json"], kind: "indicators", claim: "Dated human-warming validation reference; not a model result", availability: "public-reference" },
  { source: "server/carbonPassThroughApi.ts", paths: ["/api/cv/carbon-pass-through-evidence/export.json"], kind: "valuation", claim: "Public carbon-price evidence review; not issuer validation", availability: "public-source-review" },
  { source: "server/companyConditionalApi.ts", paths: ["/api/cv/company-conditional-summaries/export.json", "/api/cv/company-conditional-summaries/export.xlsx"], kind: "valuation", claim: "Conditional company summaries; not identified market climate expectations", availability: "public-conditional-summary" },
  { source: "server/stage10CoverageApi.ts", paths: ["/api/research/stage10-coverage/export.json", "/api/research/stage10-coverage/export.xlsx"], kind: "coverage", claim: "Retained aggregate financial coverage; no model approval", availability: "retained-source-required" },
  { source: "server/trackBAdmissionApi.ts", paths: ["/api/research/track-b-admission/export.json", "/api/research/track-b-admission/export.xlsx"], kind: "backtest", claim: "Exact published Track B period assessment; not independent scientific acceptance", availability: "rights-qualified-public-catalog-required" },
  { source: "server/workbookMoneyAuditApi.ts", paths: ["/api/financial-data/workbook-money-audit.xlsx"], kind: "coverage", claim: "Pending-review monetary audit; no inferred currency or FX", availability: "retained-audit-required" },
  { source: "server/qualifiedMissingnessApi.ts", paths: ["/api/development/qualified-missingness/export"], kind: "indicators", claim: "Private qualified-source review; operator CLI required", availability: "http-denied-403" },
] as const;

/** Explicit opt-in: all existing query pins retained; no server source selector
 * is changed by requesting transport metadata. */
export function withDownloadManifest(url: string) {
  const parsed = new URL(url, "https://download.invalid");
  parsed.searchParams.set("downloadMetadata", "manifest-v1");
  return `${parsed.pathname}${parsed.search}`;
}

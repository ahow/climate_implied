import { currentSelection } from "./analysis-selection";
import { z } from "zod";
import { bindNestedOutput } from "@shared/outputFieldSemantics";
import { exportJsonIdentity } from "./export-identity";
/** Interpretation travels with downloaded data, rather than only with its page. */
export const exportContracts = {
  coverage: {
    status: "Descriptive revised-workbook company coverage",
    interpretation: "Full-workbook and eligible financial-identity denominators, separate emissions scopes and explicit operating-geography versus HQ-fallback mapping; no geography inferred from headquarters.",
    limitation: "Known-value shares exclude unknown values and are not total-universe estimates. Workbook market cap uses its USD-million convention without implied FX. Company scope3 sums are not a global physical inventory. Source/review integrity is not scientific acceptance or original-vintage proof.",
  },
  native: {
    status:"Uncalibrated native-emissions candidate",
    interpretation:"Global deterministic conditional emissions using native gas masses and AR6 GWP100 reporting. No temperature, regional climate or ensemble probability claim.",
    limitation:"Control/illustrative/dashboard inputs are not approved calibrated policy forecasts. Published inventory uncertainty is not forecast uncertainty; retained hashes are not publication-vintage proof. Separate residual diagnostics use5% of the same captured2024 native-gas baseline, not CO2e or physical net zero; no crossing is censored at the actual simulated horizon.",
  },
  legacy: {
    status: "Unsupported legacy diagnostic",
    interpretation: "Not a validated climate forecast. Aggregate GHG is passed through a CO2-only response with a fixed warming offset. Regional values are global counterfactuals, not regional temperatures.",
    limitation: "Positive residual-emissions thresholds are not net zero. No threshold date is extrapolated beyond 2100; null means not reached within the simulated horizon. Quantile labels do not establish calibrated predictive uncertainty.",
  },
  indicators: {
    status: "Source indicator data",
    interpretation: "Source observations and available estimates, not a climate forecast.",
    limitation: "Current revised history is not original publication-vintage evidence. Collection and approval status must be checked separately.",
  },
  valuation: {
    status: "Descriptive valuation diagnostic",
    interpretation: "P/E and earnings-yield comparisons. Gordon growth is a steady-state comparator, not five-year cash-flow growth or an inferred emissions reduction.",
    limitation: "Does not identify market climate expectations. Carbon intensity, where reported, is per market capitalisation, not revenue. Missing financial or identity evidence is not an approval.",
  },
  backtest: {
    status: "Retrospective research",
    interpretation: "Historical strategy diagnostics, not validated investment evidence or a forecast of future returns.",
    limitation: "Revised-history inputs, legacy selections and incomplete lifecycle/borrow/FX evidence limit inference. This is not acceptance of the new paired valuation-gap model.",
  },
  news: {
    status: "Descriptive news analysis",
    interpretation: "Article coverage and sentiment summaries, not climate projections or market expectations.",
    limitation: "Coverage depends on the source and retrieval window; sentiment is not a verified causal effect.",
  },
} as const;

export type ExportKind = keyof typeof exportContracts;

export function exportNotes(kind: ExportKind, filename: string, exportedAt: string) {
  const selection = currentSelection();
  const contract = exportContracts[kind];
  if (!contract) throw new Error("Unknown export interpretation");
  return [
    { Field: "Analysis input selection", Value: selection
      ? `Workbook ${selection.workbook}; indicators ${selection.indicators}; regional inputs ${selection.regional ?? "not selected"}; ordered company overlays ${selection.overlays?.join(",") ?? "none"}; cutoff ${selection.asOf ?? "not specified"}. Applies only to supported analytical views, not news, published references or provider/data-management records. Current-code replay, not original-vintage evidence.`
      : "Current inputs; no archived analysis selection" },
    { Field: "File", Value: filename },
    { Field: "Export time (not observation or publication date)", Value: exportedAt },
    { Field: "Evidence status", Value: contract.status },
    { Field: "Interpretation", Value: contract.interpretation },
    { Field: "Limitations", Value: contract.limitation },
    { Field: "Reproducibility", Value: "This is a view export, not an immutable analysis archive. An export timestamp does not identify the input vintage or model run." },
    { Field: "Units and missingness", Value: "Use the column headings for units. Empty cells mean missing or unavailable, not zero. Do not combine different growth definitions or horizons." },
  ];
}

const count = z.number().int().nonnegative(), fraction = z.number().min(0).max(1).nullable();
const mapping = z.object({ count, share: fraction }).strict();
const weighted = z.object({ knownValue: z.number().finite().nonnegative().nullable(), shareOfKnownValue: fraction }).strict();
const metric = z.object({
  states: z.object({ present: count, null: count, missing: count, conflicted: count, invalid: count }).strict(),
  availableCount: count, availableShare: fraction, knownTotal: z.number().finite().nonnegative().nullable(),
  operatingGeography: weighted, headquartersFallback: weighted,
}).strict();
const population = z.object({
  denominator: count,
  mapping: z.object({ "operating-geography": mapping, "headquarters-fallback": mapping,
    unknown: mapping, missing: mapping, conflicted: mapping }).strict(),
  metrics: z.object({ marketCap: metric, scope1Emissions: metric, scope2Emissions: metric, scope3Emissions: metric }).strict(),
}).strict();
const coverageJsonSchema = z.object({
  version: z.literal("company-coverage-1"),
  sourceId: z.union([z.literal("current-workbook-unversioned"), z.string().regex(/^[a-f0-9]{64}$/)]),
  observationDate: z.string().date(), informationCutoff: z.string().datetime(),
  fullWorkbook: population, eligible: population, eligibleCompanyShare: fraction,
  eligibleKnownValueCoverage: z.object({ marketCap: fraction, scope1Emissions: fraction, scope2Emissions: fraction, scope3Emissions: fraction }).strict(),
  eligibilityConflicts: count, eligibilityRule: z.string().min(1),
  units: z.object({ marketCap: z.string().min(1), emissions: z.string().min(1) }).strict(),
  limitations: z.array(z.string().min(1)).min(1), scientificAcceptance: z.literal(false),
}).strict();
export function validateCompanyCoverageJson(payload: unknown) {
  const report = coverageJsonSchema.parse(payload);
  const selection = currentSelection();
  if (selection?.overlays?.length) throw new Error("Coverage JSON requires baseline workbook without overlays");
  if (selection && report.sourceId !== selection.workbook) throw new Error("Coverage JSON source conflicts with active workbook selection");
  if (report.observationDate > report.informationCutoff.slice(0, 10)) throw new Error("Coverage JSON observation after cutoff");
  // Validate all exact primitive semantic IDs, not only the top-level schema.
  bindNestedOutput("companyCoverage", report);
  return report;
}
/** Shared central-writer contract; data is retained exactly, metadata travels
 * beside it in an envelope, and SHA-256 identifies the lossless data member. */
export async function prepareQualifiedJsonExport(payload: unknown, kind: ExportKind, filename: string,
  exportedAt: string, validatePayload: (value: unknown) => unknown) {
  validatePayload(payload);
  const identity = await exportJsonIdentity(payload);
  const envelope = { data: payload, interpretation: exportNotes(kind, filename, exportedAt),
    dataIdentity: { algorithm: "SHA-256", hash: identity.hash, serialization: "UTF-8 JSON.stringify(data, null, 2); no normalization" } };
  return { text: JSON.stringify(envelope, null, 2), hash: identity.hash };
}

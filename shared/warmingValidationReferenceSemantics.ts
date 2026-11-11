import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { WARMING_VALIDATION_REFERENCE as reference } from "./warmingValidationReference";

export const warmingReferenceFieldSpecs: [string, string, string, string][] = [
  ["version", "Dated shared reference content version", "igcc-2025-human-warming-reference-1", "identifier"],
  ["role", "Reference role, never causal/calibration use", "dated-validation-reference-only", "label"],
  ["calculationInput", "Not an engine input or replacement warming offset", "literal false", "boolean"],
  ["modelAcceptance", "Reference storage is not scientific model acceptance", "literal false", "boolean"],
  ["observable", "Human-induced global mean surface temperature, not GSAT or total warming", "human-induced GMST", "observable identifier"],
  ["temperatureBaseline", "Common anomaly reference period", "1850-1900 inclusive", "calendar-year period"],
  ["unit", "Temperature reference unit", "degC anomaly relative to temperatureBaseline", "unit identifier"],
  ["inventory.year", "Frozen native inventory year, not the warming reference year", "2024; does not select 2025 emissions", "calendar year"],
  ["inventory.version", "Existing inventory artifact version", "igcc-2024-candidate-1", "identifier"],
  ["inventory.basis", "Native gas inventory versus reporting convention", "Native species masses; AR6 GWP100 used for reporting only, never a temperature-response coefficient", "basis description"],
  ["inventory.status", "Existing inventory is not promoted by this reference", "candidate-not-promoted", "status"],
  ["headline2025.year", "Annual-labelled headline coordinate, not source publication year", "2025", "calendar year"],
  ["headline2025.valueC", "Required IGCC 2025 human-induced warming headline under the source SR1.5 definition", "Pinned source SR15 definition p50=1.37; not ordinary Annual=1.38, not an offset", "degC anomaly"],
  ["headline2025.definition", "Exact temporal-statistic distinction", "Final fitted linear-trend endpoint from 2011-2025 annual values; not the ordinary 2025 annual mean", "statistic description"],
  ["headline2025.trendStartYear", "Start of the source-defined headline trend window", "2011 inclusive", "calendar year"],
  ["headline2025.trendEndYear", "End/evaluation year of the source-defined headline trend window", "2025 inclusive", "calendar year"],
  ["decade.firstYear", "Start of distinct lagged-decade statistic", "2016 inclusive", "calendar year"],
  ["decade.lastYear", "End of distinct lagged-decade statistic", "2025 inclusive", "calendar year"],
  ["decade.meanC", "Assessed human-induced GMST mean for 2016-2025", "Pinned source decade p50=1.24; no averaging of marginal annual quantiles", "degC anomaly"],
  ["decade.p05C", "Lower bound of the source-assessed decadal range", "Pinned source decade p05=1.0; not dashboard/model-member p05", "degC anomaly"],
  ["decade.p95C", "Upper bound of the source-assessed decadal range", "Pinned source decade p95=1.5; not dashboard/model-member p95", "degC anomaly"],
  ["decade.rangeDefinition", "Source uncertainty scope, not a calibrated dashboard distribution", "Multi-method assessed p05-p95 for the 2016-2025 human-induced GMST mean", "range description"],
  ["source.assessment", "Exact source assessment version", "IGCC-2025a", "identifier"],
  ["source.publicationUrl", "Source assessment paper", "Forster et al. (2026), section 8, doi:10.5194/essd-18-3889-2026", "URL"],
  ["source.publicationDate", "Original publication day is not asserted by this reference", "literal null; no creation/retrieval-date substitution", "unknown ISO date"],
  ["source.dateQualification", "Explicit source-date limitation", "metadata creation and retrieval timestamps are not original publication dates", "text"],
  ["source.revision", "Pinned ClimateIndicator/data source revision", "d9726573dccd9381652432b58b38f670af493c1c", "Git revision"],
  ["source.path", "Exact headline source file", "data/base/anthropogenic_warming/Assessment-Update-2025_GMST_headlines.csv", "repository path"],
  ["source.url", "Immutable revision-qualified headline source URL", "ClimateIndicator/data raw URL at source.revision/source.path", "URL"],
  ["source.sha256", "Reviewed headline CSV byte identity, not evidence of model acceptance", "d419c3f7d513b42052f5635454853610739d8b5f1749f55b5df03862dfe28879", "SHA-256"],
  ["source.metadataDateCreated", "Source metadata creation timestamp, not publication/data year", "2026-07-22T10:13:14Z", "UTC timestamp"],
  ["source.retrievedAtUTC", "Previously retained source-retrieval timestamp, not a new request", "2026-11-10T12:09:00.306870+00:00", "UTC timestamp"],
  ["source.licence", "Source-specific bounded factual-reference permission", "CC-BY-4.0; does not extend rights to unrelated model/ancillary inputs", "licence identifier"],
  ["source.credit", "Author/multi-method attribution", "Smith/Walsh; ROF/Gillett, KCC/Ribes, GWI/Walsh; Forster et al. (2026)", "citation"],
  ["source.temporalDefinitionUrl", "Reviewed source temporal-method supplement", "doi:10.5194/essd-18-3889-2026-supplement", "URL"],
  ["source.temporalDefinitionLocator", "Exact method passages defining the SR1.5 trend endpoint", "S8.1.1 PDF29-30; Figure S12 PDF43", "document locator"],
  ["source.temporalDefinitionSha256", "Retained reviewed supplement byte identity", "c533320e534438ef760ac494d2eef030e2b9714d197557a9d6ec4c0d627ecd1d", "SHA-256"],
  ["qualification", "No numerical or scientific promotion through presentation", "No offset/calculation/model acceptance; no 1.38 replacement, fitted adjustment or GSAT/GMST conversion", "text"],
];

export const warmingValidationReferenceSemantics: OutputFieldSemantic[] = warmingReferenceFieldSpecs.map(([field, meaning, formula, unit]) => ({
  id: `warmingReference.${field}`, meaning, formula, unit, role: "Output",
  dependencies: [`WARMING_VALIDATION_REFERENCE.${field}`],
  source: `${reference.source.url}; ${reference.source.temporalDefinitionUrl}; reviewed public receipts docs/next-physical-evidence.json and docs/physical-attribution-evidence.json`,
  period: "2025 SR1.5 headline; 2016-2025 mean; 2024 inventory year separately; 1850-1900 anomaly baseline",
  geography: "Global human-induced GMST reference; not region-specific warming",
  status: "Dated validation reference only; no offset, model acceptance or scientific promotion",
  missingness: "Original publication day remains explicit null; no inference from source creation/retrieval time",
  uncertainty: "Published decadal assessed p05-p95 range only; not a matched model-member distribution or forecast calibration",
  scope: reference.qualification,
  asOfRule: "Pinned reviewed IGCC-2025a revision and exact source hashes; manual source review required for replacement",
}));

export function requireWarmingReferenceSemantic(id: string) {
  const semantic = warmingValidationReferenceSemantics.find(s => s.id === id);
  if (!semantic) throw new Error(`Unmapped warming-reference field: ${id}`);
  return semantic;
}

export const warmingReferenceExportBindings = {
  Reference: { id: "warmingReference.role", transform: "Explicit row title; headline and decade remain separate" },
  "Value (degC anomaly)": { id: "warmingReference.headline2025.valueC", transform: "Row discriminator: headline2025 uses headline2025.valueC; decade uses decade.meanC; never sum/subtract" },
  "Decadal lower p05 (degC)": { id: "warmingReference.decade.p05C", transform: "Decade row only; headline row null means not a decadal statistic, not unavailable source data" },
  "Decadal upper p95 (degC)": { id: "warmingReference.decade.p95C", transform: "Decade row only; headline row null means not a decadal statistic" },
  Statistic: { id: "warmingReference.headline2025.definition", transform: "Headline definition or decade.rangeDefinition according to explicit row title" },
  "Inventory year (not warming year)": { id: "warmingReference.inventory.year", transform: "2024 repeated as separate inventory metadata, never an anomaly offset" },
  Observable: { id: "warmingReference.observable", transform: "Identity" },
  Baseline: { id: "warmingReference.temperatureBaseline", transform: "Identity" },
  "Source URL": { id: "warmingReference.source.url", transform: "Identity; exact revision-qualified URL" },
  "Source SHA256": { id: "warmingReference.source.sha256", transform: "Identity" },
  Qualification: { id: "warmingReference.qualification", transform: "Identity" },
} as const;

export function warmingReferenceExportRows() {
  const common = {
    "Inventory year (not warming year)": reference.inventory.year,
    Observable: reference.observable, Baseline: reference.temperatureBaseline,
    "Source URL": reference.source.url, "Source SHA256": reference.source.sha256, Qualification: reference.qualification,
  };
  return [
    { Reference: "2025 human-induced SR1.5 headline", "Value (degC anomaly)": reference.headline2025.valueC,
      "Decadal lower p05 (degC)": null, "Decadal upper p95 (degC)": null, Statistic: reference.headline2025.definition, ...common },
    { Reference: "2016-2025 human-induced decadal mean", "Value (degC anomaly)": reference.decade.meanC,
      "Decadal lower p05 (degC)": reference.decade.p05C, "Decadal upper p95 (degC)": reference.decade.p95C,
      Statistic: reference.decade.rangeDefinition, ...common },
  ];
}

/** Fully self-describing JSON export; includes every source/period leaf plus
 * distinct value-column bindings for each row rather than an ambiguous unit. */
export function warmingReferenceExportDocument() {
  return { reference, rows: warmingReferenceExportRows(), columnBindings: warmingReferenceExportBindings,
    rowValueBindings: ["warmingReference.headline2025.valueC", "warmingReference.decade.meanC"],
    rowColumnBindings: [
      warmingReferenceExportBindings,
      { ...warmingReferenceExportBindings,
        "Value (degC anomaly)": { id: "warmingReference.decade.meanC", transform: "Identity; 2016-2025 mean, not the 2025 headline" },
        Statistic: { id: "warmingReference.decade.rangeDefinition", transform: "Identity; source-assessed decadal range definition" } },
    ],
    fieldSemantics: warmingValidationReferenceSemantics };
}

/** Exact finite serialization domain, including metadata cells. These reuse the
 * 38 scientific/reference definitions; metadata repetition is not new science. */
export function warmingReferenceExportLeafBindings() {
  const document = warmingReferenceExportDocument();
  const bindings: Record<string, { id: string; transform: string }> = {};
  const visit = (value: unknown, path: string, id: string, transform: string) => {
    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) visit(child, path ? `${path}.${key}` : key, id, transform);
    } else {
      requireWarmingReferenceSemantic(id);
      bindings[path] = { id, transform };
    }
  };
  for (const [field] of warmingReferenceFieldSpecs) {
    const value = field.split(".").reduce<unknown>((v, key) => (v as Record<string, unknown>)[key], reference);
    visit(value, `reference.${field}`, `warmingReference.${field}`, "Identity; shared reference leaf");
  }
  document.rows.forEach((row, i) => {
    for (const [column, value] of Object.entries(row)) {
      const binding = document.rowColumnBindings[i][column as keyof typeof warmingReferenceExportBindings];
      visit(value, `rows.${i}.${column}`, binding.id, binding.transform);
    }
  });
  for (const [column, binding] of Object.entries(document.columnBindings))
    visit(binding, `columnBindings.${column}`, binding.id, "Serialization metadata: semantic ID and transformation, not a new measured value");
  document.rowValueBindings.forEach((id, i) => visit(id, `rowValueBindings.${i}`, id, "Explicit numeric-row semantic identifier"));
  document.rowColumnBindings.forEach((columns, i) => {
    for (const [column, binding] of Object.entries(columns))
      visit(binding, `rowColumnBindings.${i}.${column}`, binding.id, "Exact row-specific semantic ID/transform metadata");
  });
  document.fieldSemantics.forEach((semantic, i) =>
    visit(semantic, `fieldSemantics.${i}`, semantic.id, "Qualified field-definition metadata, not additional observation/calibration inputs"));
  return bindings;
}

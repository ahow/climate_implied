import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { producerDownloadSemantics } from "./producerDownloadSemantics";
import { valuationPEDerivations } from "./derivedConsumer";

type Field = [path: string, meaning: string, formula: string, unit: string];
const fields: Field[] = [
  ["version", "Supplemental transformed-consumer lineage contract", "Literal derived-consumer-lineage-1", "contract label"],
  ["derivationHash", "Identity of the closed derivation including exact field map, units and selected indices", "SHA-256 canonical finite JSON of derivation", "SHA-256"],
  ["dataIdentity.hash", "Identity of actual normalized exported observation rows, not native parent bytes", "SHA-256 of JSON rows with sorted keys, missing cells null, preserved row order", "SHA-256"],
  ["dataIdentity.method", "Exact exported-row hash serialization declaration", "Literal method selected by derivedConsumerIdentity", "text"],
  ["chartIdentity.hash", "Identity of exact visible chart rows including counts and epoch dates", "SHA-256 canonical finite JSON of closed derivation chart rows at retainedIndices; absent fields explicit null", "SHA-256"],
  ["chartIdentity.method", "Exact chart-row hash serialization declaration", "Literal method selected by derivedConsumerIdentity", "text"],
  ["originalHistoricalExport", "New prospective export is not recovered original historical bytes", "Literal false", "boolean"],
  ["scientificAcceptance", "Consumer lineage does not grant scientific acceptance or data approval", "Literal false", "boolean"],
  ["meaning", "Explicit prospective-output and acceptance boundary", "Fixed response-derived consumer explanation", "text"],
  ["derivation.version", "Closed producer-to-P/E consumer transformation version", "Literal valuation-pe-consumer-1", "contract label"],
  ["derivation.key", "One exact supported consumer, not an arbitrary formula", "One of carbon, sdg, ambition", "enum"],
  ["derivation.scenario", "Required exact server producer scenario for this consumer", "valuationPEDerivations[key].scenario; mismatches refuse", "producer scenario label"],
  ["derivation.filter", "Date-only exclusion rule; unavailable P/E is not filtered into a complete-case population", "Exclude missing or invalid parsed observation dates only", "text"],
  ["derivation.order", "Parent order and duplicate observations retained", "No sort, deduplication or current-selection replacement", "text"],
  ["derivation.retainedIndices[]", "Exact parent-array positions represented by exported and visible chart rows", "Zero-based parent index where parsed observation date is finite", "zero-based index"],
  ["derivation.excludedIndices[]", "Exact excluded parent-array positions", "Zero-based parent index where observation date is missing or invalid", "zero-based index"],
  ["derivation.transformation", "Finite P/E rounding and UTC calendar export-date construction", "Math.round(value*100)/100 if finite; otherwise null. Date rendered en-US UTC with numeric year/day and short month", "text"],
  ["derivation.chartTransformation", "Construction of timestamp, rounded P/E and identity-mapped count fields", "Same retained indices/order; date as epoch milliseconds; counts from exact native fields; missing hash cells null", "text"],
  ["derivation.chartUnits.date", "Chart observation-time unit", "Parsed native observation date, not export/publication time", "milliseconds since Unix epoch (UTC)"],
  ["derivation.chartUnits.pe", "Chart P/E unit", "Rounding does not alter dimensionless quantity", "dimensionless multiple (x)"],
  ["derivation.chartUnits.counts", "Tooltip group count unit", "Native reported group count; absent count is unavailable, not zero", "companies"],
  ["derivation.missingness", "Unavailable P/E never becomes zero; invalid dates excluded", "Explicit null export cells; zero retained; no date inference", "text"],
  ["sheetsHashMethod", "Worksheet cell hash serialization, explicitly excluding the lineage sheet itself", "Canonical finite JSON of header:1 raw worksheet cells, defval:null, exact row/column order", "text"],
  ["captureBoundary", "Browser output is a prospective capture, not a signature, original export or approval", "Fixed capture disclosure; no installed lifecycle or publication authority inferred", "text"],
  ["sheets[].name", "Exact captured workbook sheet name", "book.SheetNames[index], excluding Derived lineage to avoid self-hashing", "worksheet label"],
  ["sheets[].index", "Exact captured workbook sheet order", "Zero-based index in book.SheetNames", "zero-based index"],
  ["sheets[].cellsHash", "Exact actual worksheet-cell identity", "SHA-256 canonical finite JSON of decoded header:1 raw cells with defval:null", "SHA-256"],
  ["sheets[].role", "Distinguishes transformed parent observations from consumer-authored metadata", "First sheet is derived observations; remaining sheets are captured consumer metadata", "text"],
  ["sheets[].derivation", "Data-sheet derivation hash or separately versioned metadata writer", "First sheet derivationHash; otherwise central-download-writer-metadata-1", "SHA-256 or contract label"],
  ["sheets[].units", "Metadata worksheet unit declaration, not an additional native financial quantity", "Literal metadata-cell caveat on supplemental sheets; data sheet uses explicit column-unit map", "metadata text"],
  ["sheets[].order", "Exact captured worksheet order policy", "No row/column sorting or deduplication during readback", "text"],
  ["sheet.Field", "Exact lineage metadata property name in the Derived lineage worksheet", "Object.entries(lineage) property name, one row per property, preserved construction order", "metadata property name"],
  ["sheet.Value", "Unambiguous JSON encoding of the corresponding lineage property value", "JSON.stringify(value); nested leaves bound by derivedConsumer semantics before serialization", "JSON text"],
];
const columnUnits = new Set<string>(["Date"]);
const nativeChartFields = new Set<string>(["date"]);
for (const spec of Object.values(valuationPEDerivations)) {
  columnUnits.add(`${spec.highLabel} P/E (x)`);
  columnUnits.add(`${spec.lowLabel} P/E (x)`);
  for (const key of [spec.highKey, spec.lowKey,
    spec.highKey === "bestPE" ? "bestCount" : "cleanCount",
    spec.lowKey === "worstPE" ? "worstCount" : "dirtyCount"]) nativeChartFields.add(key);
}
for (const column of Array.from(columnUnits)) {
  fields.push([`derivation.fields.${column}`, "Exact source field selected for this exported column",
    column === "Date" ? "Native date" : "Exact native P/E field from valuationPEDerivations[key]", "source field name"]);
  for (const prefix of ["derivation.units", "sheets[].units"])
    fields.push([`${prefix}.${column}`, "Exact declared exported-column unit; no physical interpretation inferred",
      column === "Date" ? "UTC calendar observation date" : "Dimensionless P/E multiple after finite rounding",
      column === "Date" ? "UTC calendar date" : "dimensionless multiple (x)"]);
}
for (const key of Array.from(nativeChartFields))
  fields.push([`derivation.chartFields.${key}`, "Exact native parent field mapped to this chart key",
    "Closed valuationPEDerivations field map; no alias or current-selection substitution", "source field name"]);

const context = {
  role: "Output" as const,
  dependencies: ["verified retained producer response", "closed valuation-pe-consumer-1 derivation", "actual central workbook writer"],
  source: "shared/derivedConsumer.ts; client/src/lib/producer-download.ts; client/src/lib/derived-consumer-workbook.ts",
  period: "Retained parent observation periods; prospective export capture is not original publication time",
  geography: "Exact retained parent population; no additional geography inference",
  status: "Supplemental consumer engineering lineage, not scientific acceptance or source approval",
  missingness: "Unregistered rows/clones remain unbound; changed registered source/output, wrong scenario or caller-supplied capture refuses. No fallback to current inputs.",
  uncertainty: "Identity and deterministic transformation only; no calibrated uncertainty, signature, execution-container attestation or causal validation",
  scope: "Three P/E chart/workbook consumers and their captured supplemental metadata sheets only. No original cohort closure, arbitrary callback certification or historical export recovery.",
  asOfRule: "Parent source availability remains its retained declaration; export time does not authenticate original vintage",
};
export const derivedConsumerSemantics: OutputFieldSemantic[] = [
  ...fields.map(([path, meaning, formula, unit]) => ({ id: `derivedConsumer.${path}`, meaning, formula, unit, ...context })),
  ...producerDownloadSemantics.map(field => ({ ...field,
    id: field.id.replace(/^retainedProducer\./, "derivedConsumer.parent."),
    scope: context.scope, source: context.source,
    formula: `Exact unchanged consumed server parent proof: ${field.formula}`,
  })),
];
export const derivedConsumerSheetBindings = {
  Field: { id: "derivedConsumer.sheet.Field", transform: "Exact lineage property name; no aliases or duplicate rows" },
  Value: { id: "derivedConsumer.sheet.Value", transform: "JSON.stringify property value; strict nested semantic binding before serialization" },
};

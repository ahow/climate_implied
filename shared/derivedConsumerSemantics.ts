import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { producerDownloadSemantics } from "./producerDownloadSemantics";
import { valuationPEDerivations } from "./derivedConsumer";
import { readonlyConsumerFieldMaps, readonlyConsumerColumnUnit } from "./readonlyConsumer";

type Field = [path: string, meaning: string, formula: string, unit: string];
const fields: Field[] = [
  ["version", "Supplemental transformed-consumer lineage contract", "Literal derived-consumer-lineage-1", "contract label"],
  ["derivationHash", "Identity of the closed derivation including exact field map, units and selected indices", "SHA-256 canonical finite JSON of derivation", "SHA-256"],
  ["dataIdentity.hash", "Identity of actual normalized exported observation rows, not native parent bytes", "SHA-256 of JSON rows with sorted keys, missing cells null, preserved row order", "SHA-256"],
  ["dataIdentity.method", "Exact exported-row hash serialization declaration", "Literal method selected by derivedConsumerIdentity", "text"],
  ["chartIdentity.hash", "Identity of exact visible chart rows including retained counts/dates or signal joins", "SHA-256 canonical finite JSON of closed derivation visible chart rows; absent values explicit null; declared filter and join/order policy", "SHA-256"],
  ["chartIdentity.method", "Exact chart-row hash serialization declaration", "Literal method selected by derivedConsumerIdentity", "text"],
  ["originalHistoricalExport", "New prospective export is not recovered original historical bytes", "Literal false", "boolean"],
  ["scientificAcceptance", "Consumer lineage does not grant scientific acceptance or data approval", "Literal false", "boolean"],
  ["meaning", "Explicit prospective-output and acceptance boundary", "Fixed response-derived consumer explanation", "text"],
  ["derivation.version", "Closed producer-to-consumer transformation version", "valuation-pe-consumer-1, signal-chained-consumer-1 or readonly-diff-consumer-1", "contract label"],
  ["derivation.key", "One exact supported consumer, not an arbitrary formula", "carbon, sdg, ambition, signal-comparison, group-gap, signal-cumulative, signal-active, gap-cumulative, gap-active, version-diff or affected-analyses", "enum"],
  ["derivation.scenario", "Required exact first server producer scenario for this consumer", "Closed registry scenario; additional parents checked individually by slot; mismatches refuse", "producer scenario label"],
  ["derivation.filter", "Date-only exclusion rule; unavailable P/E is not filtered into a complete-case population", "Exclude missing or invalid parsed observation dates only", "text"],
  ["derivation.order", "Versioned exact ordering and duplicate policy", "P/E preserves native order/duplicates; signal comparison uses timestamp union ascending last per-parent duplicate; paired backtests use exact native-date-key union sorted with last per-parent duplicate. No current-source replacement", "text"],
  ["derivation.retainedIndices[]", "Exact positions represented by visible/exported rows", "P/E: native retained parent indices. Signal: joined chart indices; exact pre-join native parent indices separately in intermediates", "zero-based index"],
  ["derivation.excludedIndices[]", "Exact excluded positions under the versioned contract", "P/E: invalid-date native indices. Signal: no post-join exclusion; per-parent date exclusions in intermediates", "zero-based index"],
  ["derivation.transformation", "Closed numeric/date export construction", "P/E finite two-decimal rounding and UTC date; signal native P/E Gordon difference or rounded decimal backtest conversion with original dates or captured-timezone month labels, as declared", "text"],
  ["derivation.chartTransformation", "Closed parent-to-chart construction", "P/E retained indices/order/counts; signal exact projected intermediates and declared union/duplicate policy; missing hash values null", "text"],
  ["derivation.chartUnits.date", "Chart observation-time unit", "Valuation parsed epoch milliseconds; backtest unchanged native date; never export/publication time", "declared observation-time unit"],
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
fields.push(
  ["derivation.selection", "Closed signal or group measure selection", "carbon_intensity, sdg_exposure, sdg_alignment or decarb_ambition; whole backtest parent summary.signal must agree", "enum"],
  ["derivation.dateLabelTimezone", "Actual runtime timezone used for month labels", "Intl.DateTimeFormat().resolvedOptions().timeZone at closed derivation replay", "IANA timezone"],
  ["derivation.chartUnits.value", "Chained chart ordinate unit", "Valuation Gordon differences in percentage points; backtest decimal conversions in percent", "percentage points or percent, as declared"],
  ["intermediates[].parentIndex", "Exact retained parent used for this intermediate stage", "Zero-based position in ordered parents proof array", "zero-based index"],
  ["intermediates[].retainedIndices[]", "Exact native observation indices projected before join", "Indices with valid parsed observation dates; native order retained before explicit join", "zero-based index"],
  ["intermediates[].excludedIndices[]", "Exact invalid-date native observation indices omitted", "Indices with missing/invalid date; no inferred dates", "zero-based index"],
  ["intermediates[].rows[]", "Empty projected intermediate stage", "Empty only when native parent contains no dated observations; missing parent still refuses capture", "empty observation array"],
  ["intermediates[].units", "Native-to-intermediate stage unit declaration", "Closed valuation P/E to percentage-point difference or decimal backtest to percent conversion", "text"],
);
for (const [field, meaning, formula, unit] of [
  ["sourceIndex", "Native observation position before joins", "Exact parent array/series index", "zero-based index"],
  ["date", "Intermediate observation date", "Valuation: parsed epoch milliseconds; backtest: unchanged native date", "epoch milliseconds or native observation date"],
  ["dateLabel", "Valuation month label", "en-US short month and numeric year in captured runtime timezone", "calendar month label"],
  ["value", "Intermediate group earnings-yield gap", "(8-100/firstPE)-(8-100/secondPE), finite positive P/E only; nonfinite result null", "percentage points"],
  ["benchmark", "Intermediate benchmark cumulative return", "Math.round((benchmarkCumulative-1)*10000)/100; unavailable/nonfinite/overflow null", "percent"],
  ["portfolio", "Intermediate portfolio cumulative return", "Math.round((portfolioCumulative-1)*10000)/100; unavailable/nonfinite/overflow null", "percent"],
  ["activeReturn", "Intermediate active return", "Math.round(activeReturn*10000)/100; unavailable/nonfinite/overflow null", "percent"],
  ["trackingError", "Intermediate annualized expanding tracking error", "Math.round(trackingError*10000)/100; unavailable/nonfinite/overflow null", "percent"],
] as Field[]) fields.push([`intermediates[].rows[].${field}`, meaning, formula, unit]);
for (const field of ["date", "firstPE", "secondPE", "benchmark", "portfolio", "activeReturn", "trackingError"])
  fields.push([`intermediates[].fields.${field}`, "Exact native field used by this projected intermediate",
    "Closed signal registry field map; first/second native P/E fields or whole backtest response series field", "source field path"]);
const signalColumns = [
  "Carbon intensity group earnings-yield gap (pp)", "SDG group earnings-yield gap (pp)",
  "Ambition group earnings-yield gap (pp)",
  ...["Carbon Intensity", "SDG Alignment", "Decarb Ambition"].map(label => `Group earnings-yield gap - ${label} (pp)`),
  "Benchmark Cumulative Return (%)", "Legacy peer-yield ranking cumulative return (%)",
  ...["Carbon Intensity", "SDG Exposure", "Decarb Ambition"].map(label => `${label} Portfolio Cumulative Return (%)`),
  ...["Carbon Intensity", "SDG Alignment", "Decarb Ambition"].map(label => `${label}-Driven Cumulative Return (%)`),
  "Active Return (%)", "Tracking Error (ann.) (%)", "Tracking Error (ann. %)",
];
for (const column of signalColumns) {
  fields.push([`derivation.fields.${column}`, "Closed chart-to-export column mapping for a signal consumer",
    "Projection of exact intermediate/joined chart rows; native stage field mapping retained in intermediates", "source field expression"]);
  for (const prefix of ["derivation.units", "sheets[].units"])
    fields.push([`${prefix}.${column}`, "Declared signal-consumer export column unit",
      column.endsWith("(pp)") ? "Gordon baseline difference, no physical reduction interpretation" : "Decimal return/wealth/TE converted to percent by closed Math.round transform",
      column.endsWith("(pp)") ? "percentage points" : "percent"]);
}
for (const field of ["value", "dateLabel", "carbonIntensity", "sdgExposure", "decarbAmbition",
  "impliedRate", "benchmark", "portfolio", "valuation", "activeReturn", "trackingError"])
  fields.push([`derivation.chartFields.${field}`, "Closed field map for chained chart stage",
    "Whole response series field or native P/E pair; second-parent valuation portfolio selected explicitly", "source field path"]);
const columnUnits = new Set<string>(["Date"]);
// Finite readonly projections, not wildcard column acceptance. Empty native
// arrays still declare their complete closed field/unit domains.
const readonlyColumns = new Set(Object.values(readonlyConsumerFieldMaps).flatMap(map => Object.keys(map)));
for (const column of Array.from(readonlyColumns)) {
    for (const prefix of ["derivation.fields", "derivation.chartFields"])
      fields.push([`${prefix}.${column}`, "Exact readonly source-report projection field",
        "Closed readonly-diff-consumer-1 map; source and scanned result values never published", "source report field path"]);
    for (const prefix of ["derivation.units", "sheets[].units"])
      fields.push([`${prefix}.${column}`, "Exact readonly comparison column unit",
        "Native source-cell count or exact retained report identifier/text; no model or investment inference", readonlyConsumerColumnUnit(column)]);
}
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
      column === "Date" ? "P/E UTC calendar date; signal valuation captured-timezone month label; backtest unchanged native date, as declared" : "Dimensionless P/E multiple after finite rounding",
      column === "Date" ? "declared observation calendar date/month" : "dimensionless multiple (x)"]);
}
for (const key of Array.from(nativeChartFields))
  fields.push([`derivation.chartFields.${key}`, "Exact native parent field mapped to this chart key",
    "Closed valuationPEDerivations field map; no alias or current-selection substitution", "source field name"]);

const context = {
  role: "Output" as const,
   dependencies: ["verified retained producer responses", "closed valuation-pe-consumer-1, signal-chained-consumer-1 or readonly-diff-consumer-1 derivation", "actual central workbook writer"],
  source: "shared/derivedConsumer.ts; shared/readonlyConsumer.ts; client/src/lib/producer-download.ts; client/src/lib/derived-consumer-workbook.ts",
  period: "Retained parent observation periods; prospective export capture is not original publication time",
  geography: "Exact retained parent population; no additional geography inference",
  status: "Supplemental consumer engineering lineage, not scientific acceptance or source approval",
   missingness: "Unregistered rows/clones remain unbound; changed registered source/output, wrong scenario or caller-supplied capture refuses. Signal chains additionally require every ordered parent, request-bound active selection, equal materialInputsId/codeArchiveId/modelVersion/orderedSnapshotHashes. Material archives exclude scenario and calculator settings, so different material IDs here cannot be excused by different scenarios. No fallback to current inputs.",
  uncertainty: "Identity and deterministic transformation only; no calibrated uncertainty, signature, execution-container attestation or causal validation",
   scope: "Three P/E, six signal/gap and two readonly source-comparison consumers, exact intermediate chains and captured supplemental metadata sheets only. No original cohort closure, arbitrary callback certification or historical export recovery. Original 1000/1001 census unchanged.",
  asOfRule: "Parent source availability remains its retained declaration; export time does not authenticate original vintage",
};
export const derivedConsumerSemantics: OutputFieldSemantic[] = [
  ...fields.map(([path, meaning, formula, unit]) => ({ id: `derivedConsumer.${path}`, meaning, formula, unit, ...context })),
  ...producerDownloadSemantics.map(field => ({ ...field,
    id: field.id.replace(/^retainedProducer\./, "derivedConsumer.parent."),
    scope: context.scope, source: context.source,
    formula: `Exact unchanged consumed server parent proof: ${field.formula}`,
  })),
  ...producerDownloadSemantics.map(field => ({ ...field,
    id: field.id.replace(/^retainedProducer\./, "derivedConsumer.parents[]."),
    scope: context.scope, source: context.source,
    formula: `Exact ordered consumed server parent proof; not current-source substitution: ${field.formula}`,
  })),
];
export const derivedConsumerSheetBindings = {
  Field: { id: "derivedConsumer.sheet.Field", transform: "Exact lineage property name; no aliases or duplicate rows" },
  Value: { id: "derivedConsumer.sheet.Value", transform: "JSON.stringify property value; strict nested semantic binding before serialization" },
};

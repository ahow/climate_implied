import { nativeExportColumns, nativeExportRow } from "./nativeExport";
import { nativeResidualDiagnosticsSchema } from "./nativeThresholdSchema";
import { THRESHOLD_DIAGNOSTIC_LABEL } from "./thresholdDiagnostic";

export const NATIVE_PRODUCER_SCENARIO = "source-backed:native-candidate-1";
export const nativeScenarios = {
  constant: "constant-activity-control",
  transition: "illustrative-transition-not-calibrated",
  dashboard: "dated-dashboard-input-diagnostic-not-a-policy-forecast",
} as const;
export type NativeScenario = keyof typeof nativeScenarios;
export type NativeConsumerKey = "native-thresholds" | "native-trajectory";
export const nativeReviewYears = [2024, 2030, 2050, 2100] as const;
export const nativeThresholdFields = {
  Context: "contextLabel", Diagnostic: "diagnostic.label", Version: "diagnostic.version",
  [THRESHOLD_DIAGNOSTIC_LABEL]: "diagnostic.year", Status: "diagnostic.status", Reason: "diagnostic.reason",
  "Baseline year": "diagnostic.baselineYear", "Selected 2024 baseline": "diagnostic.baselineValue",
  "Baseline evidence": "diagnostic.baselineEvidenceId", "Threshold fraction": "diagnostic.thresholdFraction",
  "Threshold value": "diagnostic.thresholdValue", "Horizon year": "diagnostic.horizonYear",
  Selection: "diagnostic.basis.selectionId", Trajectory: "diagnostic.basis.trajectoryId",
  Member: "diagnostic.basis.memberId", "Gas basis": "diagnostic.basis.gasBasis", Unit: "diagnostic.basis.unit",
  "Crossing rule": "diagnostic.crossingRule", "Not net zero": "diagnostic.notNetZero", Gas: "gas", Region: "region",
} as const;
export const nativeConsumerFieldMaps = {
  "native-thresholds": Object.fromEntries(Object.entries(nativeThresholdFields)
    .map(([column, path]) => [column, `residualDiagnostics.records[].${path}`])),
  "native-trajectory": Object.fromEntries(nativeExportColumns.map(c => [c.column, `result.trajectory[].${c.path.join(".")}`])),
};
export function nativeConsumerUnit(key: NativeConsumerKey, column: string) {
  if (key === "native-trajectory") return column === "Year" ? "calendar year" :
    column.includes("GtCO2e") ? "GtCO2e/year; AR6 GWP100 reporting only" : "Mt named native gas/year";
  return ["Selected 2024 baseline", "Threshold value"].includes(column) ? "record-specific native mass/year; see Unit" :
    ["Baseline year", "Horizon year", THRESHOLD_DIAGNOSTIC_LABEL].includes(column) ? "calendar year or null" :
      column === "Threshold fraction" ? "fraction" : column === "Not net zero" ? "boolean" : "text or null";
}
export function deriveNativeConsumer(parent: any, key: NativeConsumerKey, scenario: NativeScenario) {
  if (!Object.hasOwn(nativeScenarios, scenario) || !Object.hasOwn(nativeConsumerFieldMaps, key) ||
    parent?.result?.version !== "native-emissions-candidate-2" ||
    parent.result.scenario?.name !== nativeScenarios[scenario] ||
    parent.result.productionEligible !== false || parent.result.centralConsumptionAllowed !== false ||
    parent.result.temperature !== null || !Array.isArray(parent.result.trajectory) || !parent.result.trajectory.length)
    throw new Error("Native consumer requires the actual matching conditional candidate response");
  const diagnostics = nativeResidualDiagnosticsSchema.parse(parent.residualDiagnostics);
  const chartRows = key === "native-trajectory" ? nativeReviewYears.map(year => {
    const point = parent.result.trajectory.find((entry: any) => entry.year === year);
    return { Year: year, "Reporting emissions (GtCO2e, AR6 GWP100)":
      point && Number.isFinite(point.reportingGtCO2e) ? point.reportingGtCO2e : null };
  }) : diagnostics.records;
  const rows = key === "native-trajectory" ? parent.result.trajectory.map(nativeExportRow) : diagnostics.records.map(record => {
    const d = record.diagnostic;
    return {
      Context: `${record.region} / ${record.gas} / ${record.memberId}`, Diagnostic: d.label, Version: d.version,
      [THRESHOLD_DIAGNOSTIC_LABEL]: d.year, Status: d.status, Reason: d.reason,
      "Baseline year": d.baselineYear, "Selected 2024 baseline": d.baselineValue,
      "Baseline evidence": d.baselineEvidenceId, "Threshold fraction": d.thresholdFraction,
      "Threshold value": d.thresholdValue, "Horizon year": d.horizonYear,
      Selection: d.basis?.selectionId ?? null, Trajectory: d.basis?.trajectoryId ?? null,
      Member: d.basis?.memberId ?? null, "Gas basis": d.basis?.gasBasis ?? null,
      Unit: d.basis?.unit ?? null, "Crossing rule": d.crossingRule, "Not net zero": d.notNetZero,
      Gas: record.gas, Region: record.region,
    };
  });
  const fields = nativeConsumerFieldMaps[key];
  return { rows, chartRows, derivation: {
    version: "native-candidate-consumer-1", key, scenario: NATIVE_PRODUCER_SCENARIO,
    fields, units: Object.fromEntries(Object.keys(fields).map(column => [column, nativeConsumerUnit(key, column)])),
    filter: "All native response records; no filtering, downsampling or complete-case deletion",
    chartFilter: key === "native-trajectory" ?
      "Actual table preview:2024,2030,2050,2100 in that fixed order; first native point at each year, Year and finite reportingGtCO2e only; absent/nonfinite preview value null. Preview locale/two-decimal text is presentation, not exported rounding. Export retains all77 native years and35 columns." :
      "All native residual records supplied to the actual diagnostic table, unchanged source order; raw diagnostics retained, not formatted/rounded display strings",
    order: "Preserve native array order and duplicates; no sorting or deduplication",
    retainedIndices: rows.map((_: unknown, index: number) => index), excludedIndices: [] as number[],
    transformation: "Identity finite native columns; missing/nonfinite trajectory cells null, never zero. Threshold context joins region / gas / member. No gas conversion, baseline substitution, quantiles, calibration or temperature claim.",
  } };
}

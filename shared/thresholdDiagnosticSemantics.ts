import { FIXED_5GT_DESCRIPTOR } from "./quantityDescriptors";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { THRESHOLD_DIAGNOSTIC_LABEL, THRESHOLD_DIAGNOSTIC_VERSION } from "./thresholdDiagnostic";

const context = {
  source: "Requires explicit selected source-evidenced2024 emissions baseline or explicitly selected/captured model initial condition with genuine input lineage. Legacy60.3*(carbonIntensity/0.32) is an unverified assumption; a generated2024 point/output hash is not input provenance. Current legacy API callers supply no qualifying emissions baseline record, so withhold.",
  period: "2024 baseline; selected annual trajectory through its actual final simulated year",
  geography: "Same population/geography as selected trajectory; regional legacy outputs are global intensity counterfactuals, not regional emissions inventories",
  status: "Bounded/conditional estimate or Unavailable; diagnostic only; no scientific or policy-target verdict",
  missingness: "Withheld when own evidenced 2024 baseline is missing/invalid/mismatched; no current borrowing/default. Right-censored when evidenced threshold is not reached. Null is never zero.",
  uncertainty: "Model-conditional selected p50 trajectory; no calibrated crossing-year probability; not an individual simulation member",
  scope: "Residual diagnostic, not physical net zero. Separate legacy fixed-5gt-v1 is never substituted. Archived raw research and original-vintage evidence are unchanged.",
  asOfRule: "Effective selected input/run content identities only; not original information availability. Never borrow a current2024 point for another selected trajectory.",
};
const specs: [string, string, string, string, string[]][] = [
  ["", "Selected 5%-of-2024 residual diagnostic object", "versioned JSON object", "calculateThresholdDiagnostic(selected annual trajectory, selected matching baseline evidence)", []],
  ["version", "Version of selected2024 residual diagnostic", "version identifier", THRESHOLD_DIAGNOSTIC_VERSION, []],
  ["label", "Exact diagnostic display label", "text", THRESHOLD_DIAGNOSTIC_LABEL, []],
  ["year", THRESHOLD_DIAGNOSTIC_LABEL, "calendar year or null", "First selected annual year>=2024 with p50 <= 0.05*evidenced selected2024 baseline; equality includes final simulated year; null if withheld or right-censored", ["baselineValue", "thresholdValue", "horizonYear", "status", "selectedTrajectory[].year", "selectedTrajectory[].p50"]],
  ["status", "Available crossing, right-censoring, or withheld evidence state", "reached | right-censored | withheld", "Missing/mismatched/invalid matching2024 evidence=>withheld; first annual crossing=>reached; else=>right-censored at actual horizon", ["year", "baselineEvidenceId", "basis", "horizonYear"]],
  ["reason", "Specific reason baseline evidence is withheld", "text or null", "Explicit validation error for withheld diagnostic; null for reached/right-censored", ["status", "basis", "baselineEvidenceId"]],
  ["baselineYear", "Required reference year, not current starting year", "calendar year", "2024", []],
  ["baselineValue", "Explicitly evidenced selected2024 annual emissions on the same basis", "same annual emissions unit as basis.unit, or null", "Explicit selected baseline2024.value backed by source or captured-model-input lineage; exact equality with selected2024 trajectory point if present. Never infer input evidence from generated/default model output; null when withheld", ["basis", "baselineEvidenceId", "selectedTrajectory[year=2024].p50"]],
  ["baselineEvidenceId", "Explicit source/captured-input evidence for selected2024 baseline", "source/captured-input identifier or null", "Reference supplied with the selected baseline input; source-evidenced or explicitly captured conditional-model initial condition, not output self-hash or fabricated observed vintage", ["basis"]],
  ["thresholdFraction", "Residual fraction of selected2024 baseline", "fraction, not percentage points", "0.05", []],
  ["thresholdValue", "Selected five-percent residual threshold", "same annual emissions unit as basis.unit, or null", "0.05*baselineValue if evidenced and matched; otherwise null; NOT fixed5Gt", ["thresholdFraction", "baselineValue", "status"]],
  ["horizonYear", "Exact final simulated year used for censoring", "calendar year", "selectedTrajectory.at(-1).year; no interpolation/extrapolation or manufactured2100 default", ["selectedTrajectory[].year"]],
  ["basis", "Exact selected population/trajectory/member/gas/unit identity", "identity object or null", "Supplied selected basis or null if unavailable; all five fields must equal baseline evidence", []],
  ["basis.selectionId", "Selected input-content identity", "content/run identifier", "Effective selected input content hash; not a fallback current dataset", []],
  ["basis.trajectoryId", "Selected scenario/trajectory content identity", "content/run identifier", "Effective selected model inputs plus scenario/year/runs identity", []],
  ["basis.memberId", "Selected member or aggregate-trajectory identity", "member identifier", "For current legacy APIs: annual-p50-trajectory-not-an-individual-simulation-member; never mix ensemble members", []],
  ["basis.gasBasis", "Gas/GWP basis of both baseline and selected trajectory", "gas-basis identifier", "Current legacy APIs: aggregate-GHG-legacy-unspecified-GWP; not native CO2 or a verified GWP inventory", []],
  ["basis.unit", "Native reported annual emissions unit of selected trajectory", "unit identifier", "Current legacy APIs: GtCO2e-legacy-unreconciled; no gas or unit conversion", []],
  ["crossingRule", "Exact first-reach and censoring rule", "text", "first annual value <= 0.05 * selected 2024 baseline; no interpolation or extrapolation", []],
  ["notNetZero", "Explicit positive residual / physical-net-zero separation", "boolean", "true", []],
];
const prefixes = [
  "thresholdDiagnostic", "projection.metrics.thresholdDiagnostic", "historical.thresholdDiagnostic",
  "category.thresholdDiagnostic", "regional.thresholdDiagnostic",
  ...["all", "technology", "policy", "corporate", "socioeconomic", "financial", "emissions"]
    .map(category => `categoryHistory.${category}.thresholdDiagnostic`),
];
export const thresholdDiagnosticSemantics: OutputFieldSemantic[] = prefixes.flatMap(prefix =>
  specs.map(([field, meaning, unit, formula, dependencies]) => ({
    ...context, id: field ? `${prefix}.${field}` : prefix, meaning, unit, formula, dependencies,
    role: "Output" as const,
  })),
);
thresholdDiagnosticSemantics.push({
  ...context, id: "thresholdDiagnostic.contextLabel", role: "Output",
  meaning: "Display scenario/reference-input-year label accompanying this exported source row",
  unit: "text or null",
  formula: "Source UI scenario/region name and/or historical reference input year; null if not supplied; not an original-vintage forecast label",
  dependencies: ["sourceUiRow"],
});
for (const [field, meaning, unit, formula] of [
  ["version", "Version of separate fixed5Gt comparator", "version identifier", "fixed-5gt-v1"],
  ["year", FIXED_5GT_DESCRIPTOR.label, "calendar year or null", "first annual p50<=5, else null at selected horizon; NOT5% or net zero"],
  ["thresholdValue", "Separate fixed5Gt constant, not percentage", "GtCO2e legacy unreconciled", "5"],
  ["unit", "Legacy comparator emissions reporting unit", "unit identifier", "GtCO2e; unspecified legacy GWP"],
  ["notNetZero", "Explicit legacy residual versus physical zero separation", "boolean", "true"],
]) thresholdDiagnosticSemantics.push({
  ...context, id: `projection.metrics.legacyFixed5Gt.${field}`, meaning, unit, formula,
  role: "Output", dependencies: [],
});

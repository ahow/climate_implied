import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { thresholdDiagnosticSemantics } from "./thresholdDiagnosticSemantics";

const context = {
  source: "Captured candidate inventory2024.json cells; pinned source revision e81bb760b66ab182f9052d8d4218d42a97acbd75 and retained EDGAR/report/metrics hashes; build-emissions-inventory.ts. Regional adapter uses actual supplied/captured regional input cells, not output hashes.",
  period: "2024 initial input and actual simulated annual horizon",
  geography: "Explicit records[].region; Global candidate or supplied regional account, never borrowed across regions",
  status: "Bounded/conditional native-mass residual diagnostic; candidate not promoted; not physical net zero",
  missingness: "Missing/inconsistent captured input lineage, nonpositive baseline or mismatched gas/member/region basis withholds; otherwise no crossing is right-censored at actual horizon",
  uncertainty: "Conditional deterministic native scenario or explicitly supplied regional member; not calibrated crossing probability or forecast",
  scope: "Supplemental diagnostic only. Original native API quantities and35-column workbook unchanged. CO2-FFI and net CO2-LULUCF kept separate; never mix species mass with GWP-weighted CO2e.",
  asOfRule: "Captured2024 inventory input provenance retained; no invented availability date. Source files not independently redownloaded/revalidated for this diagnostic increment.",
};
const fields: [string, string, string, string][] = [
  ["version", "Versioned native residual diagnostic adapter", "version identifier", "native-mass-residual-diagnostics-1"],
  ["evidenceState", "Conditional evidence qualification", "evidence-state text", "Bounded/conditional estimate"],
  ["qualification", "Specific source/capture and scenario limitations", "text", "Candidate source-derived captured inventory or explicit regional model inputs; not scientific or observed-vintage certification"],
  ["baselineInputId", "Identity of actual selected baseline INPUT, not trajectory output", "content identifier", "captured-native-inventory-sha256:SHA256(inventory artifact) or captured-regional-native-input-sha256:SHA256(actual member/region input cells)"],
  ["sourceEvidence", "Retained source/captured-input evidence chain", "text", "Candidate source revision/hash manifest or supplied regional input/member identity; no fabricated source"],
  ["records[]", "One supplemental diagnostic per explicit native gas/region/member", "diagnostic rows", "Map actual captured input gas totals to same-species native annual trajectory"],
  ["records[].gas", "Native gas/account; CO2 components are separated", "gas/account identifier", "CO2-FFI | CO2-LULUCF | actual non-CO2 inventory species"],
  ["records[].region", "Explicit selected region of baseline and trajectory", "region identifier", "Global or exact regional member account"],
  ["records[].memberId", "Deterministic native path or supplied member identity", "member identifier", "deterministic-native-scenario-not-an-ensemble-member or exact supplied memberId"],
  ["records[].contextLabel", "Export-only explicit native gas/region/member context", "text", "region / gas / memberId; supplemental separate diagnostic workbook, not an extra modeled quantity"],
];
const overrides: Record<string, string> = {
  "basis.gasBasis": "native-mass:<gas/account>:<region>; CO2-FFI and net CO2-LULUCF separated, no GWP conversion",
  "basis.unit": "Mt of selected native species/year; both CO2 accounts use Mt CO2/year",
  "basis.memberId": "Exact deterministic/supplied native member; scalar values are NOT median quantiles or ensemble summaries",
  "basis.selectionId": "Actual captured baseline-input content identity, not generated trajectory hash",
  "basis.trajectoryId": "Native engine scenario key or supplied regional inputHash, qualified by region",
  "baselineEvidenceId": "Actual captured inventory/input content identity backed by retained source/capture chain; never output self-hash",
  "baselineValue": "Sum of selected2024 native input cells for exact gas/account and region; no CO2e transformation; positive finite required",
};
export const nativeThresholdSemantics: OutputFieldSemantic[] = [
  { ...context, id: "native.residualRequest.baselineYear", meaning: "Explicit selected year of supplied regional MODEL initial condition",
    unit: "calendar year", formula: "Required literal2024; no default; absent/other year rejects request, not repaired from modeled output",
    role: "Input", dependencies: [] },
  ...fields.map(([field, meaning, unit, formula]) => ({
    ...context, id: `native.residualDiagnostics.${field}`, meaning, unit, formula, role: "Output" as const, dependencies: [],
  })),
  ...thresholdDiagnosticSemantics.filter(f => f.id.startsWith("thresholdDiagnostic.") &&
    f.id !== "thresholdDiagnostic.contextLabel").map(f => {
      const field = f.id.slice("thresholdDiagnostic.".length);
      return { ...f, ...context, id: `native.residualDiagnostics.records[].diagnostic.${field}`,
        formula: overrides[field] ?? f.formula.replaceAll("p50", "selected native species mass"),
        dependencies: f.dependencies.map(d => d.replaceAll(".p50", ".nativeSpeciesMass")) };
    }),
];

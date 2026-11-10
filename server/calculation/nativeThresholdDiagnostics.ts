import { candidateInventory, type NativeInventoryCell, type projectNativeEmissions } from "./emissionsCandidate";
import type { projectRegionalMember } from "./regionalEngine";
import { contentHash } from "./analysisManifest";
import { calculateThresholdDiagnostic } from "./thresholdDiagnostic";
import type { NativeResidualDiagnostics, NativeResidualRecord } from "../../shared/nativeThresholdDiagnostics";

type Point = { year: number; nativeMt: Record<string, number>; co2FossilMt: number; co2LandUseMt: number };
// Exact audited captured INPUT artifact, not a hash freshly generated from an
// arbitrary trajectory/default. A changed inventory requires a separate audit.
const capturedInventoryContentId = "1bb224d96626cd69f675126892dd8ee0e423a9defb16c67b967a891dcdfccd29";
function totals(cells: readonly NativeInventoryCell[]) {
  const gas: Record<string, number> = {};
  for (const c of cells) {
    const name = c.gas === "CO2" ? (c.sector === "LULUCF" ? "CO2-LULUCF" : "CO2-FFI") : c.gas;
    gas[name] = (gas[name] ?? 0) + c.nativeMt;
  }
  return gas;
}
function value(point: Point, gas: string) {
  return gas === "CO2-FFI" ? point.co2FossilMt : gas === "CO2-LULUCF" ? point.co2LandUseMt : point.nativeMt[gas];
}
function records(cells: readonly NativeInventoryCell[], trajectory: readonly Point[],
  inputId: string, trajectoryId: string, memberId: string, region: string,
  evidenceId: string | null): NativeResidualRecord[] {
  const baseline = totals(cells);
  return Object.keys(baseline).sort().map(gas => {
    const species = gas.startsWith("CO2-") ? "CO2" : gas;
    const basis = { selectionId: inputId, trajectoryId: `${trajectoryId}:${region}`, memberId,
      gasBasis: `native-mass:${gas}:${region}`, unit: `Mt ${species}/year` };
    const rows = trajectory.map(point => ({ year: point.year, p50: value(point, gas) }));
    return { gas, region, memberId, diagnostic: calculateThresholdDiagnostic(rows, {
      basis, baseline2024: evidenceId ? { ...basis, year: 2024, value: baseline[gas], evidenceId } : null,
    }) };
  });
}
function inventoryEvidence(inventory: ReturnType<typeof candidateInventory>) {
  const hashes = ["EDGAR_CO2_1970_2024.xlsx", "EDGAR_CH4_1970_2024.xlsx",
    "EDGAR_N2O_1970_2024.xlsx", "EDGAR_F-gases_1970_2024.xlsx"] as const;
  return contentHash(inventory) === capturedInventoryContentId &&
    inventory.year === 2024 && inventory.version === "igcc-2024-candidate-1" &&
    inventory.source === "https://essd.copernicus.org/articles/18/3889/2026/" &&
    inventory.sourceRevision === "e81bb760b66ab182f9052d8d4218d42a97acbd75" &&
    hashes.every(name => /^[a-f0-9]{64}$/.test(inventory.sourceHashes[name])) &&
    /^[a-f0-9]{64}$/.test(inventory.reportSha256) && /^[a-f0-9]{64}$/.test(inventory.metricsSha256) &&
    inventory.cells.length > 0 && inventory.cells.every(c =>
      c.origin.length > 0 && Number.isFinite(c.nativeMt) && Number.isFinite(c.gwp100));
}

/** Read the ACTUAL captured inventory inputs, never the trajectory's output as evidence.
 * Source hashes/revision are retained provenance, not a new independent source revalidation.
 */
export function nativeCandidateResidualDiagnostics(result: ReturnType<typeof projectNativeEmissions>,
  inventory = candidateInventory()): NativeResidualDiagnostics {
  const inputId = `captured-native-inventory-sha256:${contentHash(inventory)}`;
  const qualified = inventoryEvidence(inventory);
  return {
    version: "native-mass-residual-diagnostics-1", evidenceState: "Bounded/conditional estimate",
    qualification: qualified
      ? "Source-derived captured candidate2024 native inventory; future trajectory is conditional, not calibrated or scientifically promoted. Hashes identify actual captured input, not output self-authentication. Retained source records were not independently redownloaded in this run. No CO2e/mass conversion or physical-net-zero claim."
      : "Baseline provenance is missing or differs from the audited captured candidate inventory. All primary residual diagnostics are withheld; modeled output cannot repair input lineage.",
    baselineInputId: inputId,
    sourceEvidence: qualified
      ? `${inventory.source}; source revision ${inventory.sourceRevision}; EDGAR workbook hashes, IGCC reportSha256 and metricsSha256 retained in candidate inventory; CO2-FFI allocated using EDGAR weights, not independent sector observations`
      : "Required pinned candidate inventory provenance is missing or inconsistent; baseline withheld",
    records: records(inventory.cells, result.trajectory, inputId, result.key,
      "deterministic-native-scenario-not-an-ensemble-member", "Global", qualified ? inputId : null),
  };
}

/** Separate adapter: preserves regional engine result/archives unchanged.
 * Regional cells are explicitly supplied/captured MODEL INPUTS, not newly verified regional observations.
 */
export function regionalNativeResidualDiagnostics(result: ReturnType<typeof projectRegionalMember>,
  capturedBaselineYear: 2024 | null = null): NativeResidualDiagnostics {
  const inputId = `captured-regional-native-input-sha256:${contentHash({
    baselineYear: capturedBaselineYear,
    inventoryId: result.inventoryId, memberId: result.memberId,
    regions: result.regions.map(r => ({ region: r.region, cells: r.cells })),
  })}`;
  return {
    version: "native-mass-residual-diagnostics-1", evidenceState: "Bounded/conditional estimate",
    qualification: capturedBaselineYear === 2024
      ? "Explicit supplied/captured2024 regional native initial conditions, reconciled by regional engine to captured global inventory. Conditional MODEL baseline; regional allocation/source adequacy is not independently authenticated. No regional observed-vintage or forecast claim. Nonpositive baselines (including land sinks) withhold, not silently clip."
      : "Missing explicit selected2024 regional initial-condition declaration. Manufactured2024 output does not supply input evidence; all primary diagnostics withheld.",
    baselineInputId: inputId,
    sourceEvidence: `Explicit regional input cells; declared inventory ${result.inventoryId}; member ${result.memberId}; selected input hash ${result.inputHash}`,
    records: result.regions.flatMap(r => records(r.cells, r.trajectory, inputId,
      result.inputHash, result.memberId, r.region, capturedBaselineYear === 2024 ? inputId : null)),
  };
}

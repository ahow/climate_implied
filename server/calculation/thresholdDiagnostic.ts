import {
  THRESHOLD_DIAGNOSTIC_LABEL, THRESHOLD_DIAGNOSTIC_VERSION,
  type ThresholdBasis, type ThresholdBaseline2024, type ThresholdDiagnostic,
} from "../../shared/thresholdDiagnostic";

export interface ThresholdContext {
  basis: ThresholdBasis;
  /** Trusted caller-resolved input lineage, not a user string or generated-output hash.
   * This pure arithmetic boundary checks identity/value consistency, not external
   * source authentication. Current legacy API callers have no qualifying record.
   */
  baseline2024?: ThresholdBaseline2024 | null;
}

/**
 * A generated trajectory is NOT evidence for its own initial condition.
 * Only explicitly supplied, same-selection 2024 input evidence can activate
 * the diagnostic. Current legacy callers have no such source/capture record.
 * Hashes identify outputs but cannot upgrade the hardcoded60.3 anchor.
 */
export function selectedTrajectoryThresholdContext(
  rows: readonly { year: number; p50: number }[],
  selectionId: string,
  trajectoryId: string,
  explicitSelectedBaseline?: ThresholdBaseline2024 | null,
): ThresholdContext {
  const basis: ThresholdBasis = {
    selectionId, trajectoryId,
    memberId: "annual-p50-trajectory-not-an-individual-simulation-member",
    gasBasis: "aggregate-GHG-legacy-unspecified-GWP",
    unit: "GtCO2e-legacy-unreconciled",
  };
  return {
    basis,
    baseline2024: explicitSelectedBaseline ?? null,
  };
}

/** Pure selected-input boundary: never reads current inputs, inventory defaults or other selections. */
export function calculateThresholdDiagnostic(
  rows: readonly { year: number; p50: number }[],
  context?: ThresholdContext,
): ThresholdDiagnostic {
  if (!rows.length || rows.some((r, i) => !Number.isInteger(r.year) ||
    !Number.isFinite(r.p50) || (i > 0 && r.year !== rows[i - 1].year + 1)))
    throw new Error("Threshold diagnostic requires consecutive finite annual trajectory points");
  const result: ThresholdDiagnostic = {
    version: THRESHOLD_DIAGNOSTIC_VERSION, label: THRESHOLD_DIAGNOSTIC_LABEL,
    year: null, status: "withheld", reason: null, baselineYear: 2024,
    baselineValue: null, baselineEvidenceId: null, thresholdFraction: 0.05,
    thresholdValue: null, horizonYear: rows.at(-1)!.year,
    basis: context?.basis ?? null,
    crossingRule: "first annual value <= 0.05 * selected 2024 baseline; no interpolation or extrapolation",
    notNetZero: true,
  };
  const baseline = context?.baseline2024;
  if (!baseline) return { ...result, reason: "Missing explicit source-evidenced or captured selected-model 2024 baseline; a generated/default trajectory point or its hash is not input evidence" };
  const keys = ["selectionId", "trajectoryId", "memberId", "gasBasis", "unit"] as const;
  if (!context || keys.some(k => !context.basis[k]?.trim() || baseline[k] !== context.basis[k]))
    return { ...result, reason: "2024 baseline does not match selected selection/trajectory/member/gas/unit basis" };
  if (baseline.year !== 2024 || !Number.isFinite(baseline.value) || baseline.value <= 0 ||
      !baseline.evidenceId?.trim())
    return { ...result, reason: "2024 baseline must be positive, finite and explicitly evidenced" };
  if (baseline.evidenceId.startsWith("selected-model-trajectory-sha256:"))
    return { ...result, reason: "A generated trajectory self-hash is not source-evidenced or captured-input baseline lineage" };
  // If the selected trajectory includes 2024, its own baseline must agree exactly.
  const own2024 = rows.find(r => r.year === 2024);
  if (own2024 && own2024.p50 !== baseline.value)
    return { ...result, reason: "Evidenced 2024 baseline disagrees with selected trajectory's 2024 value" };
  const thresholdValue = 0.05 * baseline.value;
  const crossing = rows.find(r => r.year >= 2024 && r.p50 <= thresholdValue);
  return {
    ...result, year: crossing?.year ?? null, status: crossing ? "reached" : "right-censored",
    baselineValue: baseline.value, baselineEvidenceId: baseline.evidenceId,
    thresholdValue,
  };
}

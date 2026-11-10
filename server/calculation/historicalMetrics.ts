import { calculateThresholdDiagnostic, type ThresholdContext } from "./thresholdDiagnostic";

/** Preserve the frozen fixed-5-Gt result separately; never relabel it as 5%-of-2024. */
export function historicalTrajectoryMetrics(rows: { year: number; p50: number }[], context?: ThresholdContext) {
  if (rows.length < 11 || rows.some((r, i) => !Number.isInteger(r.year) ||
      !Number.isFinite(r.p50) || r.p50 < 0 || (i > 0 && r.year !== rows[i - 1].year + 1)))
    throw new Error("At least eleven consecutive finite annual trajectory points required");
  if (rows[0].p50 <= 0) throw new Error("Positive initial emissions required for reduction CAGR");
  const reductionRate = (1 - (rows[10].p50 / rows[0].p50) ** (1 / 10)) * 100;
  // Preserve right censoring: do not manufacture a date after the simulated horizon.
  const netZeroYear = rows.find(r => r.p50 <= 5)?.year ?? null;
  return {
    reductionRate, netZeroYear,
    legacyFixed5Gt: { version: "fixed-5gt-v1" as const, year: netZeroYear,
      thresholdValue: 5 as const, unit: "GtCO2e" as const, notNetZero: true as const },
    thresholdDiagnostic: calculateThresholdDiagnostic(rows, context),
  };
}

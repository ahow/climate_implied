export interface BacktestPoint {
  date: string;
  benchmarkReturn: number;
  portfolioReturn: number;
  benchmarkCumulative: number;
  portfolioCumulative: number;
  activeReturn: number;
  /** Annualised, expanding-window TE through this month, in decimal units. */
  trackingError: number;
  overweightCount: number;
  underweightCount: number;
  /** Actual month-specific tilt; zero during the 12-month training warm-up. */
  tiltScale?: number;
  portfolioNetReturn?: number;
  portfolioNetCumulative?: number;
  turnover?: number;
  tradedNotional?: number;
  costFraction?: number;
}

export type SignalType = "carbon_intensity" | "sdg_exposure" | "decarb_ambition" | "decarb_gap";

export interface BacktestResponse {
  series: BacktestPoint[];
  summary: {
    signal: SignalType;
    method: string;
    targetTrackingErrorPct: number;
    realizedTrackingErrorPct: number | null;
    tiltScale: number | null;
    calibrationPeriod: { start: string; end: string; months: number } | null;
    calibrationStatus: "within_tolerance" | "outside_tolerance" | "insufficient_data";
    calibrationBasis: "full_sample_ex_post" | "expanding_past_only";
    seriesTrackingErrorUnits: "decimal";
    seriesTrackingErrorWindow: "expanding_from_start";
    warnings: string[];
    accounting?: { costBps: number; totalTurnover: number; totalCostFraction: number;
      netCumulative: number; grossCumulative: number; maxNetDrawdown: number };
  };
}

/** Reports the existing engine's unrounded result; does not recalibrate it. */
export function buildBacktestResponse(
  series: BacktestPoint[],
  annualizedTE: number,
  tiltScale: number | null,
  signal: SignalType,
  method: string,
  targetTrackingErrorPct: number,
  calibrationBasis: "full_sample_ex_post" | "expanding_past_only" = "full_sample_ex_post",
): BacktestResponse {
  const sufficient = series.length >= 3;
  const realizedTrackingErrorPct = sufficient ? annualizedTE * 100 : null;
  return {
    series,
    summary: {
      signal, method, targetTrackingErrorPct, realizedTrackingErrorPct, tiltScale,
      calibrationPeriod: calibrationBasis === "expanding_past_only" ? (
        series.length >= 12 ? { start: series[0].date, end: series[11].date, months: 12 } : null
      ) : series.length ? {
        start: series[0].date, end: series[series.length - 1].date, months: series.length,
      } : null,
      calibrationStatus: !sufficient ? "insufficient_data"
        : Math.abs(realizedTrackingErrorPct! - targetTrackingErrorPct) / targetTrackingErrorPct < 0.02
          ? "within_tolerance" : "outside_tolerance",
      calibrationBasis,
      seriesTrackingErrorUnits: "decimal",
      seriesTrackingErrorWindow: "expanding_from_start",
      warnings: calibrationBasis === "expanding_past_only" ? [
        "Risk scaling uses only previously realized unit-tilt returns; the first 12 months hold the benchmark. Tilt is capped at 5; realized tracking error is not guaranteed.",
        "Quarter-lagged accounting observations are used, but publication dates, historical classifications, universe membership and revised data vintages are not verified. This is a reconstructed-history analysis, not a point-in-time investable backtest.",
        "Returns are gross of costs. Survivor coverage, missing-company returns and corporate actions still require assessment; gaps are not treated as single-month returns.",
      ] : [
        "The tilt is calibrated on the full sample, not an ex-ante risk budget. Returns are gross of trading costs.",
        signal === "decarb_gap"
          ? "Quarter-lagged records are used, but publication-date availability and historical data vintages are not verified."
          : "Fixed company scores are applied retrospectively; this is not a point-in-time investable backtest.",
      ],
    },
  };
}

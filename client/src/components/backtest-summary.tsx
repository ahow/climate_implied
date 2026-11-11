import { analysisFetch as fetch } from "@/lib/analysis-selection";
import type { BacktestResponse } from "@shared/backtest";

export async function fetchBacktest(url: string): Promise<BacktestResponse> {
  const response = await fetch(url, { credentials: "include" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Backtest request failed");
  return body;
}

export function BacktestSummary({ data, error, label }: {
  data?: BacktestResponse; error?: Error | null; label?: string;
}) {
  if (error) return <p role="alert" className="text-sm text-destructive mb-3">{label}: {error.message}</p>;
  if (!data) return <p role="status" className="text-xs text-muted-foreground">{label}: No backtest result for the current selection.</p>;
  const s = data.summary;
  if (!s || !Number.isFinite(s.targetTrackingErrorPct) || typeof s.method !== "string" ||
    typeof s.calibrationStatus !== "string" || !Array.isArray(s.warnings)) {
    return <p role="status" className="text-xs text-muted-foreground">{label}: Backtest calibration summary is incomplete; no calibration claim is available.</p>;
  }
  return (
    <div className="text-xs text-muted-foreground space-y-1 mb-3" data-testid="backtest-calibration-summary">
      <p>
        {label && <strong>{label}: </strong>}
        <span data-field-id="backtest.summary.targetTrackingErrorPct">Target TE {s.targetTrackingErrorPct.toFixed(2)}%</span>
        {" · "}<span data-field-id="backtest.summary.realizedTrackingErrorPct">Realised full-period TE {s.realizedTrackingErrorPct?.toFixed(3) ?? "N/A"}%</span>
        {" · "}<span data-field-id="backtest.summary.tiltScale">{s.calibrationBasis === "expanding_past_only" ? "Latest tilt" : "Tilt"} {s.tiltScale?.toFixed(4) ?? "N/A"}</span>
        <span data-field-id="backtest.summary.calibrationBasis">{s.calibrationBasis === "expanding_past_only" && " · Initial training"}</span>
        {s.calibrationPeriod && <>
          {" · "}<span data-field-id="backtest.summary.calibrationPeriod.start">{s.calibrationPeriod.start}</span>–
          <span data-field-id="backtest.summary.calibrationPeriod.end">{s.calibrationPeriod.end}</span>
          {" ("}<span data-field-id="backtest.summary.calibrationPeriod.months">{s.calibrationPeriod.months}</span> months)
        </>}
        {" · "}Ranking: <span data-field-id="backtest.summary.method">{s.method.replaceAll("_", " ")}</span>
      </p>
      {s.calibrationStatus !== "within_tolerance" && <p role="status" data-field-id="backtest.summary.calibrationStatus">Calibration: {s.calibrationStatus.replaceAll("_", " ")}. Target TE is not guaranteed.</p>}
      {s.warnings.map(warning => <p key={warning} data-field-id="backtest.summary.warnings[]">{warning}</p>)}
      {s.accounting && <p>
        <span data-field-id="backtest.summary.accounting.costBps">Cost assumption: {s.accounting.costBps} bps per traded dollar</span>
        {" · "}<span data-field-id="backtest.summary.accounting.grossCumulative">Gross cumulative return: {((s.accounting.grossCumulative - 1) * 100).toFixed(2)}%</span>
        {" · "}<span data-field-id="backtest.summary.accounting.netCumulative">Net cumulative return: {((s.accounting.netCumulative - 1) * 100).toFixed(2)}%</span>
        {" · "}<span data-field-id="backtest.summary.accounting.maxNetDrawdown">Maximum net drawdown: {(s.accounting.maxNetDrawdown * 100).toFixed(2)}%</span>
        {" · "}<span data-field-id="backtest.summary.accounting.totalTurnover">Total one-way turnover: {s.accounting.totalTurnover.toFixed(2)}×</span>
      </p>}
      <p>The TE series is annualised over the expanding history, not a rolling fixed-length window.</p>
    </div>
  );
}

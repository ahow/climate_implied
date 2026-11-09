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
  if (!data) return null;
  const s = data.summary;
  return (
    <div className="text-xs text-muted-foreground space-y-1 mb-3" data-testid="backtest-calibration-summary">
      <p>
        {label && <strong>{label}: </strong>}
        Target TE {s.targetTrackingErrorPct.toFixed(2)}% · Realised full-period TE {s.realizedTrackingErrorPct?.toFixed(3) ?? "N/A"}%
        {" · "}{s.calibrationBasis === "expanding_past_only" ? "Latest tilt" : "Tilt"} {s.tiltScale?.toFixed(4) ?? "N/A"}
        {s.calibrationBasis === "expanding_past_only" && " · Initial training"}
        {s.calibrationPeriod && ` · ${s.calibrationPeriod.start}–${s.calibrationPeriod.end} (${s.calibrationPeriod.months} months)`}
        {" · "}Ranking: {s.method.replaceAll("_", " ")}
      </p>
      {s.calibrationStatus !== "within_tolerance" && <p role="status">Calibration: {s.calibrationStatus.replaceAll("_", " ")}. Target TE is not guaranteed.</p>}
      {s.warnings.map(warning => <p key={warning}>{warning}</p>)}
      {s.accounting && <p>
        Cost assumption: {s.accounting.costBps} bps per traded dollar · Gross cumulative return: {((s.accounting.grossCumulative - 1) * 100).toFixed(2)}%
        {" · "}Net cumulative return: {((s.accounting.netCumulative - 1) * 100).toFixed(2)}%
        {" · "}Maximum net drawdown: {(s.accounting.maxNetDrawdown * 100).toFixed(2)}%
        {" · "}Total one-way turnover: {s.accounting.totalTurnover.toFixed(2)}×
      </p>}
      <p>The TE series is annualised over the expanding history, not a rolling fixed-length window.</p>
    </div>
  );
}

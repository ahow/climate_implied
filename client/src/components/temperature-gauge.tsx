import { FIXED_5GT_DESCRIPTOR } from "@shared/quantityDescriptors";
import { Card } from "@/components/ui/card";
import { ScientificEvidenceStrands } from "./scientific-evidence-strands";
import { Skeleton } from "@/components/ui/skeleton";
import { Thermometer, TrendingDown, Calendar } from "lucide-react";
import type { MetricView } from "@/lib/types";
import { THRESHOLD_DIAGNOSTIC_LABEL, thresholdDiagnosticDisplay, type ThresholdDiagnostic } from "@shared/thresholdDiagnostic";
import { ThresholdDiagnosticDetails } from "./threshold-diagnostic-details";

interface TemperatureGaugeProps {
  temperature: number;
  p10: number;
  p90: number;
  reductionRate?: number | null;
  netZeroYear?: number | null;
  thresholdDiagnostic?: ThresholdDiagnostic;
  metricView: MetricView;
  isLoading?: boolean;
}

function getTemperatureColor(temp: number): string {
  if (temp <= 1.5) return "text-emerald-500";
  if (temp <= 2.0) return "text-sky-500";
  if (temp <= 2.5) return "text-amber-500";
  if (temp <= 3.0) return "text-orange-500";
  return "text-red-500";
}

function getTemperatureLabel(temp: number): { label: string; color: string; textColor: string } {
  if (temp <= 1.5) return { label: "Paris 1.5\u00B0C Goal", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", textColor: "text-emerald-600 dark:text-emerald-400" };
  if (temp <= 2.0) return { label: "Paris 2\u00B0C Limit", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400", textColor: "text-sky-600 dark:text-sky-400" };
  if (temp <= 2.5) return { label: "Moderate Warming", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", textColor: "text-amber-600 dark:text-amber-400" };
  if (temp <= 3.0) return { label: "High Warming", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", textColor: "text-orange-600 dark:text-orange-400" };
  return { label: "Dangerous Warming", color: "bg-red-500/10 text-red-600 dark:text-red-400", textColor: "text-red-600 dark:text-red-400" };
}

function getReductionColor(rate: number): string {
  if (rate >= 7.0) return "text-emerald-500";
  if (rate >= 5.0) return "text-sky-500";
  if (rate >= 3.0) return "text-amber-500";
  if (rate >= 1.0) return "text-orange-500";
  return "text-red-500";
}

function getReductionLabel(rate: number): { label: string; color: string; badgeColor: string } {
  if (rate >= 7.0) return { label: "Rapid Decarbonization", color: "text-emerald-600 dark:text-emerald-400", badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  if (rate >= 5.0) return { label: "Strong Progress", color: "text-sky-600 dark:text-sky-400", badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400" };
  if (rate >= 3.0) return { label: "Moderate Progress", color: "text-amber-600 dark:text-amber-400", badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (rate >= 1.0) return { label: "Slow Progress", color: "text-orange-600 dark:text-orange-400", badgeColor: "bg-orange-500/10 text-orange-600 dark:text-orange-400" };
  return { label: "Insufficient Action", color: "text-red-600 dark:text-red-400", badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400" };
}

export function TemperatureGauge({
  temperature,
  p10,
  p90,
  reductionRate,
  netZeroYear,
  thresholdDiagnostic,
  metricView,
  isLoading,
}: TemperatureGaugeProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-4 w-32" />
      </Card>
    );
  }

  if (![temperature, p10, p90].every(value => typeof value === "number" && Number.isFinite(value))) {
    return <Card className="p-6"><p role="status">Legacy temperature distribution is incomplete for this selection. No temperature or uncertainty values are substituted.</p></Card>;
  }

  const tempLabel = getTemperatureLabel(temperature);
  const hasReduction = typeof reductionRate === "number" && Number.isFinite(reductionRate);
  const reductionLabel = hasReduction ? getReductionLabel(reductionRate) : {
    label: "Reduction rate unavailable — not returned for this selection",
    color: "text-muted-foreground", badgeColor: "text-muted-foreground",
  };

  const gaugePercent = Math.min(100, Math.max(0, ((temperature - 1.0) / 4.0) * 100));
  const p10Percent = Math.min(100, Math.max(0, ((p10 - 1.0) / 4.0) * 100));
  const p90Percent = Math.min(100, Math.max(0, ((p90 - 1.0) / 4.0) * 100));

  if (metricView === "reductionRate") {
    return (
      <Card className="p-6" data-testid="card-temperature-gauge">
        <ScientificEvidenceStrands compact />
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">Emissions Reduction Rate</h3>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className={`text-5xl font-bold tabular-nums tracking-tight ${hasReduction ? getReductionColor(reductionRate) : "text-muted-foreground"}`} data-testid="text-reduction-value">
            {hasReduction ? reductionRate.toFixed(2) : "Unavailable"}
          </span>
          <span className="text-2xl font-medium text-muted-foreground">% / yr</span>
        </div>

        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium mb-4 ${reductionLabel.badgeColor}`} data-testid="text-reduction-label">
          {reductionLabel.label}
        </div>

        <div className="relative h-3 bg-muted rounded-full mb-2 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: hasReduction ? `${Math.min(100, Math.max(0, (reductionRate / 10) * 100))}%` : "0%",
              background: `linear-gradient(90deg, hsl(0, 84%, 35%), hsl(43, 86%, 42%), hsl(168, 76%, 36%))`,
            }}
          />
        </div>

        <div className="flex justify-between text-xs text-muted-foreground mb-6">
          <span>0%</span>
          <span>5% (illustrative)</span>
          <span>10%+</span>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-start gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Temperature Rise</p>
              <p className={`text-sm font-semibold tabular-nums ${getTemperatureColor(temperature)}`} data-testid="text-temperature-value">
                {temperature.toFixed(2)}&deg;C
              </p>
              <p className={`text-xs ${tempLabel.textColor}`}>{tempLabel.label}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">{THRESHOLD_DIAGNOSTIC_LABEL}</p>
              <p className="text-sm font-semibold tabular-nums" data-testid="text-net-zero-year">
                 {thresholdDiagnosticDisplay(thresholdDiagnostic)}
              </p>
              <p className="text-xs text-muted-foreground">
                Not net zero; no extrapolation
              </p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (metricView === "netZero") {
    return (
      <Card className="p-6" data-testid="card-temperature-gauge">
        <ScientificEvidenceStrands compact />
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-sm font-medium text-muted-foreground">{THRESHOLD_DIAGNOSTIC_LABEL}</h3>
        </div>

        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-3xl font-bold tabular-nums tracking-tight" data-testid="text-netzero-value">
            {thresholdDiagnosticDisplay(thresholdDiagnostic)}
          </span>
        </div>

        <div className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium mb-4 bg-muted text-muted-foreground" data-testid="text-netzero-label">
          Positive-emissions threshold, not net zero
        </div>

        <ThresholdDiagnosticDetails diagnostic={thresholdDiagnostic} contextLabel="Selected main trajectory" />
        <p className="my-4 text-xs text-muted-foreground">
           <span title={FIXED_5GT_DESCRIPTOR.description}>{FIXED_5GT_DESCRIPTOR.label}</span>: {netZeroYear === undefined ? "Unavailable — not returned" : netZeroYear === null ? "Not reached within trajectory horizon" : netZeroYear}.
          Fixed 5 GtCO₂e is not 5% of 2024 and is not net zero.
        </p>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-start gap-2">
            <Thermometer className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Temperature Rise</p>
              <p className={`text-sm font-semibold tabular-nums ${getTemperatureColor(temperature)}`} data-testid="text-temperature-value">
                {temperature.toFixed(2)}&deg;C
              </p>
              <p className={`text-xs ${tempLabel.textColor}`}>{tempLabel.label}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <TrendingDown className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Reduction Rate</p>
              <p className="text-sm font-semibold tabular-nums" data-testid="text-reduction-rate">
                 {hasReduction ? `${reductionRate.toFixed(2)}% / yr` : "Unavailable — not returned"}
              </p>
              <p className={`text-xs ${reductionLabel.color}`}>{reductionLabel.label}</p>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6" data-testid="card-temperature-gauge">
      <ScientificEvidenceStrands compact />
      <div className="flex items-center gap-2 mb-4">
        <Thermometer className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-medium text-muted-foreground">Implied Temperature Rise by 2100</h3>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className={`text-5xl font-bold tabular-nums tracking-tight ${getTemperatureColor(temperature)}`} data-testid="text-temperature-value">
          {temperature.toFixed(2)}
        </span>
        <span className="text-2xl font-medium text-muted-foreground">&deg;C</span>
      </div>

      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium mb-4 ${tempLabel.color}`} data-testid="text-temperature-label">
        {tempLabel.label}
      </div>

      <div className="relative h-3 bg-muted rounded-full mb-2 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${gaugePercent}%`,
            background: `linear-gradient(90deg, hsl(168, 76%, 36%), hsl(43, 86%, 42%), hsl(0, 84%, 35%))`,
          }}
        />
        <div
          className="absolute top-0 bottom-0 border-l-2 border-foreground/30"
          style={{ left: `${p10Percent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 border-l-2 border-foreground/30"
          style={{ left: `${p90Percent}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground"
          style={{ left: `${12.5}%` }}
          title="1.5°C target"
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/50"
          style={{ left: `${25}%` }}
          title="2.0°C limit"
        />
      </div>

      <div className="flex justify-between text-xs text-muted-foreground mb-6">
        <span>1.0&deg;C</span>
        <span>P10: {p10.toFixed(1)}&deg;C</span>
        <span>P90: {p90.toFixed(1)}&deg;C</span>
        <span>5.0&deg;C</span>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div className="flex items-start gap-2">
          <TrendingDown className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">Reduction Rate</p>
            <p className="text-sm font-semibold tabular-nums" data-testid="text-reduction-rate">
              {hasReduction ? `${reductionRate.toFixed(2)}% / yr` : "Unavailable — not returned"}
            </p>
            <p className={`text-xs ${reductionLabel.color}`}>{reductionLabel.label}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-xs text-muted-foreground">{THRESHOLD_DIAGNOSTIC_LABEL}</p>
            <p className="text-sm font-semibold tabular-nums" data-testid="text-net-zero-year">
              {thresholdDiagnosticDisplay(thresholdDiagnostic)}
            </p>
            <p className="text-xs text-muted-foreground">
              Not net zero; no extrapolation
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

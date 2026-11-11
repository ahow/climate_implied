import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";
import type { SensitivityResult } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";

interface SensitivityChartProps {
  data: SensitivityResult[];
  isLoading?: boolean;
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "Technology": return "hsl(168, 76%, 36%)";
    case "Policy": return "hsl(43, 86%, 42%)";
    case "Corporate": return "hsl(27, 87%, 48%)";
    case "Socioeconomic": return "hsl(280, 65%, 50%)";
    case "Financial Flows": return "hsl(150, 65%, 40%)";
    case "Emissions Outcomes": return "hsl(0, 65%, 50%)";
    default: return "hsl(220, 65%, 50%)";
  }
}

function getCategoryBadgeClass(category: string): string {
  switch (category) {
    case "Technology": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
    case "Policy": return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
    case "Corporate": return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "Socioeconomic": return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    case "Financial Flows": return "bg-teal-500/10 text-teal-600 dark:text-teal-400";
    case "Emissions Outcomes": return "bg-red-500/10 text-red-600 dark:text-red-400";
    default: return "bg-muted text-muted-foreground";
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      label: string;
      category: string;
      low: number;
      high: number;
      range: number;
      baseline: number;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active) return null;
  if (!payload?.[0]?.payload) return <p role="status">Sensitivity observation unavailable — no payload returned.</p>;
  const d = payload[0].payload;
  const format = (value: unknown, field: string, digits: number) =>
    typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(digits)}°C` : `${field} unavailable — not returned`;
  return (
    <div className="bg-popover border rounded-md p-3 shadow-md text-sm">
      <p className="font-medium mb-1">{d.label || "Sensitivity label not returned"}</p>
      <p className="text-muted-foreground text-xs mb-1">{d.category || "Category not returned"}</p>
      <div className="space-y-0.5 text-xs">
        <p>Baseline: <span className="font-medium tabular-nums">{format(d.baseline, "Baseline", 2)}</span></p>
        <p>Low scenario: <span className="font-medium tabular-nums text-blue-500">{format(d.low, "Low scenario", 2)}</span></p>
        <p>High scenario: <span className="font-medium tabular-nums text-red-500">{format(d.high, "High scenario", 2)}</span></p>
        <p>Impact range: <span className="font-medium tabular-nums">{format(d.range, "Impact range", 3)}</span></p>
      </div>
    </div>
  );
}

export function SensitivityChart({ data, isLoading }: SensitivityChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[400px] w-full" />
      </Card>
    );
  }

  if (!data?.length) return <Card className="p-6"><p role="status">No legacy sensitivity results were returned. No baseline is substituted.</p></Card>;
  if (data.some(row => ![row.baselineTemperature, row.p10Temperature, row.p90Temperature, row.temperatureRange].every(value => typeof value === "number" && Number.isFinite(value)))) {
    return <Card className="p-6"><p role="status">Legacy sensitivity inputs are incomplete. Baseline and sensitivity ranges are withheld rather than defaulted.</p></Card>;
  }

  const baseline = data[0].baselineTemperature;
  const top10 = data.slice(0, 10);

  const chartData = top10.map((d) => ({
    label: d.label,
    category: d.category,
    low: d.p10Temperature,
    high: d.p90Temperature,
    range: d.temperatureRange,
    baseline,
    lowOffset: d.p10Temperature - baseline,
    highOffset: d.p90Temperature - baseline,
  }));

  const minTemp = Math.min(...chartData.map(d => d.low)) - 0.05;
  const maxTemp = Math.max(...chartData.map(d => d.high)) + 0.05;

  const uniqueCategories = Array.from(new Set(top10.map(d => d.category)));

  const downloadRows = data.map((d) => ({
    Indicator: d.label,
    Category: d.category,
    "Baseline (\u00B0C)": d.baselineTemperature ?? baseline,
    "Lower scenario median (\u00B0C)": d.p10Temperature,
    "Upper scenario median (\u00B0C)": d.p90Temperature,
    "Impact Range (\u00B0C)": d.temperatureRange,
  }));

  return (
    <Card className="p-6" data-testid="card-sensitivity-analysis">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold" data-testid="text-sensitivity-title">Indicator Sensitivity Analysis</h3>
          <p className="text-xs text-muted-foreground">Temperature impact when each indicator is varied between pessimistic and optimistic scenarios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {uniqueCategories.map(cat => (
              <Badge key={cat} variant="secondary" className={`text-[10px] px-1.5 py-0 ${getCategoryBadgeClass(cat)}`}>
                {cat}
              </Badge>
            ))}
          </div>
          <DownloadDataButton
            kind="legacy"
            filename="indicator-sensitivity"
            sheetName="Sensitivity"
            rows={downloadRows}
            fieldBindings={{
              Indicator:{id:"sensitivity.label",transform:"Identity"},
              Category:{id:"sensitivity.category",transform:"Identity"},
              "Baseline (\u00B0C)":{id:"sensitivity.baselineTemperature",transform:"Row baseline, or shared chart baseline if row field missing"},
              "Lower scenario median (\u00B0C)":{id:"sensitivity.p10Temperature",transform:"Identity; not a probability quantile"},
              "Upper scenario median (\u00B0C)":{id:"sensitivity.p90Temperature",transform:"Identity; not a probability quantile"},
              "Impact Range (\u00B0C)":{id:"sensitivity.temperatureRange",transform:"Identity"},
            }}
            testId="button-download-sensitivity"
          />
        </div>
      </div>

      <div className="h-[380px] mt-4" data-testid="chart-sensitivity-tornado">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 120, bottom: 20 }}
          >
            <XAxis
              type="number"
              domain={[minTemp, maxTemp]}
              tickFormatter={(v: number) => `${v.toFixed(1)}\u00B0C`}
              tick={{ fontSize: 10 }}
              label={{ value: "Temperature (\u00B0C)", position: "insideBottom", offset: -10, style: { fontSize: 10 } }}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 10 }}
              width={110}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={baseline} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeWidth={1.5} />
            <Bar dataKey="low" stackId="range" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="range" stackId="range" isAnimationActive={false}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={getCategoryColor(entry.category)} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-px h-4 border-l border-dashed border-muted-foreground" />
          <span>Baseline: {baseline.toFixed(2)}&deg;C</span>
        </div>
        <span>Wider bars indicate higher sensitivity to that indicator</span>
      </div>
    </Card>
  );
}

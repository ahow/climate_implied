import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ForwardProjection } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";

interface EmissionsChartProps {
  trajectory: ForwardProjection[];
  isLoading?: boolean;
}

export function EmissionsChart({ trajectory, isLoading }: EmissionsChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[300px] w-full" />
      </Card>
    );
  }

  const sampledData = trajectory.filter((_, i) => i % 2 === 0 || i === trajectory.length - 1);

  const downloadRows = trajectory.map((t) => ({
    Year: t.year,
    "P10 (GtCO2e)": t.p10,
    "Median P50 (GtCO2e)": t.p50,
    "P90 (GtCO2e)": t.p90,
  }));

  return (
    <Card className="p-6" data-testid="card-emissions-chart">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Global Emissions Trajectory</h3>
          <p className="text-xs text-muted-foreground mt-0.5">GtCO2e with P10-P90 uncertainty range</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-primary rounded-full" />
              <span>Median (P50)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-2 bg-primary/20 rounded-sm" />
              <span>P10-P90 Range</span>
            </div>
          </div>
          <DownloadDataButton
            filename="global-emissions-trajectory"
            sheetName="Emissions Trajectory"
            rows={downloadRows}
            testId="button-download-emissions"
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={sampledData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="emissionsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(168, 76%, 36%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(168, 76%, 36%)" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="uncertaintyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(168, 76%, 36%)" stopOpacity={0.15} />
              <stop offset="95%" stopColor="hsl(168, 76%, 36%)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="year"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}`}
            label={{ value: "GtCO2e", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                p50: "Median",
                p10: "P10 (Optimistic)",
                p90: "P90 (Pessimistic)",
              };
              return [`${value.toFixed(1)} GtCO2e`, labels[name] || name];
            }}
            labelFormatter={(label) => `Year ${label}`}
          />
          <Area
            type="monotone"
            dataKey="p90"
            stackId="range"
            stroke="none"
            fill="url(#uncertaintyGradient)"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="p10"
            stackId="range"
            stroke="none"
            fill="hsl(var(--background))"
            fillOpacity={1}
          />
          <Area
            type="monotone"
            dataKey="p50"
            stroke="hsl(168, 76%, 36%)"
            strokeWidth={2}
            fill="url(#emissionsGradient)"
            fillOpacity={1}
          />
          <ReferenceLine
            y={5}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="4 4"
            label={{
              value: "Net-Zero Threshold (5 Gt)",
              position: "insideTopRight",
              style: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from "recharts";
import type { HistoricalTrendPoint, MetricView } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";

interface HistoricalTrendChartProps {
  data: HistoricalTrendPoint[];
  metricView: MetricView;
  isLoading?: boolean;
}

export function HistoricalTrendChart({ data, metricView, isLoading }: HistoricalTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[280px] w-full" />
      </Card>
    );
  }

  const hasNowcast = data.some((d) => d.isNowcast);
  const firstYear = data[0]?.year;
  const lastObservedYear = data.filter((d) => !d.isNowcast).at(-1)?.year;

  const getConfig = () => {
    switch (metricView) {
      case "temperature":
        return {
          title: "Historical Temperature Projections",
          subtitle: hasNowcast
            ? `Observed data (${firstYear}-${lastObservedYear}) with nowcast extrapolation to present`
            : `Current model applied retrospectively to each year's inputs (${firstYear}-${lastObservedYear})`,
          dataKey: "median",
          yLabel: "\u00B0C above pre-industrial",
          yDomain: [1.5, 3.5] as [number, number],
          color: "hsl(10, 78%, 54%)",
          referenceLines: [
            { y: 1.5, label: "1.5\u00B0C", color: "hsl(168, 76%, 36%)" },
            { y: 2.0, label: "2.0\u00B0C", color: "hsl(197, 71%, 38%)" },
          ],
          formatter: (v: number) => `${v.toFixed(2)}\u00B0C`,
          showRange: true,
        };
      case "reductionRate":
        return {
          title: "Historical Reduction Rate Projections",
          subtitle: hasNowcast
            ? `Observed data with nowcast extrapolation to ${new Date().getFullYear()}`
            : "Projected emissions reduction rate over next decade",
          dataKey: "reductionRate",
          yLabel: "% per year",
          yDomain: [0, 5] as [number, number],
          color: "hsl(168, 76%, 36%)",
          referenceLines: [
            { y: 7.0, label: "1.5\u00B0C pathway", color: "hsl(168, 76%, 36%)" },
          ],
          formatter: (v: number) => `${v.toFixed(2)}%/yr`,
          showRange: false,
        };
      case "netZero":
        return {
          title: "Historical Net-Zero Year Projections",
          subtitle: hasNowcast
            ? `Observed data with nowcast extrapolation to ${new Date().getFullYear()}`
            : "When emissions would reach near-zero at each projection point",
          dataKey: "netZeroYear",
          yLabel: "Net-Zero Year",
          yDomain: [2050, 2150] as [number, number],
          color: "hsl(43, 86%, 42%)",
          referenceLines: [
            { y: 2050, label: "2050 Target", color: "hsl(168, 76%, 36%)" },
          ],
          formatter: (v: number) => `${Math.round(v)}`,
          showRange: false,
        };
    }
  };

  const config = getConfig();

  const downloadRows = data.map((d) => ({
    Year: d.year,
    "Temperature Median (\u00B0C)": d.median,
    "P10 (\u00B0C)": d.p10,
    "P90 (\u00B0C)": d.p90,
    "Reduction Rate (%/yr)": d.reductionRate,
    "Net-Zero Year": d.netZeroYear ?? "Never",
    Estimated: d.isNowcast ? "yes" : "no",
  }));

  const chartData = data.map((d) => {
    const rawValue = metricView === "netZero" ? (d.netZeroYear || 2200) : d[config.dataKey as keyof HistoricalTrendPoint];
    return {
      ...d,
      displayValue: d.isNowcast ? undefined : rawValue,
      nowcastValue: d.isNowcast ? rawValue : undefined,
      bridgeValue: rawValue,
    };
  });

  if (hasNowcast && lastObservedYear) {
    const lastObservedIdx = chartData.findIndex((d) => d.year === lastObservedYear);
    if (lastObservedIdx >= 0) {
      chartData[lastObservedIdx].nowcastValue = chartData[lastObservedIdx].bridgeValue;
    }
  }

  return (
    <Card className="p-6" data-testid="card-historical-trend">
      <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-muted-foreground">{config.title}</h3>
            {hasNowcast && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="badge-nowcast">
                Nowcast
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{config.subtitle}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Retrospective reconstruction using current methodology and revised inputs—not forecasts issued at the time.
          </p>
        </div>
        <DownloadDataButton
          filename={`historical-trend-${metricView}`}
          sheetName="Historical Trend"
          rows={downloadRows}
          testId="button-download-historical-trend"
        />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
            domain={config.yDomain}
            label={{ value: config.yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              fontSize: "12px",
            }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload;
              if (!point) return null;
              const isNc = point.isNowcast;
              const value = isNc ? point.nowcastValue : point.displayValue;
              if (value == null) return null;
              return (
                <div
                  style={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {isNc ? `${label} (estimated)` : `${label}`}
                  </p>
                  <p className="text-sm font-medium">
                    {config.formatter(value)}
                  </p>
                  {config.showRange && point.p10 != null && point.p90 != null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Range: {config.formatter(point.p10)} – {config.formatter(point.p90)}
                    </p>
                  )}
                </div>
              );
            }}
          />
          {config.referenceLines.map((ref, i) => (
            <ReferenceLine
              key={i}
              y={ref.y}
              stroke={ref.color}
              strokeDasharray="4 4"
              label={{
                value: ref.label,
                position: "insideTopRight",
                style: { fontSize: 10, fill: ref.color },
              }}
            />
          ))}
          {config.showRange && (
            <>
              <Area
                type="monotone"
                dataKey="p90"
                fill={config.color}
                fillOpacity={0.1}
                stroke="none"
              />
              <Area
                type="monotone"
                dataKey="p10"
                fill="hsl(var(--background))"
                fillOpacity={1}
                stroke="none"
              />
            </>
          )}
          <Line
            type="monotone"
            dataKey="displayValue"
            stroke={config.color}
            strokeWidth={2}
            dot={{ r: 3, fill: config.color }}
            activeDot={{ r: 5 }}
            connectNulls={false}
          />
          {hasNowcast && (
            <Line
              type="monotone"
              dataKey="nowcastValue"
              stroke={config.color}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={(props: any) => {
                if (!props.payload?.isNowcast) return <circle key={props.key} r={0} />;
                return (
                  <circle
                    key={props.key}
                    cx={props.cx}
                    cy={props.cy}
                    r={3}
                    fill="hsl(var(--background))"
                    stroke={config.color}
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  );
}

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
} from "recharts";
import type { CategoryHistoricalTrendPoint, MetricView } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";
import { certifyFiniteExport,finiteExportBindings,categoryExportNames,categoryExportKeys } from "@shared/finiteExportSchemas";
import { THRESHOLD_DIAGNOSTIC_LABEL, thresholdDiagnosticDisplay } from "@shared/thresholdDiagnostic";
import { ThresholdDiagnosticDownload } from "./threshold-diagnostic-details";

interface CategoryTrendChartProps {
  data: CategoryHistoricalTrendPoint[];
  metricView: MetricView;
  isLoading?: boolean;
}

const CATEGORY_KEYS = categoryExportKeys;

const CATEGORY_COLORS: Record<string, string> = {
  all: "hsl(var(--muted-foreground))",
  technology: "hsl(168, 76%, 36%)",
  policy: "hsl(43, 86%, 42%)",
  corporate: "hsl(27, 87%, 48%)",
  socioeconomic: "hsl(340, 65%, 50%)",
  financial: "hsl(150, 65%, 40%)",
  emissions: "hsl(0, 65%, 50%)",
};

const CATEGORY_NAMES = categoryExportNames;

function getConfig(metricView: MetricView) {
  switch (metricView) {
    case "temperature":
      return {
        title: "Category Scenario Temperature Trends",
        subtitle: "Projected temperature rise under each what-if scenario over time",
        metricKey: "median" as const,
        yLabel: "\u00B0C above pre-industrial",
        yDomain: undefined as [number, number] | undefined,
        formatter: (v: number) => `${v.toFixed(2)}\u00B0C`,
        referenceLines: [
          { y: 1.5, label: "1.5\u00B0C", color: "hsl(168, 76%, 36%)" },
          { y: 2.0, label: "2.0\u00B0C", color: "hsl(197, 71%, 38%)" },
        ],
      };
    case "reductionRate":
      return {
        title: "Category Scenario Reduction Rates",
        subtitle: "Projected emissions reduction rate under each scenario",
        metricKey: "reductionRate" as const,
        yLabel: "% per year",
        yDomain: undefined as [number, number] | undefined,
        formatter: (v: number) => `${v.toFixed(2)}%/yr`,
        referenceLines: [
          { y: 7.0, label: "1.5\u00B0C pathway", color: "hsl(168, 76%, 36%)" },
        ],
      };
    case "netZero":
      return {
        title: THRESHOLD_DIAGNOSTIC_LABEL,
        subtitle: "Each scenario uses its own evidenced 2024 baseline; missing baseline withheld. Not net zero.",
        metricKey: "netZeroYear" as const,
        yLabel: "5% of 2024 threshold year",
        yDomain: [2024, 2100] as [number, number],
        formatter: (v: number) => `${Math.round(v)}`,
        referenceLines: [],
      };
  }
}

export function CategoryTrendChart({ data, metricView, isLoading }: CategoryTrendChartProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <Skeleton className="h-[280px] w-full" />
      </Card>
    );
  }

  if (!data.length) return <Card className="p-6"><p role="status">No legacy category trend observations were returned.</p></Card>;

  const config = getConfig(metricView);
  const hasNowcast = data.some((d) => d.isNowcast);

  const downloadRows = certifyFiniteExport("categoryTrend",data.map((d) => {
    const row: Record<string, string | number | boolean | undefined> = {
      Year: d.year,
      Estimated: d.isNowcast ? "yes" : "no",
    };
    for (const key of CATEGORY_KEYS) {
      let value: number | null | undefined = d[key]?.[config.metricKey];
      row[CATEGORY_NAMES[key]] = value ?? undefined;
    }
    return row;
  }),{metric:config.metricKey});

  const chartData = data.map((d) => {
    const row: Record<string, number | string | boolean | undefined> = { year: d.year, isNowcast: d.isNowcast };
    for (const key of CATEGORY_KEYS) {
      const metrics = d[key];
      let value = metricView === "netZero" ? metrics?.thresholdDiagnostic?.year : metrics?.[config.metricKey];
      row[key] = d.isNowcast ? undefined : (value ?? undefined);
      row[`${key}_nowcast`] = d.isNowcast ? (value ?? undefined) : undefined;
    }
    return row;
  });

  if (hasNowcast) {
    const lastObservedIdx = chartData.findIndex((d) => {
      const nextIdx = chartData.indexOf(d) + 1;
      return nextIdx < chartData.length && chartData[nextIdx].isNowcast;
    });
    if (lastObservedIdx >= 0) {
      for (const key of CATEGORY_KEYS) {
        chartData[lastObservedIdx][`${key}_nowcast`] = chartData[lastObservedIdx][key];
      }
    }
  }

  return (
    <Card className="p-6" data-testid="card-category-trend">
      <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-medium text-muted-foreground">{config.title}</h3>
            {hasNowcast && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                Nowcast
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{config.subtitle}</p>
        </div>
        <DownloadDataButton
          kind="legacy"
          filename={`category-trends-${metricView==="netZero"?"legacy-fixed-5gt-v1":metricView}`}
          sheetName="Category Trends"
          rows={downloadRows}
          fieldBindings={finiteExportBindings("categoryTrend",{metric:config.metricKey})}
          testId="button-download-category-trends"
          label={metricView === "netZero" ? "Download separate legacy fixed-5gt-v1" : "Download data"}
        />
      </div>
      {data.some(row => CATEGORY_KEYS.some(key => !row[key])) &&
        <p role="status" className="text-xs text-muted-foreground">Some category cells are missing for the selected reference years. Their values and threshold diagnostics remain unavailable; other categories are not substituted.</p>}
      {metricView === "netZero" && <details className="text-xs text-muted-foreground mb-3" data-testid="category-threshold-statuses">
        <summary>Selected 5%-of-2024 diagnostic status by year and scenario</summary>
        <ul>{data.flatMap(d => CATEGORY_KEYS.map(key =>
          <li key={`${d.year}-${key}`}>{d.year} / {CATEGORY_NAMES[key]}: {thresholdDiagnosticDisplay(d[key]?.thresholdDiagnostic)}</li>
        ))}</ul>
      </details>}
      {metricView === "netZero" && <ThresholdDiagnosticDownload diagnostics={
        data.flatMap(d => CATEGORY_KEYS.flatMap(key => d[key]?.thresholdDiagnostic ? [d[key].thresholdDiagnostic!] : []))
      } contextLabels={data.flatMap(d => CATEGORY_KEYS.flatMap(key => d[key]?.thresholdDiagnostic
        ? [`Reference input year ${d.year}: ${CATEGORY_NAMES[key]}`] : []))} />}

      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
            label={{
              value: config.yLabel,
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0]?.payload;
              const isNc = point?.isNowcast;
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
                  <p className="text-xs text-muted-foreground mb-1.5">
                    {isNc ? `${label} (estimated)` : `${label}`}
                  </p>
                  {CATEGORY_KEYS.map((key) => {
                    const val = isNc ? point[`${key}_nowcast`] : point[key];
                    if (val == null) return null;
                    return (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-2.5 h-2.5 rounded-sm"
                            style={{ backgroundColor: CATEGORY_COLORS[key] }}
                          />
                          <span className="text-xs">{CATEGORY_NAMES[key]}</span>
                        </div>
                        <span className="text-xs font-medium tabular-nums">
                          {config.formatter(val as number)}
                        </span>
                      </div>
                    );
                  })}
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
          {CATEGORY_KEYS.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CATEGORY_COLORS[key]}
              strokeWidth={key === "all" ? 2.5 : 1.5}
              strokeDasharray={key === "all" ? "6 3" : undefined}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
          {hasNowcast && CATEGORY_KEYS.map((key) => (
            <Line
              key={`${key}_nowcast`}
              type="monotone"
              dataKey={`${key}_nowcast`}
              stroke={CATEGORY_COLORS[key]}
              strokeWidth={key === "all" ? 2 : 1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
        {CATEGORY_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-1">
            <div
              className="w-3 h-0.5"
              style={{
                backgroundColor: CATEGORY_COLORS[key],
                borderTop: key === "all" ? `2px dashed ${CATEGORY_COLORS[key]}` : undefined,
              }}
            />
            <span className="text-[10px] text-muted-foreground">{CATEGORY_NAMES[key]}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

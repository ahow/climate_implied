import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, TrendingDown, Globe, Layers, BarChart3 } from "lucide-react";
import { DownloadDataButton } from "@/components/download-data-button";
import { BacktestSummary, fetchBacktest } from "@/components/backtest-summary";
import type { BacktestResponse } from "@shared/backtest";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
  ComposedChart,
  Bar,
} from "recharts";

interface HistoricalTrendPoint {
  year: number;
  median: number;
  p10: number;
  p90: number;
  reductionRate: number;
  netZeroYear: number | null;
  isNowcast?: boolean;
}

interface SDGGrowthPoint {
  date: string;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  cleanCount: number;
  dirtyCount: number;
}

interface DecarbTercilePoint {
  date: string;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  bestTercileCompanyCount: number;
  worstTercileCompanyCount: number;
}

interface CarbonPricePoint {
  date: string;
  impliedCarbonPrice: number;
  impliedDecarbRate: number;
  impliedTemperature: number;
  topTercileCompanyCount: number;
  bottomTercileCompanyCount: number;
}

interface BacktestPoint {
  date: string;
  benchmarkReturn: number;
  portfolioReturn: number;
  benchmarkCumulative: number;
  portfolioCumulative: number;
  activeReturn: number;
  trackingError: number;
  overweightCount: number;
  underweightCount: number;
}

interface UploadRecord {
  id: number;
  status: string;
}

interface DimensionsData {
  sectors: string[];
  geographies: string[];
}

type ScoringMethod = "absolute" | "sector_relative" | "sub_sector_relative" | "industry_relative";
type BacktestSignal = "carbon_intensity" | "sdg_exposure" | "decarb_ambition";

interface ChartDataPoint {
  date: number;
  dateLabel: string;
  expected?: number;
  carbonIntensity?: number;
  sdgExposure?: number;
  decarbAmbition?: number;
}

const SCORING_METHODS: { value: ScoringMethod; label: string }[] = [
  { value: "absolute", label: "Absolute" },
  { value: "sector_relative", label: "Sector-Relative" },
  { value: "sub_sector_relative", label: "Sub-Sector" },
  { value: "industry_relative", label: "Industry" },
];

const BACKTEST_SIGNALS: { value: BacktestSignal; label: string }[] = [
  { value: "carbon_intensity", label: "Carbon Intensity" },
  { value: "sdg_exposure", label: "SDG Exposure" },
  { value: "decarb_ambition", label: "Decarb Ambition" },
];

const LINE_COLORS = {
  expected: "hsl(168, 76%, 36%)",
  carbonIntensity: "hsl(220, 70%, 50%)",
  sdgExposure: "hsl(280, 60%, 50%)",
  decarbAmbition: "hsl(30, 80%, 50%)",
};

const BACKTEST_COLORS = {
  benchmark: "hsl(var(--muted-foreground))",
  portfolio: "hsl(168, 76%, 36%)",
  activePositive: "hsl(168, 76%, 36%)",
  activeNegative: "hsl(0, 70%, 50%)",
  trackingError: "hsl(30, 80%, 50%)",
};

function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function DecarbSignal() {
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>("sector_relative");
  const [geography, setGeography] = useState<string>("all");
  const [backtestSignal, setBacktestSignal] = useState<BacktestSignal>("carbon_intensity");
  const [trackingErrorLimit, setTrackingErrorLimit] = useState(2);

  const geoParam = geography !== "all" ? `&geography=${encodeURIComponent(geography)}` : "";
  const methodParam = `method=${scoringMethod}`;

  const { data: dimensions } = useQuery<DimensionsData>({
    queryKey: ["/api/cv/dimensions"],
  });

  const { data: uploads } = useQuery<UploadRecord[]>({
    queryKey: ["/api/cv/uploads"],
  });

  const uploadId = uploads?.find((u) => u.status === "completed")?.id;

  const { data: historicalTrend, isLoading: loadingTrend } = useQuery<HistoricalTrendPoint[]>({
    queryKey: ["/api/projection/historical-trend"],
  });

  const { data: carbonPriceData, isLoading: loadingCP } = useQuery<CarbonPricePoint[]>({
    queryKey: ["/api/cv/carbon-price", scoringMethod, geography, uploadId],
    queryFn: async () => {
      const res = await fetch(`/api/cv/carbon-price?uploadId=${uploadId}&${methodParam}&includeScope3=false&winsorize=true&inferenceMethod=carbon_intensity${geoParam}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!uploadId,
  });

  const { data: sdgData, isLoading: loadingSDG } = useQuery<SDGGrowthPoint[]>({
    queryKey: ["/api/cv/sdg-growth", geography],
    queryFn: async () => {
      const res = await fetch(`/api/cv/sdg-growth?costOfEquity=0.08${geoParam}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: decarbTercileData, isLoading: loadingDecarb } = useQuery<DecarbTercilePoint[]>({
    queryKey: ["/api/cv/decarb-terciles", scoringMethod, geography],
    queryFn: async () => {
      const res = await fetch(`/api/cv/decarb-terciles?${methodParam}&costOfEquity=0.08${geoParam}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: backtestResponse, isLoading: loadingBacktest, error: backtestError } = useQuery<BacktestResponse>({
    queryKey: ["/api/cv/backtest", backtestSignal, trackingErrorLimit, scoringMethod, geography],
    queryFn: async () => {
      return fetchBacktest(`/api/cv/backtest?signal=${backtestSignal}&trackingError=${trackingErrorLimit}&trackingErrorUnit=percent&method=absolute${geoParam}`);
    },
    enabled: !!uploadId,
  });
  const backtestData = backtestResponse?.series;

  const isLoading = loadingTrend || loadingCP || loadingSDG || loadingDecarb;
  const hasAnyCV = (carbonPriceData && carbonPriceData.length > 0) ||
    (sdgData && sdgData.length > 0) ||
    (decarbTercileData && decarbTercileData.length > 0);
  const hasTrend = historicalTrend && historicalTrend.length > 0;
  const hasData = hasAnyCV || hasTrend;
  const isGeoFiltered = geography !== "all";
  const expectedLabel = isGeoFiltered ? "Expected (Global)" : "Expected (Model)";

  const chartData = useMemo(() => {
    const dateMap = new Map<number, ChartDataPoint>();

    if (historicalTrend) {
      for (const pt of historicalTrend) {
        const ts = new Date(pt.year, 6, 1).getTime();
        dateMap.set(ts, {
          date: ts,
          dateLabel: `${pt.year}`,
          expected: Math.round(pt.reductionRate * 100) / 100,
        });
      }
    }

    if (carbonPriceData) {
      for (const pt of carbonPriceData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        if (existing) {
          existing.carbonIntensity = pt.impliedDecarbRate;
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            carbonIntensity: pt.impliedDecarbRate,
          });
        }
      }
    }

    if (sdgData) {
      for (const pt of sdgData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        if (existing) {
          existing.sdgExposure = Math.round(pt.impliedDecarbRate * 100) / 100;
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            sdgExposure: Math.round(pt.impliedDecarbRate * 100) / 100,
          });
        }
      }
    }

    if (decarbTercileData) {
      for (const pt of decarbTercileData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        if (existing) {
          existing.decarbAmbition = Math.round(pt.impliedDecarbRate * 100) / 100;
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            decarbAmbition: Math.round(pt.impliedDecarbRate * 100) / 100,
          });
        }
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date - b.date);
  }, [historicalTrend, carbonPriceData, sdgData, decarbTercileData]);

  const latestValues = useMemo(() => {
    if (chartData.length === 0) return null;

    let latestExpected: number | undefined;
    let latestCI: number | undefined;
    let latestSDG: number | undefined;
    let latestDA: number | undefined;

    for (let i = chartData.length - 1; i >= 0; i--) {
      if (latestExpected === undefined && chartData[i].expected !== undefined) latestExpected = chartData[i].expected;
      if (latestCI === undefined && chartData[i].carbonIntensity !== undefined) latestCI = chartData[i].carbonIntensity;
      if (latestSDG === undefined && chartData[i].sdgExposure !== undefined) latestSDG = chartData[i].sdgExposure;
      if (latestDA === undefined && chartData[i].decarbAmbition !== undefined) latestDA = chartData[i].decarbAmbition;
    }

    return { expected: latestExpected, carbonIntensity: latestCI, sdgExposure: latestSDG, decarbAmbition: latestDA };
  }, [chartData]);

  const backtestStats = useMemo(() => {
    if (!backtestData || backtestData.length === 0) return null;
    const last = backtestData[backtestData.length - 1];
    const totalActiveReturn = (last.portfolioCumulative / last.benchmarkCumulative - 1) * 100;
    const annualizedActive = backtestData.length > 12
      ? (Math.pow(last.portfolioCumulative / last.benchmarkCumulative, 12 / backtestData.length) - 1) * 100
      : totalActiveReturn;
    const avgGreen = Math.round(backtestData.reduce((s, d) => s + d.overweightCount, 0) / backtestData.length);
    const avgBrown = Math.round(backtestData.reduce((s, d) => s + d.underweightCount, 0) / backtestData.length);
    return {
      totalActive: totalActiveReturn,
      annualizedActive,
      finalTE: last.trackingError * 100,
      benchmarkTotal: (last.benchmarkCumulative - 1) * 100,
      portfolioTotal: (last.portfolioCumulative - 1) * 100,
      avgGreen,
      avgBrown,
      months: backtestData.length,
    };
  }, [backtestData]);

  const backtestChartData = useMemo(() => {
    if (!backtestData) return [];
    return backtestData.map((d) => ({
      date: d.date,
      benchmark: Math.round((d.benchmarkCumulative - 1) * 10000) / 100,
      portfolio: Math.round((d.portfolioCumulative - 1) * 10000) / 100,
      activeReturn: Math.round(d.activeReturn * 10000) / 100,
      trackingError: Math.round(d.trackingError * 10000) / 100,
    }));
  }, [backtestData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm" data-testid="chart-tooltip">
        <p className="font-medium text-foreground mb-2">{formatDateLabel(label)}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums" style={{ color: entry.color }}>
              {entry.value?.toFixed(2)}%/yr
            </span>
          </div>
        ))}
      </div>
    );
  };

  const BacktestTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm" data-testid="backtest-tooltip">
        <p className="font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums" style={{ color: entry.color }}>
              {entry.value?.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    );
  };

  const signalLabel = BACKTEST_SIGNALS.find(s => s.value === backtestSignal)?.label || backtestSignal;

  const comparisonDownloadRows = chartData.map((d) => ({
    Date: d.dateLabel,
    [`${expectedLabel} (%/yr)`]: d.expected,
    "Carbon Intensity (%/yr)": d.carbonIntensity,
    "SDG Exposure (%/yr)": d.sdgExposure,
    "Decarb Ambition (%/yr)": d.decarbAmbition,
  }));

  const cumulativeReturnDownloadRows = backtestChartData.map((d) => ({
    Date: d.date,
    "Benchmark Cumulative Return (%)": d.benchmark,
    [`${signalLabel} Portfolio Cumulative Return (%)`]: d.portfolio,
  }));

  const activeReturnDownloadRows = backtestChartData.map((d) => ({
    Date: d.date,
    "Active Return (%)": d.activeReturn,
    "Tracking Error (ann.) (%)": d.trackingError,
  }));

  return (
    <div className="p-4 space-y-4 max-w-full" data-testid="page-decarb-signal">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Decarb Signal Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Expected reduction rates vs. market-implied decarbonization signals
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Select value={scoringMethod} onValueChange={(v) => setScoringMethod(v as ScoringMethod)}>
              <SelectTrigger className="w-[160px]" data-testid="select-scoring-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORING_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value} data-testid={`option-method-${m.value}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={geography} onValueChange={setGeography}>
              <SelectTrigger className="w-[180px]" data-testid="select-geography">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-geo-all">All Geographies</SelectItem>
                {dimensions?.geographies?.map((geo) => (
                  <SelectItem key={geo} value={geo} data-testid={`option-geo-${geo.toLowerCase().replace(/\s+/g, "-")}`}>
                    {geo.charAt(0) + geo.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">{expectedLabel}</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.expected }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-expected-rate">
            {latestValues?.expected !== undefined ? `${latestValues.expected.toFixed(2)}%` : "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">per year</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">Carbon Intensity</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.carbonIntensity }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-ci-rate">
            {latestValues?.carbonIntensity !== undefined ? `${latestValues.carbonIntensity.toFixed(2)}%` : "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">per year (market-implied)</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">SDG Exposure</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.sdgExposure }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-sdg-rate">
            {latestValues?.sdgExposure !== undefined ? `${latestValues.sdgExposure.toFixed(2)}%` : "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">per year (market-implied)</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">Decarb Ambition</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.decarbAmbition }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-da-rate">
            {latestValues?.decarbAmbition !== undefined ? `${latestValues.decarbAmbition.toFixed(2)}%` : "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">per year (market-implied)</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold" data-testid="text-chart-title">
              Decarbonization Rate Comparison
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Annual implied reduction rates from different inference approaches
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Badge variant="secondary">Loading...</Badge>}
            <DownloadDataButton
              filename="decarbonization-rate-comparison"
              sheetName="Decarb Rate Comparison"
              rows={comparisonDownloadRows}
              testId="button-download-decarb-comparison"
            />
          </div>
        </div>

        {isLoading && !hasData ? (
          <Skeleton className="w-full h-[420px]" />
        ) : chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[420px] text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">
              {!uploadId
                ? "No dataset uploaded yet. Upload a dataset in the Scenario Analyzer to see market-implied signals."
                : isGeoFiltered
                  ? "No results for selected geography. Try a different region or reset to All Geographies."
                  : "No data available."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatDateLabel}
                tick={{ fontSize: 11 }}
                scale="time"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
                label={{ value: "Decarb Rate (%/yr)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
              <Line
                dataKey="expected"
                name={expectedLabel}
                stroke={LINE_COLORS.expected}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls
                type="monotone"
              />
              <Line
                dataKey="carbonIntensity"
                name="Carbon Intensity"
                stroke={LINE_COLORS.carbonIntensity}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                type="monotone"
              />
              <Line
                dataKey="sdgExposure"
                name="SDG Exposure"
                stroke={LINE_COLORS.sdgExposure}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                type="monotone"
              />
              <Line
                dataKey="decarbAmbition"
                name="Decarb Ambition"
                stroke={LINE_COLORS.decarbAmbition}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                type="monotone"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>

      {uploadId && (
        <Card className="p-4" data-testid="card-backtest">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-semibold flex items-center gap-2" data-testid="text-backtest-title">
                <BarChart3 className="h-4 w-4" />
                Signal Backtest
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Retrospective signal portfolios. Non-gap signals use pooled ranking, regardless of the page's valuation-grouping control.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Signal</Label>
                <Select value={backtestSignal} onValueChange={(v) => setBacktestSignal(v as BacktestSignal)}>
                  <SelectTrigger className="w-[160px]" data-testid="select-backtest-signal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BACKTEST_SIGNALS.map((s) => (
                      <SelectItem key={s.value} value={s.value} data-testid={`option-signal-${s.value}`}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3 min-w-[220px]">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Target TE: {trackingErrorLimit.toFixed(1)}%
                </Label>
                <Slider
                  value={[trackingErrorLimit]}
                  onValueChange={([v]) => setTrackingErrorLimit(v)}
                  min={0.5}
                  max={10}
                  step={0.5}
                  className="w-[120px]"
                  data-testid="slider-tracking-error"
                />
              </div>
            </div>
          </div>

          <BacktestSummary data={backtestResponse} error={backtestError} label="Selected signal" />
          {backtestStats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Portfolio Total</p>
                <p className={`text-lg font-bold tabular-nums ${backtestStats.portfolioTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-portfolio-total">
                  {backtestStats.portfolioTotal >= 0 ? "+" : ""}{backtestStats.portfolioTotal.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Benchmark Total</p>
                <p className={`text-lg font-bold tabular-nums ${backtestStats.benchmarkTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-benchmark-total">
                  {backtestStats.benchmarkTotal >= 0 ? "+" : ""}{backtestStats.benchmarkTotal.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Active Return (ann.)</p>
                <p className={`text-lg font-bold tabular-nums ${backtestStats.annualizedActive >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-active-return">
                  {backtestStats.annualizedActive >= 0 ? "+" : ""}{backtestStats.annualizedActive.toFixed(2)}%
                </p>
              </div>
              <div className="p-3 rounded-md border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Tracking Error</p>
                <p className="text-lg font-bold tabular-nums" data-testid="text-tracking-error">
                  {backtestStats.finalTE.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {backtestStats.avgGreen} green / {backtestStats.avgBrown} brown
                </p>
              </div>
            </div>
          )}

          {loadingBacktest ? (
            <Skeleton className="w-full h-[380px]" />
          ) : backtestChartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[380px] text-muted-foreground">
              <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No backtest data available. Ensure a dataset is uploaded.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Cumulative Return (%)</h3>
                  <DownloadDataButton
                    filename="signal-backtest-cumulative-return"
                    sheetName="Cumulative Return"
                    rows={cumulativeReturnDownloadRows}
                    testId="button-download-backtest-cumulative"
                  />
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={backtestChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: string) => {
                        const parts = v.split("-");
                        return parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : v;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    />
                    <Tooltip content={<BacktestTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <Line
                      dataKey="benchmark"
                      name="Benchmark (MV-weighted)"
                      stroke={BACKTEST_COLORS.benchmark}
                      strokeWidth={1.5}
                      dot={false}
                      type="monotone"
                    />
                    <Line
                      dataKey="portfolio"
                      name={`${signalLabel} Portfolio`}
                      stroke={BACKTEST_COLORS.portfolio}
                      strokeWidth={2}
                      dot={false}
                      type="monotone"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-xs font-medium text-muted-foreground">Monthly Active Return & Expanding Tracking Error (%)</h3>
                  <DownloadDataButton
                    filename="signal-backtest-active-return"
                    sheetName="Active Return & TE"
                    rows={activeReturnDownloadRows}
                    testId="button-download-backtest-active"
                  />
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <ComposedChart data={backtestChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      tickFormatter={(v: string) => {
                        const parts = v.split("-");
                        return parts.length === 2 ? `${parts[1]}/${parts[0].slice(2)}` : v;
                      }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    />
                    <Tooltip content={<BacktestTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                    <ReferenceLine yAxisId="right" y={trackingErrorLimit} stroke={BACKTEST_COLORS.trackingError} strokeDasharray="6 3" strokeOpacity={0.6} label={{ value: `Target TE: ${trackingErrorLimit}%`, position: "right", style: { fontSize: 10, fill: BACKTEST_COLORS.trackingError } }} />
                    <Bar
                      yAxisId="left"
                      dataKey="activeReturn"
                      name="Active Return"
                      fill={BACKTEST_COLORS.portfolio}
                      fillOpacity={0.5}
                      barSize={3}
                    />
                    <Line
                      yAxisId="right"
                      dataKey="trackingError"
                      name="Tracking Error (ann.)"
                      stroke={BACKTEST_COLORS.trackingError}
                      strokeWidth={1.5}
                      dot={false}
                      type="monotone"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-2">Methodology Notes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground leading-relaxed">
          <div>
            <p className="font-medium text-foreground mb-1">Expected (Model)</p>
            <p>
              Derived from Monte Carlo simulation using 14 real-world indicators.
              Shows the annualized emissions reduction rate implied by current technology,
              policy, corporate, and socioeconomic trajectories.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Carbon Intensity (Market)</p>
            <p>
              Compares P/E ratios of high vs. low carbon intensity companies.
              The differential implies a market-priced decarbonization rate via
              the Gordon Growth Model (g = r - 1/PE).
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">SDG Exposure (Market)</p>
            <p>
              Splits companies by SDG alignment score (positive = clean, negative = dirty).
              Growth rate differential between clean and dirty portfolios implies
              a market-priced transition rate.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Decarb Ambition (Market)</p>
            <p>
              Ranks companies by 2050 emission reduction targets into terciles.
              P/E premium for ambitious vs. lagging companies translates to
              an implied decarbonization rate through growth differentials.
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="font-medium text-foreground mb-1">Signal Backtest</p>
            <p>
              Constructs a portfolio that overweights low-carbon (green) companies and
              underweights high-carbon (brown) companies based on the selected signal.
              Returns are derived from the Total Return Index (RI), converted to monthly changes
              with extreme moves (&gt;50% monthly) filtered. Portfolio weights start from
              market-cap weights and are tilted proportionally, then scaled to meet the
              tracking error constraint. The tracking error limit controls how much the
              portfolio can deviate from the benchmark.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

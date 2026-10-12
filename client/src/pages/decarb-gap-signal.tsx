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
import { Activity, Globe, Layers, BarChart3, TrendingUp, TrendingDown, ArrowUpDown, Beaker } from "lucide-react";
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
  ComposedChart,
  Bar,
  BarChart,
  Cell,
} from "recharts";

interface DecarbGapSummary {
  projectedRate: number;
  medianImpliedRate: number;
  meanImpliedRate: number;
  companyCount: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  distribution: Array<{ bucket: string; count: number; midpoint: number }>;
  topCompanies: CompanyGap[];
  bottomCompanies: CompanyGap[];
}

interface CompanyGap {
  companyId: number;
  companyName: string;
  sector: string | null;
  subSector: string | null;
  industry: string | null;
  pe: number;
  impliedGrowth: number;
  peerMedianGrowth: number;
  impliedDecarbRate: number;
  gap: number;
  score: number;
}

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
type MeasureType = "carbon_intensity" | "sdg_alignment" | "decarb_ambition";

const SCORING_METHODS: { value: ScoringMethod; label: string }[] = [
  { value: "absolute", label: "Absolute" },
  { value: "sector_relative", label: "Sector-Relative" },
  { value: "sub_sector_relative", label: "Sub-Sector" },
  { value: "industry_relative", label: "Industry" },
];

const MEASURE_TYPES: { value: MeasureType; label: string; description: string }[] = [
  { value: "carbon_intensity", label: "Carbon Intensity", description: "Low vs high carbon intensity P/E differential" },
  { value: "sdg_alignment", label: "SDG Alignment", description: "SDG-clean vs SDG-dirty growth differential" },
  { value: "decarb_ambition", label: "Decarb Ambition", description: "Best vs worst decarbonization target P/E differential" },
];

const COLORS = {
  projected: "hsl(168, 76%, 36%)",
  implied: "hsl(220, 70%, 50%)",
  positive: "hsl(168, 76%, 36%)",
  negative: "hsl(0, 70%, 50%)",
  benchmark: "hsl(var(--muted-foreground))",
  portfolio: "hsl(168, 76%, 36%)",
  valuation: "hsl(260, 60%, 55%)",
  trackingError: "hsl(30, 80%, 50%)",
  gapFill: "hsl(168, 76%, 36%)",
};

interface TimeSeriesDataPoint {
  date: number;
  dateLabel: string;
  projectedRate?: number;
  impliedRate?: number;
}

function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDateStr(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export default function DecarbGapSignal() {
  const [scoringMethod, setScoringMethod] = useState<ScoringMethod>("sector_relative");
  const [geography, setGeography] = useState<string>("all");
  const [trackingErrorLimit, setTrackingErrorLimit] = useState(2);
  const [measure, setMeasure] = useState<MeasureType>("sdg_alignment");

  const geoParam = geography !== "all" ? `&geography=${encodeURIComponent(geography)}` : "";
  const methodParam = `method=${scoringMethod}`;

  const { data: dimensions } = useQuery<DimensionsData>({
    queryKey: ["/api/cv/dimensions"],
  });

  const { data: uploads } = useQuery<UploadRecord[]>({
    queryKey: ["/api/cv/uploads"],
  });

  const uploadId = uploads?.find((u) => u.status === "completed")?.id;

  const { data: summary, isLoading: loadingSummary } = useQuery<DecarbGapSummary>({
    queryKey: ["/api/cv/decarb-gap/summary", scoringMethod, geography],
    queryFn: async () => {
      const res = await fetch(`/api/cv/decarb-gap/summary?${methodParam}${geoParam}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!uploadId,
  });

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
    enabled: !!uploadId,
  });

  const { data: decarbTercileData, isLoading: loadingDecarb } = useQuery<DecarbTercilePoint[]>({
    queryKey: ["/api/cv/decarb-terciles", scoringMethod, geography],
    queryFn: async () => {
      const res = await fetch(`/api/cv/decarb-terciles?${methodParam}&costOfEquity=0.08${geoParam}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!uploadId,
  });

  const backtestSignal = measure === "carbon_intensity" ? "carbon_intensity"
    : measure === "sdg_alignment" ? "sdg_exposure"
    : measure === "decarb_ambition" ? "decarb_ambition"
    : "decarb_gap";

  const compareGap = backtestSignal !== "decarb_gap";
  const { data: backtestResponse, isLoading: loadingBacktest, error: backtestError } = useQuery<BacktestResponse>({
    queryKey: ["/api/cv/backtest", backtestSignal, trackingErrorLimit, scoringMethod, geography],
    queryFn: async () => {
      return fetchBacktest(`/api/cv/backtest?signal=${backtestSignal}&trackingError=${trackingErrorLimit}&trackingErrorUnit=percent&method=${compareGap ? "absolute" : scoringMethod}${geoParam}`);
    },
    enabled: !!uploadId,
  });

  const { data: valuationBacktestResponse, isLoading: loadingValBacktest, error: valuationBacktestError } = useQuery<BacktestResponse>({
    queryKey: ["/api/cv/backtest", "valuation", "decarb_gap", trackingErrorLimit, scoringMethod, geography],
    queryFn: async () => {
      return fetchBacktest(`/api/cv/backtest?signal=decarb_gap&trackingError=${trackingErrorLimit}&trackingErrorUnit=percent&${methodParam}${geoParam}`);
    },
    enabled: !!uploadId && compareGap,
  });
  const backtestData = backtestResponse?.series;
  const valuationBacktestData = compareGap ? valuationBacktestResponse?.series : undefined;

  const selectedMeasureData = useMemo(() => {
    if (measure === "carbon_intensity") return carbonPriceData;
    if (measure === "sdg_alignment") return sdgData;
    if (measure === "decarb_ambition") return decarbTercileData;
    return null;
  }, [measure, carbonPriceData, sdgData, decarbTercileData]);

  const latestImpliedRate = useMemo(() => {
    if (!selectedMeasureData || selectedMeasureData.length === 0) return null;
    const last = selectedMeasureData[selectedMeasureData.length - 1];
    return Math.round(last.impliedDecarbRate * 100) / 100;
  }, [selectedMeasureData]);

  const latestProjectedRate = useMemo(() => {
    if (!historicalTrend || historicalTrend.length === 0) return summary?.projectedRate ?? null;
    const last = historicalTrend[historicalTrend.length - 1];
    return Math.round(last.reductionRate * 100) / 100;
  }, [historicalTrend, summary]);

  const gap = latestProjectedRate !== null && latestImpliedRate !== null
    ? Math.round((latestProjectedRate - latestImpliedRate) * 100) / 100
    : (summary ? summary.projectedRate - summary.medianImpliedRate : 0);

  const chartData = useMemo(() => {
    const dateMap = new Map<number, TimeSeriesDataPoint>();

    if (historicalTrend) {
      for (const pt of historicalTrend) {
        const ts = new Date(pt.year, 6, 1).getTime();
        dateMap.set(ts, {
          date: ts,
          dateLabel: `${pt.year}`,
          projectedRate: Math.round(pt.reductionRate * 100) / 100,
        });
      }
    }

    if (selectedMeasureData) {
      for (const pt of selectedMeasureData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        const impliedRate = Math.round(pt.impliedDecarbRate * 100) / 100;
        if (existing) {
          existing.impliedRate = impliedRate;
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            impliedRate,
          });
        }
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date - b.date);
  }, [historicalTrend, selectedMeasureData]);

  const loadingMeasure = (measure === "carbon_intensity" && loadingCP) ||
    (measure === "sdg_alignment" && loadingSDG) ||
    (measure === "decarb_ambition" && loadingDecarb);
  const loadingTS = loadingTrend || loadingMeasure;
  const hasChartData = chartData.length > 0 && chartData.some(d => d.impliedRate !== undefined || d.projectedRate !== undefined);
  const hasData = !!summary && summary.companyCount > 0;

  function computeStats(data: BacktestPoint[] | undefined) {
    if (!data || data.length === 0) return null;
    const last = data[data.length - 1];
    const totalActiveReturn = (last.portfolioCumulative / last.benchmarkCumulative - 1) * 100;
    const annualizedActive = data.length > 12
      ? (Math.pow(last.portfolioCumulative / last.benchmarkCumulative, 12 / data.length) - 1) * 100
      : totalActiveReturn;
    const avgGreen = Math.round(data.reduce((s, d) => s + d.overweightCount, 0) / data.length);
    const avgBrown = Math.round(data.reduce((s, d) => s + d.underweightCount, 0) / data.length);
    return {
      totalActive: totalActiveReturn,
      annualizedActive,
      finalTE: last.trackingError * 100,
      benchmarkTotal: (last.benchmarkCumulative - 1) * 100,
      portfolioTotal: (last.portfolioCumulative - 1) * 100,
      avgGreen,
      avgBrown,
      months: data.length,
    };
  }

  const backtestStats = useMemo(() => computeStats(backtestData), [backtestData]);
  const valBacktestStats = useMemo(() => computeStats(valuationBacktestData), [valuationBacktestData]);

  const backtestChartData = useMemo(() => {
    if (!backtestData && !valuationBacktestData) return [];
    const signalMap = new Map<string, BacktestPoint>();
    const valMap = new Map<string, BacktestPoint>();
    if (backtestData) {
      for (const d of backtestData) signalMap.set(d.date, d);
    }
    if (valuationBacktestData) {
      for (const d of valuationBacktestData) valMap.set(d.date, d);
    }
    const allDates = Array.from(new Set([...Array.from(signalMap.keys()), ...Array.from(valMap.keys())])).sort();
    return allDates.map((date) => {
      const sd = signalMap.get(date);
      const vd = valMap.get(date);
      const bmSource = sd || vd;
      return {
        date,
        benchmark: bmSource ? Math.round((bmSource.benchmarkCumulative - 1) * 10000) / 100 : undefined,
        portfolio: sd ? Math.round((sd.portfolioCumulative - 1) * 10000) / 100 : undefined,
        valuation: vd ? Math.round((vd.portfolioCumulative - 1) * 10000) / 100 : undefined,
        activeReturn: sd ? Math.round(sd.activeReturn * 10000) / 100 : undefined,
        trackingError: sd ? Math.round(sd.trackingError * 10000) / 100 : undefined,
      };
    });
  }, [backtestData, valuationBacktestData]);

  const TimeSeriesChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm">
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
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm">
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

  const DistributionTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const item = payload[0]?.payload;
    if (!item) return null;
    return (
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm">
        <p className="font-medium text-foreground mb-1">{item.bucket}</p>
        <p className="text-muted-foreground">{item.count} companies</p>
      </div>
    );
  };

  const measureInfo = MEASURE_TYPES.find(m => m.value === measure);

  const distributionDownloadRows = (summary?.distribution || []).map((d) => ({
    "Gap Bucket": d.bucket,
    "Midpoint (%)": d.midpoint,
    "Companies": d.count,
  }));

  const timeseriesDownloadRows = chartData.map((d) => ({
    "Date": formatDateLabel(d.date),
    "Projected Rate (%/yr)": d.projectedRate,
    [`Implied Rate - ${measureInfo?.label ?? "Measure"} (%/yr)`]: d.impliedRate,
  }));

  const cumulativeReturnDownloadRows = backtestChartData.map((d) => ({
    "Date": d.date,
    "Benchmark Cumulative Return (%)": d.benchmark,
    [`${measureInfo?.label ?? "Measure"}-Driven Cumulative Return (%)`]: d.portfolio,
    ...(compareGap ? { "Decarb Gap Cumulative Return (%)": d.valuation } : {}),
  }));

  const activeReturnDownloadRows = backtestChartData.map((d) => ({
    "Date": d.date,
    "Active Return (%)": d.activeReturn,
    "Tracking Error (ann. %)": d.trackingError,
  }));

  return (
    <div className="p-4 space-y-4 max-w-full" data-testid="page-decarb-gap-signal">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Decarb Gap Signal
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Market-implied vs. projected decarbonization rate gap per company
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Beaker className="h-4 w-4 text-muted-foreground" />
            <Select value={measure} onValueChange={(v) => setMeasure(v as MeasureType)}>
              <SelectTrigger className="w-[180px]" data-testid="select-measure">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEASURE_TYPES.map((m) => (
                  <SelectItem key={m.value} value={m.value} data-testid={`option-measure-${m.value}`}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

      {!uploadId && (
        <Card className="p-8 flex flex-col items-center justify-center text-muted-foreground">
          <Activity className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No dataset uploaded. Upload a dataset in the Scenario Analyzer to see gap signals.</p>
        </Card>
      )}

      {uploadId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Projected Rate</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.projected }} />
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-projected-rate">
                {latestProjectedRate !== null ? `${latestProjectedRate.toFixed(2)}%` : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground">per year (Monte Carlo)</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Implied Rate ({measureInfo?.label})</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.implied }} />
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-implied-rate">
                {latestImpliedRate !== null ? `${latestImpliedRate.toFixed(2)}%` : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground">per year (GGM, {measureInfo?.label})</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Gap (Proj - Implied)</span>
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className={`text-2xl font-bold tabular-nums ${gap >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-gap">
                {latestProjectedRate !== null && latestImpliedRate !== null ? `${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%` : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground">positive = underpriced transition</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Companies Scored</span>
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-company-count">
                {summary ? summary.companyCount : "\u2014"}
              </p>
              <p className="text-xs text-muted-foreground">
                {summary ? (
                  <span>
                    <span className="text-green-600 dark:text-green-400">{summary.positiveSignalCount} positive</span>
                    {" / "}
                    <span className="text-red-600 dark:text-red-400">{summary.negativeSignalCount} negative</span>
                  </span>
                ) : "signal split"}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4" data-testid="card-gap-distribution">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-semibold mb-1">Gap Distribution</h2>
                  <p className="text-xs text-muted-foreground">
                    Distribution of (projected - implied) gap across companies
                  </p>
                </div>
                <DownloadDataButton
                  filename="gap-distribution"
                  sheetName="Gap Distribution"
                  rows={distributionDownloadRows}
                  testId="button-download-gap-distribution"
                />
              </div>
              {loadingSummary ? (
                <Skeleton className="w-full h-[300px]" />
              ) : !hasData ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summary?.distribution || []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={50} />
                    <YAxis tick={{ fontSize: 10 }} label={{ value: "Companies", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }} />
                    <Tooltip content={<DistributionTooltip />} />
                    <ReferenceLine x="-0.5 to 0%" stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Bar dataKey="count" name="Companies" radius={[2, 2, 0, 0]}>
                      {(summary?.distribution || []).map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.midpoint >= 0 ? COLORS.positive : COLORS.negative}
                          fillOpacity={0.7}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-4" data-testid="card-gap-timeseries">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-semibold mb-1">Implied vs Projected Over Time</h2>
                  <p className="text-xs text-muted-foreground">
                    {measureInfo?.description} vs. Monte Carlo projected rate
                  </p>
                </div>
                <DownloadDataButton
                  filename="implied-vs-projected-over-time"
                  sheetName="Implied vs Projected"
                  rows={timeseriesDownloadRows}
                  testId="button-download-gap-timeseries"
                />
              </div>
              {loadingTS ? (
                <Skeleton className="w-full h-[300px]" />
              ) : !hasChartData ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No time series data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10 }}
                      tickFormatter={formatDateLabel}
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      scale="time"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                      label={{ value: "Decarb Rate (%/yr)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                    />
                    <Tooltip content={<TimeSeriesChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Line
                      dataKey="projectedRate"
                      name="Projected (Model)"
                      stroke={COLORS.projected}
                      strokeWidth={2.5}
                      dot={false}
                      type="monotone"
                      connectNulls
                    />
                    <Line
                      dataKey="impliedRate"
                      name={`Implied (${measureInfo?.label})`}
                      stroke={COLORS.implied}
                      strokeWidth={2}
                      dot={false}
                      type="monotone"
                      connectNulls
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {hasData && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4" data-testid="card-top-companies">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <h2 className="text-sm font-semibold">Largest Positive Gap (Underpriced Transition)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-2">Company</th>
                        <th className="text-left py-1.5 pr-2">Sector</th>
                        <th className="text-right py-1.5 pr-2">P/E</th>
                        <th className="text-right py-1.5 pr-2">Implied</th>
                        <th className="text-right py-1.5">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.topCompanies.map((c) => (
                        <tr key={c.companyId} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]" title={c.companyName}>{c.companyName}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[100px]" title={c.sector || ""}>{c.sector || "\u2014"}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{c.pe.toFixed(1)}x</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{c.impliedDecarbRate.toFixed(2)}%</td>
                          <td className="py-1.5 text-right tabular-nums text-green-600 dark:text-green-400 font-medium">+{c.gap.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-4" data-testid="card-bottom-companies">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <h2 className="text-sm font-semibold">Largest Negative Gap (Overpriced Transition)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-2">Company</th>
                        <th className="text-left py-1.5 pr-2">Sector</th>
                        <th className="text-right py-1.5 pr-2">P/E</th>
                        <th className="text-right py-1.5 pr-2">Implied</th>
                        <th className="text-right py-1.5">Gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.bottomCompanies.map((c) => (
                        <tr key={c.companyId} className="border-b border-border/50">
                          <td className="py-1.5 pr-2 font-medium truncate max-w-[140px]" title={c.companyName}>{c.companyName}</td>
                          <td className="py-1.5 pr-2 text-muted-foreground truncate max-w-[100px]" title={c.sector || ""}>{c.sector || "\u2014"}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{c.pe.toFixed(1)}x</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{c.impliedDecarbRate.toFixed(2)}%</td>
                          <td className="py-1.5 text-right tabular-nums text-red-600 dark:text-red-400 font-medium">{c.gap.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          <Card className="p-4" data-testid="card-backtest">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-base font-semibold flex items-center gap-2" data-testid="text-backtest-title">
                  <BarChart3 className="h-4 w-4" />
                  {measureInfo?.label} Backtest
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {compareGap
                    ? `${measureInfo?.label} (pooled ranking) versus Decarb Gap (${SCORING_METHODS.find(m => m.value === scoringMethod)?.label} ranking).`
                    : "Decarb Gap signal only; the identical comparison is hidden."}
                </p>
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

            <BacktestSummary data={backtestResponse} error={backtestError} label={measureInfo?.label} />
            {compareGap && <BacktestSummary data={valuationBacktestResponse} error={valuationBacktestError} label="Decarb Gap" />}
            {(backtestStats || valBacktestStats) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div className="p-3 rounded-md border bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">Benchmark Total</p>
                  <p className={`text-lg font-bold tabular-nums ${(backtestStats?.benchmarkTotal ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-benchmark-total">
                    {(backtestStats?.benchmarkTotal ?? 0) >= 0 ? "+" : ""}{(backtestStats?.benchmarkTotal ?? 0).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-md border bg-muted/30">
                  <p className="text-xs mb-1 font-medium" style={{ color: COLORS.portfolio }}>{measureInfo?.label}-Driven</p>
                  {backtestStats ? (
                    <>
                      <p className={`text-lg font-bold tabular-nums ${backtestStats.portfolioTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-portfolio-total">
                        {backtestStats.portfolioTotal >= 0 ? "+" : ""}{backtestStats.portfolioTotal.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active: {backtestStats.annualizedActive >= 0 ? "+" : ""}{backtestStats.annualizedActive.toFixed(2)}% ann. | TE: {backtestStats.finalTE.toFixed(2)}%
                      </p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">Loading...</p>}
                </div>
                {compareGap && <div className="p-3 rounded-md border bg-muted/30">
                  <p className="text-xs mb-1 font-medium" style={{ color: COLORS.valuation }}>Decarb Gap</p>
                  {valBacktestStats ? (
                    <>
                      <p className={`text-lg font-bold tabular-nums ${valBacktestStats.portfolioTotal >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-valuation-total">
                        {valBacktestStats.portfolioTotal >= 0 ? "+" : ""}{valBacktestStats.portfolioTotal.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active: {valBacktestStats.annualizedActive >= 0 ? "+" : ""}{valBacktestStats.annualizedActive.toFixed(2)}% ann. | TE: {valBacktestStats.finalTE.toFixed(2)}%
                      </p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">Loading...</p>}
                </div>}
              </div>
            )}

            {(loadingBacktest || loadingValBacktest) ? (
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
                      filename="backtest-cumulative-return"
                      sheetName="Cumulative Return"
                      rows={cumulativeReturnDownloadRows}
                      testId="button-download-cumulative-return"
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
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
                      <Tooltip content={<BacktestTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                      <Line dataKey="benchmark" name="Benchmark (MV-weighted)" stroke={COLORS.benchmark} strokeWidth={1.5} dot={false} type="monotone" />
                      <Line dataKey="portfolio" name={`${measureInfo?.label}-Driven`} stroke={COLORS.portfolio} strokeWidth={2} dot={false} type="monotone" />
                      {compareGap && <Line dataKey="valuation" name="Decarb Gap" stroke={COLORS.valuation} strokeWidth={2} dot={false} type="monotone" strokeDasharray="6 3" />}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-xs font-medium text-muted-foreground">Monthly Active Return & Expanding Tracking Error (%)</h3>
                    <DownloadDataButton
                      filename="backtest-active-return-tracking-error"
                      sheetName="Active Return & TE"
                      rows={activeReturnDownloadRows}
                      testId="button-download-active-return"
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
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Tooltip content={<BacktestTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <ReferenceLine yAxisId="left" y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.4} />
                      <ReferenceLine yAxisId="right" y={trackingErrorLimit} stroke={COLORS.trackingError} strokeDasharray="6 3" strokeOpacity={0.6} label={{ value: `Target TE: ${trackingErrorLimit}%`, position: "right", style: { fontSize: 10, fill: COLORS.trackingError } }} />
                      <Bar yAxisId="left" dataKey="activeReturn" name="Active Return" fill={COLORS.portfolio} fillOpacity={0.5} barSize={3} />
                      <Line yAxisId="right" dataKey="trackingError" name="Tracking Error (ann.)" stroke={COLORS.trackingError} strokeWidth={1.5} dot={false} type="monotone" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4" data-testid="card-methodology">
            <h3 className="text-sm font-semibold mb-3">Methodology</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground leading-relaxed">
              <div>
                <p className="font-medium text-foreground mb-1">Per-Company Implied Decarb Rate</p>
                <p>
                  Each company's P/E ratio is converted to an implied growth rate using the
                  Gordon Growth Model (g = r - 1/PE, where r is cost of equity at 8%).
                  The company's implied decarbonization rate is the growth premium relative to
                  its peer group median. Higher growth relative to peers suggests the market is
                  pricing in transition benefits.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Market-Implied Rate (3 Measures)</p>
                <p>
                  <strong>Carbon Intensity:</strong> Compares aggregate P/E of lowest-carbon-intensity
                  tercile vs highest; the growth differential is the market-implied decarbonization rate.{" "}
                  <strong>SDG Alignment:</strong> Splits companies by SDG alignment score (positive = clean,
                  negative = dirty); clean vs dirty P/E growth differential.{" "}
                  <strong>Decarb Ambition:</strong> Ranks companies by emission reduction targets
                  (2050 pathway); best vs worst tercile P/E growth differential.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Projected Rate</p>
                <p>
                  The global projected decarbonization rate from the Monte Carlo simulation (10,000 iterations),
                  based on 22 real-world indicators across technology, policy, corporate,
                  and socioeconomic categories. Varies over time as historical indicator values
                  change, showing how the model's expectation has evolved from 2015 to present.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Gap Signal</p>
                <p>
                  Gap = Projected Rate - Company Implied Rate. A positive gap means the company
                  is not yet pricing in the full expected transition (potential upside).
                  A negative gap means the market is pricing more decarbonization than projected
                  (potential overvaluation). Companies are ranked within their peer group
                  ({SCORING_METHODS.find(m => m.value === scoringMethod)?.label}) and scored -1 to +1.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="font-medium text-foreground text-xs mb-2">Backtesting Methodology (Detailed)</p>
              <div className="text-xs text-muted-foreground leading-relaxed space-y-2">
                <p>
                  <strong>Signal comparison:</strong> The backtest compares the selected signal with Decarb Gap, unless it is already selected.
                  The <strong style={{ color: COLORS.portfolio }}>{measureInfo?.label}-Driven</strong> strategy ranks companies
                  directly by their {measure === "carbon_intensity" ? "carbon emissions intensity" : measure === "sdg_alignment" ? "SDG alignment score" : "decarbonization target ambition"} and
                  tilts toward the best performers.
                  The <strong style={{ color: COLORS.valuation }}>Decarb Gap</strong> signal (formerly labelled Valuation-Aware) computes each company's
                  implied decarbonization rate from its P/E ratio (via GGM), compares it to the Monte Carlo projected rate,
                  and tilts toward companies where the projected rate exceeds the market-implied rate (underpriced transition).
                </p>
                <p>
                  <strong>1. Signal Scoring:</strong> For the {measureInfo?.label}-driven strategy, companies are ranked by
                  their {measure === "carbon_intensity" ? "carbon intensity (lower = better)" : measure === "sdg_alignment" ? "SDG exposure score (higher = better)" : "decarb target pathway (more ambitious = better)"}.
                  For Decarb Gap, the gap = projected rate - company implied rate.
                  Only Decarb Gap uses the selected peer grouping; other signals use pooled ranking. Companies are assigned a
                  continuous score from -1 to +1 based on percentile rank.
                </p>
                <p>
                  <strong>2. Monthly Returns:</strong> Total Return Index (RI) data for each company
                  is aggregated into monthly returns using consecutive available month-end observations:
                  (current month-end RI / previous available month-end RI) - 1. Returns exceeding ±50% in a
                  single month are excluded as outliers.
                </p>
                <p>
                  <strong>3. Benchmark Construction:</strong> The benchmark is a market-capitalization-weighted
                  portfolio of all companies with valid return data in each month. Each company's weight equals
                  its market cap divided by total market cap. The benchmark return is the weighted average of
                  individual monthly returns.
                </p>
                <p>
                  <strong>4. Portfolio Tilting:</strong> Starting from benchmark weights, each company's weight
                  is tilted by: active_weight = signal_score × tilt_scale × benchmark_weight. The portfolio
                  weight becomes benchmark_weight + active_weight, floored at zero (no short positions).
                  Weights are then re-normalized to sum to 1. Companies with positive signal scores are
                  overweighted; negative scores are underweighted.
                </p>
                <p>
                  <strong>5. Tracking Error Calibration:</strong> The tilt_scale parameter controls how
                  aggressively the portfolio deviates from the benchmark. A binary search algorithm
                  calibrates tilt_scale to achieve the user-specified annualized tracking error target.
                  The algorithm runs up to 20 iterations, converging when realized tracking error is within
                  2% of the target. Tracking error is computed as the annualized standard deviation of
                  monthly active returns (portfolio return minus benchmark return), using √12 annualization.
                </p>
                <p>
                  <strong>6. Cumulative Performance:</strong> Portfolio and benchmark cumulative returns
                  are computed by chaining monthly returns: Cum(t) = Cum(t-1) × (1 + r(t)). Active return
                  per month is portfolio return minus benchmark return. Expanding tracking error is computed
                  over all months up to the current period, providing a time series of realized risk.
                </p>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

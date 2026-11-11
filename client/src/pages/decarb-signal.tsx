import { analysisFetch as fetch, hasArchivedSelection } from "@/lib/analysis-selection";
import { useState, useMemo } from "react";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { ReadResultReason } from "@/components/read-result-reason";
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
import { certifyFiniteExport,finiteExportBindings,signalCumulativeColumn } from "@shared/finiteExportSchemas";
import { earningsYieldGapPp, displayDiagnostic, gordonBaselineLabel, gordonExportNotes } from "@/lib/valuation-claims";
import { QueryReadErrors } from "@/components/query-read-errors";
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

interface SDGGrowthPoint {
  cleanPE: number;
  dirtyPE: number;
  date: string;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  cleanCount: number;
  dirtyCount: number;
}

interface DecarbTercilePoint {
  bestTercilePE: number;
  worstTercilePE: number;
  date: string;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  bestTercileCompanyCount: number;
  worstTercileCompanyCount: number;
}

interface CarbonPricePoint {
  bottomTercilePeRatio: number;
  topTercilePeRatio: number;
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
  carbonIntensity?: number | null;
  sdgExposure?: number | null;
  decarbAmbition?: number | null;
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

  const { data: uploads, isLoading: uploadsLoading, error: uploadsError } = useQuery<UploadRecord[]>({
    queryKey: ["/api/cv/uploads"],
  });

  const uploadId = hasArchivedSelection() ? "archived" : uploads?.find((u) => u.status === "completed")?.id;

  const { data: carbonPriceData, isLoading: loadingCP, error: cpError } = useQuery<CarbonPricePoint[]>({
    queryKey: ["/api/cv/carbon-price", scoringMethod, geography, uploadId],
    queryFn: async () => {
      const res = await fetch(`/api/cv/carbon-price?uploadId=${uploadId}&${methodParam}&includeScope3=false&winsorize=true&inferenceMethod=carbon_intensity${geoParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Company valuation groups unavailable");
      return res.json();
    },
    enabled: !!uploadId,
  });

  const { data: sdgData, isLoading: loadingSDG, error: sdgError } = useQuery<SDGGrowthPoint[]>({
    queryKey: ["/api/cv/sdg-growth", geography, uploadId],
    queryFn: async () => {
      const res = await fetch(`/api/cv/sdg-growth?costOfEquity=0.08${geoParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("SDG valuation groups unavailable");
      return res.json();
    },
    enabled: !!uploadId,
  });

  const { data: decarbTercileData, isLoading: loadingDecarb, error: decarbError } = useQuery<DecarbTercilePoint[]>({
    queryKey: ["/api/cv/decarb-terciles", scoringMethod, geography, uploadId],
    queryFn: async () => {
      const res = await fetch(`/api/cv/decarb-terciles?${methodParam}&costOfEquity=0.08${geoParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Target valuation groups unavailable");
      return res.json();
    },
    enabled: !!uploadId,
  });

  const { data: backtestResponse, isLoading: loadingBacktest, error: backtestError } = useQuery<BacktestResponse>({
    queryKey: ["/api/cv/backtest", backtestSignal, trackingErrorLimit, scoringMethod, geography, uploadId],
    queryFn: async () => {
      return fetchBacktest(`/api/cv/backtest?signal=${backtestSignal}&trackingError=${trackingErrorLimit}&trackingErrorUnit=percent&method=absolute${geoParam}`);
    },
    enabled: !!uploadId,
  });
  const backtestData = backtestResponse?.series;

  const isLoading = loadingCP || loadingSDG || loadingDecarb;
  const hasAnyCV = (carbonPriceData && carbonPriceData.length > 0) ||
    (sdgData && sdgData.length > 0) ||
    (decarbTercileData && decarbTercileData.length > 0);
  const hasData = hasAnyCV;
  const isGeoFiltered = geography !== "all";
  const expectedLabel = "Physical comparison withheld";

  const chartData = useMemo(() => {
    const dateMap = new Map<number, ChartDataPoint>();

    if (carbonPriceData) {
      for (const pt of carbonPriceData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        if (existing) {
          existing.carbonIntensity = earningsYieldGapPp(pt.bottomTercilePeRatio, pt.topTercilePeRatio);
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            carbonIntensity: earningsYieldGapPp(pt.bottomTercilePeRatio, pt.topTercilePeRatio),
          });
        }
      }
    }

    if (sdgData) {
      for (const pt of sdgData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        if (existing) {
          existing.sdgExposure = earningsYieldGapPp(pt.cleanPE, pt.dirtyPE);
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            sdgExposure: earningsYieldGapPp(pt.cleanPE, pt.dirtyPE),
          });
        }
      }
    }

    if (decarbTercileData) {
      for (const pt of decarbTercileData) {
        const ts = new Date(pt.date).getTime();
        const existing = dateMap.get(ts);
        if (existing) {
          existing.decarbAmbition = earningsYieldGapPp(pt.bestTercilePE, pt.worstTercilePE);
        } else {
          dateMap.set(ts, {
            date: ts,
            dateLabel: formatDateLabel(ts),
            decarbAmbition: earningsYieldGapPp(pt.bestTercilePE, pt.worstTercilePE),
          });
        }
      }
    }

    return Array.from(dateMap.values()).sort((a, b) => a.date - b.date);
  }, [carbonPriceData, sdgData, decarbTercileData]);

  const latestValues = useMemo(() => {
    if (chartData.length === 0) return null;

    // All headline cards refer to the same latest chart date. Never silently
    // backfill a missing latest observation with a different month's result.
    const latest = chartData[chartData.length - 1];
    return { carbonIntensity: latest.carbonIntensity, sdgExposure: latest.sdgExposure, decarbAmbition: latest.decarbAmbition };
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
              {displayDiagnostic(entry.value, " pp")}
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
    "Carbon intensity group earnings-yield gap (pp)": d.carbonIntensity,
    "SDG group earnings-yield gap (pp)": d.sdgExposure,
    "Ambition group earnings-yield gap (pp)": d.decarbAmbition,
  }));

  const cumulativeReturnDownloadRows = certifyFiniteExport("signalCumulative",backtestChartData.map((d) => ({
    Date: d.date,
    "Benchmark Cumulative Return (%)": d.benchmark,
    [signalCumulativeColumn(backtestSignal)]: d.portfolio,
  })),{signal:backtestSignal});

  const activeReturnDownloadRows = backtestChartData.map((d) => ({
    Date: d.date,
    "Active Return (%)": d.activeReturn,
    "Tracking Error (ann.) (%)": d.trackingError,
  }));

  return (
    <div className="p-4 space-y-4 max-w-full" data-testid="page-decarb-signal">
      <QueryReadErrors prefix="/api/cv" />
      <ReadResultReason label="Company dataset" loading={uploadsLoading} error={uploadsError} available={!!uploadId} emptyReason="No completed company dataset is available. Import and review require the operator CLI." />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Valuation Signal Comparison
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Descriptive group earnings-yield gaps — not emissions reduction rates
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
            Unavailable
          </p>
          <p className="text-xs text-muted-foreground">No defensible valuation-to-activity mapping</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">Carbon Intensity</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.carbonIntensity }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-ci-rate">
            {displayDiagnostic(latestValues?.carbonIntensity, " pp")}
          </p>
          <p className="text-xs text-muted-foreground">Low-minus-high group Gordon baseline gap</p>
          <ReadResultReason label="Carbon intensity gap" loading={loadingCP} error={cpError} available={latestValues?.carbonIntensity != null} emptyReason={!uploadId ? "No completed company dataset." : carbonPriceData?.length ? "Selected groups have missing or invalid P/E denominators." : "No carbon-intensity groups for this selection."} />
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">SDG Exposure</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.sdgExposure }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-sdg-rate">
            {displayDiagnostic(latestValues?.sdgExposure, " pp")}
          </p>
          <p className="text-xs text-muted-foreground">Positive-minus-negative group Gordon baseline gap</p>
          <ReadResultReason label="SDG gap" loading={loadingSDG} error={sdgError} available={latestValues?.sdgExposure != null} emptyReason={!uploadId ? "No completed company dataset." : sdgData?.length ? "Selected groups have missing or invalid P/E denominators." : "No SDG groups for this selection."} />
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs text-muted-foreground font-medium">Decarb Ambition</span>
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LINE_COLORS.decarbAmbition }} />
          </div>
          <p className="text-2xl font-bold tabular-nums" data-testid="text-da-rate">
            {displayDiagnostic(latestValues?.decarbAmbition, " pp")}
          </p>
          <p className="text-xs text-muted-foreground">Best-minus-worst group Gordon baseline gap</p>
          <ReadResultReason label="Ambition gap" loading={loadingDecarb} error={decarbError} available={latestValues?.decarbAmbition != null} emptyReason={!uploadId ? "No completed company dataset." : decarbTercileData?.length ? "Selected groups have missing or invalid P/E denominators." : "No ambition groups for this selection."} />
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold" data-testid="text-chart-title">
              Group Earnings-Yield Gap Comparison
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gordonBaselineLabel(8)} differences = earnings yield of second group minus first group (pp), not climate expectations
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Badge variant="secondary">Loading...</Badge>}
            <DownloadDataButton
              interpretationNotes={gordonExportNotes(8)}
              filename="group-earnings-yield-gaps"
              kind="valuation"
              sheetName="Valuation gaps"
              rows={comparisonDownloadRows}
              fieldBindings={{
                Date:{id:"signalComparison.date",transform:"Identity of chart dateLabel; en-US short month and numeric year in browser timezone"},
                "Carbon intensity group earnings-yield gap (pp)":{id:"signalComparison.carbonIntensity",transform:"Identity; null or absent month preserved as blank"},
                "SDG group earnings-yield gap (pp)":{id:"signalComparison.sdgExposure",transform:"Identity; null or absent month preserved as blank"},
                "Ambition group earnings-yield gap (pp)":{id:"signalComparison.decarbAmbition",transform:"Identity; null or absent month preserved as blank"},
              }}
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
                ? "No company dataset is available. Import and review require the operator CLI."
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
                label={{ value: "Earnings-yield gap (pp)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
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
                    kind="backtest"
                    sheetName="Cumulative Return"
                    rows={cumulativeReturnDownloadRows}
                    fieldBindings={finiteExportBindings("signalCumulative",{signal:backtestSignal})}
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
                    kind="backtest"
                    sheetName="Active Return & TE"
                    rows={activeReturnDownloadRows}
                    fieldBindings={{
                      Date:{id:"backtest.date",transform:"Identity UTC YYYY-MM"},
                      "Active Return (%)":{id:"backtest.activeReturn",transform:"Math.round(fraction*10000)/100"},
                      "Tracking Error (ann.) (%)":{id:"backtest.trackingError",transform:"Math.round(fraction*10000)/100"},
                    }}
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
            <p className="font-medium text-foreground mb-1">Physical comparison withheld</p>
            <p>
              A valuation earnings-yield gap and a global emissions reduction rate have different definitions.
              Their subtraction is not a supported climate signal. Temperature, carbon-price and net-zero outputs are unavailable.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Carbon Intensity (Market)</p>
            <p>
              Compares P/E ratios of high vs. low carbon intensity companies.
              Intensity is emissions per market cap, not revenue. The low-minus-high Gordon baseline difference
              equals high-group earnings yield minus low-group earnings yield.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">SDG Exposure (Market)</p>
            <p>
              Splits companies by SDG alignment score (positive = clean, negative = dirty).
              The positive-minus-negative group Gordon baseline difference is a descriptive earnings-yield gap, not a transition rate.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Decarb Ambition (Market)</p>
            <p>
              Ranks companies by 2050 emission reduction targets into terciles.
              The best-minus-worst group Gordon baseline difference is not a decarbonization rate.
              Gordon steady-state growth assumes fully distributed earnings and is not five-year reverse-DCF growth.
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

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
import { Activity, Globe, Layers, BarChart3, TrendingUp, TrendingDown, ArrowUpDown, Beaker } from "lucide-react";
import { DownloadDataButton } from "@/components/download-data-button";
import { deriveProducerSignalConsumer } from "@/lib/producer-download";
import { certifyFiniteExport,finiteExportBindings } from "@shared/finiteExportSchemas";
import { gordonBaselinePct, displayDiagnostic, gordonBaselineLabel, gordonExportNotes, backtestDisplay, backtestDisplayStats, observationTimestamp, hasUndatedObservations, tooltipObservation, selectedGroupGapPp } from "@/lib/valuation-claims";
import { QueryReadErrors } from "@/components/query-read-errors";
import { BacktestSummary, fetchBacktest } from "@/components/backtest-summary";
import { RetainedPairedResearch } from "@/components/retained-paired-research";
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

function formatDateLabel(timestamp: number): string {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "Observation date unavailable";
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDateStr(dateStr: string): string {
  if (observationTimestamp(dateStr) === undefined) return "Observation date unavailable";
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

  const { data: uploads, isLoading: uploadsLoading, error: uploadsError } = useQuery<UploadRecord[]>({
    queryKey: ["/api/cv/uploads"],
  });

  const uploadId = hasArchivedSelection() ? "archived" : uploads?.find((u) => u.status === "completed")?.id;

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<DecarbGapSummary>({
    queryKey: ["/api/cv/decarb-gap/summary", scoringMethod, geography, uploadId],
    queryFn: async () => {
      const res = await fetch(`/api/cv/decarb-gap/summary?${methodParam}${geoParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch summary");
      return res.json();
    },
    enabled: !!uploadId,
  });

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

  const backtestSignal = measure === "carbon_intensity" ? "carbon_intensity"
    : measure === "sdg_alignment" ? "sdg_exposure"
    : measure === "decarb_ambition" ? "decarb_ambition"
    : "decarb_gap";

  const compareGap = backtestSignal !== "decarb_gap";
  const { data: backtestResponse, isLoading: loadingBacktest, error: backtestError } = useQuery<BacktestResponse>({
    queryKey: ["/api/cv/backtest", backtestSignal, trackingErrorLimit, scoringMethod, geography, uploadId],
    queryFn: async () => {
      return fetchBacktest(`/api/cv/backtest?signal=${backtestSignal}&trackingError=${trackingErrorLimit}&trackingErrorUnit=percent&method=${compareGap ? "absolute" : scoringMethod}${geoParam}`);
    },
    enabled: !!uploadId,
  });

  const { data: valuationBacktestResponse, isLoading: loadingValBacktest, error: valuationBacktestError } = useQuery<BacktestResponse>({
    queryKey: ["/api/cv/backtest", "valuation", "decarb_gap", trackingErrorLimit, scoringMethod, geography, uploadId],
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
    if (!selectedMeasureData || selectedMeasureData.length === 0 || hasUndatedObservations(selectedMeasureData)) return null;
    const last = selectedMeasureData[selectedMeasureData.length - 1];
    return selectedGroupGapPp(last, measure);
  }, [selectedMeasureData, measure]);


  const timeseriesConsumer = useMemo(() => deriveProducerSignalConsumer(
    [selectedMeasureData], "group-gap", measure,
  ), [selectedMeasureData, measure]);
  const chartData = timeseriesConsumer.chartRows;

  const loadingMeasure = (measure === "carbon_intensity" && loadingCP) ||
    (measure === "sdg_alignment" && loadingSDG) ||
    (measure === "decarb_ambition" && loadingDecarb);
  const loadingTS = loadingMeasure;
  const hasChartData = chartData.some(d => d.impliedRate != null);
  const hasData = !!summary && summary.companyCount > 0;

  function computeStats(data: BacktestPoint[] | undefined) {
    return hasUndatedObservations(data) ? null : backtestDisplayStats(data);
  }

  const backtestStats = useMemo(() => computeStats(backtestData), [backtestData]);
  const valBacktestStats = useMemo(() => computeStats(valuationBacktestData), [valuationBacktestData]);

  const cumulativeConsumer = useMemo(() => deriveProducerSignalConsumer(
    [backtestResponse, valuationBacktestResponse], "gap-cumulative", measure,
  ), [backtestResponse, valuationBacktestResponse, measure]);
  const activeConsumer = useMemo(() => deriveProducerSignalConsumer(
    [backtestResponse, valuationBacktestResponse], "gap-active", measure,
  ), [backtestResponse, valuationBacktestResponse, measure]);
  const backtestChartData = cumulativeConsumer.chartRows;

  const TimeSeriesChartTooltip = ({ active, payload, label }: any) => {
    if (!active) return null;
    if (!Array.isArray(payload) || !payload.length || payload.some(entry => !entry || typeof entry !== "object"))
      return <p role="status">Tooltip series unavailable — no valid observations returned.</p>;
    return (
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm">
        <p className="font-medium text-foreground mb-2">{formatDateLabel(label)}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`${entry.dataKey ?? "unidentified-series"}:${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name ?? "Series name unavailable"}</span>
            </span>
            <span className="font-medium tabular-nums" style={{ color: entry.color }}>
              {tooltipObservation(entry.value, entry.name ?? entry.dataKey ?? "Series value", " pp")}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const BacktestTooltip = ({ active, payload, label }: any) => {
    if (!active) return null;
    if (!Array.isArray(payload) || !payload.length || payload.some(entry => !entry || typeof entry !== "object"))
      return <p role="status">Tooltip series unavailable — no valid observations returned.</p>;
    return (
      <div className="bg-popover border rounded-md p-3 shadow-md text-sm">
        <p className="font-medium text-foreground mb-2">{observationTimestamp(label) === undefined ? "Observation date unavailable" : label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`${entry.dataKey ?? "unidentified-series"}:${index}`} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name ?? "Series name unavailable"}</span>
            </span>
            <span className="font-medium tabular-nums" style={{ color: entry.color }}>
              {tooltipObservation(entry.value, entry.name ?? entry.dataKey ?? "Series value", "%")}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const measureInfo = MEASURE_TYPES.find(m => m.value === measure);

  const timeseriesDownloadRows = certifyFiniteExport("groupGap", timeseriesConsumer.rows, {measure});
  // The finite measure UI currently always enables comparison. Preserve the
  // historical no-comparison projection for callers inspecting that branch;
  // it is deliberately unbound and the required-parent writer refuses it.
  const cumulativeReturnDownloadRows: Array<{
    Date: string | number; "Benchmark Cumulative Return (%)": number | null;
    "Legacy peer-yield ranking cumulative return (%)"?: number | null;
  }> = compareGap ? cumulativeConsumer.rows : backtestChartData.map((d) => ({
    Date: d.date,
    "Benchmark Cumulative Return (%)": d.benchmark,
    [`${measureInfo?.label ?? "Measure"}-Driven Cumulative Return (%)`]: d.portfolio,
  }));
  const activeReturnDownloadRows = activeConsumer.rows;

  return (
    <div className="p-4 space-y-4 max-w-full" data-testid="page-decarb-gap-signal">
      <QueryReadErrors prefix="/api/cv" />
      <RetainedPairedResearch />
      {hasUndatedObservations(selectedMeasureData) && <p role="status">Selected group observation date unavailable. Undated rows are omitted from charts and exports; the latest gap is withheld rather than backfilled.</p>}
      {(hasUndatedObservations(backtestData) || hasUndatedObservations(valuationBacktestData)) && <p role="status">Backtest observation date unavailable. Undated rows are omitted from charts and exports; affected derived period accounting is withheld. No date is substituted.</p>}
      <ReadResultReason label="Company dataset" loading={uploadsLoading} error={uploadsError} available={!!uploadId} emptyReason="No completed company dataset is available. Import and review require the operator CLI." />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Peer-Relative Valuation Diagnostics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gordon steady-state baselines and peer-relative earnings-yield gaps — not decarbonization estimates
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

      {!uploadId && !uploadsLoading && !uploadsError && (
        <Card className="p-8 flex flex-col items-center justify-center text-muted-foreground">
          <Activity className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No company dataset is available. Import and review require the operator CLI.</p>
        </Card>
      )}

      {uploadId && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Physical decarbonization rate</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.projected }} />
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-projected-rate">
                Unavailable
              </p>
              <p className="text-xs text-muted-foreground">Not inferred from valuations</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Group earnings-yield gap ({measureInfo?.label})</span>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.implied }} />
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-implied-rate">
                {displayDiagnostic(latestImpliedRate, " pp")}
              </p>
              <p className="text-xs text-muted-foreground">First-minus-second group Gordon baseline gap</p>
              <ReadResultReason label="Selected group gap" loading={loadingMeasure} error={measure === "carbon_intensity" ? cpError : measure === "sdg_alignment" ? sdgError : decarbError} available={latestImpliedRate != null} emptyReason={hasUndatedObservations(selectedMeasureData) ? "Observation date missing or invalid; the latest gap cannot be established." : selectedMeasureData?.length ? "Selected groups have missing or invalid P/E denominators." : "No valuation groups for this measure and geography."} />
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Physical vs. valuation gap</span>
                <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-gap">
                Withheld
              </p>
              <p className="text-xs text-muted-foreground">Definitions are not comparable</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs text-muted-foreground font-medium">Companies Scored</span>
              </div>
              <p className="text-2xl font-bold tabular-nums" data-testid="text-company-count" data-field-id="peerValuation.companyCount">
                 {summary?.companyCount ?? "Unavailable"}
              </p>
              <p className="text-xs text-muted-foreground">
                Legacy eligible-company count; not verified identity coverage
              </p>
              <ReadResultReason label="Companies scored" loading={summaryLoading} error={summaryError} available={summary?.companyCount != null} emptyReason="The summary did not return an eligible-company count." />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-4" data-testid="card-gap-distribution">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-semibold mb-1">Physical-gap distribution withheld</h2>
                  <p className="text-xs text-muted-foreground">
                    A global physical reduction rate cannot be subtracted from a valuation earnings-yield gap.
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Temperature, carbon-price and net-zero outputs are unavailable. No numeric substitutes or physical-gap downloads are provided.
                Company diagnostics below show only the legacy endpoint&apos;s selected subset, not a full-universe ranking.
              </p>
            </Card>

            <Card className="p-4" data-testid="card-gap-timeseries">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-semibold mb-1">Group earnings-yield gap over time</h2>
                  <p className="text-xs text-muted-foreground">
                    {measureInfo?.description}. Descriptive valuation difference only.
                  </p>
                </div>
                <DownloadDataButton
                  requireDerivedParent
                  kind="valuation"
                  filename="group-earnings-yield-gap-over-time"
                  sheetName="Group valuation gap"
                  rows={timeseriesDownloadRows}
                  fieldBindings={finiteExportBindings("groupGap",{measure})}
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
                      label={{ value: "Earnings-yield gap (pp)", angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" } }}
                    />
                    <Tooltip filterNull={false} content={<TimeSeriesChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" strokeOpacity={0.5} />
                    <Line
                      dataKey="impliedRate"
                      name={`Earnings-yield gap (${measureInfo?.label})`}
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
                  <h2 className="text-sm font-semibold">Legacy selected companies — first subset</h2>
                </div>
                <ReadResultReason label="First company subset" available={!!summary?.topCompanies?.length} emptyReason="No first-subset company diagnostics were returned for this selection." />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-2">Company</th>
                        <th className="text-left py-1.5 pr-2">Sector</th>
                        <th className="text-right py-1.5 pr-2">P/E</th>
                        <th className="text-right py-1.5 pr-2">{gordonBaselineLabel(8)}</th>
                        <th className="text-right py-1.5">Peer earnings-yield gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.topCompanies?.map((c) => (
                        <tr key={c.companyId} className="border-b border-border/50">
                          <td data-field-id="peerValuation.topCompanies[].companyName" className="py-1.5 pr-2 font-medium truncate max-w-[140px]" title={c.companyName}>{c.companyName}</td>
                          <td data-field-id="peerValuation.topCompanies[].sector" className="py-1.5 pr-2 text-muted-foreground truncate max-w-[100px]" title={c.sector || ""}>{c.sector || "\u2014"}</td>
                          <td data-field-id="peerValuation.topCompanies[].pe" className="py-1.5 pr-2 text-right tabular-nums">{displayDiagnostic(c.pe, "x")}</td>
                          <td data-field-id="peerValuation.display.topCompanies.gordonBaselinePct" className="py-1.5 pr-2 text-right tabular-nums">{displayDiagnostic(gordonBaselinePct(c.pe), "%")}</td>
                          <td data-field-id="peerValuation.display.topCompanies.peerGapPp" className="py-1.5 text-right tabular-nums font-medium">{displayDiagnostic(typeof c.impliedGrowth === "number" && typeof c.peerMedianGrowth === "number" ? (c.impliedGrowth - c.peerMedianGrowth) * 100 : null, " pp")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card className="p-4" data-testid="card-bottom-companies">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <h2 className="text-sm font-semibold">Legacy selected companies — second subset</h2>
                </div>
                <ReadResultReason label="Second company subset" available={!!summary?.bottomCompanies?.length} emptyReason="No second-subset company diagnostics were returned for this selection." />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-left py-1.5 pr-2">Company</th>
                        <th className="text-left py-1.5 pr-2">Sector</th>
                        <th className="text-right py-1.5 pr-2">P/E</th>
                        <th className="text-right py-1.5 pr-2">{gordonBaselineLabel(8)}</th>
                        <th className="text-right py-1.5">Peer earnings-yield gap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary?.bottomCompanies?.map((c) => (
                        <tr key={c.companyId} className="border-b border-border/50">
                          <td data-field-id="peerValuation.bottomCompanies[].companyName" className="py-1.5 pr-2 font-medium truncate max-w-[140px]" title={c.companyName}>{c.companyName}</td>
                          <td data-field-id="peerValuation.bottomCompanies[].sector" className="py-1.5 pr-2 text-muted-foreground truncate max-w-[100px]" title={c.sector || ""}>{c.sector || "\u2014"}</td>
                          <td data-field-id="peerValuation.bottomCompanies[].pe" className="py-1.5 pr-2 text-right tabular-nums">{displayDiagnostic(c.pe, "x")}</td>
                          <td data-field-id="peerValuation.display.bottomCompanies.gordonBaselinePct" className="py-1.5 pr-2 text-right tabular-nums">{displayDiagnostic(gordonBaselinePct(c.pe), "%")}</td>
                          <td data-field-id="peerValuation.display.bottomCompanies.peerGapPp" className="py-1.5 text-right tabular-nums font-medium">{displayDiagnostic(typeof c.impliedGrowth === "number" && typeof c.peerMedianGrowth === "number" ? (c.impliedGrowth - c.peerMedianGrowth) * 100 : null, " pp")}</td>
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
                  <p className={`text-lg font-bold tabular-nums ${(backtestStats?.benchmarkTotal ?? NaN) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-benchmark-total">
                    {backtestDisplay(backtestStats?.benchmarkTotal, 1, true)}
                  </p>
                </div>
                <div className="p-3 rounded-md border bg-muted/30">
                  <p className="text-xs mb-1 font-medium" style={{ color: COLORS.portfolio }}>{measureInfo?.label}-Driven</p>
                  {backtestStats ? (
                    <>
                      <p className={`text-lg font-bold tabular-nums ${(backtestStats.portfolioTotal ?? NaN) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-portfolio-total">
                        {backtestDisplay(backtestStats.portfolioTotal, 1, true)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active: {backtestDisplay(backtestStats.annualizedActive, 2, true)} ann. | TE: {backtestDisplay(backtestStats.finalTE)}
                      </p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">{loadingBacktest ? "Loading..." : hasUndatedObservations(backtestData) ? "Unavailable — observation date missing or invalid." : "Unavailable — return accounting not returned."}</p>}
                </div>
                {compareGap && <div className="p-3 rounded-md border bg-muted/30">
                  <p className="text-xs mb-1 font-medium" style={{ color: COLORS.valuation }}>Decarb Gap</p>
                  {valBacktestStats ? (
                    <>
                      <p className={`text-lg font-bold tabular-nums ${(valBacktestStats.portfolioTotal ?? NaN) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-valuation-total">
                        {backtestDisplay(valBacktestStats.portfolioTotal, 1, true)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Active: {backtestDisplay(valBacktestStats.annualizedActive, 2, true)} ann. | TE: {backtestDisplay(valBacktestStats.finalTE)}
                      </p>
                    </>
                  ) : <p className="text-sm text-muted-foreground">{loadingValBacktest ? "Loading..." : hasUndatedObservations(valuationBacktestData) ? "Unavailable — observation date missing or invalid." : "Unavailable — return accounting not returned."}</p>}
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
                      requireDerivedParent
                      interpretationNotes={gordonExportNotes(8)}
                      filename="backtest-cumulative-return"
                      kind="backtest"
                      sheetName="Cumulative Return"
                      rows={cumulativeReturnDownloadRows}
                      fieldBindings={{
                        Date:{id:"backtest.date",transform:"Identity UTC YYYY-MM"},
                        "Benchmark Cumulative Return (%)":{id:"backtest.benchmarkCumulative",transform:"Math.round((wealth-1)*10000)/100; primary response month or comparison response fallback; absent month remains blank"},
                        [`${measureInfo?.label ?? "Measure"}-Driven Cumulative Return (%)`]:{id:"backtest.portfolioCumulative",transform:"Math.round((wealth-1)*10000)/100; selected measure signal; absent primary month remains blank"},
                        ...(compareGap ? {"Legacy peer-yield ranking cumulative return (%)":{id:"backtest.portfolioCumulative",transform:"Comparison decarb_gap response: Math.round((wealth-1)*10000)/100; absent comparison month remains blank"}} : {}),
                      }}
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
                      <Tooltip filterNull={false} content={<BacktestTooltip />} />
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
                      requireDerivedParent
                      filename="backtest-active-return-tracking-error"
                      kind="backtest"
                      sheetName="Active Return & TE"
                      rows={activeReturnDownloadRows}
                      fieldBindings={{
                        Date:{id:"backtest.date",transform:"Identity UTC YYYY-MM"},
                        "Active Return (%)":{id:"backtest.activeReturn",transform:"Math.round(fraction*10000)/100; absent primary month remains blank"},
                        "Tracking Error (ann. %)":{id:"backtest.trackingError",transform:"Math.round(fraction*10000)/100; absent primary month remains blank"},
                      }}
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
                      <Tooltip filterNull={false} content={<BacktestTooltip />} />
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
                <p className="font-medium text-foreground mb-1">Gordon baseline and peer-relative earnings-yield gap</p>
                <p>
                  The Gordon steady-state earnings-growth baseline is g = r − 1/PE at r = 8%, assuming fully
                  distributed earnings. It is not five-year reverse-DCF growth. The displayed peer-relative
                  earnings-yield gap is 100 × (company g − peer median g), in percentage points:
                  peer median earnings yield minus company earnings yield. It does not identify climate expectations.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Group valuation diagnostics</p>
                <p>
                  <strong>Carbon Intensity:</strong> Compares aggregate P/E of lowest-carbon-intensity
                  tercile vs highest; intensity means emissions per market cap, not revenue.{" "}
                  <strong>SDG Alignment:</strong> Splits companies by SDG alignment score (positive = clean,
                  negative = dirty); the positive-minus-negative Gordon baseline gap is descriptive.{" "}
                  <strong>Decarb Ambition:</strong> Ranks companies by emission reduction targets
                  (2050 pathway); best-minus-worst group Gordon baseline gap. None is a physical decarbonization rate.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Physical outputs unavailable</p>
                <p>
                  Valuation-derived temperature, carbon-price and net-zero outputs are withheld.
                  A defensible valuation-to-activity mapping has not been established.
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">Legacy selection, not valuation advice</p>
                <p>
                  Company subsets come from the legacy endpoint, not a new validated screen.
                  Its projected-rate offset is common across companies and does not establish an
                  underpriced or overpriced transition. Peer grouping:
                  {" "}{SCORING_METHODS.find(m => m.value === scoringMethod)?.label}.
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
                  legacy score from a peer-relative Gordon baseline gap and a common global offset.
                  This is a retrospective ranking experiment, not evidence of underpriced transition or a validated investment signal.
                </p>
                <p>
                  <strong>1. Signal Scoring:</strong> For the {measureInfo?.label}-driven strategy, companies are ranked by
                  their {measure === "carbon_intensity" ? "carbon intensity (lower = better)" : measure === "sdg_alignment" ? "SDG exposure score (higher = better)" : "decarb target pathway (more ambitious = better)"}.
                  For the legacy Decarb Gap ranking, a common projected-rate offset minus a peer-relative earnings-yield gap is used;
                  that offset does not supply a physical interpretation.
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

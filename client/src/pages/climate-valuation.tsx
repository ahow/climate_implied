import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DownloadDataButton } from "@/components/download-data-button";
import { Upload, FileSpreadsheet, RefreshCw, TrendingUp, DollarSign, Building2, Thermometer, Leaf, Target, Factory, Info } from "lucide-react";
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
} from "recharts";

interface UploadRecord {
  id: number;
  filename: string;
  status: string;
  companiesCount: number | null;
  timePeriodsCount: number | null;
  errorMessage: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface CarbonPricePoint {
  date: string;
  impliedCarbonPrice: number;
  impliedDecarbRate: number;
  impliedTemperature: number;
  topTercileMarketCap: number;
  topTercileProfit: number;
  topTercileEmissions: number;
  topTercilePeRatio: number;
  topTercileCompanyCount: number;
  bottomTercileMarketCap: number;
  bottomTercileProfit: number;
  bottomTercileEmissions: number;
  bottomTercilePeRatio: number;
  bottomTercileCompanyCount: number;
  highGroupLabel: string;
  lowGroupLabel: string;
}

interface SDGGrowthPoint {
  date: string;
  cleanPE: number;
  dirtyPE: number;
  cleanGrowth: number;
  dirtyGrowth: number;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  cleanCount: number;
  dirtyCount: number;
  cleanMarketCap: number;
  dirtyMarketCap: number;
  cleanProfit: number;
  dirtyProfit: number;
}

interface DecarbTercilePoint {
  date: string;
  bestTercilePE: number;
  worstTercilePE: number;
  bestTercileAvgDecarbRate: number;
  worstTercileAvgDecarbRate: number;
  bestTercileCompanyCount: number;
  worstTercileCompanyCount: number;
  bestTercileMarketCap: number;
  worstTercileMarketCap: number;
  bestTercileProfit: number;
  worstTercileProfit: number;
  bestImpliedGrowth: number;
  worstImpliedGrowth: number;
  growthPremium: number;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
}

interface Summary {
  companiesCount: number;
  latestUpload: UploadRecord | null;
  dateRange: { minDate: string; maxDate: string; recordCount: number } | null;
  sectors: number;
  geographies: number;
  imputation?: {
    totalRecords: number;
    imputedRecords: number;
    imputedFraction: number;
    imputedByScope: { scope1: number; scope2: number; scope3: number };
  };
}


export default function ClimateValuation() {
  const { toast } = useToast();
  const [includeScope3, setIncludeScope3] = useState(false);
  const [winsorize, setWinsorize] = useState(true);
  const [activeUploadId, setActiveUploadId] = useState<number | null>(null);
  const [costOfEquity, setCostOfEquity] = useState(8);
  const [decarbTercileMethod, setDecarbTercileMethod] = useState<"absolute" | "sector_relative" | "sub_sector_relative" | "industry_relative">("sector_relative");

  const { data: uploads } = useQuery<UploadRecord[]>({
    queryKey: ["/api/cv/uploads"],
    refetchInterval: 5000,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery<Summary>({
    queryKey: ["/api/cv/summary"],
    refetchInterval: uploads?.some((u) => u.status === "processing") ? 5000 : false,
  });

  const latestCompletedUpload = uploads?.find((u) => u.status === "completed");
  const processingUpload = uploads?.find((u) => u.status === "processing");
  const uploadId = activeUploadId || latestCompletedUpload?.id;
  const hasTimeSeriesData = summary && summary.dateRange && Number(summary.dateRange.recordCount) > 0;

  const carbonPriceUrl = `/api/cv/carbon-price?uploadId=${uploadId}&method=sector_relative&includeScope3=${includeScope3}&winsorize=${winsorize}&inferenceMethod=carbon_intensity`;
  const { data: carbonPrices, isLoading: carbonPricesLoading } = useQuery<CarbonPricePoint[]>({
    queryKey: [carbonPriceUrl],
    enabled: !!uploadId && !!hasTimeSeriesData,
  });

  const costOfEquityDecimal = costOfEquity / 100;
  const sdgGrowthUrl = `/api/cv/sdg-growth?costOfEquity=${costOfEquityDecimal}`;
  const { data: sdgGrowth, isLoading: sdgGrowthLoading } = useQuery<SDGGrowthPoint[]>({
    queryKey: ["/api/cv/sdg-growth", costOfEquityDecimal],
    queryFn: async () => {
      const res = await fetch(sdgGrowthUrl);
      if (!res.ok) throw new Error("Failed to fetch SDG growth data");
      return res.json();
    },
    enabled: !!hasTimeSeriesData,
  });

  const decarbTercileUrl = `/api/cv/decarb-terciles?method=${decarbTercileMethod}&costOfEquity=${costOfEquityDecimal}`;
  const { data: decarbTerciles, isLoading: decarbTercilesLoading } = useQuery<DecarbTercilePoint[]>({
    queryKey: ["/api/cv/decarb-terciles", decarbTercileMethod, costOfEquityDecimal],
    queryFn: async () => {
      const res = await fetch(decarbTercileUrl);
      if (!res.ok) throw new Error("Failed to fetch decarb terciles");
      return res.json();
    },
    enabled: !!hasTimeSeriesData,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      let res: Response;
      try {
        res = await fetch("/api/cv/upload", { method: "POST", body: formData });
      } catch (networkError) {
        throw new Error(`Network error during upload. The file may be too large for the server. Try uploading from the development environment instead.`);
      }
      if (!res.ok) {
        let errorMsg = `Upload failed (HTTP ${res.status})`;
        try {
          const err = await res.json();
          errorMsg = err.error || err.message || errorMsg;
        } catch (_) {
          const text = await res.text().catch(() => "");
          if (text) errorMsg += `: ${text.slice(0, 200)}`;
        }
        throw new Error(errorMsg);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "File uploaded", description: `Processing started. This may take a few minutes for large datasets.` });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/dimensions"] });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/cv/upload/${id}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset upload");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Upload reset", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/uploads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cv/summary"] });
    },
    onError: () => {
      toast({ title: "Reset failed", variant: "destructive" });
    },
  });

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadMutation.mutate(file);
      e.target.value = "";
    },
    [uploadMutation]
  );

  const formatChartDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  };

  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  };

  const carbonIntensityChartData = carbonPrices?.map((p) => ({
    date: new Date(p.date).getTime(),
    impliedCarbonPrice: Math.round(p.impliedCarbonPrice * 100) / 100,
    impliedDecarbRate: p.impliedDecarbRate,
    impliedTemperature: p.impliedTemperature,
    cleanPE: Math.round(p.bottomTercilePeRatio * 100) / 100,
    dirtyPE: Math.round(p.topTercilePeRatio * 100) / 100,
    cleanCount: p.bottomTercileCompanyCount,
    dirtyCount: p.topTercileCompanyCount,
  }));

  const sdgChartData = sdgGrowth?.map((p) => ({
    date: new Date(p.date).getTime(),
    impliedCarbonPrice: Math.round(p.impliedCarbonPrice * 100) / 100,
    impliedDecarbRate: Math.round(p.impliedDecarbRate * 100) / 100,
    impliedTemperature: Math.round(p.impliedTemperature * 100) / 100,
    cleanPE: Math.round(p.cleanPE * 100) / 100,
    dirtyPE: Math.round(p.dirtyPE * 100) / 100,
    cleanCount: p.cleanCount,
    dirtyCount: p.dirtyCount,
  }));

  const ambitionChartData = decarbTerciles?.map((p) => ({
    date: new Date(p.date).getTime(),
    impliedCarbonPrice: Math.round(p.impliedCarbonPrice * 100) / 100,
    impliedDecarbRate: Math.round(p.impliedDecarbRate * 100) / 100,
    impliedTemperature: Math.round(p.impliedTemperature * 100) / 100,
    bestPE: Math.round(p.bestTercilePE * 100) / 100,
    worstPE: Math.round(p.worstTercilePE * 100) / 100,
    bestCount: p.bestTercileCompanyCount,
    worstCount: p.worstTercileCompanyCount,
  }));

  const latestCarbon = carbonIntensityChartData && carbonIntensityChartData.length > 0
    ? carbonIntensityChartData[carbonIntensityChartData.length - 1]
    : null;
  const latestSDG = sdgChartData && sdgChartData.length > 0
    ? sdgChartData[sdgChartData.length - 1]
    : null;
  const latestAmbition = ambitionChartData && ambitionChartData.length > 0
    ? ambitionChartData[ambitionChartData.length - 1]
    : null;

  const hasData = !!hasTimeSeriesData;

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-cv-title">
              Climate Scenario Analyzer
            </h1>
            <p className="text-sm text-muted-foreground">
              Corporate Carbon Emissions vs. Market Valuations
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              id="cv-file-upload"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileSelect}
              data-testid="input-file-upload"
            />
            <Button
              variant="default"
              onClick={() => document.getElementById("cv-file-upload")?.click()}
              disabled={uploadMutation.isPending}
              data-testid="button-upload"
            >
              {uploadMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              <span className="ml-2">Upload Excel Data</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Building2} label="Companies" value={summary?.companiesCount ?? 0} isLoading={summaryLoading} />
          <SummaryCard icon={FileSpreadsheet} label="Records" value={summary?.dateRange?.recordCount ?? 0} isLoading={summaryLoading} />
          <SummaryCard icon={Factory} label="Sectors" value={summary?.sectors ?? 0} isLoading={summaryLoading} />
          <SummaryCard icon={TrendingUp} label="Geographies" value={summary?.geographies ?? 0} isLoading={summaryLoading} />
        </div>

        {summary?.imputation && summary.imputation.imputedRecords > 0 && (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
            data-testid="text-imputation-disclosure"
          >
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {summary.imputation.imputedRecords.toLocaleString()} of{" "}
              {summary.imputation.totalRecords.toLocaleString()} records (
              {(summary.imputation.imputedFraction * 100).toFixed(1)}%) use carried-forward
              (imputed) emissions where a reporting gap exists. Carbon-intensity and pricing
              for these periods rely on the most recent observed scope 1/2/3 values.
            </span>
          </div>
        )}

        {uploads && uploads.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3" data-testid="text-uploads-heading">Recent Uploads</h3>
            <div className="space-y-2">
              {uploads.slice(0, 3).map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-sm flex-wrap" data-testid={`row-upload-${u.id}`}>
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{u.filename}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={u.status === "completed" ? "default" : u.status === "processing" ? "secondary" : "destructive"}
                      data-testid={`badge-upload-status-${u.id}`}
                    >
                      {u.status === "processing" && <RefreshCw className="h-3 w-3 animate-spin mr-1" />}
                      {u.status}
                    </Badge>
                    {u.status === "completed" && u.companiesCount && (
                      <span className="text-muted-foreground text-xs">{u.companiesCount} companies</span>
                    )}
                    {(u.status === "processing" || u.status === "failed") && (
                      <Button size="sm" variant="outline" data-testid={`button-reset-upload-${u.id}`} disabled={resetMutation.isPending} onClick={() => resetMutation.mutate(u.id)}>
                        {u.status === "processing" ? "Recover" : "Retry"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {hasData && (
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3" data-testid="text-config-heading">Analysis Configuration</h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground whitespace-nowrap">Cost of Equity</Label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="30"
                    step="0.5"
                    defaultValue={costOfEquity}
                    onBlur={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0 && val <= 30) setCostOfEquity(val);
                      else e.target.value = String(costOfEquity);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    className="w-16 h-9 rounded-md border bg-background px-2 text-sm text-center"
                    data-testid="input-cost-of-equity"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="scope3-switch" checked={includeScope3} onCheckedChange={setIncludeScope3} data-testid="switch-scope3" />
                <Label htmlFor="scope3-switch" className="text-sm text-muted-foreground whitespace-nowrap">Include Scope 3</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="winsorize-switch" checked={winsorize} onCheckedChange={setWinsorize} data-testid="switch-winsorize" />
                <Label htmlFor="winsorize-switch" className="text-sm text-muted-foreground whitespace-nowrap">Winsorize (5%)</Label>
              </div>
            </div>
          </Card>
        )}

        {hasData ? (
          <div className="space-y-10">

            <AnalysisSection
              icon={Factory}
              title="High vs Low Carbon Companies"
              description={`Companies ranked by carbon intensity (emissions per $ revenue) into terciles. The implied carbon price equalizes P/E ratios between the most and least carbon-intensive groups. The implied decarbonization rate is derived via the Gordon Growth Model (g = ${costOfEquity}% - 1/PE).`}
              latestDecarbRate={latestCarbon?.impliedDecarbRate ?? null}
              latestCarbonPrice={latestCarbon?.impliedCarbonPrice ?? null}
              latestTemperature={latestCarbon?.impliedTemperature ?? null}
              chartData={carbonIntensityChartData ?? []}
              isLoading={carbonPricesLoading}
              formatChartDate={formatChartDate}
              formatTooltipDate={formatTooltipDate}
              testIdPrefix="carbon"
              carbonPriceTooltip={(d) => (
                <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                  <div className="font-medium">{formatTooltipDate(d.date)}</div>
                  <div className="font-semibold text-sm">${d.impliedCarbonPrice.toFixed(2)}/tCO2</div>
                  <div className="border-t pt-1.5 text-muted-foreground">
                    <div>Clean tercile P/E: {d.cleanPE?.toFixed(1)}x ({d.cleanCount} co.)</div>
                    <div>Dirty tercile P/E: {d.dirtyPE?.toFixed(1)}x ({d.dirtyCount} co.)</div>
                  </div>
                </div>
              )}
              decarbRateTooltip={(d) => (
                <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                  <div className="font-medium">{formatTooltipDate(d.date)}</div>
                  <div className="font-semibold text-sm">{d.impliedDecarbRate.toFixed(2)}%/yr</div>
                  <div className="border-t pt-1.5 text-muted-foreground">
                    <div>Clean P/E: {d.cleanPE?.toFixed(1)}x | Dirty P/E: {d.dirtyPE?.toFixed(1)}x</div>
                  </div>
                </div>
              )}
              peChart={{
                highKey: "cleanPE",
                lowKey: "dirtyPE",
                highLabel: "Low Carbon (Clean)",
                lowLabel: "High Carbon (Dirty)",
                tooltip: (d) => (
                  <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                    <div className="font-medium">{formatTooltipDate(d.date)}</div>
                    <div className="space-y-0.5">
                      <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "hsl(168, 76%, 36%)" }} />Low Carbon P/E: <span className="font-semibold">{d.cleanPE?.toFixed(1)}x</span> ({d.cleanCount} co.)</div>
                      <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />High Carbon P/E: <span className="font-semibold">{d.dirtyPE?.toFixed(1)}x</span> ({d.dirtyCount} co.)</div>
                    </div>
                  </div>
                ),
              }}
            />

            <AnalysisSection
              icon={Leaf}
              title="High vs Low SDG-Aligned Companies"
              description={`Companies classified by SDG alignment (climate revenue). The growth differential between clean and dirty companies (Gordon Growth Model at ${costOfEquity}% cost of equity) reveals the market's implied decarbonization rate.`}
              latestDecarbRate={latestSDG?.impliedDecarbRate ?? null}
              latestCarbonPrice={latestSDG?.impliedCarbonPrice ?? null}
              latestTemperature={latestSDG?.impliedTemperature ?? null}
              chartData={sdgChartData ?? []}
              isLoading={sdgGrowthLoading}
              formatChartDate={formatChartDate}
              formatTooltipDate={formatTooltipDate}
              testIdPrefix="sdg"
              carbonPriceTooltip={(d) => (
                <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                  <div className="font-medium">{formatTooltipDate(d.date)}</div>
                  <div className="font-semibold text-sm">${d.impliedCarbonPrice.toFixed(2)}/tCO2</div>
                  <div className="border-t pt-1.5 text-muted-foreground">
                    <div>Clean P/E: {d.cleanPE?.toFixed(1)}x ({d.cleanCount} co.)</div>
                    <div>Dirty P/E: {d.dirtyPE?.toFixed(1)}x ({d.dirtyCount} co.)</div>
                  </div>
                </div>
              )}
              decarbRateTooltip={(d) => (
                <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                  <div className="font-medium">{formatTooltipDate(d.date)}</div>
                  <div className="font-semibold text-sm">{d.impliedDecarbRate.toFixed(2)}%/yr</div>
                  <div className="border-t pt-1.5 text-muted-foreground">
                    <div>Clean P/E: {d.cleanPE?.toFixed(1)}x | Dirty P/E: {d.dirtyPE?.toFixed(1)}x</div>
                  </div>
                </div>
              )}
              peChart={{
                highKey: "cleanPE",
                lowKey: "dirtyPE",
                highLabel: "Positive SDG (Clean)",
                lowLabel: "Negative SDG (Dirty)",
                tooltip: (d) => (
                  <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                    <div className="font-medium">{formatTooltipDate(d.date)}</div>
                    <div className="space-y-0.5">
                      <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "hsl(168, 76%, 36%)" }} />Positive SDG P/E: <span className="font-semibold">{d.cleanPE?.toFixed(1)}x</span> ({d.cleanCount} co.)</div>
                      <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />Negative SDG P/E: <span className="font-semibold">{d.dirtyPE?.toFixed(1)}x</span> ({d.dirtyCount} co.)</div>
                    </div>
                  </div>
                ),
              }}
            />

            <AnalysisSection
              icon={Target}
              title="High vs Low Ambition Companies"
              description={`Companies ranked by announced emission reduction targets into terciles. The P/E differential between the most ambitious and least ambitious terciles implies a decarbonization rate via the Gordon Growth Model (${costOfEquity}% cost of equity).`}
              latestDecarbRate={latestAmbition?.impliedDecarbRate ?? null}
              latestCarbonPrice={latestAmbition?.impliedCarbonPrice ?? null}
              latestTemperature={latestAmbition?.impliedTemperature ?? null}
              chartData={ambitionChartData ?? []}
              isLoading={decarbTercilesLoading}
              formatChartDate={formatChartDate}
              formatTooltipDate={formatTooltipDate}
              testIdPrefix="ambition"
              headerRight={
                <Select value={decarbTercileMethod} onValueChange={(v: "absolute" | "sector_relative" | "sub_sector_relative" | "industry_relative") => setDecarbTercileMethod(v)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-decarb-tercile-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absolute">Absolute</SelectItem>
                    <SelectItem value="sector_relative">Sector Relative</SelectItem>
                    <SelectItem value="sub_sector_relative">Sub-Sector Relative</SelectItem>
                    <SelectItem value="industry_relative">Industry Relative</SelectItem>
                  </SelectContent>
                </Select>
              }
              carbonPriceTooltip={(d) => (
                <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                  <div className="font-medium">{formatTooltipDate(d.date)}</div>
                  <div className="font-semibold text-sm">${d.impliedCarbonPrice.toFixed(2)}/tCO2</div>
                  <div className="border-t pt-1.5 text-muted-foreground">
                    <div>Best tercile P/E: {d.bestPE?.toFixed(1)}x ({d.bestCount} co.)</div>
                    <div>Worst tercile P/E: {d.worstPE?.toFixed(1)}x ({d.worstCount} co.)</div>
                  </div>
                </div>
              )}
              decarbRateTooltip={(d) => (
                <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                  <div className="font-medium">{formatTooltipDate(d.date)}</div>
                  <div className="font-semibold text-sm">{d.impliedDecarbRate.toFixed(2)}%/yr</div>
                  <div className="border-t pt-1.5 text-muted-foreground">
                    <div>Best P/E: {d.bestPE?.toFixed(1)}x | Worst P/E: {d.worstPE?.toFixed(1)}x</div>
                  </div>
                </div>
              )}
              peChart={{
                highKey: "bestPE",
                lowKey: "worstPE",
                highLabel: "Most Ambitious",
                lowLabel: "Least Ambitious",
                tooltip: (d) => (
                  <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
                    <div className="font-medium">{formatTooltipDate(d.date)}</div>
                    <div className="space-y-0.5">
                      <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "hsl(168, 76%, 36%)" }} />Most Ambitious P/E: <span className="font-semibold">{d.bestPE?.toFixed(1)}x</span> ({d.bestCount} co.)</div>
                      <div><span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: "hsl(0, 72%, 51%)" }} />Least Ambitious P/E: <span className="font-semibold">{d.worstPE?.toFixed(1)}x</span> ({d.worstCount} co.)</div>
                    </div>
                  </div>
                ),
              }}
            />

          </div>
        ) : (
          <Card className="p-12">
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center w-16 h-16 rounded-md bg-primary/10 mx-auto">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-medium" data-testid="text-no-data-heading">Upload Data to Get Started</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  Upload an Excel file with corporate emissions, financial, and ESG data to analyze
                  implied carbon prices and decarbonization rates across different classification methods.
                </p>
              </div>
              <Button variant="default" onClick={() => document.getElementById("cv-file-upload")?.click()} disabled={uploadMutation.isPending} data-testid="button-upload-cta">
                <Upload className="h-4 w-4 mr-2" />
                Upload Excel File
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

interface AnalysisSectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  latestDecarbRate: number | null;
  latestCarbonPrice: number | null;
  latestTemperature: number | null;
  chartData: Array<{ date: number; impliedCarbonPrice: number; impliedDecarbRate: number; [k: string]: any }>;
  isLoading: boolean;
  formatChartDate: (ts: number) => string;
  formatTooltipDate: (ts: number) => string;
  testIdPrefix: string;
  headerRight?: React.ReactNode;
  carbonPriceTooltip: (d: any) => React.ReactNode;
  decarbRateTooltip: (d: any) => React.ReactNode;
  peChart: {
    highKey: string;
    lowKey: string;
    highLabel: string;
    lowLabel: string;
    tooltip: (d: any) => React.ReactNode;
  };
}

function AnalysisSection({
  icon: Icon,
  title,
  description,
  latestDecarbRate,
  latestCarbonPrice,
  latestTemperature,
  chartData,
  isLoading,
  formatChartDate,
  formatTooltipDate,
  testIdPrefix,
  headerRight,
  carbonPriceTooltip,
  decarbRateTooltip,
  peChart,
}: AnalysisSectionProps) {
  const peDownloadRows = chartData.map((d) => ({
    Date: formatTooltipDate(d.date),
    [`${peChart.highLabel} P/E (x)`]: d[peChart.highKey],
    [`${peChart.lowLabel} P/E (x)`]: d[peChart.lowKey],
  }));

  const priceDownloadRows = chartData.map((d) => ({
    Date: formatTooltipDate(d.date),
    "Implied Carbon Price ($/tCO2)": d.impliedCarbonPrice,
  }));

  const rateDownloadRows = chartData.map((d) => ({
    Date: formatTooltipDate(d.date),
    "Implied Decarb Rate (%/yr)": d.impliedDecarbRate,
  }));

  return (
    <section>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <h2 className="text-lg font-semibold flex items-center gap-2" data-testid={`text-${testIdPrefix}-heading`}>
          <Icon className="h-5 w-5 text-muted-foreground" />
          {title}
        </h2>
        {headerRight}
      </div>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Implied Decarb Rate</span>
          </div>
          <p className="text-xl font-semibold" data-testid={`text-${testIdPrefix}-decarb-rate`}>
            {latestDecarbRate !== null ? `${latestDecarbRate.toFixed(2)}%` : "-"}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ yr</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Implied Carbon Price</span>
          </div>
          <p className="text-xl font-semibold" data-testid={`text-${testIdPrefix}-carbon-price`}>
            {latestCarbonPrice !== null ? `$${latestCarbonPrice.toFixed(0)}` : "-"}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ tonne</span>
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Implied Temperature</span>
          </div>
          <p className="text-xl font-semibold" data-testid={`text-${testIdPrefix}-temperature`}>
            {latestTemperature !== null ? `${latestTemperature.toFixed(1)}` : "-"}
            <span className="text-sm font-normal text-muted-foreground ml-1">&deg;C</span>
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-pe-chart-heading`}>P/E Ratio Comparison</h3>
              <p className="text-xs text-muted-foreground mt-1">{peChart.highLabel} vs {peChart.lowLabel} over time</p>
            </div>
            <DownloadDataButton
              filename={`${testIdPrefix}-pe-ratio-comparison`}
              sheetName="P-E Ratio"
              rows={peDownloadRows}
              testId={`button-download-${testIdPrefix}-pe`}
            />
          </div>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} scale="time" tick={{ fontSize: 11 }} tickFormatter={formatChartDate} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(0)}x`} className="text-muted-foreground" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return <>{peChart.tooltip(payload[0].payload)}</>;
                }} />
                <Legend verticalAlign="top" height={30} iconType="line" wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey={peChart.highKey} stroke="hsl(168, 76%, 36%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name={peChart.highLabel} />
                <Line type="monotone" dataKey={peChart.lowKey} stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name={peChart.lowLabel} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">No data available</div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-price-chart-heading`}>Implied Carbon Price</h3>
              <p className="text-xs text-muted-foreground mt-1">Market-implied cost per tonne CO2 over time</p>
            </div>
            <DownloadDataButton
              filename={`${testIdPrefix}-implied-carbon-price`}
              sheetName="Carbon Price"
              rows={priceDownloadRows}
              testId={`button-download-${testIdPrefix}-price`}
            />
          </div>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} scale="time" tick={{ fontSize: 11 }} tickFormatter={formatChartDate} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} className="text-muted-foreground" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return <>{carbonPriceTooltip(payload[0].payload)}</>;
                }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                <Line type="monotone" dataKey="impliedCarbonPrice" stroke="hsl(168, 76%, 36%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">No data available</div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-rate-chart-heading`}>Implied Decarbonization Rate</h3>
              <p className="text-xs text-muted-foreground mt-1">Annual rate of emissions reduction implied by valuations</p>
            </div>
            <DownloadDataButton
              filename={`${testIdPrefix}-implied-decarbonization-rate`}
              sheetName="Decarb Rate"
              rows={rateDownloadRows}
              testId={`button-download-${testIdPrefix}-rate`}
            />
          </div>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" type="number" domain={["dataMin", "dataMax"]} scale="time" tick={{ fontSize: 11 }} tickFormatter={formatChartDate} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v.toFixed(1)}%`} className="text-muted-foreground" />
                <Tooltip content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return <>{decarbRateTooltip(payload[0].payload)}</>;
                }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                <Line type="monotone" dataKey="impliedDecarbRate" stroke="hsl(262, 80%, 55%)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">No data available</div>
          )}
        </Card>
      </div>
    </section>
  );
}

function SummaryCard({ icon: Icon, label, value, isLoading }: { icon: React.ElementType; label: string; value: number; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Card className="p-4">
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-7 w-16" />
      </Card>
    );
  }
  return (
    <Card className="p-4" data-testid={`card-summary-${label.toLowerCase()}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-xl font-semibold">{value.toLocaleString()}</p>
    </Card>
  );
}

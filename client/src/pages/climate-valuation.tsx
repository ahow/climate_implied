import { WorkbookMoneyAudit } from "@/components/workbook-money-audit";
import { CarbonPassThroughReview } from "@/components/carbon-pass-through-review";
import { analysisFetch as fetch, hasArchivedSelection } from "@/lib/analysis-selection";
import { deriveProducerValuationPE } from "@/lib/producer-download";
import type { ValuationPEDerivation } from "@shared/derivedConsumer";
import { CompanyConditionalSummary } from "@/components/company-conditional-summary";
import { ProducerReservePanel } from "@/components/producer-reserve-panel";
import { LocationElectricityPanel } from "@/components/location-electricity-panel";
import { RetirementAssociationPanel } from "@/components/retirement-association-panel";
import { useState } from "react";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { OperatorOnlyNotice, OPERATOR_ONLY_REASON } from "@/components/operator-only-notice";
import { QueryReadErrors } from "@/components/query-read-errors";
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
import { DownloadDataButton, ProducerDownloadLink } from "@/components/download-data-button";
import { gordonBaselineLabel, gordonExportNotes, verifyGordonBaselineRows, displayDiagnostic } from "@/lib/valuation-claims";
import { GORDON_DEFINITION } from "@shared/quantityDescriptors";
import { certifyFiniteExport,finiteExportBindings } from "@shared/finiteExportSchemas";
import { Upload, FileSpreadsheet, RefreshCw, TrendingUp, DollarSign, Building2, Leaf, Target, Factory, Info } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
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
  const [includeScope3, setIncludeScope3] = useState(false);
  const [winsorize, setWinsorize] = useState(true);
  const [costOfEquity, setCostOfEquity] = useState(8);
  const [decarbTercileMethod, setDecarbTercileMethod] = useState<"absolute" | "sector_relative" | "sub_sector_relative" | "industry_relative">("sector_relative");

  const { data: uploads, error: uploadsError } = useQuery<UploadRecord[]>({
    queryKey: ["/api/cv/uploads"],
    refetchInterval: 5000,
    select: rows => { assertValuationGroupRows(rows); return rows; },
  });

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useQuery<Summary>({
    queryKey: ["/api/cv/summary"],
    refetchInterval: uploads?.some((u) => u.status === "processing") ? 5000 : false,
  });

  const latestCompletedUpload = uploads?.find((u) => u.status === "completed");
  const uploadId = hasArchivedSelection() ? "archived" : latestCompletedUpload?.id;
  const hasTimeSeriesData = summary && summary.dateRange && typeof summary.dateRange.recordCount === "number" && Number.isFinite(summary.dateRange.recordCount) && summary.dateRange.recordCount > 0;

  const carbonPriceUrl = `/api/cv/carbon-price?uploadId=${uploadId}&method=sector_relative&includeScope3=${includeScope3}&winsorize=${winsorize}&inferenceMethod=carbon_intensity`;
  const { data: carbonPrices, isLoading: carbonPricesLoading, error: carbonPricesError } = useQuery<CarbonPricePoint[]>({
    queryKey: [carbonPriceUrl],
    select: rows => { assertValuationGroupRows(rows); return rows; },
    enabled: !!uploadId && !!hasTimeSeriesData,
  });

  const costOfEquityDecimal = costOfEquity / 100;
  const sdgGrowthUrl = `/api/cv/sdg-growth?costOfEquity=${costOfEquityDecimal}`;
  const { data: sdgGrowth, isLoading: sdgGrowthLoading, error: sdgGrowthError } = useQuery<SDGGrowthPoint[]>({
    queryKey: ["/api/cv/sdg-growth", costOfEquityDecimal, uploadId],
    select: rows => { assertValuationGroupRows(rows); return rows; },
    queryFn: async () => {
      const res = await fetch(sdgGrowthUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch SDG growth data");
      const rows = await res.json();
      verifyGordonBaselineRows(rows, costOfEquity);
      return rows;
    },
    enabled: !!hasTimeSeriesData,
  });

  const decarbTercileUrl = `/api/cv/decarb-terciles?method=${decarbTercileMethod}&costOfEquity=${costOfEquityDecimal}`;
  const { data: decarbTerciles, isLoading: decarbTercilesLoading, error: decarbTercilesError } = useQuery<DecarbTercilePoint[]>({
    queryKey: ["/api/cv/decarb-terciles", decarbTercileMethod, costOfEquityDecimal, uploadId],
    select: rows => { assertValuationGroupRows(rows); return rows; },
    queryFn: async () => {
      const res = await fetch(decarbTercileUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch decarb terciles");
      const rows = await res.json();
      verifyGordonBaselineRows(rows, costOfEquity);
      return rows;
    },
    enabled: !!hasTimeSeriesData,
  });

  const formatChartDate = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
  };

  const formatTooltipDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  };

  const carbonIntensityChartData = carbonPrices ? deriveProducerValuationPE(carbonPrices, "carbon").chartRows : undefined;
  const sdgChartData = sdgGrowth ? deriveProducerValuationPE(sdgGrowth, "sdg").chartRows : undefined;
  const ambitionChartData = decarbTerciles ? deriveProducerValuationPE(decarbTerciles, "ambition").chartRows : undefined;

  const hasData = !!hasTimeSeriesData;

  return (
    <div className="bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <QueryReadErrors prefix="/api/cv" />
        {summaryLoading && <p role="status" aria-live="polite" className="text-sm text-muted-foreground" data-testid="status-company-summary-loading">Loading company summary for the current selection.</p>}
        <p role="status" className="text-sm text-muted-foreground">Monetary-input-dependent totals and derived ratios are withheld when source currency,magnitude or required actual-source-day FX is unqualified. Empty financial panels can reflect this intentional guard,not absence of numeric source cells. This restriction does not by itself reject an independently reported dimensionless P/E.</p>
        <WorkbookMoneyAudit />
        {!summaryLoading && !summaryError && <ProducerDownloadLink payload={summary} />}
        {!carbonPricesLoading && !carbonPricesError && <ProducerDownloadLink payload={carbonPrices} />}
        <CarbonPassThroughReview />
        {uploadsError && <p role="alert">Company dataset inventory could not be read. No completed-dataset identity is inferred.</p>}
        {summaryError && <p role="alert">Company summary read failed for the current selection. No prior summary counts or series are shown.</p>}
        {summary?.dateRange && !(typeof summary.dateRange.recordCount === "number" && Number.isFinite(summary.dateRange.recordCount)) &&
          <p role="status">Historical record count not returned as a finite number. Group-series availability is not inferred.</p>}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-cv-title">
              Company Valuation Research
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
              disabled
              data-testid="input-file-upload"
            />
            <Button
              variant="default"
              disabled
              title={OPERATOR_ONLY_REASON}
              data-testid="button-upload"
            >
              <Upload className="h-4 w-4" />
              <span className="ml-2">Upload Excel Data</span>
            </Button>
          </div>
        </div>
        <OperatorOnlyNotice />
        <CompanyConditionalSummary />
        <ProducerReservePanel />
        <LocationElectricityPanel />
        <RetirementAssociationPanel />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard icon={Building2} label="Companies" value={summary?.companiesCount ?? null} isLoading={summaryLoading} />
          <SummaryCard icon={FileSpreadsheet} label="Records" value={summary?.dateRange?.recordCount ?? null} isLoading={summaryLoading} />
          <SummaryCard icon={Factory} label="Sectors" value={summary?.sectors ?? null} isLoading={summaryLoading} />
          <SummaryCard icon={TrendingUp} label="Geographies" value={summary?.geographies ?? null} isLoading={summaryLoading} />
        </div>

        {summary?.imputation && summary.imputation.imputedRecords > 0 && (
          <div
            className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
            data-testid="text-imputation-disclosure"
          >
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              <span data-field-id="companySummary.imputation.imputedRecords">{summary.imputation.imputedRecords.toLocaleString()}</span> of{" "}
              <span data-field-id="companySummary.imputation.totalRecords">{typeof summary.imputation.totalRecords === "number" && Number.isFinite(summary.imputation.totalRecords) ? summary.imputation.totalRecords.toLocaleString() : "Total record count unavailable — not returned"}</span> records (
              <span data-field-id="companySummary.imputation.imputedFraction">{displayDiagnostic(typeof summary.imputation.imputedFraction === "number" ? summary.imputation.imputedFraction * 100 : null, "%")}</span>) use carried-forward
              (imputed) emissions where a reporting gap exists. Carbon-intensity and pricing
              for these periods rely on the most recent observed scope 1/2/3 values.
            </span>
          </div>
        )}
        {summary?.imputation && !(typeof summary.imputation.imputedRecords === "number" && Number.isFinite(summary.imputation.imputedRecords)) &&
          <p role="status">Imputation coverage unavailable: imputed record count not returned. No zero-imputation inference is made.</p>}

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
                      <Button size="sm" variant="outline" data-testid={`button-reset-upload-${u.id}`} disabled title={OPERATOR_ONLY_REASON}>
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
              costOfEquityPct={8}
              title="High vs Low Carbon Companies"
              description="Companies ranked by emissions per market cap, not revenue, into terciles. P/E differences are descriptive valuation diagnostics. This endpoint uses fixed r = 8%; changing the SDG/ambition cost-of-equity control does not change it. Gordon steady-state g = r − 1/PE assumes earnings are fully distributable; it is not a decarbonization rate or five-year reverse-DCF growth."
              chartData={carbonIntensityChartData ?? []}
              producerPayload={carbonPrices}
              producerDerivation="carbon"
              isLoading={carbonPricesLoading}
              error={carbonPricesError}
              formatChartDate={formatChartDate}
              formatTooltipDate={formatTooltipDate}
              testIdPrefix="carbon"
              peChart={{
                highKey: "cleanPE",
                lowKey: "dirtyPE",
                highLabel: "Low Carbon (Clean)",
                lowLabel: "High Carbon (Dirty)",
                tooltip: (d) => <ValuationPETooltip dateLabel={formatTooltipDate(d.date)} highLabel="Low Carbon" lowLabel="High Carbon" highValue={d.cleanPE} lowValue={d.dirtyPE} highCount={d.cleanCount} lowCount={d.dirtyCount} />,
              }}
            />

            <AnalysisSection
              icon={Leaf}
              costOfEquityPct={costOfEquity}
              gordonSemanticPrefix="sdg"
              title="High vs Low SDG-Aligned Companies"
              description={`Companies grouped by SDG alignment. Gordon steady-state earnings-growth baselines at ${costOfEquity}% cost of equity are not identified market climate expectations or measured emissions reductions.`}
              chartData={sdgChartData ?? []}
              producerPayload={sdgGrowth}
              producerDerivation="sdg"
              isLoading={sdgGrowthLoading}
              error={sdgGrowthError}
              formatChartDate={formatChartDate}
              formatTooltipDate={formatTooltipDate}
              testIdPrefix="sdg"
              peChart={{
                highKey: "cleanPE",
                lowKey: "dirtyPE",
                highLabel: "Positive SDG (Clean)",
                lowLabel: "Negative SDG (Dirty)",
                tooltip: (d) => <ValuationPETooltip dateLabel={formatTooltipDate(d.date)} highLabel="Positive SDG" lowLabel="Negative SDG" highValue={d.cleanPE} lowValue={d.dirtyPE} highCount={d.cleanCount} lowCount={d.dirtyCount} />,
              }}
            />

            <AnalysisSection
              icon={Target}
              costOfEquityPct={costOfEquity}
              gordonSemanticPrefix="targetTerciles"
              title="High vs Low Ambition Companies"
              description={`Companies grouped by announced targets. P/E differences do not establish emissions outcomes. Gordon steady-state baselines use ${costOfEquity}% cost of equity, not a validated valuation-to-activity mapping.`}
              chartData={ambitionChartData ?? []}
              producerPayload={decarbTerciles}
              producerDerivation="ambition"
              isLoading={decarbTercilesLoading}
              error={decarbTercilesError}
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
              peChart={{
                highKey: "bestPE",
                lowKey: "worstPE",
                highLabel: "Most Ambitious",
                lowLabel: "Least Ambitious",
                tooltip: (d) => <ValuationPETooltip dateLabel={formatTooltipDate(d.date)} highLabel="Most Ambitious" lowLabel="Least Ambitious" highValue={d.bestPE} lowValue={d.worstPE} highCount={d.bestCount} lowCount={d.worstCount} />,
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
                <h3 className="text-lg font-medium" data-testid="text-no-data-heading">No company dataset available</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  An operator must import and review company data using the CLI.
                  Valuation-derived temperature, carbon-price and net-zero outputs remain withheld.
                </p>
              </div>
              <Button variant="default" disabled title={OPERATOR_ONLY_REASON} data-testid="button-upload-cta">
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
  costOfEquityPct: number;
  gordonSemanticPrefix?: "sdg" | "targetTerciles";
  icon: React.ElementType;
  title: string;
  description: string;
  chartData: Array<{ date?: number; [k: string]: any }>;
  producerPayload?: unknown;
  producerDerivation?: ValuationPEDerivation;
  isLoading: boolean;
  error?: Error | null;
  formatChartDate: (ts: number) => string;
  formatTooltipDate: (ts: number) => string;
  testIdPrefix: string;
  headerRight?: React.ReactNode;
  peChart: {
    highKey: string;
    lowKey: string;
    highLabel: string;
    lowLabel: string;
    tooltip: (d: any) => React.ReactNode;
  };
}

export function AnalysisSection({
  costOfEquityPct,
  gordonSemanticPrefix,
  icon: Icon,
  title,
  description,
  chartData,
  producerPayload,
  producerDerivation,
  isLoading,
  error,
  formatChartDate,
  formatTooltipDate,
  testIdPrefix,
  headerRight,
  peChart,
}: AnalysisSectionProps) {
  const currentRows = isLoading || error ? [] : chartData.filter((row): row is { date: number; [k: string]: any } => typeof row.date === "number" && Number.isFinite(row.date));
  const peDownloadRows = certifyFiniteExport("valuationPE",(!isLoading && !error && producerPayload && producerDerivation)
    ? deriveProducerValuationPE(producerPayload, producerDerivation).rows : currentRows.map((d) => ({
    Date: formatTooltipDate(d.date),
    [`${peChart.highLabel} P/E (x)`]: roundedPE(d[peChart.highKey]),
    [`${peChart.lowLabel} P/E (x)`]: roundedPE(d[peChart.lowKey]),
  })),{case:testIdPrefix});

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
      <p className="text-sm font-medium mb-4" data-testid={`${testIdPrefix}-gordon-baseline-label`}
        title={GORDON_DEFINITION}
        data-field-id={gordonSemanticPrefix ? `${gordonSemanticPrefix}.gordonBaselineLabel` : undefined}>
        {gordonBaselineLabel(costOfEquityPct)}
      </p>

      <Card className="p-4 mb-6 text-sm text-muted-foreground" data-testid={`${testIdPrefix}-withheld`}>
        Temperature, carbon price, net-zero year and physical decarbonization rates: unavailable.
        No defensible valuation-to-activity mapping has been established. No numeric substitutes are shown or exported.
      </Card>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-pe-chart-heading`}>P/E Ratio Comparison</h3>
              <p className="text-xs text-muted-foreground mt-1">{peChart.highLabel} vs {peChart.lowLabel} over time</p>
            </div>
            <DownloadDataButton
              kind="valuation"
              interpretationNotes={gordonExportNotes(costOfEquityPct, gordonSemanticPrefix)}
              filename={`${testIdPrefix}-pe-ratio-comparison`}
              sheetName="P-E Ratio"
              rows={peDownloadRows}
              fieldBindings={finiteExportBindings("valuationPE",{case:testIdPrefix})}
              testId={`button-download-${testIdPrefix}-pe`}
            />
          </div>
          {error ? <p role="alert">P/E comparison read failed for {title}. No prior selection values or downloads are shown.</p> : isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : currentRows.length > 0 ? (
            <>
            {currentRows.some(row => roundedPE(row[peChart.highKey]) === undefined || roundedPE(row[peChart.lowKey]) === undefined) &&
              <p role="status">Some selected P/E observations are missing or invalid. Their chart and export cells remain unavailable, not zero.</p>}
            {currentRows.length !== chartData.length && <p role="status">Rows with missing or invalid observation dates are withheld; no date is inferred.</p>}
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={currentRows.map(row => ({ ...row, [peChart.highKey]: roundedPE(row[peChart.highKey]), [peChart.lowKey]: roundedPE(row[peChart.lowKey]) }))}>
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
            </>
          ) : (
            <div role="status" className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">{chartData.length ? "No P/E observations have a valid observation date; no date is inferred." : `No P/E observations returned for ${title}.`}</div>
          )}
        </Card>

      </div>
    </section>
  );
}

export function SummaryCard({ icon: Icon, label, value, isLoading }: { icon: React.ElementType; label: string; value?: number | null; isLoading?: boolean }) {
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
      <p className="text-xl font-semibold">{typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "Unavailable"}</p>
      {!(typeof value === "number" && Number.isFinite(value)) && <p role="status" className="text-xs text-muted-foreground">{label}: count not returned for the current selection.</p>}
    </Card>
  );
}

export function roundedPE(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value * 100) / 100;
  return Number.isFinite(rounded) ? rounded : undefined;
}

export function assertValuationGroupRows(rows: unknown): void {
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" || Array.isArray(row))) {
    throw new Error("Valuation records unavailable: expected an array of observation records.");
  }
}

export function ValuationPETooltip({ dateLabel, highLabel, lowLabel, highValue, lowValue, highCount, lowCount }: {
  dateLabel?: string; highLabel: string; lowLabel: string;
  highValue?: number | null; lowValue?: number | null; highCount?: number | null; lowCount?: number | null;
}) {
  const pe = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(1)}x` : "Unavailable — P/E not returned";
  const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? `${value} co.` : "Company count not returned";
  return <div className="bg-card border rounded-md p-3 text-xs space-y-1.5 shadow-md" style={{ minWidth: 200 }}>
    <div className="font-medium">{dateLabel ?? "Observation date unavailable"}</div>
    <div>{highLabel} P/E: <span className="font-semibold">{pe(highValue)}</span> ({count(highCount)})</div>
    <div>{lowLabel} P/E: <span className="font-semibold">{pe(lowValue)}</span> ({count(lowCount)})</div>
  </div>;
}

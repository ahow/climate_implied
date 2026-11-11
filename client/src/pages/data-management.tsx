import { useRef, useState } from "react";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { ReadResultReason } from "@/components/read-result-reason";
import { OperatorOnlyNotice, OPERATOR_ONLY_REASON } from "@/components/operator-only-notice";
import { QueryReadErrors } from "@/components/query-read-errors";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefreshCw, ExternalLink, Clock, Check, X, Database } from "lucide-react";
import { DownloadDataButton } from "@/components/download-data-button";
import { certifyFiniteExport,finiteExportBindings,indicatorValueColumn } from "@shared/finiteExportSchemas";
import { indicatorFieldSpecs } from "@shared/indicatorFieldSemantics";
import { describePersistedSummary } from "@shared/dataManagementSemantics";
import type { FetchSummaryEvidence } from "@shared/fetchSummarySemantics";
import { FinancialProviderStatus } from "@/components/financial-provider-status";
import { AnalysisSnapshotStatus } from "@/components/analysis-snapshot-status";
import { FinancialReview, ScientificValidation } from "@/components/financial-review";
import {CompanyOperatingReview} from "@/components/company-operating-review";
import {CompanyCoverage} from "@/components/company-coverage";
import {CompanyReplayUpload} from "@/components/company-replay-upload";
import {TargetInputDisclosure} from "@/components/target-input-disclosure";

interface IndicatorSummary {
  key: string;
  label: string;
  unit: string;
  category: string;
  source: string;
  tier: string;
  fetchMethod: string;
  decimals: number;
  appliedYear: number;
  appliedValue: number;
  appliedIsNowcast?: boolean;
  provenance: string;
  provenanceSource: string;
  provenanceAsOf?: string | null;
  curatedLatest: number | null;
  pendingCount: number;
}

interface IndicatorsResponse {
  indicators: IndicatorSummary[];
  baselineYear: number;
  latestYear: number;
}

interface Proposal {
  id: string;
  indicatorKey: string;
  year: number;
  value: number;
  source: string;
  sourceUrl: string | null;
  asOfDate: string | null;
  method: string;
  status: string;
  note: string | null;
  createdAt: string;
  decidedAt: string | null;
}

interface SeriesPoint {
  year: number;
  value: number;
  source: string;
  method: string;
  asOfDate?: string | null;
  sourceUrl?: string | null;
  overridden: boolean;
  isNowcast?: boolean;
}

interface IndicatorDetail {
  def: IndicatorSummary;
  series: SeriesPoint[];
  proposals: Proposal[];
}

interface FetchRun {
  id: string;
  trigger: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  proposalsCreated: number;
  adaptersSucceeded: number;
  adaptersFailed: number;
  summary: unknown;
}
function runSummaryClaimLabel(value:unknown,evidence?:FetchSummaryEvidence):string {
  const interpretation=describePersistedSummary(value,evidence);
  return interpretation.availability==="available"
    ? interpretation.provenance==="verified"
      ? "Prospective producer manifest verified; not source or scientific acceptance"
      : "Schema-compatible JSON only; producer provenance unverified; raw JSON remains available unchanged"
    : "Typed summary claims unavailable; raw historical JSON remains available unchanged";
}

interface RunsResponse {
  runs: FetchRun[];
  summaryEvidence?: Record<string,FetchSummaryEvidence>;
}

const CATEGORY_ORDER = [
  "Technology",
  "Policy",
  "Corporate",
  "Socioeconomic",
  "Financial Flows",
  "Emissions Outcomes",
];

function formatValue(value: number | null | undefined, decimals: number): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable — not returned";
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function provenanceBadge(provenance: string) {
  if (provenance === "curated") {
    return (
      <Badge variant="secondary" data-testid="badge-provenance-curated">
        Curated
      </Badge>
    );
  }
  if (provenance === "manual") {
    return <Badge data-testid="badge-provenance-manual">Manual</Badge>;
  }
  if (provenance === "nowcast") {
    return (
      <Badge variant="outline" className="border-muted-foreground text-muted-foreground" data-testid="badge-provenance-nowcast">
        Nowcast (estimated)
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-primary text-primary" data-testid="badge-provenance-estimated">
      Estimated ({provenance})
    </Badge>
  );
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

export default function DataManagement() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const detailTrigger = useRef<HTMLElement | null>(null);

  const { data, isLoading, error: indicatorsError } = useQuery<IndicatorsResponse>({
    queryKey: ["/api/data/indicators"],
  });

  const { data: runsData, isLoading: runsLoading, error: runsError } = useQuery<RunsResponse>({
    queryKey: ["/api/data/runs"],
  });

  const lastRun = runsData?.runs?.[0];
  const lastSummaryEvidence = lastRun ? runsData?.summaryEvidence?.[lastRun.id] : undefined;
  const lastSummaryInterpretation = lastRun
    ? describePersistedSummary(lastRun.summary,lastSummaryEvidence) : undefined;

  const grouped = (data?.indicators ?? []).reduce<Record<string, IndicatorSummary[]>>(
    (acc, ind) => {
      (acc[ind.category] ??= []).push(ind);
      return acc;
    },
    {},
  );

  const totalPending = data?.indicators?.every(indicator => typeof indicator.pendingCount === "number" && Number.isFinite(indicator.pendingCount))
    ? data.indicators.reduce((sum, indicator) => sum + indicator.pendingCount, 0)
    : undefined;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <QueryReadErrors prefix="/api/data" />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-6 w-6 text-primary" />
            Reviewed indicators
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Inspect indicator provenance, historical series, pending proposals and operator decision history.
            Collection and data changes are operator-only; this page is read-only.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <Button
            disabled
            title={OPERATOR_ONLY_REASON}
            data-testid="button-refresh-now"
          >
            <RefreshCw className="h-4 w-4" />
            Collect data (operator only)
          </Button>
          {lastRun && (
            <>
            <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-run">
              <Clock className="h-3 w-3" />
              Last run: <span data-field-id="fetchRuns.runs[].startedAt">{formatDateTime(lastRun.startedAt)}</span>
              {" ("}<span data-field-id="fetchRuns.runs[].trigger">{lastRun.trigger}</span>
              {", "}<span data-field-id="fetchRuns.runs[].status">{lastRun.status}</span>{")"}
            </p>
            <p className="text-xs text-muted-foreground" data-field-id="fetchSummaryDisplay.claim">
              {runSummaryClaimLabel(lastRun.summary,lastSummaryEvidence)}
            </p>
            {lastSummaryEvidence?.availability==="unverified" && (
              <p className="text-xs text-muted-foreground" data-field-id="fetchSummaryEvidence.reason">
                {lastSummaryEvidence.reason}
              </p>
            )}
            {lastSummaryEvidence?.availability==="verified" && lastSummaryInterpretation?.availability==="available" && (
              <div className="text-xs space-y-1" data-testid="verified-run-summary">
                <p>
                  Producer contract: <span data-field-id="fetchSummaryEvidence.manifest.version">{lastSummaryEvidence.manifest.version}</span>
                  {" · manifest "}<span className="break-all" data-field-id="fetchSummaryEvidence.manifestId">{lastSummaryEvidence.manifestId}</span>
                </p>
                {lastSummaryInterpretation.claims.perAdapter.map((adapter,index)=>(
                  <p key={`${adapter.id}-${index}`}>
                    <span data-field-id="fetchSummaryProducer.perAdapter[].id">{adapter.id}</span>
                    {": "}<span data-field-id="fetchSummaryProducer.perAdapter[].values">{adapter.values}</span>{" fetched rows"}
                    {adapter.error!==undefined && (
                      <span data-field-id="fetchSummaryProducer.perAdapter[].error">{" · error: "}{adapter.error}</span>
                    )}
                  </p>
                ))}
                {lastSummaryInterpretation.claims.error!==undefined && (
                  <p data-field-id="fetchSummaryProducer.error">Run error: {lastSummaryInterpretation.claims.error}</p>
                )}
              </div>
            )}
            <details className="text-xs text-muted-foreground">
              <summary>Retained raw run summary</summary>
              <pre className="whitespace-pre-wrap break-all" data-field-id="fetchRuns.runs[].summary">{JSON.stringify(lastRun.summary,null,2)}</pre>
            </details>
            </>
          )}
        </div>
      </div>

      <OperatorOnlyNotice />
      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Indicators tracked</p>
            <p className="text-2xl font-bold" data-testid="text-count-indicators">
              {data?.indicators ? data.indicators.length : "Unavailable"}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending review</p>
            <p className="text-2xl font-bold" data-testid="text-count-pending">
               {totalPending ?? "Unavailable — pending counts not returned"}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Projection baseline</p>
            <p className="text-2xl font-bold" data-testid="text-baseline-year">
              {data?.baselineYear ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <ReadResultReason label="Indicator inventory" loading={isLoading} error={indicatorsError} available={!!data?.indicators?.length} emptyReason="No reviewed indicators were returned. No indicator values are substituted." />
      <ReadResultReason label="Collection history" loading={runsLoading} error={runsError} available={!!runsData?.runs?.length} emptyReason="No retained collection runs were returned." />
      <TargetInputDisclosure />
      <FinancialProviderStatus />
      <AnalysisSnapshotStatus />
      <FinancialReview />
      <CompanyOperatingReview />
      <CompanyCoverage />
      <CompanyReplayUpload />
      <ScientificValidation />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((category) => (
          <div key={category} className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {category}
            </h2>
            <div className="grid gap-2">
              {grouped[category].map((ind) => (
                <Card
                  key={ind.key}
                  className="hover-elevate cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-haspopup="dialog"
                  onClick={(event) => { detailTrigger.current = event.currentTarget; setSelectedKey(ind.key); }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      detailTrigger.current = event.currentTarget;
                      setSelectedKey(ind.key);
                    }
                  }}
                  data-testid={`card-indicator-${ind.key}`}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-medium truncate" data-testid={`text-label-${ind.key}`}>
                        {ind.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ind.provenanceSource}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {ind.pendingCount > 0 && (
                        <Badge variant="destructive" data-testid={`badge-pending-${ind.key}`}>
                          {ind.pendingCount} pending
                        </Badge>
                      )}
                      {provenanceBadge(ind.provenance)}
                      <div className="text-right w-28">
                        <p className="font-mono font-semibold" data-field-id="indicatorInventory.indicators[].appliedValue" data-testid={`text-value-${ind.key}`}>
                          {formatValue(ind.appliedValue, ind.decimals)}
                        </p>
                        <p className="text-[10px] text-muted-foreground" data-field-id="indicatorInventory.indicators[].unit">
                          {ind.unit} · {ind.appliedYear}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}

      <IndicatorDetailDialog
        indicatorKey={selectedKey}
        onClose={() => setSelectedKey(null)}
        returnFocusTo={detailTrigger}
      />
    </div>
  );
}

export function IndicatorDetailDialog({
  indicatorKey,
  onClose,
  returnFocusTo,
}: {
  indicatorKey: string | null;
  onClose: () => void;
  returnFocusTo?: { current: HTMLElement | null };
}) {
  const [manualYear, setManualYear] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [manualNote, setManualNote] = useState("");

  const { data: detail, isLoading, isError, isFetching, refetch } = useQuery<IndicatorDetail>({
    queryKey: ["/api/data/indicator", indicatorKey],
    enabled: !!indicatorKey,
  });

  const { proposals, def, hasDefinition, usableSeries } = indicatorDetailAvailability(detail, indicatorKey);
  const pending = (proposals ?? []).filter((p) => p.status === "pending");
  const decided = (proposals ?? []).filter(
    (p) => p.status === "approved" || p.status === "rejected",
  );
  const series = usableSeries ?? [];
  const firstNowcastIdx = series.findIndex((p) => p.isNowcast);
  const chartData = series.map((p, i) => ({
    year: p.year,
    actual: p.isNowcast ? null : p.value,
    estimated:
      p.isNowcast || (firstNowcastIdx > 0 && i === firstNowcastIdx - 1)
        ? p.value
        : null,
    source: p.source,
    isNowcast: p.isNowcast,
  }));
  const hasEstimated = firstNowcastIdx !== -1;

  const downloadRows = certifyFiniteExport("indicatorDetail",(hasDefinition ? series : []).map((p) => ({
    Year: p.year,
    [indicatorValueColumn(def?.key)]: p.value,
    Type: p.isNowcast ? "Estimated (nowcast)" : "Retained (not nowcast)",
    Source: p.source,
    Method: p.method,
    "As Of Date": p.asOfDate ?? "",
  })),{key:def?.key});

  if (!indicatorKey) return null;

  return (
    <Dialog open={!!indicatorKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-indicator-detail"
        onCloseAutoFocus={(event) => {
          if (returnFocusTo?.current?.isConnected) {
            event.preventDefault();
            returnFocusTo.current.focus();
          }
        }}>
        <DialogHeader>
          <DialogTitle data-testid="text-detail-title">
            {hasDefinition ? <>{def?.label} <span className="text-muted-foreground font-normal">({def?.unit})</span></> : "Indicator details"}
          </DialogTitle>
          <DialogDescription>
            {hasDefinition ? <>{def?.source || "Source not returned"} · {def?.category || "Category not returned"} · fetch method: {def?.fetchMethod || "Fetch method not returned"}</> :
              "Read-only details for the current indicator selection. Missing evidence is unavailable; no values are substituted."}
          </DialogDescription>
        </DialogHeader>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching} data-testid="button-refresh-indicator-detail">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          {isFetching ? "Refreshing detail…" : "Refresh detail"}
        </Button>
        <QueryReadErrors prefix="/api/data/indicator" />
        <IndicatorDetailReadState error={isError} loading={isLoading} available={!!detail} definitionAvailable={hasDefinition} seriesAvailable={!!usableSeries} seriesEmpty={usableSeries?.length === 0} proposalHistoryAvailable={!!proposals}>
          <>
            <OperatorOnlyNotice />

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Time series</h3>
              {hasDefinition && <DownloadDataButton
                kind="indicators"
                filename={`indicator-time-series-${def?.key ?? "series"}`}
                sheetName="Time Series"
                rows={downloadRows}
                fieldBindings={finiteExportBindings("indicatorDetail",{key:def?.key})}
                testId="button-download-timeseries"
              />}
            </div>

            <div className="h-56 w-full" data-testid="chart-timeseries">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} domain={["auto", "auto"]} />
                  <RechartsTooltip
                     content={({ active, payload, label }) => <IndicatorSeriesTooltip active={active} payload={payload} label={label} decimals={def?.decimals} unit={def?.unit} />}
                  />
                  <Legend
                    verticalAlign="top"
                    height={24}
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Sourced (observed)"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  {hasEstimated && (
                    <Line
                      type="monotone"
                      dataKey="estimated"
                      name="Estimated (nowcast)"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={(props: any) => {
                        const { cx, cy, payload, key } = props;
                        if (!payload?.isNowcast || cx == null || cy == null) {
                          return <g key={key} />;
                        }
                        return (
                          <circle
                            key={key}
                            cx={cx}
                            cy={cy}
                            r={3}
                            fill="hsl(var(--background))"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                          />
                        );
                      }}
                      connectNulls
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {pending.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Pending proposals</h3>
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                      data-testid={`proposal-${p.id}`}
                    >
                      <div className="min-w-0 text-sm">
                        <p className="font-mono font-semibold">
                          {p.year}: {formatValue(p.value, def?.decimals ?? 2)} {def?.unit}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {p.source}
                          {p.sourceUrl && (
                            <a
                              href={p.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-primary hover:underline"
                              data-testid={`link-source-${p.id}`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {p.asOfDate ? ` · as of ${p.asOfDate}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          disabled
                          title={OPERATOR_ONLY_REASON}
                          data-testid={`button-approve-${p.id}`}
                        >
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          title={OPERATOR_ONLY_REASON}
                          data-testid={`button-reject-${p.id}`}
                        >
                          <X className="h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Separator />
            <fieldset disabled className="space-y-2">
              <h3 className="text-sm font-semibold">Manual entry / edit</h3>
              <p className="text-xs text-muted-foreground">
                Manual entry is unavailable in the dashboard. An operator must review and apply changes using the CLI.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <Label htmlFor="manual-year" className="text-xs">Year</Label>
                  <Input
                    id="manual-year"
                    type="number"
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    placeholder={String(def?.appliedYear ?? "")}
                    data-testid="input-manual-year"
                  />
                </div>
                <div>
                  <Label htmlFor="manual-value" className="text-xs">Value ({def?.unit})</Label>
                  <Input
                    id="manual-value"
                    type="number"
                    step="any"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    data-testid="input-manual-value"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled
                    title={OPERATOR_ONLY_REASON}
                    data-testid="button-save-manual"
                  >
                    Save & apply
                  </Button>
                </div>
              </div>
              <Textarea
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="Optional note (source, rationale)…"
                rows={2}
                data-testid="input-manual-note"
              />
            </fieldset>

            <Separator />
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Historical series</h3>
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...series].reverse().map((pt) => (
                      <TableRow key={pt.year} data-testid={`row-series-${pt.year}`}>
                        <TableCell>{pt.year}</TableCell>
                        <TableCell className="font-mono">
                          {formatValue(pt.value, def?.decimals ?? 2)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {pt.overridden ? (
                            <span className="text-primary">{pt.source}</span>
                          ) : (
                            pt.source
                          )}
                          {pt.asOfDate ? ` · as of ${pt.asOfDate}` : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {decided.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Decision history</h3>
                  <div className="space-y-1">
                    {decided.slice(0, 10).map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs text-muted-foreground"
                        data-testid={`history-${p.id}`}
                      >
                        <span>
                          {p.year}: {formatValue(p.value, def?.decimals ?? 2)} ({p.source})
                        </span>
                        <Badge variant={p.status === "approved" ? "default" : "secondary"}>
                          {p.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        </IndicatorDetailReadState>
      </DialogContent>
    </Dialog>
  );
}

export function IndicatorDetailReadState({ error, loading, available, definitionAvailable, seriesAvailable, seriesEmpty, proposalHistoryAvailable, children }: {
  error?: boolean; loading?: boolean; available: boolean; definitionAvailable?: boolean;
  seriesAvailable?: boolean; seriesEmpty?: boolean; proposalHistoryAvailable?: boolean; children?: React.ReactNode;
}) {
  if (error) return <p role="alert" className="text-sm text-muted-foreground">Indicator details are unavailable. Retry the read above or close this dialog. No prior indicator details are shown.</p>;
  if (loading) return <div role="status" aria-label="Loading selected indicator details" className="space-y-3">
    <Skeleton className="h-6 w-1/2" /><Skeleton className="h-48 w-full" />
  </div>;
  if (!available) return <p role="status">No indicator detail response was returned for this selection. No series or values are substituted.</p>;
  if (definitionAvailable === false) return <p role="status">Indicator definition is missing or invalid for this selection. Labels and units cannot be verified; series and downloads are withheld.</p>;
  if (seriesAvailable === false) return <p role="status">No usable indicator series array was returned for this selection. Missing or invalid observation rows are not substituted; downloads are withheld.</p>;
  return <>
    {seriesEmpty && <p role="status">No indicator series observations were returned. No numeric values are substituted.</p>}
    {proposalHistoryAvailable === false && <p role="status">Proposal history is unavailable: no usable proposal array was returned. Review completeness is not inferred.</p>}
    {children}
  </>;
}

export function indicatorDetailAvailability(detail?: IndicatorDetail | null, selectedKey?: string | null) {
  const def = detail?.def;
  const hasDefinition = [def?.key, def?.label, def?.unit].every(value => typeof value === "string" && value.trim().length > 0) &&
    typeof def?.decimals === "number" && Number.isInteger(def.decimals) && def.decimals >= 0 && def.decimals <= 20 &&
    indicatorFieldSpecs.some(([key]) => key === def?.key) && (selectedKey === undefined || selectedKey === def?.key);
  const usableSeries = Array.isArray(detail?.series) && detail.series.every(row => row && typeof row === "object" &&
    typeof row.year === "number" && Number.isFinite(row.year) && typeof row.value === "number" && Number.isFinite(row.value) &&
    typeof row.source === "string" && typeof row.method === "string" &&
    (row.asOfDate == null || typeof row.asOfDate === "string")) ? detail.series : undefined;
  const proposals = Array.isArray(detail?.proposals) && detail.proposals.every(row => row && typeof row === "object") ? detail.proposals : undefined;
  return { def, hasDefinition, usableSeries, proposals };
}

export function IndicatorSeriesTooltip({ active, payload, label, decimals = 2, unit }: {
  active?: boolean; payload?: readonly { value?: unknown; payload?: { actual?: number | null; estimated?: number | null; source?: string; isNowcast?: boolean } }[];
  label?: React.ReactNode; decimals?: number; unit?: string;
}) {
  if (!active) return null;
  const entry = payload?.find(point => point.value != null) ?? payload?.[0];
  if (!entry?.payload) return <p role="status">No indicator observation was returned for this tooltip. No value is substituted.</p>;
  const point = entry.payload;
  return <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
    <p className="font-semibold">{label ?? "Year unavailable"}: {formatValue(point.actual ?? point.estimated, decimals)} {unit ?? "Unit unavailable"}</p>
    <p className="text-muted-foreground">{point.isNowcast === true ? "Estimated — " : point.isNowcast === false ? "Sourced — " : "Observation/estimate status unavailable — "}{typeof point.source === "string" && point.source.trim() ? point.source : "Source not returned"}</p>
  </div>;
}

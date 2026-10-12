import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, ExternalLink, Clock, Check, X, Database } from "lucide-react";
import { DownloadDataButton } from "@/components/download-data-button";

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
}

interface RunsResponse {
  runs: FetchRun[];
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
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
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
  const { toast } = useToast();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery<IndicatorsResponse>({
    queryKey: ["/api/data/indicators"],
  });

  const { data: runsData } = useQuery<RunsResponse>({
    queryKey: ["/api/data/runs"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/data/refresh");
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/data/indicators"] });
      queryClient.invalidateQueries({ queryKey: ["/api/data/runs"] });
      toast({
        title: "Refresh complete",
        description: `${result?.proposalsCreated ?? 0} new proposals created. Review and approve below.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Refresh failed",
        description: String(err?.message ?? err),
        variant: "destructive",
      });
    },
  });

  const lastRun = runsData?.runs?.[0];

  const grouped = (data?.indicators ?? []).reduce<Record<string, IndicatorSummary[]>>(
    (acc, ind) => {
      (acc[ind.category] ??= []).push(ind);
      return acc;
    },
    {},
  );

  const totalPending = (data?.indicators ?? []).reduce((s, i) => s + i.pendingCount, 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Database className="h-6 w-6 text-primary" />
            Data Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Fetch the latest values for all 22 indicators, review proposals, and approve them
            before they feed the projection model. The model always falls back to curated
            baseline values until you approve a change.
          </p>
        </div>
        <div className="flex flex-col items-start md:items-end gap-2">
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            data-testid="button-refresh-now"
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
            {refreshMutation.isPending ? "Fetching…" : "Refresh now"}
          </Button>
          {lastRun && (
            <p className="text-xs text-muted-foreground flex items-center gap-1" data-testid="text-last-run">
              <Clock className="h-3 w-3" />
              Last run: {formatDateTime(lastRun.startedAt)} ({lastRun.trigger}, {lastRun.status})
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Indicators tracked</p>
            <p className="text-2xl font-bold" data-testid="text-count-indicators">
              {data?.indicators?.length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[140px]">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending review</p>
            <p className="text-2xl font-bold" data-testid="text-count-pending">
              {totalPending}
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
                  onClick={() => setSelectedKey(ind.key)}
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
                        <p className="font-mono font-semibold" data-testid={`text-value-${ind.key}`}>
                          {formatValue(ind.appliedValue, ind.decimals)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
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
      />
    </div>
  );
}

function IndicatorDetailDialog({
  indicatorKey,
  onClose,
}: {
  indicatorKey: string | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [manualYear, setManualYear] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [manualNote, setManualNote] = useState("");

  const { data: detail, isLoading } = useQuery<IndicatorDetail>({
    queryKey: ["/api/data/indicator", indicatorKey],
    enabled: !!indicatorKey,
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["/api/data/indicator", indicatorKey] });
    queryClient.invalidateQueries({ queryKey: ["/api/data/indicators"] });
    queryClient.invalidateQueries({ queryKey: ["/api/data/runs"] });
  }

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/data/proposals/${id}/approve`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Approved", description: "Value applied to the model." });
    },
    onError: (err: any) =>
      toast({ title: "Approve failed", description: String(err?.message ?? err), variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/data/proposals/${id}/reject`);
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Rejected", description: "Proposal discarded." });
    },
    onError: (err: any) =>
      toast({ title: "Reject failed", description: String(err?.message ?? err), variant: "destructive" }),
  });

  const manualMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/data/indicator/${indicatorKey}/manual`, {
        year: parseInt(manualYear, 10),
        value: parseFloat(manualValue),
        note: manualNote || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      invalidateAll();
      setManualYear("");
      setManualValue("");
      setManualNote("");
      toast({ title: "Saved", description: "Manual value applied to the model." });
    },
    onError: (err: any) =>
      toast({ title: "Save failed", description: String(err?.message ?? err), variant: "destructive" }),
  });

  const pending = (detail?.proposals ?? []).filter((p) => p.status === "pending");
  const decided = (detail?.proposals ?? []).filter(
    (p) => p.status === "approved" || p.status === "rejected",
  );
  const def = detail?.def;

  const series = detail?.series ?? [];
  const firstNowcastIdx = series.findIndex((p) => p.isNowcast);
  const chartData = series.map((p, i) => ({
    year: p.year,
    actual: p.isNowcast ? null : p.value,
    estimated:
      p.isNowcast || (firstNowcastIdx > 0 && i === firstNowcastIdx - 1)
        ? p.value
        : null,
    source: p.source,
    isNowcast: !!p.isNowcast,
  }));
  const hasEstimated = firstNowcastIdx !== -1;

  const downloadRows = series.map((p) => ({
    Year: p.year,
    [`Value (${def?.unit ?? ""})`]: p.value,
    Type: p.isNowcast ? "Estimated (nowcast)" : "Sourced (observed)",
    Source: p.source,
    Method: p.method,
    "As Of Date": p.asOfDate ?? "",
  }));

  const manualValid =
    manualYear.trim() !== "" &&
    manualValue.trim() !== "" &&
    !Number.isNaN(parseInt(manualYear, 10)) &&
    !Number.isNaN(parseFloat(manualValue));

  return (
    <Dialog open={!!indicatorKey} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-indicator-detail">
        {isLoading || !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle data-testid="text-detail-title">
                {def?.label} <span className="text-muted-foreground font-normal">({def?.unit})</span>
              </DialogTitle>
              <DialogDescription>
                {def?.source} · {def?.category} · fetch method: {def?.fetchMethod}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-semibold">Time series</h3>
              <DownloadDataButton
                filename={`indicator-time-series-${def?.key ?? "series"}`}
                sheetName="Time Series"
                rows={downloadRows}
                testId="button-download-timeseries"
              />
            </div>

            <div className="h-56 w-full" data-testid="chart-timeseries">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={56} domain={["auto", "auto"]} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const entry =
                        payload.find((p) => p.value != null) ?? payload[0];
                      const pt = entry.payload as (typeof chartData)[number];
                      return (
                        <div className="rounded-md border bg-background p-2 text-xs shadow-sm">
                          <p className="font-semibold">
                            {label}: {formatValue(pt.actual ?? pt.estimated ?? 0, def?.decimals ?? 2)}{" "}
                            {def?.unit}
                          </p>
                          <p className="text-muted-foreground">
                            {pt.isNowcast ? "Estimated — " : "Sourced — "}
                            {pt.source}
                          </p>
                        </div>
                      );
                    }}
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
                          onClick={() => approveMutation.mutate(p.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${p.id}`}
                        >
                          <Check className="h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMutation.mutate(p.id)}
                          disabled={rejectMutation.isPending}
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
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Manual entry / edit</h3>
              <p className="text-xs text-muted-foreground">
                Enter a value to approve directly. This supersedes any existing approved value for
                that year.
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
                    disabled={!manualValid || manualMutation.isPending}
                    onClick={() => manualMutation.mutate()}
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
            </div>

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
                    {[...detail.series].reverse().map((pt) => (
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
        )}
      </DialogContent>
    </Dialog>
  );
}

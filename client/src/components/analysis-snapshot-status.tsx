import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface SnapshotStatus {
  status: "immutable-workbook-snapshot" | "not-provisioned";
  snapshotId: string | null;
  companyCount: number;
  observationCount: number;
  createdAt: string | null;
  sourceNote: string;
  currentFinancialOverlaysApplied: false;
}

interface SnapshotsResponse {
  status: "available" | "not-provisioned";
  nextCursor: string | null;
  items: {
    id: string;
    kind: string;
    companyCount: number;
    observationCount: number;
    createdAt: string | null;
  }[];
}

interface HistoricalSummaryPreview {
  summary: {
    snapshotId?: string | null;
    companiesCount?: number | null;
    dateRange?: { recordCount?: number | null } | null;
  } | null;
  snapshotHeader: string | null;
  manifestHeader: string | null;
}

function SummaryCount({ value }: { value: number | null | undefined }) {
  return <>{typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "Unavailable — not returned"}</>;
}

function SnapshotDate({ value }: { value: string | null }) {
  if (!value) return <>Not supplied</>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="break-all">{value}</span>;
  return <time dateTime={value} className="break-words">{date.toLocaleString()} ({value})</time>;
}

export function AnalysisSnapshotStatus() {
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const current = useQuery<SnapshotStatus>({
    queryKey: ["/api/analysis/snapshot-status"],
  });
  const inventory = useInfiniteQuery({
    queryKey: ["/api/analysis/snapshots", "workbook-baseline"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<SnapshotsResponse> => {
      const query = new URLSearchParams({ kind: "workbook-baseline" });
      if (pageParam) query.set("after", pageParam);
      const response = await apiRequest("GET", `/api/analysis/snapshots?${query}`);
      return response.json();
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const history = { ...inventory, data: inventory.data ? {
    status: inventory.data.pages[0].status,
    items: inventory.data.pages.flatMap(page => page.items),
  } : undefined };
  const workbookSnapshots = history.data?.status === "available"
    ? history.data.items.filter((item) => item.kind === "workbook-baseline")
    : [];
  const selectionAvailable = workbookSnapshots.some((item) => item.id === selectedSnapshotId);
  const preview = useQuery<HistoricalSummaryPreview>({
    queryKey: ["historical-workbook-summary-preview", selectedSnapshotId],
    enabled: selectionAvailable,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/cv/summary?snapshotId=${encodeURIComponent(selectedSnapshotId)}`,
      );
      return {
        summary: await response.json(),
        snapshotHeader: response.headers.get("X-Analysis-Snapshot"),
        manifestHeader: response.headers.get("X-Analysis-Manifest"),
      };
    },
  });

  return (
    <Card data-testid="analysis-snapshot-status">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Analysis snapshots</h2>
          <p className="text-sm text-muted-foreground">
            Historical workbook snapshots are immutable. They are not refreshed with live financial
            overlays; current financial data does not update these historical records.
          </p>
        </div>
        <section aria-labelledby="current-snapshot-heading" className="space-y-2">
          <h3 id="current-snapshot-heading" className="text-sm font-semibold">Current source identity</h3>
          {current.isError ? (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-muted-foreground">Snapshot status could not be loaded. Availability is unknown.</p>
              <Button size="sm" variant="outline" onClick={() => void current.refetch()} disabled={current.isFetching}>Retry snapshot status</Button>
            </div>
          ) : current.isLoading ? (
            <div role="status" aria-label="Loading snapshot status" className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : current.data ? (
            <>
              <Badge variant="outline" data-testid="snapshot-status">{current.data.status}</Badge>
              {current.data.status === "not-provisioned" && (
                <p className="text-sm text-muted-foreground">No analysis snapshot is provisioned in this environment.</p>
              )}
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="min-w-0 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Full snapshot ID</dt>
                  <dd className="font-mono break-all" data-testid="snapshot-source-id">{current.data.snapshotId ?? "Not supplied"}</dd>
                </div>
                <div><dt className="text-xs text-muted-foreground">Companies</dt><dd>{current.data.companyCount?.toLocaleString() ?? "Unavailable"}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Observations</dt><dd>{current.data.observationCount?.toLocaleString() ?? "Unavailable"}</dd></div>
                <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-muted-foreground">Created</dt><dd><SnapshotDate value={current.data.createdAt} /></dd></div>
                <div className="min-w-0 sm:col-span-2"><dt className="text-xs text-muted-foreground">Source note</dt><dd className="whitespace-pre-wrap break-words">{current.data.sourceNote || "Not supplied"}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Current financial overlays applied</dt><dd>No</dd></div>
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Snapshot status is unavailable. No source identity was returned.</p>
          )}
        </section>
        <section aria-labelledby="snapshot-history-heading" className="border-t pt-3 space-y-2">
          <h3 id="snapshot-history-heading" className="text-sm font-semibold">Historical workbook snapshot inventory</h3>
          {history.isError ? (
            <div role="alert" className="space-y-2">
              <p className="text-sm text-muted-foreground">The snapshot inventory could not be loaded. This does not establish whether snapshots exist.</p>
              <Button size="sm" variant="outline" onClick={() => void history.refetch()} disabled={history.isFetching}>Retry snapshot inventory</Button>
            </div>
          ) : history.isLoading ? (
            <div role="status" aria-label="Loading snapshot inventory"><Skeleton className="h-16 w-full" /></div>
          ) : history.data ? (
            <>
              <Badge variant="outline">{history.data.status}</Badge>
              {history.data.status === "not-provisioned" ? (
                <p className="text-sm text-muted-foreground">Historical snapshots are not provisioned in this environment.</p>
              ) : history.data.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">The inventory returned no historical snapshots.</p>
              ) : (
                <ul className="space-y-3" aria-label="Historical snapshots">
                  {history.data.items.map((item) => (
                    <li key={item.id} className="rounded-md border p-3 text-sm space-y-2">
                      <dl className="space-y-2">
                        <div><dt className="text-xs text-muted-foreground">Full snapshot ID</dt><dd className="font-mono break-all">{item.id}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Kind</dt><dd className="break-words">{item.kind}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Coverage</dt><dd>{item.companyCount.toLocaleString()} companies · {item.observationCount.toLocaleString()} observations</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Created</dt><dd><SnapshotDate value={item.createdAt} /></dd></div>
                      </dl>
                    </li>
                  ))}
                </ul>
              )}
              {inventory.hasNextPage && (
                <Button size="sm" variant="outline" disabled={inventory.isFetchingNextPage}
                  onClick={() => void inventory.fetchNextPage()}>
                  {inventory.isFetchingNextPage ? "Loading more snapshots…" : "Load more workbook snapshots"}
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Snapshot inventory is unavailable. No inventory response was returned.</p>
          )}
        </section>
        <section aria-labelledby="historical-summary-heading" className="border-t pt-3 space-y-3">
          <div className="space-y-1">
            <h3 id="historical-summary-heading" className="text-sm font-semibold">
              Historical workbook summary preview — not a full historical analysis switch
            </h3>
            <p id="historical-summary-description" className="text-sm text-muted-foreground">
              Read-only preview of one immutable workbook baseline. Selection changes only this
              summary; it does not change the current source or any other page. Reproducible
              workbook records do not establish validated climate inference.
            </p>
          </div>
          <div className="space-y-2">
            <label htmlFor="historical-workbook-selection" className="text-sm font-medium">
              Workbook baseline
            </label>
            <select
              id="historical-workbook-selection"
              data-testid="historical-workbook-selection"
              aria-describedby="historical-summary-description"
              className="flex h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={selectedSnapshotId}
              onChange={(event) => setSelectedSnapshotId(event.target.value)}
              disabled={history.isLoading || history.isError || workbookSnapshots.length === 0}
            >
              <option value="">Select a workbook baseline to preview</option>
              {selectedSnapshotId && !selectionAvailable && (
                <option value={selectedSnapshotId}>Previously selected baseline is unavailable</option>
              )}
              {workbookSnapshots.map((item) => (
                <option key={item.id} value={item.id}>{item.id}</option>
              ))}
            </select>
          </div>
          <div aria-live="polite" aria-busy={selectionAvailable && preview.isFetching}>
            {history.isLoading ? (
              <div role="status" aria-label="Loading workbook baseline choices" className="space-y-2">
                <p className="text-sm text-muted-foreground">Loading workbook baseline choices…</p>
                <Skeleton className="h-16 w-full" />
              </div>
            ) : history.isError ? (
              <p className="text-sm text-muted-foreground">Preview unavailable because the snapshot inventory could not be loaded. Use Retry snapshot inventory above.</p>
            ) : !history.data || history.data.status === "not-provisioned" ? (
              <p className="text-sm text-muted-foreground">Historical workbook summary preview is unavailable: no snapshot inventory is provisioned or supplied.</p>
            ) : workbookSnapshots.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workbook-baseline snapshots are available for preview. Other snapshot kinds cannot be selected.</p>
            ) : !selectedSnapshotId ? (
              <p className="text-sm text-muted-foreground">Select a workbook baseline to load its summary and response provenance.</p>
            ) : !selectionAvailable ? (
              <p className="text-sm text-muted-foreground">The selected workbook baseline is no longer available. Select another baseline.</p>
            ) : preview.isError ? (
              <div role="alert" className="space-y-2">
                <p className="text-sm text-muted-foreground">The selected historical summary could not be loaded. No summary is shown; no current-data fallback is used.</p>
                <Button size="sm" variant="outline" onClick={() => void preview.refetch()} disabled={preview.isFetching}>Retry historical summary</Button>
              </div>
            ) : preview.isFetching || preview.isLoading ? (
              <div role="status" aria-label="Loading historical workbook summary" className="space-y-2">
                <p className="text-sm text-muted-foreground">Loading selected historical workbook summary…</p>
                <Skeleton className="h-20 w-full" />
              </div>
            ) : preview.data ? (
              <div className="space-y-3">
                {(!preview.data.summary?.snapshotId || !preview.data.snapshotHeader || !preview.data.manifestHeader) && (
                  <p role="status" className="text-sm text-muted-foreground">Response provenance is incomplete. Missing identifiers are unavailable, not inferred from your selection.</p>
                )}
                {((preview.data.summary?.snapshotId && preview.data.summary.snapshotId !== selectedSnapshotId) ||
                  (preview.data.snapshotHeader && preview.data.snapshotHeader !== selectedSnapshotId)) && (
                  <p role="alert" className="text-sm font-medium">Snapshot identity mismatch: the response does not confirm the selected baseline. Returned values are shown below; do not treat them as the selected historical summary.</p>
                )}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm" data-testid="historical-summary-preview">
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Returned snapshotId</dt>
                    <dd className="font-mono break-all">{preview.data.summary?.snapshotId || "Unavailable — not returned"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total companies (companiesCount)</dt>
                    <dd><SummaryCount value={preview.data.summary?.companiesCount} /></dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Total records (dateRange.recordCount)</dt>
                    <dd><SummaryCount value={preview.data.summary?.dateRange?.recordCount} /></dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Response X-Analysis-Snapshot</dt>
                    <dd className="font-mono break-all">{preview.data.snapshotHeader || "Unavailable — header not returned"}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Response X-Analysis-Manifest</dt>
                    <dd className="font-mono break-all">{preview.data.manifestHeader || "Unavailable — header not returned"}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Historical summary unavailable. No response was returned.</p>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

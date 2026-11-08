import { useQuery } from "@tanstack/react-query";
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
  items: {
    id: string;
    kind: string;
    companyCount: number;
    observationCount: number;
    createdAt: string | null;
  }[];
}

function SnapshotDate({ value }: { value: string | null }) {
  if (!value) return <>Not supplied</>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <span className="break-all">{value}</span>;
  return <time dateTime={value} className="break-words">{date.toLocaleString()} ({value})</time>;
}

export function AnalysisSnapshotStatus() {
  const current = useQuery<SnapshotStatus>({
    queryKey: ["/api/analysis/snapshot-status"],
  });
  const history = useQuery<SnapshotsResponse>({
    queryKey: ["/api/analysis/snapshots"],
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
          <h3 id="snapshot-history-heading" className="text-sm font-semibold">Historical snapshot inventory</h3>
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
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Snapshot inventory is unavailable. No inventory response was returned.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

import { useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

/** Read failures must not be presented as zero observations or successful empty results. */
export function QueryReadErrors({ prefix }: { prefix: string }) {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const subscribe = useCallback((notify: () => void) => cache.subscribe(notify), [cache]);
  const snapshot = useCallback(() => cache.getAll()
    .filter(q => q.isActive() && String(q.queryKey[0]).startsWith(prefix) && q.state.status === "error")
    .map(q => String(q.queryKey[0])).sort().join(", "), [cache, prefix]);
  const failed = useSyncExternalStore(subscribe, snapshot, snapshot);
  if (!failed) return null;
  return (
    <aside role="alert" className="rounded-md border p-4 text-sm space-y-2">
      <p>Some existing results could not be loaded. Missing results are unavailable, not zero; no substitute values are provided.</p>
      <p className="break-all">Failed current reads: {failed}</p>
      <Button variant="outline" size="sm" onClick={() => void client.invalidateQueries({
        predicate: q => q.isActive() && String(q.queryKey[0]).startsWith(prefix) && q.state.status === "error",
      })}>Retry reads</Button>
    </aside>
  );
}

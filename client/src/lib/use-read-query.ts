import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

/**
 * Read-only evidence views must not keep displaying a previous successful result
 * while its current read is pending or has failed. Query keys still own selection
 * identity; this does not substitute data or change the server/cache.
 */
export function useReadQuery<T>(options: UseQueryOptions<T, Error, T>) {
  const client = useQueryClient();
  const query = useQuery<T, Error, T>(options);
  // React Query's SSR observer optimistically reports "fetching" for stale
  // cached data even though no fetch starts during static rendering. Preserve
  // that ready cache on the server, but still withhold it for a real in-flight
  // read. Browser optimistic fetches remain fail-closed from their first render.
  const readPending = query.isFetching && (typeof window !== "undefined" ||
    client.getQueryState(options.queryKey)?.fetchStatus === "fetching");
  return {
    ...query,
    data: query.isError || readPending ? undefined : query.data,
    isLoading: query.isLoading || readPending,
  };
}

import { useReadQuery } from "@/lib/use-read-query";
import { fetchCleanCoveredDocument, CLEAN_COVERED_ROUTE } from "@/lib/clean-covered-reader";

export const CLEAN_COVERED_QUERY_KEY = [CLEAN_COVERED_ROUTE] as const;
export function useCleanCovered() {
  return useReadQuery({
    queryKey: CLEAN_COVERED_QUERY_KEY, queryFn: fetchCleanCoveredDocument,
    staleTime: Infinity, structuralSharing: false, retry: false,
  });
}

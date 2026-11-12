import { useReadQuery } from "@/lib/use-read-query";
import { fetchProducerReserveDocument, PRODUCER_RESERVE_ROUTE } from "@/lib/producer-reserve-reader";

export const PRODUCER_RESERVE_QUERY_KEY = [PRODUCER_RESERVE_ROUTE] as const;
export function useProducerReserve() {
  return useReadQuery({
    queryKey: PRODUCER_RESERVE_QUERY_KEY,
    queryFn: fetchProducerReserveDocument,
    staleTime: Infinity,
    structuralSharing: false,
    retry: false,
  });
}

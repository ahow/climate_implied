import { useReadQuery } from "@/lib/use-read-query";
import { fetchRetirementAssociationDocument, RETIREMENT_ASSOCIATION_ROUTE } from "@/lib/retirement-association-reader";

export const RETIREMENT_ASSOCIATION_QUERY_KEY = [RETIREMENT_ASSOCIATION_ROUTE] as const;
export function useRetirementAssociation() {
  return useReadQuery({
    queryKey: RETIREMENT_ASSOCIATION_QUERY_KEY, queryFn: fetchRetirementAssociationDocument,
    staleTime: Infinity, structuralSharing: false, retry: false,
  });
}

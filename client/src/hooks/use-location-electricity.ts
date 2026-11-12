import { useReadQuery } from "@/lib/use-read-query";
import { fetchLocationElectricityDocument, LOCATION_ELECTRICITY_ROUTE } from "@/lib/location-electricity-reader";

export const LOCATION_ELECTRICITY_QUERY_KEY = [LOCATION_ELECTRICITY_ROUTE] as const;
export function useLocationElectricity() {
  return useReadQuery({
    queryKey: LOCATION_ELECTRICITY_QUERY_KEY, queryFn: fetchLocationElectricityDocument,
    staleTime: Infinity, structuralSharing: false, retry: false,
  });
}

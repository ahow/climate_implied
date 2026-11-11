import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { getConditionalCompanySummary } from "@shared/companyConditionalData";

export const COMPANY_CONDITIONAL_QUERY_KEY = ["/api/cv/company-conditional-summaries"] as const;

export function useCompanyConditionalSummaries() {
  return useQuery<ReturnType<typeof getConditionalCompanySummary>>({
    queryKey: COMPANY_CONDITIONAL_QUERY_KEY,
    queryFn: async () => {
      const response = await apiRequest("GET", COMPANY_CONDITIONAL_QUERY_KEY[0]);
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Public conditional-summary service is not available.");
      }
      const summary = await response.json();
      if (summary.schemaVersion !== "company-conditional-public-1" || !Array.isArray(summary.companies)) {
        throw new Error("Public conditional-summary contract was not recognized.");
      }
      return summary;
    },
    staleTime: Infinity,
    retry: false,
  });
}

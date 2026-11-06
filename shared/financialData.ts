export interface FinancialProviderStatus {
  configured: boolean;
  state: "not-configured" | "checking" | "verified" | "error";
  checkedAt: string | null;
  error: string | null;
  symbol: string;
  quote: { price: number; currency: string; timestamp: number } | null;
  financialPeriod: string | null;
  reportedCurrency: string | null;
  filingDate: string | null;
  refreshMode: "startup-diagnostic-only";
  approvedUpdatesEnabled: false;
  limitations: string[];
}

import { fmpRequest } from "./provider";
import type { FinancialProviderStatus } from "../../shared/financialData";

let inFlight: Promise<void> | undefined;
let status: FinancialProviderStatus = {
  configured: !!process.env.FMP_API_KEY, state: "not-configured", checkedAt: null,
  error: null, symbol: "AAPL", quote: null, financialPeriod: null,
  reportedCurrency: null, filingDate: null, refreshMode: "startup-diagnostic-only",
  approvedUpdatesEnabled: false,
  limitations: [
    "AAPL is a provider-connectivity sample, not a mapped portfolio or trading recommendation.",
    "No workbook data or approved company records are modified.",
    "Prices are a timestamped snapshot, not a streaming feed.",
    "OpenFIGI/FMP matching still requires issuer and listing review.",
    "FMP ESG ratings are not substitutes for carbon emissions or MSCI SDG scores.",
  ],
};
export function financialProviderStatus(): FinancialProviderStatus { return { ...status }; }

/** Three bounded requests once per process. Public GET never triggers spending. */
export function checkFinancialProvider(): Promise<void> {
  if (inFlight) return inFlight;
  if (!process.env.FMP_API_KEY) return Promise.resolve();
  status = { ...status, configured: true, state: "checking" };
  inFlight = (async () => {
    try {
      const [[quote], [profile], [statement]] = await Promise.all([
        fmpRequest("quote", { symbol: "AAPL" }),
        fmpRequest("profile", { symbol: "AAPL" }),
        fmpRequest("income-statement", { symbol: "AAPL", limit: "1" }),
      ]);
      if (!quote || quote.symbol !== "AAPL" || typeof quote.price !== "number" ||
          !Number.isFinite(quote.price) || quote.price <= 0 || typeof quote.timestamp !== "number" ||
          !Number.isFinite(quote.timestamp) || !profile || profile.symbol !== "AAPL" ||
          typeof profile.currency !== "string" || !statement || statement.symbol !== "AAPL") {
        throw new Error("Provider sample failed identity/price validation");
      }
      status = { ...status, state: "verified", checkedAt: new Date().toISOString(),
        quote: { price: quote.price, currency: profile.currency, timestamp: quote.timestamp },
        financialPeriod: typeof statement.date === "string" ? statement.date : null,
        reportedCurrency: typeof statement.reportedCurrency === "string" ? statement.reportedCurrency : null,
        filingDate: typeof statement.filingDate === "string" ? statement.filingDate : null };
    } catch (error) {
      status = { ...status, state: "error", checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Provider check failed" };
    }
  })();
  return inFlight;
}

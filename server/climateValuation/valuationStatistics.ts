/** Descriptive cross-sectional statistics, not time-series confidence intervals. */
import { qualifiedSourceAmount, type MonetarySourceRow } from "../financialData/workbookMoneyConsumers";
export function summarizeRates(values: number[]) {
  if (!values.length || values.some(v => !Number.isFinite(v))) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const quantile = (p: number) => {
    const index = p * (sorted.length - 1);
    const lo = Math.floor(index);
    return sorted[lo] + (sorted[Math.ceil(index)] - sorted[lo]) * (index - lo);
  };
  return { count: sorted.length, mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
    median: quantile(.5), p25: quantile(.25), p75: quantile(.75) };
}

export function positivePE(record: {
  priceEarnings: number | null; marketCap: number | null; netProfit: number | null;
} & Partial<Omit<MonetarySourceRow, "marketCap" | "netProfit">>): number | null {
  if (record.priceEarnings != null && Number.isFinite(record.priceEarnings) && record.priceEarnings > 0) {
    return record.priceEarnings;
  }
  if (record.marketCap == null || !Number.isFinite(record.marketCap) || record.marketCap <= 0 ||
      record.netProfit == null || !Number.isFinite(record.netProfit) || record.netProfit <= 0) return null;
  if (record.companyId === undefined || !record.date) return null;
  const source = { ...record, companyId: record.companyId, date: record.date };
  const cap = qualifiedSourceAmount(source, "marketCap"), profit = qualifiedSourceAmount(source, "netProfit");
  if (cap.value === null || profit.value === null || profit.value <= 0) return null;
  const pe = cap.value / profit.value;
  return Number.isFinite(pe) && pe > 0 ? pe : null;
}

/** Descriptive cross-sectional statistics, not time-series confidence intervals. */
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
}): number | null {
  if (record.priceEarnings != null && Number.isFinite(record.priceEarnings) && record.priceEarnings > 0) {
    return record.priceEarnings;
  }
  if (record.marketCap == null || !Number.isFinite(record.marketCap) || record.marketCap <= 0 ||
      record.netProfit == null || !Number.isFinite(record.netProfit) || record.netProfit <= 0) return null;
  const pe = record.marketCap / record.netProfit;
  return Number.isFinite(pe) && pe > 0 ? pe : null;
}

const unsupported = new Set([
  "impliedTemperature", "impliedCarbonPrice", "impliedDecarbRate", "netZeroYear",
  "projectedRate", "gap", "medianImpliedRate", "meanImpliedRate",
  "p25ImpliedRate", "p75ImpliedRate",
]);
/** Decimal rate, never a hard-coded 8% label for a variable-r result. */
export function gordonBaselineMetadata(costOfEquity: number) {
  if (!Number.isFinite(costOfEquity) || costOfEquity <= 0 || costOfEquity > 1)
    throw new Error("Gordon cost of equity must be finite and in (0,1]");
  return {
    costOfEquity,
    gordonBaselineLabel: `Gordon baseline (r = ${Number((costOfEquity * 100).toPrecision(12))}%)`,
    gordonDefinition: "g = r - 1/PE; fully distributable earnings; steady-state comparator, not five-year reverse-DCF growth or a physical decarbonisation rate",
  };
}
/** Keep descriptive input rows, but never publish unsupported physical claims. */
export function publicValuationResult(value: unknown, stripPhysicalDistribution = false): unknown {
  if (Array.isArray(value)) return value.map(item => publicValuationResult(item, stripPhysicalDistribution));
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !unsupported.has(key) && !(stripPhysicalDistribution && key === "distribution"))
    .map(([key, item]) => [key, publicValuationResult(item, stripPhysicalDistribution)]));
}

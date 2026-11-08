const unsupported = new Set([
  "impliedTemperature", "impliedCarbonPrice", "impliedDecarbRate", "netZeroYear",
  "projectedRate", "gap", "medianImpliedRate", "meanImpliedRate",
]);
/** Keep descriptive input rows, but never publish unsupported physical claims. */
export function publicValuationResult(value: unknown, stripPhysicalDistribution = false): unknown {
  if (Array.isArray(value)) return value.map(item => publicValuationResult(item, stripPhysicalDistribution));
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !unsupported.has(key) && !(stripPhysicalDistribution && key === "distribution"))
    .map(([key, item]) => [key, publicValuationResult(item, stripPhysicalDistribution)]));
}

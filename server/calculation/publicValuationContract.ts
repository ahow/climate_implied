const unsupported = new Set([
  "impliedTemperature", "impliedCarbonPrice", "impliedDecarbRate", "netZeroYear",
]);
/** Keep descriptive input rows, but never publish unsupported physical claims. */
export function publicValuationResult(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicValuationResult);
  if (value === null || typeof value !== "object" || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !unsupported.has(key))
    .map(([key, item]) => [key, publicValuationResult(item)]));
}

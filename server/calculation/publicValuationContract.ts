import { GORDON_DEFINITION, gordonLabelFromPercent } from "../../shared/quantityDescriptors";
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
    gordonBaselineLabel: gordonLabelFromPercent(costOfEquity * 100),
    gordonDefinition: GORDON_DEFINITION,
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

/** Closed, deterministic consumer registry. This module describes/replays a
 * derivation; it cannot authenticate a parent or accept a UI-supplied proof. */
export const valuationPEDerivations = {
  carbon: { scenario: "descriptive-valuation:/carbon-price",
    high: "bottomTercilePeRatio", low: "topTercilePeRatio",
    highKey: "cleanPE", lowKey: "dirtyPE",
    highCount: "bottomTercileCompanyCount", lowCount: "topTercileCompanyCount",
    highLabel: "Low Carbon (Clean)", lowLabel: "High Carbon (Dirty)" },
  sdg: { scenario: "descriptive-valuation:/sdg-growth",
    high: "cleanPE", low: "dirtyPE", highKey: "cleanPE", lowKey: "dirtyPE",
    highCount: "cleanCount", lowCount: "dirtyCount",
    highLabel: "Positive SDG (Clean)", lowLabel: "Negative SDG (Dirty)" },
  ambition: { scenario: "descriptive-valuation:/decarb-terciles",
    high: "bestTercilePE", low: "worstTercilePE", highKey: "bestPE", lowKey: "worstPE",
    highCount: "bestTercileCompanyCount", lowCount: "worstTercileCompanyCount",
    highLabel: "Most Ambitious", lowLabel: "Least Ambitious" },
} as const;
export type ValuationPEDerivation = keyof typeof valuationPEDerivations;

/** Same finite-JSON canonicalization as the retained server result contract. */
export function consumerCanonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(consumerCanonicalJson).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${consumerCanonicalJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error("Consumer identity requires explicit finite JSON");
}
export function derivedRoundedPE(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const rounded = Math.round(value * 100) / 100;
  return Number.isFinite(rounded) ? rounded : undefined;
}
function timestamp(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : undefined;
}
export function deriveValuationPE(parent: unknown, key: ValuationPEDerivation) {
  if (!Object.hasOwn(valuationPEDerivations, key)) throw new Error("Unknown consumer derivation");
  if (!Array.isArray(parent) || parent.some(row => !row || typeof row !== "object" || Array.isArray(row)))
    throw new Error("P/E derivation requires observation records");
  const spec = valuationPEDerivations[key];
  const chartRows: Array<{ date?: number; [key: string]: unknown }> = [];
  const rows: Array<{ Date: string; [key: string]: string | number | null | undefined }> = [];
  const retainedIndices: number[] = [], excludedIndices: number[] = [];
  parent.forEach((source, index) => {
    const date = timestamp(source.date);
    const high = derivedRoundedPE(source[spec.high]), low = derivedRoundedPE(source[spec.low]);
    chartRows.push({ date, [spec.highKey]: high, [spec.lowKey]: low,
      [key === "ambition" ? "bestCount" : "cleanCount"]: source[spec.highCount],
      [key === "ambition" ? "worstCount" : "dirtyCount"]: source[spec.lowCount] });
    if (date === undefined) { excludedIndices.push(index); return; }
    retainedIndices.push(index);
    rows.push({ Date: new Date(date).toLocaleDateString("en-US",
      { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }),
    [`${spec.highLabel} P/E (x)`]: high ?? null, [`${spec.lowLabel} P/E (x)`]: low ?? null });
  });
  return { chartRows, rows, derivation: {
    version: "valuation-pe-consumer-1", key, scenario: spec.scenario,
    fields: { Date: "date", [`${spec.highLabel} P/E (x)`]: spec.high, [`${spec.lowLabel} P/E (x)`]: spec.low },
    filter: "Exclude only missing/invalid observation dates; no inferred dates or P/E-value filtering",
    order: "Preserve parent array order, including duplicate dates; no sorting or deduplication",
    retainedIndices, excludedIndices,
    transformation: "P/E Math.round(value * 100) / 100; unavailable/nonfinite/overflow -> null. Date parsed as JavaScript Date, rendered en-US UTC year/numeric month/short day/numeric",
    chartFields: { date: "date", [spec.highKey]: spec.high, [spec.lowKey]: spec.low,
      [key === "ambition" ? "bestCount" : "cleanCount"]: spec.highCount,
      [key === "ambition" ? "worstCount" : "dirtyCount"]: spec.lowCount },
    chartTransformation: "Same retained observation indices/order and rounded P/E values as exported rows; date is parsed UTC epoch milliseconds. Counts are identity-mapped native fields. Missing chart fields hash as explicit null. Chart display omits invalid-date observations.",
    chartUnits: { date: "milliseconds since Unix epoch (UTC)", pe: "dimensionless multiple (x)",
      counts: "native group company count; unavailable is not zero" },
    units: { Date: "UTC calendar observation date", [`${spec.highLabel} P/E (x)`]: "dimensionless multiple (x)",
      [`${spec.lowLabel} P/E (x)`]: "dimensionless multiple (x)" },
    missingness: "Unavailable P/E stays null/blank, never zero; genuine zero retained",
  } };
}

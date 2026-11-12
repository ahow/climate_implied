/** S09-001 original child clauses, not interchangeable vintage claims. */
export const HISTORICAL_TYPES = {
  ACTUAL_ARCHIVED_FORECAST: "Actual archived forecast",
  VERIFIED_PAST_INPUT_SIMULATION: "Retrospective simulation on verified past inputs",
  REVISED_HISTORY_RECONSTRUCTION: "Revised-history reconstruction",
} as const;
export type HistoricalTypeCode = keyof typeof HISTORICAL_TYPES;
export function historicalType(code: HistoricalTypeCode) {
  return { historicalTypeCode: code, historicalTypeLabel: HISTORICAL_TYPES[code] };
}
export const revisedHistoryType = historicalType("REVISED_HISTORY_RECONSTRUCTION");
/** Unknown/legacy outputs must not be silently relabelled or exported as certified history. */
export function requireHistoricalType(input: {
  historicalTypeCode?: unknown; historicalTypeLabel?: unknown;
}) {
  const code = input.historicalTypeCode;
  if (typeof code !== "string" || !Object.hasOwn(HISTORICAL_TYPES, code) ||
      input.historicalTypeLabel !== HISTORICAL_TYPES[code as HistoricalTypeCode])
    throw new Error("Historical type missing or inconsistent; no vintage label substituted");
  return { "Historical type code": code, "Historical type label": input.historicalTypeLabel as string };
}

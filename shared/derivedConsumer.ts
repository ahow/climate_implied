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

export type SignalConsumerKey = "signal-comparison" | "group-gap" |
  "signal-cumulative" | "signal-active" | "gap-cumulative" | "gap-active";
export type SignalConsumerSelection = "carbon_intensity" | "sdg_exposure" |
  "decarb_ambition" | "sdg_alignment";
/** Preserve the concrete native-consumer column domain in callers' types.
 * Dynamic finite labels still require finiteExportSchemas certification; these
 * types do not authenticate a parent or grant runtime semantic coverage. */
export type SignalConsumerRow<K extends SignalConsumerKey> =
  K extends "signal-comparison" ? {
    Date: string; "Carbon intensity group earnings-yield gap (pp)": number | null;
    "SDG group earnings-yield gap (pp)": number | null; "Ambition group earnings-yield gap (pp)": number | null;
  } : K extends "signal-active" ? {
    Date: string | number; "Active Return (%)": number | null; "Tracking Error (ann.) (%)": number | null;
  } : K extends "gap-active" ? {
    Date: string | number; "Active Return (%)": number | null; "Tracking Error (ann. %)": number | null;
  } : K extends "gap-cumulative" ? {
    Date: string | number; "Benchmark Cumulative Return (%)": number | null;
    "Legacy peer-yield ranking cumulative return (%)": number | null;
  } : K extends "signal-cumulative" ? {
    Date: string | number; "Benchmark Cumulative Return (%)": number | null;
    [column: string]: string | number | null;
  } : { Date: string | number; [column: string]: string | number | null };
const signalSpecs = {
  carbon_intensity: { pe: "carbon", chart: "carbonIntensity", label: "Carbon Intensity" },
  sdg_exposure: { pe: "sdg", chart: "sdgExposure", label: "SDG Exposure" },
  sdg_alignment: { pe: "sdg", chart: "sdgExposure", label: "SDG Alignment" },
  decarb_ambition: { pe: "ambition", chart: "decarbAmbition", label: "Decarb Ambition" },
} as const;
const comparisonColumns = [
  "Carbon intensity group earnings-yield gap (pp)", "SDG group earnings-yield gap (pp)",
  "Ambition group earnings-yield gap (pp)",
];
function gap(first: unknown, second: unknown): number | null {
  if (typeof first !== "number" || !Number.isFinite(first) || first <= 0 ||
      typeof second !== "number" || !Number.isFinite(second) || second <= 0) return null;
  // Preserve the actual UI's subtraction order, including floating-point effects.
  const result = (8 - 100 / first) - (8 - 100 / second);
  return Number.isFinite(result) ? result : null;
}
function percent(value: unknown, cumulative = false): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const result = Math.round((value - (cumulative ? 1 : 0)) * 10000) / 100;
  return Number.isFinite(result) ? result : null;
}
function monthLabel(date: number) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
/** Closed replay of the signal pages' real chart -> export chains. Undefined
 * parents permit partial rendering, but the client binding refuses their export.
 * Backtest parents are WHOLE responses (summary + series), never detached series. */
export function deriveSignalConsumer<K extends SignalConsumerKey>(
  parents: readonly unknown[], key: K, selection: SignalConsumerSelection,
) {
  if (!["signal-comparison", "group-gap", "signal-cumulative", "signal-active",
    "gap-cumulative", "gap-active"].includes(key) || !Object.hasOwn(signalSpecs, selection))
    throw new Error("Unknown signal consumer derivation");
  if ((key === "signal-comparison" && selection !== "carbon_intensity") ||
      ((key === "group-gap" || key.startsWith("gap-")) && selection === "sdg_exposure") ||
      ((key === "signal-cumulative" || key === "signal-active") && selection === "sdg_alignment"))
    throw new Error("Signal consumer selection is outside its closed domain");
  const spec = signalSpecs[selection];
  const valuation = key === "signal-comparison" || key === "group-gap";
  const joinedBacktest = key === "gap-cumulative" || key === "gap-active";
  const expectedCount = key === "signal-comparison" ? 3 : joinedBacktest ? 2 : 1;
  if (parents.length !== expectedCount) throw new Error("Signal consumer parent slots conflict");
  const scenarios = valuation
    ? (key === "signal-comparison" ? ["carbon", "sdg", "ambition"] as const : [spec.pe])
      .map(pe => valuationPEDerivations[pe].scenario)
    : parents.map(() => "descriptive-valuation:/backtest");
  const intermediates = parents.map((parent, parentIndex) => {
    const source = valuation ? parent : (parent as any)?.series;
    if (!valuation && parent != null && !Array.isArray(source))
      throw new Error("Signal derivation requires whole backtest response with series");
    if (source != null && (!Array.isArray(source) ||
      source.some(row => !row || typeof row !== "object" || Array.isArray(row))))
      throw new Error("Signal derivation requires observation records");
    const retainedIndices: number[] = [], excludedIndices: number[] = [];
    const rows: Record<string, any>[] = [];
    (source ?? []).forEach((row: any, index: number) => {
      const date = timestamp(row.date);
      if (date === undefined) { excludedIndices.push(index); return; }
      retainedIndices.push(index);
      if (valuation) {
        const pe = valuationPEDerivations[key === "signal-comparison"
          ? (["carbon", "sdg", "ambition"] as const)[parentIndex] : spec.pe];
        rows.push({ sourceIndex: index, date, dateLabel: monthLabel(date),
          value: gap(row[pe.high], row[pe.low]) });
      } else {
        rows.push({ sourceIndex: index, date: row.date,
          benchmark: percent(row.benchmarkCumulative, true),
          portfolio: percent(row.portfolioCumulative, true),
          activeReturn: percent(row.activeReturn), trackingError: percent(row.trackingError) });
      }
    });
    const pe = valuation ? valuationPEDerivations[key === "signal-comparison"
      ? (["carbon", "sdg", "ambition"] as const)[parentIndex] : spec.pe] : undefined;
    return { parentIndex, retainedIndices, excludedIndices, rows,
      fields: pe ? { date: "date", firstPE: pe.high, secondPE: pe.low }
        : { date: "series.date", benchmark: "series.benchmarkCumulative",
          portfolio: "series.portfolioCumulative", activeReturn: "series.activeReturn",
          trackingError: "series.trackingError" },
      units: pe ? "native P/E multiple -> percentage-point Gordon baseline difference; date epoch milliseconds"
        : "native decimal wealth/return/TE -> percent; original observation date" };
  });
  let chartRows: Record<string, any>[];
  if (valuation) {
    const map = new Map<number, Record<string, any>>();
    intermediates.forEach((stage, parentIndex) => stage.rows.forEach(row => {
      const chartKey = key === "group-gap" ? "impliedRate"
        : ["carbonIntensity", "sdgExposure", "decarbAmbition"][parentIndex];
      const existing = map.get(row.date) ?? { date: row.date, dateLabel: row.dateLabel };
      existing[chartKey] = row.value;
      map.set(row.date, existing);
    }));
    chartRows = Array.from(map.values()).sort((a, b) => a.date - b.date).map(row =>
      key === "signal-comparison" ? { date: row.date, dateLabel: row.dateLabel,
        carbonIntensity: row.carbonIntensity ?? null, sdgExposure: row.sdgExposure ?? null,
        decarbAmbition: row.decarbAmbition ?? null } : row);
  } else if (joinedBacktest) {
    const maps = intermediates.map(stage => new Map(stage.rows.map(row => [row.date, row])));
    chartRows = Array.from(new Set([...Array.from(maps[0].keys()), ...Array.from(maps[1].keys())])).sort().map(date => {
      const sd = maps[0].get(date), vd = maps[1].get(date);
      return { date, benchmark: (sd ?? vd)?.benchmark ?? null,
        portfolio: sd?.portfolio ?? null, valuation: vd?.portfolio ?? null,
        activeReturn: sd?.activeReturn ?? null, trackingError: sd?.trackingError ?? null };
    });
  } else {
    chartRows = intermediates[0].rows.map(({ sourceIndex, ...row }) => row);
  }
  const rows: Record<string, any>[] = chartRows.map(row => {
    if (key === "signal-comparison") return { Date: row.dateLabel,
      [comparisonColumns[0]]: row.carbonIntensity ?? null,
      [comparisonColumns[1]]: row.sdgExposure ?? null, [comparisonColumns[2]]: row.decarbAmbition ?? null };
    if (key === "group-gap") return { Date: row.dateLabel,
      [`Group earnings-yield gap - ${spec.label} (pp)`]: row.impliedRate ?? null };
    if (key.endsWith("active")) return { Date: row.date, "Active Return (%)": row.activeReturn,
      [joinedBacktest ? "Tracking Error (ann. %)" : "Tracking Error (ann.) (%)"]: row.trackingError };
    return { Date: row.date, "Benchmark Cumulative Return (%)": row.benchmark,
      [`${spec.label}${joinedBacktest ? "-Driven" : " Portfolio"} Cumulative Return (%)`]: row.portfolio,
      ...(joinedBacktest ? { "Legacy peer-yield ranking cumulative return (%)": row.valuation } : {}) };
  });
  const chartFields: Record<string, string> = valuation
    ? { date: "Parsed native observation date -> epoch milliseconds; union by timestamp",
      dateLabel: "Native date -> en-US short month/numeric year in dateLabelTimezone" }
    : { date: "series.date (unchanged)",
      benchmark: joinedBacktest ? "parents[0].series.benchmarkCumulative when primary date row exists, otherwise parents[1].series.benchmarkCumulative; cumulative percent transform"
        : "parents[0].series.benchmarkCumulative; cumulative percent transform",
      portfolio: "parents[0].series.portfolioCumulative; cumulative percent transform",
      activeReturn: "parents[0].series.activeReturn; decimal-to-percent transform",
      trackingError: "parents[0].series.trackingError; decimal-to-percent transform",
      ...(joinedBacktest ? { valuation: "parents[1].series.portfolioCumulative; cumulative percent transform" } : {}) };
  if (valuation) intermediates.forEach((stage, index) => {
    chartFields[key === "group-gap" ? "impliedRate" : ["carbonIntensity", "sdgExposure", "decarbAmbition"][index]] =
      `(8-100/parents[${index}].${stage.fields.firstPE})-(8-100/parents[${index}].${stage.fields.secondPE}); finite positive P/E only; last duplicate timestamp wins`;
  });
  const exportFields: Record<string, string> = { Date: valuation ? "chart.dateLabel" : "chart.date" };
  if (key === "signal-comparison") comparisonColumns.forEach((column, index) => {
    exportFields[column] = `chart.${["carbonIntensity", "sdgExposure", "decarbAmbition"][index]}`;
  });
  else if (key === "group-gap") exportFields[`Group earnings-yield gap - ${spec.label} (pp)`] = "chart.impliedRate";
  else if (key.endsWith("active")) {
    exportFields["Active Return (%)"] = "chart.activeReturn";
    exportFields[joinedBacktest ? "Tracking Error (ann. %)" : "Tracking Error (ann.) (%)"] = "chart.trackingError";
  } else {
    exportFields["Benchmark Cumulative Return (%)"] = "chart.benchmark";
    exportFields[`${spec.label}${joinedBacktest ? "-Driven" : " Portfolio"} Cumulative Return (%)`] = "chart.portfolio";
    if (joinedBacktest) exportFields["Legacy peer-yield ranking cumulative return (%)"] = "chart.valuation";
  }
  const columns = Object.keys(exportFields);
  return { rows: rows as SignalConsumerRow<K>[], chartRows, intermediates, scenarios, derivation: {
    version: "signal-chained-consumer-1", key, scenario: scenarios[0], selection,
    fields: exportFields,
    filter: "Exclude only missing/invalid dates per parent; retain missing values as null, never zero",
    order: valuation ? "Numeric timestamp union ascending; duplicate timestamp last observation per parent wins"
      : joinedBacktest ? "Exact native date-key union lexicographically sorted; duplicate exact key last per parent wins; benchmark signal row preferred even when its value is missing"
      : "Preserve parent series order and duplicates; no sorting/deduplication",
    retainedIndices: chartRows.map((_, index) => index), excludedIndices: [],
    transformation: valuation
      ? "(8 - 100 / firstPE) - (8 - 100 / secondPE); require finite positive P/E; nonfinite result null; no rounding. Date en-US short month/numeric year in captured browser timezone"
      : "Cumulative Math.round((value-1)*10000)/100; active/TE Math.round(value*10000)/100; nonfinite/unavailable/overflow null; original date unchanged",
    chartFields,
    chartTransformation: "Exact projected intermediates joined by declared order policy; exported rows project the same chart rows",
    chartUnits: { date: valuation ? "milliseconds since Unix epoch" : "native observation date",
      value: valuation ? "percentage points" : "percent" },
    units: Object.fromEntries(columns.map(column => [column, column === "Date"
      ? valuation ? "observation month label (en-US; captured browser timezone)" : "native observation date"
      : valuation ? "percentage points" : "percent"])),
    missingness: "Null/absent values remain unavailable; genuine zero retained; no inferred dates or source substitution",
    dateLabelTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  } };
}

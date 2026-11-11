/** Descriptive valuation diagnostics only; no valuation-to-emissions mapping. */
export function gordonBaselineLabel(costOfEquityPct = 8): string {
  if (!Number.isFinite(costOfEquityPct) || costOfEquityPct <= 0 || costOfEquityPct > 100)
    throw new Error("Gordon cost of equity must be finite and in (0,100]");
  return `Gordon baseline (r = ${Number(costOfEquityPct.toPrecision(12))}%)`;
}

/** Workbook interpretation notes use precisely the displayed/API label. */
export function gordonExportNotes(costOfEquityPct: number, semanticPrefix?: "sdg" | "targetTerciles") {
  const notes = [
    { Field: "Valuation baseline", Value: gordonBaselineLabel(costOfEquityPct) },
    { Field: "Gordon cost of equity (decimal)", Value: String(costOfEquityPct / 100) },
    { Field: "Gordon definition", Value: "g = r - 1/PE; fully distributable earnings; steady-state comparator, not five-year reverse-DCF growth or a physical decarbonisation rate" },
  ];
  const fields = ["gordonBaselineLabel", "costOfEquity", "gordonDefinition"];
  return notes.map((note, index) => semanticPrefix
    ? { ...note, SemanticField: `${semanticPrefix}.${fields[index]}` }
    : note);
}

/** Refuse stale/mismatched API assumptions rather than silently relabel values. */
export function verifyGordonBaselineRows(rows: unknown, costOfEquityPct: number): void {
  const label = gordonBaselineLabel(costOfEquityPct);
  if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object" ||
    row.costOfEquity !== costOfEquityPct / 100 || row.gordonBaselineLabel !== label))
    throw new Error("Gordon baseline API assumptions do not match the selected cost of equity");
}

export function gordonBaselinePct(pe: unknown, costOfEquityPct = 8): number | null {
  if (typeof pe !== "number" || !Number.isFinite(pe) || pe <= 0 || !Number.isFinite(costOfEquityPct) || costOfEquityPct <= 0 || costOfEquityPct > 100) return null;
  return costOfEquityPct - 100 / pe;
}

/** g(company) - g(peer) = EY(peer) - EY(company), in percentage points. */
export function earningsYieldGapPp(companyPE: unknown, peerPE: unknown): number | null {
  const company = gordonBaselinePct(companyPE);
  const peer = gordonBaselinePct(peerPE);
  return company === null || peer === null ? null : company - peer;
}

/** Selection chooses the definition; another present field is never a substitute. */
export function selectedGroupGapPp(row: unknown, measure: string): number | null {
  if (!row || typeof row !== "object") return null;
  const fields = row as Record<string, unknown>;
  if (measure === "sdg_alignment") return earningsYieldGapPp(fields.cleanPE, fields.dirtyPE);
  if (measure === "decarb_ambition") return earningsYieldGapPp(fields.bestTercilePE, fields.worstTercilePE);
  if (measure === "carbon_intensity") return earningsYieldGapPp(fields.bottomTercilePeRatio, fields.topTercilePeRatio);
  return null;
}

export function displayDiagnostic(value: unknown, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "Unavailable";
}

/** Null is an unavailable observation date, never the Unix epoch. */
export function observationTimestamp(value: unknown): number | undefined {
  if (typeof value !== "number" && (typeof value !== "string" || !value.trim())) return undefined;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function datedObservations<T extends { date?: unknown }>(rows?: readonly T[] | null): T[] {
  return Array.isArray(rows) ? rows.filter(row => row && observationTimestamp(row.date) !== undefined) : [];
}

export function hasUndatedObservations(rows: unknown): boolean {
  return rows != null && (!Array.isArray(rows) || rows.some(row => !row || observationTimestamp(row.date) === undefined));
}

export function tooltipObservation(value: unknown, field: string, suffix: string): string {
  return typeof value === "number" && Number.isFinite(value)
    ? displayDiagnostic(value, suffix) : `Unavailable — ${field} not returned for this observation`;
}

export function backtestPercent(value: unknown, cumulative = false): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const result = Math.round((value - (cumulative ? 1 : 0)) * 10000) / 100;
  return Number.isFinite(result) ? result : undefined;
}

export function backtestDisplay(value: unknown, digits = 2, signed = false): string {
  return typeof value === "number" && Number.isFinite(value)
    ? `${signed && value >= 0 ? "+" : ""}${value.toFixed(digits)}%` : "Unavailable — accounting not returned";
}

export function backtestDisplayStats(rows: readonly {
  benchmarkCumulative?: number | null; portfolioCumulative?: number | null; trackingError?: number | null;
  overweightCount?: number | null; underweightCount?: number | null;
}[] | undefined) {
  if (!rows?.length) return null;
  const last = rows[rows.length - 1];
  const valid = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  const percent = (value: unknown, cumulative = false) => {
    if (!valid(value)) return undefined;
    const result = (value - (cumulative ? 1 : 0)) * 100;
    return Number.isFinite(result) ? result : undefined;
  };
  const ratio = valid(last.benchmarkCumulative) && last.benchmarkCumulative > 0 &&
    valid(last.portfolioCumulative) && last.portfolioCumulative >= 0 ? last.portfolioCumulative / last.benchmarkCumulative : undefined;
  const meanCount = (key: "overweightCount" | "underweightCount") =>
    rows.every(row => valid(row[key]) && row[key]! >= 0) ? Math.round(rows.reduce((sum, row) => sum + row[key]!, 0) / rows.length) : undefined;
  return {
    benchmarkTotal: percent(last.benchmarkCumulative, true), portfolioTotal: percent(last.portfolioCumulative, true),
    annualizedActive: ratio === undefined ? undefined : percent(rows.length > 12 ? Math.pow(ratio, 12 / rows.length) : ratio, true),
    finalTE: percent(last.trackingError), avgGreen: meanCount("overweightCount"), avgBrown: meanCount("underweightCount"),
    months: rows.length,
  };
}

import { checkedWorkbookMoney, monetaryContext, type MoneyCellEvidence } from "./workbookMoney";
export interface MonetarySourceRow {
  companyId: number; date: Date | string; marketCap?: number | null; netProfit?: number | null;
  sourceCells?: Partial<Record<"marketCap" | "netProfit", {
    sourceId: string; sheet: string; cell: string; observationDate?: string; originalValue: number | null;
  }>>;
  derivations?: Record<string, { method: string }>;
  marketCapCurrency?: string | null;
}
export class MonetaryUnavailableError extends Error {
  readonly monetaryStatus = "unavailable-unconverted";
  readonly monetaryTotal = null;
  constructor(reason: string) { super(`Monetary amount/weight unavailable: ${reason}; no default USD or zero`); }
}
export function qualifiedSourceAmount(row: MonetarySourceRow, field: "marketCap" | "netProfit", informationCutoff?: string) {
  const context = monetaryContext.getStore(), source = row.sourceCells?.[field];
  const unavailable = (reason: string) => ({ value: null, evidence: null, reason });
  if (!context || context.targetCurrency !== "USD") return unavailable("trusted USD target evidence context missing");
  if (!source || !source.observationDate || source.originalValue !== row[field]) return unavailable("exact source cell/value/date missing");
  const observationDate = new Date(source.observationDate), rowDate = new Date(row.date);
  if (!Number.isFinite(observationDate.getTime()) || !Number.isFinite(rowDate.getTime())) return unavailable("invalid source/row date");
  if (observationDate.toISOString().slice(0, 10) !== rowDate.toISOString().slice(0, 10) &&
    (field !== "netProfit" || observationDate.toISOString().slice(0, 7) !== rowDate.toISOString().slice(0, 7) ||
      row.derivations?.netProfit?.method !== "unique-same-calendar-month-source-period-alignment; not-source-cell-infill"))
    return unavailable("unjustified cross-date source");
  const candidates = context.cells.filter(c => c.companyId === row.companyId && c.field === field && c.sourceId === source.sourceId &&
    c.sheet === source.sheet && c.cell === source.cell && c.observationDate === source.observationDate && c.nativeValue === row[field]);
  if (candidates.length !== 1) return unavailable("source-cell denomination metadata missing or ambiguous");
  if (field === "marketCap" && row.marketCapCurrency != null && row.marketCapCurrency !== candidates[0].nativeCurrency)
    return unavailable("explicit native currency metadata disagreement");
  const checked = checkedWorkbookMoney(candidates[0], informationCutoff && Date.parse(informationCutoff) < Date.parse(context.cutoff)
    ? { ...context, cutoff: informationCutoff } : context);
  return checked.value === null ? unavailable(checked.reason) : { value: checked.value, evidence: candidates[0], reason: "qualified-USD-millions" };
}
export interface QualifiedWeightSource { weightSource?: MoneyCellEvidence }
/** A lagged portfolio weight is itself a derived monetary consumer. Revalidate the original native
 * source/identity/FX, rather than trusting a USD label or a normalized number supplied by a caller. */
export function requireQualifiedWeight(row: { companyId: number; marketCap: number } & QualifiedWeightSource, returnMonth?: string): number {
  const context = monetaryContext.getStore(), evidence = row.weightSource;
  if (!context || context.targetCurrency !== "USD" || !evidence || evidence.field !== "marketCap" || evidence.companyId !== row.companyId)
    throw new MonetaryUnavailableError("exact monetary weight evidence missing");
  const match = context.cells.filter(c => JSON.stringify(c) === JSON.stringify(evidence));
  if (match.length !== 1) throw new MonetaryUnavailableError("weight source not uniquely present in authorized context");
  if (returnMonth && !/^\d{4}-(?:0[1-9]|1[0-2])$/.test(returnMonth))
    throw new MonetaryUnavailableError("invalid realized return month");
  if (returnMonth && evidence.observationDate.slice(0, 7) >= returnMonth)
    throw new MonetaryUnavailableError("weight source is not dated before the realized return month");
  const checked = checkedWorkbookMoney(evidence, context);
  if (checked.value === null || checked.value !== row.marketCap) throw new MonetaryUnavailableError(checked.value === null ? checked.reason : "normalized weight/source disagreement");
  return checked.value;
}
const monthlyStates = new WeakMap<object, string>();
export function markMonthlyMoneyUnavailable<T extends object>(data: T, reason: string): T { monthlyStates.set(data, reason); return data; }
export function monthlyMoneyUnavailable(data: object) { return monthlyStates.get(data) ?? null; }

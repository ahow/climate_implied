import { AsyncLocalStorage } from "node:async_hooks";
import { contentHash } from "../calculation/analysisManifest";
import { majorCurrency, normalizeMonetaryValue } from "./currencies";
export type MonetaryField = "marketCap" | "netProfit";
export type MoneyMagnitude = "units" | "thousands" | "millions";
export interface AcceptedMoneyIdentity {
  companyId: number; isin: string; reviewId: string; status: "approved"; reviewedAt: string;
}
export interface MoneyCellEvidence {
  companyId: number; isin: string; field: MonetaryField; sourceId: string; sheet: string; cell: string;
  observationDate: string; nativeValue: number; nativeCurrency: string | null; magnitude: MoneyMagnitude | null;
  denominationEvidenceHash: string | null;
}
export interface AuthorizedDatedFx {
  identityReviewId: string; isin: string; base: string; quote: string; date: string;
  quotePerBase: number; sourceHash: string; sourceUrl: string; authorizedAt: string;
}
export interface MonetaryContext {
  cutoff: string; targetCurrency: string; identities: AcceptedMoneyIdentity[];
  cells: MoneyCellEvidence[]; fx: AuthorizedDatedFx[];
}
/** Internal caller-owned evidence context only; no public request may authorize an identity/FX receipt. */
export const monetaryContext = new AsyncLocalStorage<MonetaryContext>();
const qualifiedCopies = new WeakMap<object, { context: MonetaryContext; contextHash: string; lineageHash: string; marketCap: number | null; netProfit: number | null; date: string }>();
const hash = (s: unknown) => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
const day = (s: unknown): string | null => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(s)) return null;
  const d = new Date(s); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s.slice(0, 10) ? s.slice(0, 10) : null;
};
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
export function checkedWorkbookMoney(cell: MoneyCellEvidence, context: MonetaryContext) {
  const reject = (reason: string) => ({ value: null, reason, sourceObservationDate: cell.observationDate,
    sourceId: cell.sourceId, field: cell.field, nativeCurrency: cell.nativeCurrency, magnitude: cell.magnitude });
  if (!day(context.cutoff) || !day(cell.observationDate) || Date.parse(cell.observationDate) > Date.parse(context.cutoff)) return reject("unknown-or-future-source-date");
  const identities = context.identities.filter(i => i.companyId === cell.companyId && i.isin === cell.isin && i.status === "approved" &&
    hash(i.reviewId) && day(i.reviewedAt) && Date.parse(i.reviewedAt) <= Date.parse(context.cutoff));
  if (identities.length !== 1) return reject("exact-accepted-identity-missing-or-conflicted");
  if (!finite(cell.nativeValue) || !hash(cell.sourceId) || !/^[A-Z]+[1-9]\d*$/.test(cell.cell) || !cell.sheet || !hash(cell.denominationEvidenceHash))
    return reject("unknown-source-cell-or-denomination-provenance");
  if (!cell.nativeCurrency || !cell.magnitude) return reject("unknown-denomination-or-magnitude");
  const scale = { units: 1, thousands: 1e3, millions: 1e6 }[cell.magnitude];
  if (!scale) return reject("unknown-magnitude");
  let normalized: ReturnType<typeof normalizeMonetaryValue>;
  try {
    if (majorCurrency(context.targetCurrency) !== context.targetCurrency) return reject("target-must-be-explicit-major-currency");
    normalized = normalizeMonetaryValue(cell.nativeValue, cell.nativeCurrency);
  } catch { return reject("unsupported-explicit-native-currency"); }
  let fxRate = 1, fxSourceHash: string | null = null;
  if (normalized.currency !== context.targetCurrency) {
    const eligible = context.fx.filter(f => f.identityReviewId === identities[0].reviewId && f.isin === cell.isin &&
      f.base === normalized.currency && f.quote === context.targetCurrency && f.date === day(cell.observationDate) &&
      day(f.authorizedAt) && Date.parse(f.authorizedAt) <= Date.parse(context.cutoff) &&
      finite(f.quotePerBase) && f.quotePerBase > 0 && hash(f.sourceHash) && /^https:\/\//.test(f.sourceUrl));
    if (eligible.length !== 1) return reject("exact-authorized-source-day-FX-missing-or-conflicted");
    fxRate = eligible[0].quotePerBase; fxSourceHash = eligible[0].sourceHash;
  }
  const value = normalized.value * scale * fxRate / 1e6;
  if (!finite(value)) return reject("nonfinite-conversion");
  return { value, reason: "qualified", sourceObservationDate: cell.observationDate, sourceId: cell.sourceId,
    field: cell.field, nativeCurrency: cell.nativeCurrency, magnitude: cell.magnitude, nativeValue: cell.nativeValue,
    targetCurrency: context.targetCurrency, targetMagnitude: "millions", minorUnitFactor: normalized.factor,
    magnitudeFactor: scale, fxRate, fxSourceHash, identityReviewId: identities[0].reviewId };
}
type Row = { companyId: number; date: Date; marketCap: number | null; netProfit: number | null;
  sourceCells?: Partial<Record<MonetaryField, { sourceId: string; sheet: string; cell: string; observationDate?: string; originalValue: number | null }>>;
  derivations?: Record<string, { method: string }> };
/** All-or-withhold per timestamp. Never silently publish a selected converted subset as a universe total.
 * Source numeric values/dates are not overwritten; returned copies alone use explicit target-currency millions. */
export function qualifyMonetaryDates<T extends Row>(rows: T[], context = monetaryContext.getStore()): T[] {
  if (!context || context.targetCurrency !== "USD") return [];
  const contextHash = contentHash(context);
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const key = row.date.toISOString(); grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const output: T[] = [];
  for (const group of Array.from(grouped.values())) {
    const converted: T[] = []; let withheld = false;
    for (const row of group) {
      const prior = qualifiedCopies.get(row);
      const lineageHash = contentHash({ sourceCells: row.sourceCells ?? null, derivations: row.derivations ?? null });
      if (prior?.context === context && prior.contextHash === contextHash && prior.lineageHash === lineageHash &&
        prior.marketCap === row.marketCap && prior.netProfit === row.netProfit && prior.date === row.date.toISOString()) {
        converted.push(row); continue;
      }
      // Both unavailable means not a monetary observation; no invented zero.
      if (row.marketCap === null && row.netProfit === null) { converted.push({ ...row }); continue; }
      const values: Partial<Record<MonetaryField, number | null>> = {};
      for (const field of ["marketCap", "netProfit"] as const) {
        if (row[field] === null) { values[field] = null; continue; }
        const source = row.sourceCells?.[field], sourceDate = source?.observationDate;
        if (!source || !sourceDate || source.originalValue !== row[field]) { withheld = true; break; }
        const sameDay = day(sourceDate) === day(row.date.toISOString());
        if (!sameDay && (field !== "netProfit" || day(sourceDate)?.slice(0, 7) !== day(row.date.toISOString())?.slice(0, 7) ||
          row.derivations?.netProfit?.method !== "unique-same-calendar-month-source-period-alignment; not-source-cell-infill")) { withheld = true; break; }
        const matches = context.cells.filter(c => c.companyId === row.companyId && c.field === field && c.sourceId === source.sourceId &&
          c.sheet === source.sheet && c.cell === source.cell && c.observationDate === sourceDate && c.nativeValue === row[field]);
        if (matches.length !== 1) { withheld = true; break; }
        const checked = checkedWorkbookMoney(matches[0], context);
        if (checked.value === null) { withheld = true; break; }
        values[field] = checked.value;
      }
      if (withheld) break;
      const copy = { ...row, ...values, monetaryQualification: "explicit-source-cell-USD-millions-1" };
      qualifiedCopies.set(copy, { context, contextHash, lineageHash, marketCap: copy.marketCap, netProfit: copy.netProfit, date: copy.date.toISOString() });
      converted.push(copy);
    }
    if (!withheld) output.push(...converted);
  }
  return output;
}
export const monetaryQualificationLabel = "Monetary totals require exact accepted identity, explicit source-cell denomination/magnitude and authorized source-day FX when currencies differ. Unknown/unconverted timestamps are withheld; not zero. Profit source dates and true zeros remain unchanged.";

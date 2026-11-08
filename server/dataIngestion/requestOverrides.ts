import { AsyncLocalStorage } from "node:async_hooks";
import type { OverrideMeta } from "./overrideStore";
import { contentHash } from "../calculation/analysisManifest";
export type OverrideRow = OverrideMeta & { indicatorKey: string; year: number };
type Context = { values: ReadonlyMap<string, Readonly<OverrideMeta>>; years: number[]; hash: string };
export const requestOverrides = new AsyncLocalStorage<Context>();
export function runWithOverrideRows<T>(rows: OverrideRow[], callback: () => T): T {
  const sorted = rows.map(r => ({
    indicatorKey: r.indicatorKey, year: r.year, value: r.value, source: r.source,
    sourceUrl: r.sourceUrl ?? null, asOfDate: r.asOfDate ?? null, method: r.method,
  })).sort((a, b) => a.indicatorKey.localeCompare(b.indicatorKey) || a.year - b.year);
  const values = new Map(sorted.map(row => [`${row.indicatorKey}:${row.year}`, Object.freeze({ ...row })]));
  if (values.size !== rows.length) throw new Error("More than one approved value for an indicator/year");
  return requestOverrides.run({ values, years: Array.from(new Set(rows.map(r => r.year))).sort((a, b) => a - b),
    hash: contentHash(sorted) }, callback);
}

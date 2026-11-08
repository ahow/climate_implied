import { getApprovedValues } from "./dataStore";
import { requestOverrides } from "./requestOverrides";

export interface OverrideMeta {
  value: number;
  source: string;
  sourceUrl?: string | null;
  asOfDate?: string | null;
  method: string;
}

// In-memory cache of approved overrides, keyed by `${indicatorKey}:${year}`.
// Loaded at startup and refreshed after every approval so the (synchronous)
// calculation engine can apply overrides without going async.
const overrides = new Map<string, OverrideMeta>();
const overrideYears = new Set<number>();
let loaded = false;

function cacheKey(key: string, year: number): string {
  return `${key}:${year}`;
}

/**
 * Reload the approved-overrides cache from the database. Throws on failure so
 * callers (approval/manual-entry routes) can surface the error instead of
 * acknowledging a change that never actually reached the in-memory store.
 */
export async function loadApprovedOverrides(): Promise<void> {
  const rows = await getApprovedValues();
  overrides.clear();
  overrideYears.clear();
  for (const row of rows) {
    overrides.set(cacheKey(row.indicatorKey, row.year), {
      value: row.value,
      source: row.source,
      sourceUrl: row.sourceUrl,
      asOfDate: row.asOfDate,
      method: row.method,
    });
    overrideYears.add(row.year);
  }
  loaded = true;
  console.log(`[overrideStore] Loaded ${overrides.size} approved overrides`);
}

export function getOverride(key: string, year: number): number | undefined {
  return (requestOverrides.getStore()?.values ?? overrides).get(cacheKey(key, year))?.value;
}

export function getOverrideMeta(key: string, year: number): OverrideMeta | undefined {
  const value = (requestOverrides.getStore()?.values ?? overrides).get(cacheKey(key, year));
  return value ? { ...value } : undefined;
}

export function getOverrideYears(): number[] {
  return [...(requestOverrides.getStore()?.years ?? Array.from(overrideYears))].sort((a, b) => a - b);
}

export function hasOverrides(): boolean {
  return (requestOverrides.getStore()?.values ?? overrides).size > 0;
}

export function isLoaded(): boolean {
  return !!requestOverrides.getStore() || loaded;
}

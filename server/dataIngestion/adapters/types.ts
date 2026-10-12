import type { FetchMethod, IndicatorKey } from "../indicatorRegistry";

export interface FetchedValue {
  indicatorKey: IndicatorKey;
  year: number;
  value: number;
  source: string;
  sourceUrl?: string;
  asOfDate?: string;
  method: FetchMethod;
  rawContext?: string;
}

export interface AdapterContext {
  /** Latest curated value (or value for a specific year if provided). */
  curated: (key: IndicatorKey, year?: number) => number | undefined;
  latestCuratedYear: number;
  /** Values produced earlier in this run, keyed by indicator key (for derived adapters). */
  fetchedSoFar: Map<string, FetchedValue>;
}

export interface SourceAdapter {
  id: string;
  /** Indicator keys this adapter can produce. */
  keys: IndicatorKey[];
  fetch(ctx: AdapterContext): Promise<FetchedValue[]>;
}

export const FETCH_TIMEOUT_MS = 12000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

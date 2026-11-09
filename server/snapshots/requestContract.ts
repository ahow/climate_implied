/** An explicit historical selection must never silently become "current". */
export function snapshotSelection(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid snapshot identity");
  return value;
}
export function snapshotInventoryQuery(query: Record<string, unknown>) {
  const kind = query.kind;
  if (kind !== undefined && !["workbook-baseline", "indicator-overrides", "analysis-result", "regional-intensity"].includes(kind as string))
    throw new Error("Invalid snapshot kind");
  const after = snapshotSelection(query.after);
  return { kind: kind as string | undefined, after };
}
/** Stored-output replay does not recalculate using today's indicator state. */
export function storedReplayRequest(path: string) {
  return /^\/analysis\/results\/[^/]+\/?$/.test(path);
}

const workbookPaths = new Set([
  "/cv/dimensions", "/cv/summary", "/cv/carbon-price", "/cv/pe-comparison",
  "/cv/sdg-growth", "/cv/decarb-bands", "/cv/decarb-terciles",
  "/cv/decarb-gap/summary", "/cv/decarb-gap/timeseries", "/cv/backtest",
]);
const indicatorPaths = new Set([
  "/projection", "/projection/categories", "/projection/sensitivity",
  "/projection/historical-trend", "/projection/categories/historical-trend",
  "/indicators/historical", "/calculation-contract", "/emissions/candidate",
]);

/** Validate selectors before loading data. Unsupported routes must not imply
 * a historical input was applied merely because they returned an identity header.
 * Regional legacy projections require a paired immutable external-input archive.
 */
export function historicalRequestPolicy(path: string, query: Record<string, unknown>) {
  const normalized = path.length > 1 ? path.replace(/\/$/, "") : path;
  const workbook = snapshotSelection(query.snapshotId);
  const indicators = snapshotSelection(query.indicatorSnapshotId);
  const regional = snapshotSelection(query.regionalSnapshotId);
  if (regional && normalized !== "/projection/regions")
    throw new Error("Regional snapshot is not supported by this endpoint");
  if (normalized === "/projection/regions" && !!regional !== !!indicators)
    throw new Error("Regional historical replay requires indicator and regional snapshots together");
  if (workbook !== undefined && !workbookPaths.has(normalized))
    throw new Error("This endpoint does not support historical workbook selection");
  if (indicators !== undefined && !indicatorPaths.has(normalized) && !workbookPaths.has(normalized) && !regional)
    throw new Error("This endpoint does not support historical indicator selection");
  return { workbook, indicators,
    readsIndicators: indicatorPaths.has(normalized) || workbookPaths.has(normalized) ||
      normalized === "/projection/regions",
    readsWorkbook: workbookPaths.has(normalized) };
}

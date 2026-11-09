/** An explicit historical selection must never silently become "current". */
export function snapshotSelection(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value))
    throw new Error("Invalid snapshot identity");
  return value;
}
export function snapshotInventoryQuery(query: Record<string, unknown>) {
  const kind = query.kind;
  if (kind !== undefined && !["workbook-baseline", "indicator-overrides", "analysis-result"].includes(kind as string))
    throw new Error("Invalid snapshot kind");
  const after = snapshotSelection(query.after);
  return { kind: kind as string | undefined, after };
}
/** Stored-output replay does not recalculate using today's indicator state. */
export function storedReplayRequest(path: string) {
  return /^\/analysis\/results\/[^/]+\/?$/.test(path);
}

/** Express query values can be absent, arrays or objects, not just strings. */
export function newsMonthWindow(value: unknown): number {
  const parsed = typeof value === "string" && value.trim() !== ""
    ? Number(value)
    : NaN;
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 24) : 12;
}

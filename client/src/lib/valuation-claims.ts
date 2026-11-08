/** Descriptive valuation diagnostics only; no valuation-to-emissions mapping. */
export function gordonBaselinePct(pe: unknown, costOfEquityPct = 8): number | null {
  if (typeof pe !== "number" || !Number.isFinite(pe) || pe <= 0 || !Number.isFinite(costOfEquityPct)) return null;
  return costOfEquityPct - 100 / pe;
}

/** g(company) - g(peer) = EY(peer) - EY(company), in percentage points. */
export function earningsYieldGapPp(companyPE: unknown, peerPE: unknown): number | null {
  const company = gordonBaselinePct(companyPE);
  const peer = gordonBaselinePct(peerPE);
  return company === null || peer === null ? null : company - peer;
}

export function displayDiagnostic(value: unknown, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "Unavailable";
}

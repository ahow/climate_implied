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

export function displayDiagnostic(value: unknown, suffix = ""): string {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2)}${suffix}` : "Unavailable";
}

/** Current-provider annual history, never an original-publication vintage. */
type Row = Record<string, unknown>;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
function keyed(rows: Row[], symbol: string) {
  const result = new Map<string, Row>();
  for (const row of rows) {
    if (row.symbol !== symbol || row.period !== "FY" || typeof row.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || typeof row.reportedCurrency !== "string" ||
        !/^[A-Z]{3}$/.test(row.reportedCurrency)) throw new Error("Annual statement identity, period or currency invalid");
    if (result.has(row.date)) throw new Error("Duplicate annual statement period requires review");
    result.set(row.date, row);
  }
  return result;
}
export function normalizeStatementHistory(cashFlows: Row[], balanceSheets: Row[], symbol: string, quoteCurrency: string) {
  const cash = keyed(cashFlows, symbol), balance = keyed(balanceSheets, symbol);
  const periods = Array.from(new Set([...Array.from(cash.keys()), ...Array.from(balance.keys())])).sort();
  return periods.map(period => {
    const c = cash.get(period), b = balance.get(period), reasons: string[] = [];
    if (!c) reasons.push("cash-flow-statement-missing");
    if (!b) reasons.push("balance-sheet-missing");
    if (c && b && c.reportedCurrency !== b.reportedCurrency) reasons.push("statement-currency-mismatch");
    const currency = c?.reportedCurrency ?? b?.reportedCurrency;
    if (currency !== quoteCurrency) reasons.push("quote-statement-currency-mismatch-no-fx-assumed");
    let fcfe: number | null = null, netDebt: number | null = null;
    if (c && finite(c.operatingCashFlow) && finite(c.capitalExpenditure) && finite(c.netDebtIssuance)) {
      if (c.capitalExpenditure > 0) reasons.push("positive-capex-sign-needs-source-review");
      else fcfe = c.operatingCashFlow + c.capitalExpenditure + c.netDebtIssuance;
    } else reasons.push("fcfe-components-missing");
    if (b && finite(b.totalDebt) && finite(b.cashAndCashEquivalents)) {
      netDebt = b.totalDebt - b.cashAndCashEquivalents;
      if (finite(b.netDebt) && Math.abs(b.netDebt - netDebt) > Math.max(1, Math.abs(netDebt)) * 1e-6)
        reasons.push("reported-net-debt-does-not-reconcile");
    } else reasons.push("net-debt-components-missing");
    const filingDates = [c?.filingDate, b?.filingDate];
    // FMP documents that international filing dates may be report-date proxies.
    const publicationStatus = filingDates.every(d => typeof d === "string" && d > period)
      ? "provider-filing-date-not-independently-verified" : "publication-date-unavailable-or-report-date-proxy";
    return { period, currency, fcfe, netDebt,
      bookEquity: b && finite(b.totalStockholdersEquity) ? b.totalStockholdersEquity : null,
      operatingCashFlow: c && finite(c.operatingCashFlow) ? c.operatingCashFlow : null,
      capitalExpenditureOutflow: c && finite(c.capitalExpenditure) && c.capitalExpenditure <= 0 ? -c.capitalExpenditure : null,
      netBorrowing: c && finite(c.netDebtIssuance) ? c.netDebtIssuance : null,
      status: reasons.length ? "review-required" : "components-reconciled-not-approved",
      reasons, publicationStatus, historyBasis: "revised-history", pointInTimeEligible: false,
      valuationEligible: reasons.length === 0 && fcfe !== null && fcfe > 0,
      valuationEligibilityMeaning: "positive FCFE components only; not model approval, not identity approval" };
  });
}

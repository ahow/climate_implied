/** CI-only explicit USD-million/source-cell receipts. Never imported by production.
 * These declarations preserve fixture amounts and dates, not claims about the actual workbook. */
import { createHash } from "node:crypto";
import { monetaryContext, type MonetaryContext, type MoneyCellEvidence } from "../../server/financialData/workbookMoney";
import { companyCoverage as actualCoverage } from "../../server/calculation/companyCoverage";
import { positivePE as actualPE } from "../../server/climateValuation/valuationStatistics";
import { walkForward as actualWalk } from "../../server/climateValuation/walkForward";
import { computeMonthlyReturns as actualMonthly, computeBenchmarkReturn as actualBenchmark, computeSignalScores as actualScores } from "../../server/climateValuation/backtestCalculator";
import { computeDecarbGapScores as actualGapScores, computePerCompanyImpliedDecarbRates as actualImpliedRates } from "../../server/climateValuation/decarbGapCalculator";
const digest = (s: string) => createHash("sha256").update(s).digest("hex");
function identity(companyId: number, isin = `SYNTHETIC-IDENTITY-${companyId}`) {
  return { companyId, isin, reviewId: digest(`Explicit CI identity receipt ${companyId} ${isin}`), status: "approved" as const, reviewedAt: "1901-01-01T00:00:00.000Z" };
}
function receipt(row: any, field: "marketCap" | "netProfit", date: string, isin: string): MoneyCellEvidence {
  return { companyId: row.companyId, isin, field, sourceId: digest("CI-only explicit USD-million dataset"),
    sheet: field === "marketCap" ? "MV" : "Profit", cell: `B${Math.abs(row.companyId) + 2}`, observationDate: date,
    nativeValue: row[field], nativeCurrency: field === "marketCap" ? row.marketCapCurrency ?? "USD" : "USD",
    magnitude: "millions", denominationEvidenceHash: digest(`Explicit synthetic denomination receipt ${field} ${row.companyId} ${date}`) };
}
export function withVerifiedSyntheticRows<T>(rows: any[], work: (qualified: any[]) => T, isins?: Map<number, string>): T {
  const identities = Array.from(new Set<number>(rows.map(r => r.companyId))).map(id => identity(id, isins?.get(id)));
  const context: MonetaryContext = { cutoff: "2099-12-31T00:00:00.000Z", targetCurrency: "USD", identities, cells: [], fx: [] };
  const copies = rows.map(row => {
    // Old lightweight CI-only ratio fixtures lacked dates; this is an explicit
    // synthetic receipt date, never a production-source date inference.
    const declaredDate = row.date ?? new Date("2020-01-31");
    const date = new Date(declaredDate).toISOString(), sourceCells = { ...row.sourceCells };
    for (const field of ["marketCap", "netProfit"] as const) if (typeof row[field] === "number" && Number.isFinite(row[field])) {
      const c = receipt(row, field, date, identities.find(i => i.companyId === row.companyId)!.isin);
      context.cells.push(c); sourceCells[field] = { ...c, originalValue: row[field] };
    }
    return { ...row, date: declaredDate, sourceCells };
  });
  return monetaryContext.run(context, () => work(copies));
}
export const verifiedSyntheticCoverage: typeof actualCoverage = input => withVerifiedSyntheticRows(input.observations,
  observations => actualCoverage({ ...input, observations }), new Map(input.companies.map(c => [c.id, c.isin])));
export const verifiedSyntheticPE: typeof actualPE = record => withVerifiedSyntheticRows([
  { companyId: 1, date: new Date("2020-01-31"), ...record }
], rows => actualPE(rows[0]));
function monthlyDeclarations<T>(monthly: Map<string, any[]>, work: (copy: Map<string, any[]>) => T): T {
  const identities = Array.from(new Set<number>(Array.from(monthly.values()).flat().map(r => r.companyId))).map(id => identity(id));
  const context: MonetaryContext = { cutoff: "2099-12-31T00:00:00.000Z", targetCurrency: "USD", identities, cells: [], fx: [] };
  const copy = new Map<string, any[]>();
  for (const [month, rows] of Array.from(monthly.entries())) {
    const [year, m] = month.split("-").map(Number), sourceDate = new Date(Date.UTC(year, m - 1, 0)).toISOString();
    copy.set(month, rows.map(row => {
      const c = receipt(row, "marketCap", sourceDate, identities.find(i => i.companyId === row.companyId)!.isin);
      context.cells.push(c); return { ...row, weightSource: c };
    }));
  }
  return monetaryContext.run(context, () => work(copy));
}
export const verifiedSyntheticWalkForward: typeof actualWalk = (monthly, scores, risk, cost) =>
  monthlyDeclarations(monthly, copy => actualWalk(copy, scores, risk, cost));
export const verifiedSyntheticMonthlyReturns: typeof actualMonthly = data => withVerifiedSyntheticRows(Array.from(data.values()).flat(), rows => {
  const copy = new Map<number, any[]>();
  for (const row of rows) copy.set(row.companyId, [...(copy.get(row.companyId) ?? []), row]);
  return actualMonthly(copy);
});
export const verifiedSyntheticBenchmarkReturn: typeof actualBenchmark = rows => monthlyDeclarations(new Map([
  [rows[0]?.monthKey ?? "2020-02", rows]
]), copy => actualBenchmark(Array.from(copy.values())[0]));
export const verifiedSyntheticSignalScores: typeof actualScores = (companies, signal, data) =>
  withVerifiedSyntheticRows(Array.from(data.values()).flat(), rows => {
    const copy = new Map<number, any[]>();
    for (const row of rows) copy.set(row.companyId, [...(copy.get(row.companyId) ?? []), row]);
    return actualScores(companies, signal, copy);
  });
export const verifiedSyntheticGapScores: typeof actualGapScores = (companies, data, rate, method, cost) =>
  withVerifiedSyntheticRows(Array.from(data.values()), rows => actualGapScores(companies,
    new Map(rows.map(r => [r.companyId, r])), rate, method, cost));
export const verifiedSyntheticImpliedRates: typeof actualImpliedRates = (companies, data, method, cost) =>
  withVerifiedSyntheticRows(Array.from(data.values()), rows => actualImpliedRates(companies,
    new Map(rows.map(r => [r.companyId, r])), method, cost));

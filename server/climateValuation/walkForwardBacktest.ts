import type { CvTimeSeries } from "../../shared/schema";
import { buildBacktestResponse, type SignalType } from "../../shared/backtest";
import { computeMonthlyReturns, computeSignalScores } from "./backtestCalculator";
import { loadCompaniesAndTimeSeries, filterCompaniesByGeography, type ScoringMethod } from "./sharedUtils";
import { computeDecarbGapScores } from "./decarbGapCalculator";
import { walkForward } from "./walkForward";
import { monthlyMoneyUnavailable } from "../financialData/workbookMoneyConsumers";

/** Accounting dates are not publication dates; this remains a reconstruction. */
export async function calculateBacktest(
  signal: SignalType, trackingErrorLimit: number, scoringMethod = "sector_relative",
  geography?: string, costBps = 10,
) {
  if (signal === "sdg_exposure" || signal === "decarb_ambition") {
    const response = buildBacktestResponse([], 0, null, signal, scoringMethod, trackingErrorLimit, "expanding_past_only");
    response.summary.warnings = [
      "Backtest unavailable: dated historical SDG/target classifications are not stored. Current classifications are not applied to historical portfolios.",
    ];
    return response;
  }
  const { companies: allCompanies, timeSeries } = await loadCompaniesAndTimeSeries(true);
  const companies = filterCompaniesByGeography(allCompanies, geography);
  const ids = new Set(companies.map(c => c.id));
  const byCompany = new Map<number, CvTimeSeries[]>();
  for (const row of timeSeries) {
    if (!ids.has(row.companyId)) continue;
    const rows = byCompany.get(row.companyId) ?? [];
    rows.push(row); byCompany.set(row.companyId, rows);
  }
  const monthly = computeMonthlyReturns(byCompany);
  const moneyGap = monthlyMoneyUnavailable(monthly);
  if (moneyGap) {
    const response = buildBacktestResponse([], 0, null, signal, scoringMethod, trackingErrorLimit, "expanding_past_only");
    response.summary.warnings = [`Backtest unavailable: monetary weights unconverted (${moneyGap}); returns/wealth/tracking error are unavailable, not observed zero.`];
    return response;
  }
  const scoresByMonth = new Map<string, Map<number, number>>();
  const cache = new Map<number, Map<number, number>>();
  for (const month of Array.from(monthly.keys()).sort()) {
    const year = Number(month.slice(0, 4)), monthIndex = Number(month.slice(5)) - 1;
    const cutoff = Date.UTC(year, Math.floor(monthIndex / 3) * 3, 1);
    let scores = cache.get(cutoff);
    if (!scores) {
      const latest = new Map<number, CvTimeSeries>();
      for (const [id, rows] of Array.from(byCompany.entries())) {
        const available = rows.filter(r => r.date.getTime() < cutoff);
        if (available.length) latest.set(id, available[available.length - 1]);
      }
      if (signal === "decarb_gap") {
        // A common physical rate cancels in peer ranks. Do not read a future
        // physical forecast just to shift every company's gap by a constant.
        scores = computeDecarbGapScores(companies, latest, 0, scoringMethod as ScoringMethod);
      } else {
        const histories = new Map(Array.from(latest, ([id, row]) => [id, [row]]));
        scores = computeSignalScores(companies, signal, histories);
      }
      cache.set(cutoff, scores);
    }
    scoresByMonth.set(month, scores);
  }
  const result = walkForward(monthly, scoresByMonth, trackingErrorLimit / 100, costBps);
  const response = buildBacktestResponse(result.series, result.annualizedTE, result.lastTilt,
    signal, scoringMethod, trackingErrorLimit, "expanding_past_only");
  response.summary.accounting = result.accounting;
  response.summary.warnings = response.summary.warnings.filter(w => !w.startsWith("Returns are gross"));
  response.summary.warnings.push(
    "Charts and tracking error remain gross; net results use the disclosed flat transaction-cost assumption, not an empirical cost estimate.",
    "Missing-company returns, survivor coverage and corporate actions remain unverified. Removed holdings are assumed liquidated at last available value; this is not a point-in-time investable backtest.");
  return response;
}

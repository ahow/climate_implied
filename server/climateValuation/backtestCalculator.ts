import type { CvCompany, CvTimeSeries } from "@shared/schema";
import type { ScoringMethod } from "./sharedUtils";
import { filterCompaniesByGeography, loadCompaniesAndTimeSeries } from "./sharedUtils";
import { computeDecarbGapScores } from "./decarbGapCalculator";
import { buildBacktestResponse, type BacktestResponse } from "../../shared/backtest";
import type { BacktestPoint, SignalType } from "../../shared/backtest";
export type { SignalType } from "../../shared/backtest";


interface CompanyMonthly {
  companyId: number;
  monthKey: string;
  monthlyReturn: number;
  marketCap: number;
}

function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function computeSignalScores(
  companies: CvCompany[],
  signal: SignalType,
  timeSeriesByCompany: Map<number, CvTimeSeries[]>,
): Map<number, number> {
  const scores = new Map<number, number>();
  const rawValues: Array<{ id: number; value: number }> = [];

  if (signal === "sdg_exposure") {
    for (const c of companies) {
      if (c.sdgAlignmentScore !== null && c.sdgAlignmentScore !== undefined) {
        rawValues.push({ id: c.id, value: c.sdgAlignmentScore });
      }
    }
  } else if (signal === "decarb_ambition") {
    for (const c of companies) {
      if (c.emissionTarget2050 !== null && c.emissionTarget2050 !== undefined) {
        rawValues.push({ id: c.id, value: -c.emissionTarget2050 });
      }
    }
  } else {
    for (const c of companies) {
      const series = timeSeriesByCompany.get(c.id);
      if (!series || series.length === 0) continue;
      const latest = series[series.length - 1];
      const s1 = latest.scope1Emissions ?? 0;
      const s2 = latest.scope2Emissions ?? 0;
      const totalEmissions = s1 + s2;
      const mc = latest.marketCap;
      if (!mc || mc <= 0 || totalEmissions === 0) continue;
      rawValues.push({ id: c.id, value: -(totalEmissions / mc) });
    }
  }

  if (rawValues.length < 2) return scores;

  rawValues.sort((a, b) => a.value - b.value);
  const n = rawValues.length;
  for (let i = 0; i < n; i++) {
    const percentile = i / (n - 1);
    const score = (percentile - 0.5) * 2;
    scores.set(rawValues[i].id, score);
  }

  return scores;
}

function computeMonthlyReturns(
  timeSeriesByCompany: Map<number, CvTimeSeries[]>,
): Map<string, CompanyMonthly[]> {
  const monthlyData = new Map<string, CompanyMonthly[]>();

  const companyEntries = Array.from(timeSeriesByCompany.entries());
  for (const [companyId, series] of companyEntries) {
    const sorted = series
      .filter((s: CvTimeSeries) => s.totalReturnIndex !== null && s.marketCap !== null)
      .sort((a: CvTimeSeries, b: CvTimeSeries) => a.date!.getTime() - b.date!.getTime());

    const monthlyRI = new Map<string, { firstRI: number; lastRI: number; lastMV: number; lastDate: Date }>();

    for (const s of sorted) {
      const mk = toMonthKey(s.date!);
      const existing = monthlyRI.get(mk);
      if (!existing) {
        monthlyRI.set(mk, {
          firstRI: s.totalReturnIndex!,
          lastRI: s.totalReturnIndex!,
          lastMV: s.marketCap!,
          lastDate: s.date!,
        });
      } else {
        existing.lastRI = s.totalReturnIndex!;
        existing.lastMV = s.marketCap!;
        existing.lastDate = s.date!;
      }
    }

    const monthKeys = Array.from(monthlyRI.keys()).sort();
    for (let i = 1; i < monthKeys.length; i++) {
      const prev = monthlyRI.get(monthKeys[i - 1])!;
      const curr = monthlyRI.get(monthKeys[i])!;
      if (prev.lastRI <= 0) continue;

      const ret = (curr.lastRI / prev.lastRI) - 1;
      if (Math.abs(ret) > 0.5) continue;

      const mk = monthKeys[i];
      if (!monthlyData.has(mk)) monthlyData.set(mk, []);
      monthlyData.get(mk)!.push({
        companyId,
        monthKey: mk,
        monthlyReturn: ret,
        marketCap: prev.lastMV,
      });
    }
  }

  return monthlyData;
}

function computeBenchmarkReturn(monthData: CompanyMonthly[]): number {
  let totalMV = 0;
  for (const d of monthData) totalMV += d.marketCap;
  if (totalMV <= 0) return 0;

  let weightedReturn = 0;
  for (const d of monthData) {
    weightedReturn += (d.marketCap / totalMV) * d.monthlyReturn;
  }
  return weightedReturn;
}

function computePortfolioReturn(
  monthData: CompanyMonthly[],
  signalScores: Map<number, number>,
  tiltScale: number,
): { ret: number; overweight: number; underweight: number } {
  let totalMV = 0;
  for (const d of monthData) totalMV += d.marketCap;
  if (totalMV <= 0) return { ret: 0, overweight: 0, underweight: 0 };

  const weights: number[] = [];
  const returns: number[] = [];
  let overweight = 0;
  let underweight = 0;

  for (const d of monthData) {
    const bw = d.marketCap / totalMV;
    const score = signalScores.get(d.companyId) ?? 0;
    const activeW = score * tiltScale * bw;
    let w = bw + activeW;
    if (w < 0) w = 0;
    weights.push(w);
    returns.push(d.monthlyReturn);

    if (score > 0) overweight++;
    else if (score < 0) underweight++;
  }

  let totalW = 0;
  for (const w of weights) totalW += w;
  if (totalW <= 0) return { ret: 0, overweight: 0, underweight: 0 };

  let ret = 0;
  for (let i = 0; i < weights.length; i++) {
    ret += (weights[i] / totalW) * returns[i];
  }
  return { ret, overweight, underweight };
}

function computeDecarbGapScoresForMonth(
  monthKey: string,
  companies: CvCompany[],
  timeSeriesByCompany: Map<number, CvTimeSeries[]>,
  projectedRateForYear: number,
  scoringMethod: ScoringMethod,
  costOfEquity: number,
): Map<number, number> {
  const latestTSByCompany = new Map<number, CvTimeSeries>();
  for (const [compId, series] of Array.from(timeSeriesByCompany.entries())) {
    const beforeOrAtMonth = series
      .filter(s => s.date != null && toMonthKey(s.date!) <= monthKey)
      .sort((a, b) => a.date!.getTime() - b.date!.getTime());
    if (beforeOrAtMonth.length > 0) {
      latestTSByCompany.set(compId, beforeOrAtMonth[beforeOrAtMonth.length - 1]);
    }
  }

  if (latestTSByCompany.size < 2) return new Map<number, number>();

  return computeDecarbGapScores(
    companies,
    latestTSByCompany,
    projectedRateForYear,
    scoringMethod,
    costOfEquity,
  );
}

function runBacktestWithTilt(
  sortedMonths: string[],
  monthlyData: Map<string, CompanyMonthly[]>,
  signalScores: Map<number, number>,
  tiltScale: number,
): { results: BacktestPoint[]; annualizedTE: number } {
  let benchCum = 1;
  let portCum = 1;
  const activeReturns: number[] = [];
  const results: BacktestPoint[] = [];

  for (const month of sortedMonths) {
    const data = monthlyData.get(month)!;
    const bRet = computeBenchmarkReturn(data);
    const { ret: pRet, overweight, underweight } = computePortfolioReturn(data, signalScores, tiltScale);
    const activeRet = pRet - bRet;
    activeReturns.push(activeRet);

    benchCum *= (1 + bRet);
    portCum *= (1 + pRet);

    let rollingTE = 0;
    if (activeReturns.length >= 3) {
      const mean = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
      const variance = activeReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / activeReturns.length;
      rollingTE = Math.sqrt(variance) * Math.sqrt(12);
    }

    results.push({
      date: month,
      benchmarkReturn: Math.round(bRet * 10000) / 10000,
      portfolioReturn: Math.round(pRet * 10000) / 10000,
      benchmarkCumulative: Math.round(benchCum * 10000) / 10000,
      portfolioCumulative: Math.round(portCum * 10000) / 10000,
      activeReturn: Math.round(activeRet * 10000) / 10000,
      trackingError: Math.round(rollingTE * 10000) / 10000,
      overweightCount: overweight,
      underweightCount: underweight,
    });
  }

  let annualizedTE = 0;
  if (activeReturns.length >= 3) {
    const mean = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
    const variance = activeReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / activeReturns.length;
    annualizedTE = Math.sqrt(variance) * Math.sqrt(12);
  }

  return { results, annualizedTE };
}

function getQuarterEndMonth(year: number, quarter: number): string {
  const endMonth = quarter * 3;
  return `${year}-${String(endMonth).padStart(2, "0")}`;
}

function precomputeTimeVaryingSignals(
  sortedMonths: string[],
  companies: CvCompany[],
  timeSeriesByCompany: Map<number, CvTimeSeries[]>,
  projectedRatesByYear: Map<number, number>,
  scoringMethod: ScoringMethod,
  costOfEquity: number,
): Map<string, Map<number, number>> {
  const signalsByMonth = new Map<string, Map<number, number>>();
  const quarterCache = new Map<string, Map<number, number>>();

  for (const month of sortedMonths) {
    const year = parseInt(month.split("-")[0], 10);
    const mo = parseInt(month.slice(5), 10);
    const quarter = mo <= 3 ? 1 : mo <= 6 ? 2 : mo <= 9 ? 3 : 4;

    // Lag signal by one quarter to avoid look-ahead bias: trades in a given
    // quarter use only data available as of the PRIOR quarter-end. Otherwise
    // (e.g.) January trades would be scored using data through March.
    let signalYear = year;
    let signalQuarter = quarter - 1;
    if (signalQuarter === 0) {
      signalQuarter = 4;
      signalYear = year - 1;
    }

    const projectedRate = projectedRatesByYear.get(signalYear)
      ?? projectedRatesByYear.get(Math.max(...Array.from(projectedRatesByYear.keys())))
      ?? 1.0;

    const quarterKey = `${signalYear}-Q${signalQuarter}`;
    let scores = quarterCache.get(quarterKey);
    if (!scores) {
      const signalMonth = getQuarterEndMonth(signalYear, signalQuarter);
      scores = computeDecarbGapScoresForMonth(
        signalMonth, companies, timeSeriesByCompany, projectedRate, scoringMethod, costOfEquity
      );
      quarterCache.set(quarterKey, scores);
    }
    signalsByMonth.set(month, scores);
  }

  return signalsByMonth;
}

function runBacktestWithTimeVaryingSignal(
  sortedMonths: string[],
  monthlyData: Map<string, CompanyMonthly[]>,
  signalsByMonth: Map<string, Map<number, number>>,
  tiltScale: number,
): { results: BacktestPoint[]; annualizedTE: number } {
  let benchCum = 1;
  let portCum = 1;
  const activeReturns: number[] = [];
  const results: BacktestPoint[] = [];

  for (const month of sortedMonths) {
    const data = monthlyData.get(month)!;
    const bRet = computeBenchmarkReturn(data);
    const signalScores = signalsByMonth.get(month) || new Map<number, number>();
    const { ret: pRet, overweight, underweight } = computePortfolioReturn(data, signalScores, tiltScale);
    const activeRet = pRet - bRet;
    activeReturns.push(activeRet);

    benchCum *= (1 + bRet);
    portCum *= (1 + pRet);

    let rollingTE = 0;
    if (activeReturns.length >= 3) {
      const mean = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
      const variance = activeReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / activeReturns.length;
      rollingTE = Math.sqrt(variance) * Math.sqrt(12);
    }

    results.push({
      date: month,
      benchmarkReturn: Math.round(bRet * 10000) / 10000,
      portfolioReturn: Math.round(pRet * 10000) / 10000,
      benchmarkCumulative: Math.round(benchCum * 10000) / 10000,
      portfolioCumulative: Math.round(portCum * 10000) / 10000,
      activeReturn: Math.round(activeRet * 10000) / 10000,
      trackingError: Math.round(rollingTE * 10000) / 10000,
      overweightCount: overweight,
      underweightCount: underweight,
    });
  }

  let annualizedTE = 0;
  if (activeReturns.length >= 3) {
    const mean = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
    const variance = activeReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / activeReturns.length;
    annualizedTE = Math.sqrt(variance) * Math.sqrt(12);
  }

  return { results, annualizedTE };
}

export async function calculateBacktest(
  signal: SignalType,
  trackingErrorLimit: number,
  scoringMethod: string = "sector_relative",
  geography?: string,
  projectedRate?: number,
  projectedRatesByYear?: Map<number, number>,
): Promise<BacktestResponse> {
  const respond = (points: BacktestPoint[], te: number, tilt: number | null) =>
    buildBacktestResponse(points, te, tilt, signal, scoringMethod, trackingErrorLimit);
  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(true);

  const filteredCompanies = filterCompaniesByGeography(allCompanies, geography);
  const companyIds = new Set(filteredCompanies.map(c => c.id));

  const timeSeriesByCompany = new Map<number, CvTimeSeries[]>();
  for (const ts of allTimeSeries) {
    if (!companyIds.has(ts.companyId)) continue;
    if (!timeSeriesByCompany.has(ts.companyId)) timeSeriesByCompany.set(ts.companyId, []);
    timeSeriesByCompany.get(ts.companyId)!.push(ts);
  }

  const monthlyData = computeMonthlyReturns(timeSeriesByCompany);
  const sortedMonths = Array.from(monthlyData.keys()).sort();

  if (sortedMonths.length < 2) return respond([], 0, null);

  const targetTE = trackingErrorLimit / 100;

  if (signal === "decarb_gap" && projectedRatesByYear && projectedRatesByYear.size > 0) {
    const sm = (scoringMethod as ScoringMethod) || "sector_relative";

    const signalsByMonth = precomputeTimeVaryingSignals(
      sortedMonths, filteredCompanies, timeSeriesByCompany,
      projectedRatesByYear, sm, 0.08
    );

    const probe = runBacktestWithTimeVaryingSignal(sortedMonths, monthlyData, signalsByMonth, 1.0);
    const teAtUnit = probe.annualizedTE;

    if (teAtUnit <= 0) return respond(probe.results, probe.annualizedTE, 1);

    let lo = 0;
    let hi = Math.max(200, targetTE / teAtUnit * 4);
    let bestTilt = targetTE / teAtUnit;

    for (let iter = 0; iter < 20; iter++) {
      const mid = (lo + hi) / 2;
      const trial = runBacktestWithTimeVaryingSignal(sortedMonths, monthlyData, signalsByMonth, mid);

      if (Math.abs(trial.annualizedTE - targetTE) / targetTE < 0.02) {
        bestTilt = mid;
        break;
      }

      if (trial.annualizedTE < targetTE) {
        lo = mid;
      } else {
        hi = mid;
      }
      bestTilt = mid;
      if (hi - lo < 0.001) break;
    }

    const final = runBacktestWithTimeVaryingSignal(sortedMonths, monthlyData, signalsByMonth, bestTilt);
    return respond(final.results, final.annualizedTE, bestTilt);
  }

  let signalScores: Map<number, number>;

  if (signal === "decarb_gap" && projectedRate !== undefined) {
    const latestTSByCompany = new Map<number, CvTimeSeries>();
    for (const [compId, series] of Array.from(timeSeriesByCompany.entries())) {
      const sorted = series
        .filter(s => s.date != null)
        .sort((a, b) => a.date!.getTime() - b.date!.getTime());
      if (sorted.length > 0) {
        latestTSByCompany.set(compId, sorted[sorted.length - 1]);
      }
    }
    signalScores = computeDecarbGapScores(
      filteredCompanies,
      latestTSByCompany,
      projectedRate,
      (scoringMethod as ScoringMethod) || "sector_relative",
      0.08
    );
  } else {
    signalScores = computeSignalScores(filteredCompanies, signal, timeSeriesByCompany);
  }

  const probe = runBacktestWithTilt(sortedMonths, monthlyData, signalScores, 1.0);
  const teAtUnit = probe.annualizedTE;

  if (teAtUnit <= 0) {
    return respond(probe.results, probe.annualizedTE, 1);
  }

  let lo = 0;
  let hi = Math.max(200, targetTE / teAtUnit * 4);
  let bestTilt = targetTE / teAtUnit;

  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const trial = runBacktestWithTilt(sortedMonths, monthlyData, signalScores, mid);

    if (Math.abs(trial.annualizedTE - targetTE) / targetTE < 0.02) {
      bestTilt = mid;
      break;
    }

    if (trial.annualizedTE < targetTE) {
      lo = mid;
    } else {
      hi = mid;
    }
    bestTilt = mid;

    if (hi - lo < 0.001) break;
  }

  const final = runBacktestWithTilt(sortedMonths, monthlyData, signalScores, bestTilt);
  return respond(final.results, final.annualizedTE, bestTilt);
}

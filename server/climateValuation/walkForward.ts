import type { BacktestPoint } from "../../shared/backtest";
export interface ReturnObservation { companyId: number; monthlyReturn: number; marketCap: number; }

function annualizedRisk(values: number[]) {
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length * 12);
}

function portfolio(rows: ReturnObservation[], scores: Map<number, number>, tilt: number) {
  const total = rows.reduce((s, r) => s + r.marketCap, 0);
  if (!Number.isFinite(total) || total <= 0) throw new Error("Invalid portfolio capitalization");
  const benchmark = rows.map(r => r.marketCap / total);
  const benchmarkReturn = rows.reduce((s, r, i) => s + benchmark[i] * r.monthlyReturn, 0);
  if (tilt === 0 || rows.every(r => (scores.get(r.companyId) ?? 0) === 0)) {
    return { benchmark: benchmarkReturn, portfolio: benchmarkReturn, overweight: 0, underweight: 0,
      weights: new Map(rows.map((r, i) => [r.companyId, benchmark[i]])) };
  }
  const weights = rows.map((r, i) => benchmark[i] *
    Math.max(0, 1 + tilt * Math.max(-1, Math.min(1, scores.get(r.companyId) ?? 0))));
  const sum = weights.reduce((a, b) => a + b, 0);
  // If the long-only tilt eliminates every holding, remain in the benchmark.
  const normalized = sum > 0 ? weights.map(w => w / sum) : benchmark;
  return {
    benchmark: benchmarkReturn,
    portfolio: rows.reduce((s, r, i) => s + normalized[i] * r.monthlyReturn, 0),
    overweight: normalized.filter((w, i) => w > benchmark[i] + 1e-12).length,
    underweight: normalized.filter((w, i) => w < benchmark[i] - 1e-12).length,
    weights: new Map(rows.map((r, i) => [r.companyId, normalized[i]])),
  };
}

/** Expanding past-only risk estimate; no full-sample tilt optimization. */
export function walkForward(
  monthly: Map<string, ReturnObservation[]>,
  scoresByMonth: Map<string, Map<number, number>>,
  targetTE: number,
  costBps = 0,
) {
  if (!Number.isFinite(targetTE) || targetTE <= 0) throw new Error("Invalid target tracking error");
  if (!Number.isFinite(costBps) || costBps < 0 || costBps > 100) throw new Error("Cost must be 0–100 basis points per traded dollar");
  const months = Array.from(monthly.keys()).sort();
  const unitHistory: number[] = [], activeHistory: number[] = [];
  let benchmarkWealth = 1, portfolioWealth = 1;
  let lastTilt = 0;
  let drifted = new Map<number, number>(), priorCash = 1, netWealth = 1, peak = 1;
  let maxDrawdown = 0, totalTurnover = 0, totalCostFraction = 0;
  const series: BacktestPoint[] = [];
  for (const month of months) {
    const rows = monthly.get(month)!;
    if (new Set(rows.map(r => r.companyId)).size !== rows.length)
      throw new Error("Duplicate company in a monthly portfolio");
    if (!rows.length || rows.some(r => !Number.isFinite(r.marketCap) || r.marketCap <= 0 ||
      !Number.isFinite(r.monthlyReturn) || r.monthlyReturn < -1)) {
      throw new Error("Invalid monthly return/weight observations");
    }
    const scores = scoresByMonth.get(month) ?? new Map<number, number>();
    if (Array.from(scores.values()).some(s => !Number.isFinite(s))) throw new Error("Invalid score");
    const trainingRisk = annualizedRisk(unitHistory);
    lastTilt = unitHistory.length >= 12 && trainingRisk > 1e-12 ? Math.min(5, targetTE / trainingRisk) : 0;
    const current = portfolio(rows, scores, lastTilt);
    const allIds = Array.from(new Set([...Array.from(drifted.keys()), ...Array.from(current.weights.keys())]));
    const tradedNotional = allIds.reduce((sum, id) => sum +
      Math.abs((current.weights.get(id) ?? 0) - (drifted.get(id) ?? 0)), 0);
    const turnover = (tradedNotional + priorCash) / 2;
    const costFraction = tradedNotional * costBps / 10000;
    const netReturn = (1 - costFraction) * (1 + current.portfolio) - 1;
    netWealth *= 1 + netReturn;
    peak = Math.max(peak, netWealth);
    maxDrawdown = Math.max(maxDrawdown, 1 - netWealth / peak);
    totalTurnover += turnover; totalCostFraction += costFraction;
    const active = current.portfolio - current.benchmark;
    const unit = portfolio(rows, scores, 1);
    // Only append realized information AFTER this month's tilt is selected.
    unitHistory.push(unit.portfolio - unit.benchmark);
    activeHistory.push(active);
    benchmarkWealth *= 1 + current.benchmark;
    portfolioWealth *= 1 + current.portfolio;
    series.push({
      date: month, benchmarkReturn: current.benchmark, portfolioReturn: current.portfolio,
      benchmarkCumulative: benchmarkWealth, portfolioCumulative: portfolioWealth,
      activeReturn: active, trackingError: annualizedRisk(activeHistory),
      overweightCount: current.overweight, underweightCount: current.underweight,
      tiltScale: lastTilt,
      portfolioNetReturn: netReturn, portfolioNetCumulative: netWealth, turnover, tradedNotional, costFraction,
    });
    if (current.portfolio <= -1) break; // Insolvency is terminal, not a fresh portfolio next month.
    drifted = new Map(rows.map(r => [r.companyId,
      current.weights.get(r.companyId)! * (1 + r.monthlyReturn) / (1 + current.portfolio)]));
    priorCash = 0;
  }
  return { series, annualizedTE: annualizedRisk(activeHistory), lastTilt,
    accounting: { costBps, totalTurnover, totalCostFraction, netCumulative: netWealth,
      grossCumulative: portfolioWealth, maxNetDrawdown: maxDrawdown } };
}

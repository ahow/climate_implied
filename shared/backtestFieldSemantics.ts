import type { OutputFieldSemantic } from "./outputFieldSemantics";

const risk = "sqrt(12 * sum((activeReturn - mean(activeReturn))^2) / n); population denominator n, zero when n < 3";
const context = {
  role: "Output" as const,
  dependencies: ["selected workbook totalReturnIndex", "prior-month marketCap", "quarter-lagged scores", "trackingError", "costBps"],
  source: "server/climateValuation/walkForwardBacktest.ts, walkForward.ts, backtestCalculator.ts; shared/backtest.ts",
  period: "Consecutive UTC workbook months; expanding history through each returned month; horizon ends at last available month or gross insolvency",
  geography: "Selected company geography filter; benchmark reconstituted from eligible monthly return observations",
  status: "Reconstructed-history diagnostic, not point-in-time investable evidence or validated forecast",
  missingness: "Only finite nonnegative return-index and capitalization observations; prior month index and capitalization must be positive; skip nonconsecutive months. Missing scores are neutral zero. SDG/ambition return empty series with warning, not zero performance.",
  uncertainty: "No calibrated uncertainty. Tracking error is realized gross active-return dispersion, not confidence interval.",
  scope: "Returns and weights are dimensionless; market-cap ratios use workbook USD million, no FX conversion here. Flat costs are assumptions; survivor coverage, corporate actions and missing returns unverified.",
  asOfRule: "Scores use last observation strictly before start of current UTC quarter; risk tilt uses only prior realized unit-tilt returns. Accounting dates do not verify publication availability; historical classifications/vintages unverified.",
};
export const backtestPointSpecs: [string,string,string,string][] = [
  ["date","Return observation month","UTC YYYY-MM key of current consecutive return-index month","UTC year-month"],
  ["benchmarkReturn","Gross capitalization-weighted monthly benchmark return","sum(b_i*r_i); b_i=priorMonthMarketCap_i/sum(eligible priorMonthMarketCap); r_i=currentMonthLastRI/priorMonthLastRI-1","fraction/month"],
  ["portfolioReturn","Gross long-only tilted monthly return","sum(w_i*r_i); w_i=b_i*max(0,1+tiltScale*clamp(score_i,-1,1))/sum(raw weights); use b_i if raw sum is zero","fraction/month"],
  ["benchmarkCumulative","Benchmark wealth, initialized at one, NOT cumulative percentage return","product(1+benchmarkReturn) from first emitted month","wealth multiple"],
  ["portfolioCumulative","Gross portfolio wealth initialized at one","product(1+portfolioReturn) from first emitted month","wealth multiple"],
  ["activeReturn","Arithmetic monthly gross portfolio minus benchmark return","portfolioReturn-benchmarkReturn","fraction/month"],
  ["trackingError","Annualized expanding gross active-return dispersion",risk,"fraction/year^0.5"],
  ["overweightCount","Holdings above benchmark weight tolerance","count(w_i > b_i + 1e-12)","companies"],
  ["underweightCount","Holdings below benchmark weight tolerance","count(w_i < b_i - 1e-12)","companies"],
  ["tiltScale","Actual month-specific risk tilt, not realized tracking error","prior unit-tilt history length >=12 and annualized risk >1e-12 ? min(5,(targetTrackingErrorPct/100)/prior unit-tilt annualized risk) : 0","dimensionless"],
  ["portfolioNetReturn","Monthly return after assumed transaction cost","(1-costFraction)*(1+portfolioReturn)-1","fraction/month"],
  ["portfolioNetCumulative","Cost-adjusted wealth initialized at one","product(1+portfolioNetReturn)","wealth multiple"],
  ["tradedNotional","Absolute purchases plus sales relative to portfolio value","sum over union of prior/current holdings abs(currentWeight-priorDriftedWeight); initial prior holdings empty","fraction"],
  ["turnover","Half traded holdings plus initial cash allocation","(tradedNotional+priorCash)/2; priorCash=1 initially, otherwise 0; driftedWeight=previousWeight*(1+previousCompanyReturn)/(1+previousPortfolioReturn)","fraction"],
  ["costFraction","Flat assumed transaction cost relative to wealth","tradedNotional*costBps/10000","fraction"],
];
const summarySpecs: [string,string,string,string][] = [
  ["signal","Requested sorting signal","validated signal query, default carbon_intensity","label"],
  ["method","Requested method label; carbon-intensity scoring still uses global ranks","query method; default sector_relative for decarb_gap, absolute otherwise","label"],
  ["targetTrackingErrorPct","Requested annualized gross risk budget, not guaranteed realized risk","query trackingError, default 2; accepted (0,20]","percentage points"],
  ["realizedTrackingErrorPct","Full returned-history realized annualized gross tracking error",`series.length>=3 ? 100*(${risk}) : null`,"percent/year^0.5"],
  ["tiltScale","Last actual risk tilt, not single tilt applied retrospectively","walkForward.lastTilt; null for unavailable signal; zero for empty eligible history","dimensionless"],
  ["calibrationPeriod","Warm-up period absent when fewer than twelve months","series.length>=12 ? first twelve emitted months : null","nullable period"],
  ["calibrationPeriod.start","First emitted warm-up month","series[0].date when at least twelve months","UTC year-month"],
  ["calibrationPeriod.end","Twelfth emitted warm-up month","series[11].date when at least twelve months","UTC year-month"],
  ["calibrationPeriod.months","Warm-up observation count, not calendar elapsed span","12 when at least twelve emitted months","months"],
  ["calibrationStatus","Descriptive realized-target comparison, not acceptance","n<3 ? insufficient_data : abs(realizedTrackingErrorPct-targetTrackingErrorPct)/targetTrackingErrorPct < 0.02 ? within_tolerance : outside_tolerance","label"],
  ["calibrationBasis","Risk-scaling information window","expanding_past_only for live endpoint","label"],
  ["seriesTrackingErrorUnits","Unit declaration for series tracking error","decimal","label"],
  ["seriesTrackingErrorWindow","Window declaration for series risk","expanding_from_start","label"],
  ["warnings[]","Explicit availability and reconstruction limitations","buildBacktestResponse warnings amended by calculateBacktest; unavailable SDG/ambition classification warning replaces defaults","text"],
  ["accounting.costBps","Assumed cost per traded dollar","query costBps, default 10, validated 0..100","basis points"],
  ["accounting.totalTurnover","Sum of monthly turnover, not annualized","sum(series.turnover)","fraction"],
  ["accounting.totalCostFraction","Sum of monthly cost fractions, not compounded wealth drag","sum(series.costFraction)","fraction"],
  ["accounting.netCumulative","Final net wealth","last portfolioNetCumulative; 1 for empty eligible history","wealth multiple"],
  ["accounting.grossCumulative","Final gross wealth","last portfolioCumulative; 1 for empty eligible history","wealth multiple"],
  ["accounting.maxNetDrawdown","Largest peak-to-trough net wealth loss","max_t(1-netWealth_t/max(1,netWealth_1..t)); zero for empty history","fraction"],
];
export const backtestFieldSemantics: OutputFieldSemantic[] = [
  ...backtestPointSpecs.flatMap(([field,meaning,formula,unit]) =>
    [field,`series[].${field}`].map(path=>({...context,id:`backtest.${path}`,meaning,formula,unit}))),
  ...summarySpecs.map(([field,meaning,formula,unit])=>({...context,id:`backtest.summary.${field}`,meaning,formula,unit})),
  {...context,id:"backtest.series[]",meaning:"Empty monthly history with explicit summary warnings",formula:"[] for unavailable classifications or no eligible consecutive-month returns",unit:"empty collection"},
];

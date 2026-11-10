import type { OriginalIssuerInputs } from "./issuerOriginalOperatingCase";
import { authenticatePrimaryIssuerCashflow } from "./issuerCashflowCase";

type Interval = { lo: number; hi: number };
type Jet = { value: Interval; derivative: Interval };
const buffer = new DataView(new ArrayBuffer(8));
function nextUp(x: number): number {
  if (Number.isNaN(x) || x === Infinity) return x;
  if (x === -Infinity) return -Number.MAX_VALUE;
  if (x === 0) return Number.MIN_VALUE;
  buffer.setFloat64(0, x, false);
  let high = buffer.getUint32(0, false), low = buffer.getUint32(4, false);
  if (x > 0) { if (low === 0xffffffff) { low = 0; high++; } else low++; }
  else if (low === 0) { low = 0xffffffff; high--; } else low--;
  buffer.setUint32(0, high, false); buffer.setUint32(4, low, false);
  return buffer.getFloat64(0, false);
}
const nextDown = (x: number) => -nextUp(-x);
const interval = (lo: number, hi = lo): Interval => ({ lo, hi });
const plus = (a: Interval, b: Interval): Interval => ({ lo: nextDown(a.lo + b.lo), hi: nextUp(a.hi + b.hi) });
const minus = (a: Interval, b: Interval): Interval => plus(a, { lo: -b.hi, hi: -b.lo });
function times(a: Interval, b: Interval): Interval {
  const candidates = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi];
  return { lo: nextDown(Math.min(...candidates)), hi: nextUp(Math.max(...candidates)) };
}
function quotient(a: Interval, b: Interval): Interval {
  if (b.lo <= 0 && b.hi >= 0) throw new Error("Uncertified division across zero");
  return times(a, { lo: nextDown(1 / b.hi), hi: nextUp(1 / b.lo) });
}
const constant = (x: number): Jet => ({ value: interval(x), derivative: interval(0) });
const add = (a: Jet, b: Jet): Jet => ({ value: plus(a.value, b.value), derivative: plus(a.derivative, b.derivative) });
const sub = (a: Jet, b: Jet): Jet => ({ value: minus(a.value, b.value), derivative: minus(a.derivative, b.derivative) });
const mul = (a: Jet, b: Jet): Jet => ({ value: times(a.value, b.value),
  derivative: plus(times(a.derivative, b.value), times(a.value, b.derivative)) });
const div = (a: Jet, b: Jet): Jet => ({ value: quotient(a.value, b.value),
  derivative: quotient(minus(times(a.derivative, b.value), times(a.value, b.derivative)), times(b.value, b.value)) });
function positive(a: Jet): Jet {
  if (a.value.lo >= 0) return a;
  if (a.value.hi <= 0) return constant(0);
  return { value: interval(0, a.value.hi), derivative: interval(
    Math.min(0, a.derivative.lo), Math.max(0, a.derivative.hi)) };
}
const scale = (a: Jet, n: number) => mul(a, constant(n));
const midpoint = (i: Interval) => (i.lo + i.hi) / 2;

export type OperatingDriverSpec =
  | { kind: "global-module-volume-growth"; lower: 0; upper: number; globalWatts: number;
      maximumGlobalWatts: number; boundBasis: string }
  | { kind: "operating-cost-spread-change"; lower: number; upper: number;
      minimumMargin: number; maximumMargin: number; boundBasis: string }
  | { kind: "unsupported"; reason: string };
export type OperatingDriverCase = {
  symbol: string; input: OriginalIssuerInputs;
  baseline: { engineInput: any; ledger: any; funding: any[]; activity: any[] };
  driver: OperatingDriverSpec;
};
export const operatingDriverExperiment = Object.freeze({
  version: "issuer-operating-driver-rebuild-4", intervalPartitions: 128,
  rationale: [
    "A new experiment reading immutable v3 paths, NOT retuning/re-executing v3 builders or FCFE-shape reverse. Stub and actual revised-history equity reference remain fixed.",
    "Perturb the OPERATING driver in years 1-5; its annual increment fades linearly to zero over years 6-15, then zero in terminal. Original nominal terminal growth remains unchanged; the attained activity/margin level persists.",
    "FSLR driver is real global module volume, with source forward 19 GW baseline and conditional 21+4=25 GW completed nameplate ceiling. Full capital intensity is retained even within spare nameplate, never free growth. No incremental US credit eligibility is assumed for extra units; existing credit schedule is fixed and NOT current-law/FEOC verified.",
    "The FSLR bracket tests nonnegative volume expansion only; 19 GW is a frozen forward baseline, NOT a guaranteed demand floor. Negative demand/idle-capacity or disposal scenarios are outside this bracket, not ruled out.",
    "XOM driver is a consolidated operating COST-SPREAD margin change, NOT activity growth, a CCS tariff or causal climate effect. Source FY2022-2024 operating-only margin range supplies a frozen scenario envelope, not a prediction or legal future price limit. Physical activity does not change, hence no new physical capacity is invented.",
    "XOM inventory/payables follow the incremental cash spread relative to the FIXED FY2024 cash-cost/revenue ratio; noncash D&A timing does not reprice supplier working capital. Revenue/AR, physical fixed capital and revenue-linked cash reserve remain unchanged; tax changes at source cash-tax/core-pretax cash burden. No cash or debt added twice.",
    "FSLR new revenue, per-unit core profit/other cash costs, inventories/payables/advances/minimum cash and full capital/debt/D&A/interest/cash tax are rebuilt from stocks. Policy cash is not scaled with FCFE or assumed newly eligible US production.",
    "Negative annual investor cash is retained as voluntary pro-rata common funding, not fictitious financing. Nonpositive terminal cash refuses economic pairing.",
    "Keep the full existing future non-common cash-reserve schedule in the cost-spread scenario; do not infer new NCI distributions, ownership or contracted waterfall terms from improved consolidated margin.",
    "Uniqueness requires outward-rounded interval automatic-differentiation derivative bounds of one sign across the ENTIRE bracket. Interval range exclusions can prove no root. Endpoint/grid samples never establish uniqueness.",
    "Actual five-forecast-step FCFE CAGR uses rebuilt year-five cash and selected actual FY2024 base FCFE; nonpositive endpoints reject it. The six-calendar-year FY2024-to-2030 CAGR is separately labelled; neither is the operating perturbation.",
    "NEE consolidated EPS proxy does not identify a bounded physical/unit or consolidated cost/tariff driver. Refuse an operating reverse rather than inventing NEER cash returns or applying FPL ROE to the issuer.",
  ],
  qualifiedOriginalIssuers: 0, productionEligible: false, statutory45xEligibilityVerified: false,
});

/** Exact primary historical operating-only margin envelopes; no provider request. */
export function extractXomOperatingMarginEnvelope(html: string, identity: OriginalIssuerInputs["reconciliation"]["identity"]) {
  const primary = authenticatePrimaryIssuerCashflow(html, identity);
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)).map(m => [m[1], m[2]]));
  const usd = new Set(Array.from(html.matchAll(/<xbrli:unit id="([^"]+)">([\s\S]*?)<\/xbrli:unit>/g))
    .filter(m => m[2] === "<xbrli:measure>iso4217:USD</xbrli:measure>").map(m => m[1]));
  const claims: { tag: string; id: string; context: string; value: number; year: number }[] = [];
  const get = (tag: string, year: number, expected?: number) => {
    const found = primary.facts.filter(f => {
      const c = contexts.get(f.context) ?? "";
      return f.name === tag && usd.has(f.unit) && c.includes(`>${identity.cik}</xbrli:identifier>`) &&
        c.includes(`<xbrli:startDate>${year}-01-01</xbrli:startDate>`) &&
        c.includes(`<xbrli:endDate>${year}-12-31</xbrli:endDate>`) &&
        (expected === undefined ? !c.includes("<xbrli:segment>") : f.value === expected);
    });
    if (!found.length || new Set(found.map(f => f.value)).size !== 1) throw new Error(`Exact source margin claim absent: ${year} ${tag}`);
    const f = found[0]; claims.push({ tag, id: f.id, context: f.context, value: f.value, year }); return f.value;
  };
  const expected = [[2022, 398675e6, 11463e6, 3542e6], [2023, 334697e6, 6385e6, 3500e6], [2024, 339247e6, 6194e6, 4144e6]];
  const years = expected.map(([year, sales, equity, other]) => {
    const revenue = get("us-gaap:Revenues", year, sales);
    const operatingEbit = get("us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", year) +
      get("us-gaap:InterestExpense", year) - get("us-gaap:Revenues", year, equity) - get("us-gaap:Revenues", year, other);
    return { year, revenue, operatingEbit, operatingMargin: operatingEbit / revenue };
  });
  return { claims, years, minimum: Math.min(...years.map(y => y.operatingMargin)), maximum: Math.max(...years.map(y => y.operatingMargin)) };
}
export function fadeWeight(t: number) { return t <= 5 ? 1 : Math.max(0, 1 - (t - 5) / 10); }
export function makeFslrVolumeDriver(): OperatingDriverSpec {
  const globalWatts = 19e9, maximumGlobalWatts = 25e9;
  let lo = 0, hi = .2;
  const factor = (rho: number) => Array.from({ length: 15 }, (_, i) => 1 + rho * fadeWeight(i + 1)).reduce((a, b) => a * b, 1);
  for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (factor(m) * globalWatts <= maximumGlobalWatts) lo = m; else hi = m; }
  return { kind: "global-module-volume-growth", lower: 0, upper: lo * (1 - 1e-10), globalWatts, maximumGlobalWatts,
    boundBasis: "Source 2025 volume-guidance midpoint 19 GW; FY2024 21 GW nameplate plus planned 4 GW, conditional completion, no new capacity beyond 25 GW" };
}

/** The SAME graph executes points and outward interval derivatives. It rebuilds
 * operating cash and financing, never multiplies old FCFE by a growth factor. */
function graph(c: OperatingDriverCase, rho: Interval) {
  if (c.driver.kind === "unsupported") throw new Error(c.driver.reason);
  const b = c.baseline, x = b.engineInput, input = c.input, o = input.reconciliation.normalized;
  const baselineRows = [...b.ledger.years, ...b.ledger.continuationYears, b.ledger.terminalYear];
  const parameter: Jet = { value: rho, derivative: interval(1) };
  const leverage = input.debt / input.netPpe, daRate = o.depreciation / input.netPpe, interestRate = o.interest / input.debt;
  let ppe = constant(b.funding[0].closingPpe), debt = constant(b.funding[0].closingDebt);
  let ar = constant(baselineRows[0].openingReceivables);
  const wcSource = input.inventory + input.otherCurrentAssets + input.minimumCash - input.operatingPayables - input.customerAdvances;
  let wc = constant(wcSource * b.activity[0].nonCausalNominalRevenue / o.revenue);
  let activity = constant(1), marginIncrement = constant(0), value = constant(0);
  const time = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const stubPv = x.stub.cashFlows.reduce((sum: number, y: any) => sum + y.fcfe / (1 + x.discountRate) ** time(y.date), 0);
  value = add(value, constant(stubPv));
  const rows: Record<string, Jet | number>[] = [];
  for (let i = 0; i < 16; i++) {
    const t = i + 1, base = baselineRows[i], f = b.funding[i + 1], weight = fadeWeight(t);
    const volume = c.driver.kind === "global-module-volume-growth";
    activity = volume ? mul(activity, add(constant(1), scale(parameter, weight))) : constant(1);
    marginIncrement = volume ? constant(0) : add(marginIncrement, scale(parameter, weight));
    const revenue = scale(activity, base.revenue);
    const core = volume ? scale(activity, base.operatingProfitBeforeClimate) :
      mul(revenue, add(constant(base.operatingMarginBeforeClimateCostsAndCredits), marginIncrement));
    const openingPpe = ppe, openingDebt = debt, openingAr = ar, openingWc = wc;
    const depreciation = volume ? scale(openingPpe, daRate) : constant(base.depreciation);
    ppe = volume ? scale(activity, f.closingPpe) : constant(f.closingPpe);
    const cashPpe = add(sub(ppe, openingPpe), depreciation);
    debt = scale(ppe, leverage);
    const netBorrowing = sub(debt, openingDebt), interest = scale(openingDebt, interestRate);
    const otherCash = volume ? scale(activity, base.otherOperatingCash) : constant(base.otherOperatingCash);
    const baseCashCost = base.revenue - base.operatingProfitBeforeClimate - base.depreciation;
    if (!(baseCashCost > 0)) throw new Error("Nonpositive baseline operating cash cost");
    const cashCost = sub(sub(revenue, core), depreciation);
    const fixedCashProcurementBase = (o.revenue - o.operatingProfit - o.depreciation) / o.revenue * base.revenue;
    if (!(fixedCashProcurementBase > 0)) throw new Error("Nonpositive source cash-procurement ratio");
    const costRatio = sub(constant(1), div(sub(core, constant(base.operatingProfitBeforeClimate)), constant(fixedCashProcurementBase)));
    ar = volume ? scale(activity, base.closingReceivables) : constant(base.closingReceivables);
    const scaleRevenue = base.revenue / o.revenue;
    wc = volume ? scale(activity, wcSource * scaleRevenue) :
      add(scale(costRatio, (input.inventory - input.operatingPayables) * scaleRevenue),
        constant((input.otherCurrentAssets + input.minimumCash - input.customerAdvances) * scaleRevenue));
    const arIncrease = sub(ar, openingAr), otherWcIncrease = sub(wc, openingWc);
    const sourceTaxRate = o.cashTax / (o.operatingProfit + o.otherCash - o.interest);
    const tax = volume ? scale(positive(sub(add(core, otherCash), interest)), .21) :
      positive(add(constant(base.cashTax), scale(sub(core, constant(base.operatingProfitBeforeClimate)), sourceTaxRate)));
    const otherInvestment = base.capitalSpend - f.cashPpe;
    const capex = add(cashPpe, volume ? scale(activity, otherInvestment) : constant(otherInvestment));
    const cfo = sub(sub(sub(sub(add(add(core, depreciation), add(otherCash, constant(base.cashPolicyCredit))),
      arIncrease), otherWcIncrease), interest), tax);
    const fcfe = sub(add(sub(cfo, capex), netBorrowing), constant(base.nonCommonCashClaims));
    const roll = t <= 4 ? constant(f.rollover) : scale(openingDebt, o.annualRollover / input.debt);
    const proceeds = add(roll, positive(netBorrowing)), repayment = add(roll, positive(scale(netBorrowing, -1)));
    rows.push({ year: base.year, revenue, coreProfit: core, cashOperatingCost: cashCost, depreciation,
      openingPpe, closingPpe: ppe, cashPpe, capex, openingDebt, closingDebt: debt, debtProceeds: proceeds, debtRepayments: repayment,
      interest, cashTax: tax, otherOperatingCash: otherCash, openingReceivables: openingAr, closingReceivables: ar,
      receivablesIncrease: arIncrease, otherWorkingCapitalIncrease: otherWcIncrease,
      policyCash: constant(base.cashPolicyCredit), recognizedPolicyCredit: constant(base.recognizedPolicyCredit),
      nonCommonCashClaims: constant(base.nonCommonCashClaims), cfo, fcfe, activityMultiplier: activity,
      operatingMargin: div(core, revenue), globalWatts: scale(activity, volume ? c.driver.kind === "global-module-volume-growth" ? c.driver.globalWatts : 0 : 0),
      minimumCash: volume ? scale(activity, input.minimumCash * scaleRevenue) : constant(input.minimumCash * scaleRevenue) });
    if (t <= 15) value = add(value, scale(fcfe, 1 / (1 + x.discountRate) ** time(base.cashFlowDate)));
    else value = add(value, scale(fcfe, 1 / (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** time(baselineRows[14].cashFlowDate)));
  }
  return { value, rows, stubPv };
}
export function rebuildOperatingDriverCash(c: OperatingDriverCase, parameter: number) {
  if (c.driver.kind === "unsupported") throw new Error(c.driver.reason);
  if (!Number.isFinite(parameter) || parameter < c.driver.lower || parameter > c.driver.upper) throw new Error("Driver outside frozen source-bound envelope");
  const result = graph(c, interval(parameter));
  const rows = result.rows.map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "number" ? v : midpoint(v.value)]))) as Record<string, number>[];
  const terminal = rows[15], previous = rows[14], g = c.baseline.engineInput.terminalGrowth;
  for (const field of ["revenue", "coreProfit", "depreciation", "capex", "interest", "cashTax", "otherOperatingCash",
    "closingPpe", "openingPpe", "closingDebt", "openingDebt", "closingReceivables", "receivablesIncrease",
    "otherWorkingCapitalIncrease", "fcfe", "minimumCash"])
    if (Math.abs(terminal[field] - previous[field] * (1 + g)) > .02) throw new Error(`Rebuilt terminal not funded at original nominal growth: ${field}`);
  for (const row of rows) {
    if (row.cashPpe < 0 || row.cashOperatingCost < 0) throw new Error("Unsupported negative investment/cost in operating rebuild");
    if (Math.abs(row.openingPpe + row.cashPpe - row.depreciation - row.closingPpe) > .02 ||
      Math.abs(row.openingDebt + row.debtProceeds - row.debtRepayments - row.closingDebt) > .02)
      throw new Error("Rebuilt fixed-capital/debt cash reconciliation failed");
    if (c.driver.kind === "global-module-volume-growth" && row.globalWatts > c.driver.maximumGlobalWatts)
      throw new Error("Source conditional nameplate capacity exceeded");
    if (c.driver.kind === "operating-cost-spread-change" &&
      (row.operatingMargin < c.driver.minimumMargin - 1e-12 || row.operatingMargin > c.driver.maximumMargin + 1e-12))
      throw new Error("Source historical-margin scenario envelope exceeded");
  }
  return { parameter, driverKind: c.driver.kind, rows,
    forwardWholeEquity: terminal.fcfe > 0 ? midpoint(result.value.value) : null,
    formalSignedCashSum: midpoint(result.value.value),
    valueInterval: result.value.value, stubPresentValue: result.stubPv,
    stubTreatment: "Fixed original dated stub, not scaled or re-scored", terminalFcfe: terminal.fcfe,
    qualifiedOriginalIssuers: 0, statutory45xEligibilityVerified: false };
}
export function actualFcfeGrowth(c: OperatingDriverCase, rebuilt: ReturnType<typeof rebuildOperatingDriverCash>) {
  const baseline = c.baseline.engineInput.baseFcfe, end = rebuilt.rows[4].fcfe;
  if (!(baseline > 0)) return { status: "rejected-nonpositive-actual-baseline", fiveForecastStepCagr: null,
    actualCalendarCagr: null, baselineFcfe: baseline, yearFiveFcfe: end };
  if (!(end > 0)) return { status: "rejected-nonpositive-year-five", fiveForecastStepCagr: null,
    actualCalendarCagr: null, baselineFcfe: baseline, yearFiveFcfe: end };
  const fiveForecastStepCagr = (end / baseline) ** (1 / 5) - 1;
  return { status: Number.isFinite(fiveForecastStepCagr) ? "defined" : "rejected-growth-undefined",
    fiveForecastStepCagr: Number.isFinite(fiveForecastStepCagr) ? fiveForecastStepCagr : null,
    actualCalendarCagr: (end / baseline) ** (1 / 6) - 1, baselineFcfe: baseline, yearFiveFcfe: end,
    calendarBasis: "Selected FY2024 actual to year-five FY2030 is SIX calendar years; five-step forecast CAGR is separately labelled" };
}
export function reverseOperatingDriver(c: OperatingDriverCase, marketEquity: number) {
  if (c.driver.kind === "unsupported") return { status: "unsupported-operating-driver", reason: c.driver.reason, qualifiedOriginalIssuers: 0 };
  if (!(marketEquity > 0 && Number.isFinite(marketEquity))) throw new Error("Positive actual same-date equity reference required");
  const baseline = rebuildOperatingDriverCash(c, 0), lower = rebuildOperatingDriverCash(c, c.driver.lower), upper = rebuildOperatingDriverCash(c, c.driver.upper);
  const cells: { lo: number; hi: number; value: Interval; derivative: Interval; terminal: Interval; feasible: boolean }[] = [];
  for (let i = 0; i < operatingDriverExperiment.intervalPartitions; i++) {
    const lo = c.driver.lower + (c.driver.upper - c.driver.lower) * i / operatingDriverExperiment.intervalPartitions;
    const hi = c.driver.lower + (c.driver.upper - c.driver.lower) * (i + 1) / operatingDriverExperiment.intervalPartitions;
    const enclosed = graph(c, interval(lo, hi));
    cells.push({ lo, hi, value: enclosed.value.value, derivative: enclosed.value.derivative,
      terminal: (enclosed.rows[15].fcfe as Jet).value,
      feasible: enclosed.rows.every(row => (row.cashPpe as Jet).value.lo >= 0 && (row.cashOperatingCost as Jet).value.lo >= 0 &&
        (c.driver.kind !== "global-module-volume-growth" ||
          (row.globalWatts as Jet).value.hi <= c.driver.maximumGlobalWatts)) });
  }
  const proof = { method: "outward-rounded interval automatic differentiation, NOT sampled-grid uniqueness",
    intervals: cells.length, lowerDerivative: Math.min(...cells.map(c => c.derivative.lo)),
    upperDerivative: Math.max(...cells.map(c => c.derivative.hi)),
    lowerValue: Math.min(...cells.map(c => c.value.lo)), upperValue: Math.max(...cells.map(c => c.value.hi)),
    fundedTerminalThroughoutBracket: cells.every(cell => cell.terminal.lo > 0),
    originalBracket: [c.driver.lower, c.driver.upper] };
  const increasing = proof.lowerDerivative > 0, decreasing = proof.upperDerivative < 0;
  const baselineGrowth = actualFcfeGrowth(c, baseline);
  const common = { driver: c.driver, baseline, endpoints: { lower, upper }, proof, baselineGrowth,
    equityReferenceMode: "revised-history-conditional", qualifiedOriginalIssuers: 0, statutory45xEligibilityVerified: false };
  if (!cells.every(cell => cell.feasible))
    return { ...common, status: "uncertified-operating-feasibility-domain", impliedOperatingPerturbation: null, impliedFcfeGrowth: null };
  if (cells.every(cell => cell.terminal.hi <= 0))
    return { ...common, status: "rejected-nonpositive-terminal-throughout-bracket", impliedOperatingPerturbation: null, impliedFcfeGrowth: null };
  if (cells.every(cell => cell.value.hi < marketEquity) || cells.every(cell => cell.value.lo > marketEquity))
    return { ...common, status: "no-root-certified-range", impliedOperatingPerturbation: null, impliedFcfeGrowth: null,
      exclusionScope: "Outward interval cash-sum envelope excludes target even over the superset; any funded subset therefore has no root. This does not certify all terminal states." };
  if (!cells.every(cell => cell.terminal.lo > 0))
    return { ...common, status: "uncertified-funded-terminal-domain", impliedOperatingPerturbation: null, impliedFcfeGrowth: null };
  if (!increasing && !decreasing)
    return { ...common, status: "uncertified-monotonicity-or-multiple-roots-not-excluded", impliedOperatingPerturbation: null, impliedFcfeGrowth: null };
  const signLow = lower.formalSignedCashSum - marketEquity, signHigh = upper.formalSignedCashSum - marketEquity;
  if (signLow * signHigh > 0)
    return { ...common, status: "no-root-certified-monotonic-bracket", impliedOperatingPerturbation: null, impliedFcfeGrowth: null };
  let lo = c.driver.lower, hi = c.driver.upper;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2, v = rebuildOperatingDriverCash(c, mid).formalSignedCashSum;
    if (increasing ? v < marketEquity : v > marketEquity) lo = mid; else hi = mid;
  }
  const impliedOperatingPerturbation = (lo + hi) / 2, rebuilt = rebuildOperatingDriverCash(c, impliedOperatingPerturbation);
  const impliedFcfeGrowth = actualFcfeGrowth(c, rebuilt);
  const relativeRepricingError = Math.abs(rebuilt.formalSignedCashSum / marketEquity - 1);
  if (relativeRepricingError > 1e-8) throw new Error("Independent rebuilt operating-driver repricing failed");
  return { ...common, status: rebuilt.terminalFcfe <= 0 ? "rejected-nonpositive-rebuilt-terminal" :
    impliedFcfeGrowth.status !== "defined" ? "operating-target-match-rejected-undefined-fcfe-growth" : "conditional-operating-driver-target-match",
    impliedOperatingPerturbation, impliedFcfeGrowth, rebuilt, relativeRepricingError,
    interpretation: "Operating unit-growth or cost-spread perturbation is DISTINCT from actual rebuilt five-step FCFE growth; no causal climate coefficient asserted" };
}

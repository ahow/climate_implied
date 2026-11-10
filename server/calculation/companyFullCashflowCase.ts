import { z } from "zod";

const n = z.number().finite(), positive = n.positive(), nonnegative = n.nonnegative();
const source = z.object({
  id: z.string().min(1), kind: z.enum(["primary-disclosure", "frozen-analyst-assumption"]),
  rationale: z.string().min(1), availableAt: z.string().datetime(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
const year = z.object({
  year: z.number().int(), cashFlowDate: z.string().date(),
  evidenceIds: z.array(z.string()).min(1),
  nonClimateRevenue: nonnegative, climateRevenue: n,
  operatingMarginBeforeClimateCostsAndCredits: n.min(-1).max(1),
  climateOperatingCost: nonnegative, recognizedPolicyCredit: nonnegative,
  cashPolicyCredit: nonnegative, depreciation: nonnegative, otherNonCash: n,
  openingReceivables: nonnegative, closingReceivables: nonnegative,
  increaseOtherOperatingWorkingCapital: n,
  interestPaid: nonnegative, cashTax: nonnegative, otherOperatingCash: n,
  capitalSpend: nonnegative, debtProceeds: nonnegative, debtRepayments: nonnegative,
  nonCommonCashClaims: nonnegative,
}).strict();
const specification = z.object({
  symbol: z.string().min(1), cik: z.string().regex(/^\d{10}$/),
  security: z.string().min(1), currency: z.literal("USD"),
  referenceDate: z.string().date(), frozenAt: z.string().datetime(),
  firstYear: z.number().int(), baseFcfe: n,
  evidence: z.array(source).min(1), years: z.array(year).length(5),
  boundary: z.literal("whole-issuer-common-equity"),
  unresolvedAccountingClaims: z.array(z.string()),
  discountRate: positive.max(1).optional(), terminalGrowth: n.min(0).max(.2).optional(),
  continuationGrowthAtYear5: n.gt(-1).max(1).optional(),
  terminalEvidenceIds: z.array(z.string()).min(1).optional(),
}).strict();

/**
 * Explicit five-year accrual-to-cash ledger. Collection timing consumes only
 * receivables; other WC excludes receivables and policy-credit receivables.
 * No future schedules, cash tax, credit entitlement or financing are inferred.
 * This is a private alternative, not a change to Gordon or D8 model selection.
 */
export function calculateCompanyFullCashflowCase(input: unknown) {
  const x = specification.parse(input);
  const terminalEntries = [x.discountRate, x.terminalGrowth, x.continuationGrowthAtYear5, x.terminalEvidenceIds];
  const hasTerminal = terminalEntries.every(v => v !== undefined);
  if (terminalEntries.some(v => v !== undefined) && !hasTerminal)
    throw new Error("Supply all justified terminal model entries, or none for cash-schedule-only execution");
  if (hasTerminal && x.discountRate! <= x.terminalGrowth!) throw new Error("Discount rate must exceed terminal growth");
  if (x.firstYear <= Number(x.referenceDate.slice(0, 4))) throw new Error("Full annual prospective window must follow reference year");
  const ids = new Set(x.evidence.map(e => e.id));
  if (ids.size !== x.evidence.length) throw new Error("Duplicate evidence identity");
  const checkIds = (list: string[]) => {
    if (list.some(id => !ids.has(id))) throw new Error("Unknown evidence or assumption");
  };
  if (x.terminalEvidenceIds) checkIds(x.terminalEvidenceIds);
  if (x.evidence.some(e => e.availableAt.slice(0, 10) > x.referenceDate ||
      Date.parse(e.availableAt) > Date.parse(x.frozenAt)))
    throw new Error("Evidence/assumption unavailable at reference or freeze; no backdating");
  const years = x.years.map((y, i) => {
    checkIds(y.evidenceIds);
    if (y.year !== x.firstYear + i) throw new Error("Five consecutive ordered annual years required");
    if (y.cashFlowDate !== `${y.year}-12-31`) throw new Error("Explicit calendar year-end cash-flow date required");
    if (i && y.openingReceivables !== x.years[i - 1].closingReceivables)
      throw new Error("Receivables continuity failed");
    const revenue = y.nonClimateRevenue + y.climateRevenue;
    if (revenue < 0) throw new Error("Negative total revenue");
    const operatingProfitBeforeClimate = revenue * y.operatingMarginBeforeClimateCostsAndCredits;
    const operatingProfit = operatingProfitBeforeClimate - y.climateOperatingCost + y.recognizedPolicyCredit;
    const receivablesIncrease = y.closingReceivables - y.openingReceivables;
    const collections = revenue - receivablesIncrease;
    // Recognized policy benefit is already in earnings. Remove it before adding
    // independently scheduled credit cash; do not add it to CFO a second time.
    const operatingCashFlow = operatingProfit + y.depreciation + y.otherNonCash -
      y.recognizedPolicyCredit + y.cashPolicyCredit - receivablesIncrease -
      y.increaseOtherOperatingWorkingCapital - y.interestPaid - y.cashTax + y.otherOperatingCash;
    const fcfe = operatingCashFlow - y.capitalSpend + y.debtProceeds -
      y.debtRepayments - y.nonCommonCashClaims;
    if (![revenue, collections, operatingProfit, operatingCashFlow, fcfe].every(Number.isFinite))
      throw new Error("Nonfinite full cash-flow ledger");
    return { ...y, revenue, operatingProfitBeforeClimate, operatingProfit, receivablesIncrease,
      collections, operatingCashFlow, fcfe };
  });
  const gaps = [...x.unresolvedAccountingClaims];
  if (hasTerminal && years[4].fcfe <= 0) gaps.push("Year-five FCFE must be positive for this continuation; no invented recovery.");
  return { status: gaps.length ? "blocked" as const : "conditional-full-cashflow-case" as const,
    specification: x, years, gaps, productionEligible: false, identityApproved: false,
    completeApprovedIssuerCases: 0,
    terminalModelStatus: hasTerminal ? "explicit-conditional-continuation" : "withheld-no-justified-terminal-basis",
    cashConventions: {
      wcExcludes: ["trade receivables already in collections", "policy credit receivables separately scheduled"],
      creditTreatment: "Recognized credit removed once; only scheduled cash credit added.",
      cashTax: "Explicit annual cash tax, not automatic refunds or earnings tax rate.",
      financing: "Cash debt proceeds less repayments; common equity issuance is not FCFE.",
      claims: "Explicit non-common cash claims deducted; no second net-debt subtraction or cash add-on.",
    } };
}

/**
 * Both directions use the actual five annual FCFE entries, the SAME explicit
 * ten-year continuation and terminal value. Reverse output is a path-shape-
 * preserving FCFE growth adjustment, NOT constant five-year FCFE CAGR and not
 * a climate-activity growth estimate. Annual negative FCFE is retained in forward
 * PV; a reverse solve is refused if monotonicity is not established.
 */
export function pairCompanyFullCashflowCase(input: unknown, market: {
  symbol: string; cik: string; security: string; currency: "USD";
  referenceDate: string; priceDate: string; sharesDate: string;
  price: number; shares: number;
  datedReferenceReviewed: boolean;
}) {
  const ledger = calculateCompanyFullCashflowCase(input);
  const x = ledger.specification;
  if (ledger.status === "blocked") return { ...ledger, pairing: "blocked", pairGaps: ledger.gaps };
  if (x.discountRate === undefined || x.terminalGrowth === undefined || x.continuationGrowthAtYear5 === undefined)
    return { ...ledger, pairing: "blocked", pairGaps: ["Full five-year cash schedule computed; no justified terminal/continuation model supplied."] };
  const discountRate = x.discountRate, terminalGrowth = x.terminalGrowth;
  const continuationGrowthAtYear5 = x.continuationGrowthAtYear5;
  if (["symbol", "cik", "security", "currency", "referenceDate"].some(k =>
    market[k as keyof typeof market] !== x[k as keyof typeof x]))
    throw new Error("Market and full operating case identity/basis mismatch");
  if (market.referenceDate !== market.priceDate || market.referenceDate !== market.sharesDate)
    throw new Error("Same-date price and primary common shares required");
  if (!market.datedReferenceReviewed) return { ...ledger, pairing: "blocked",
    pairGaps: ["Primary share/classes/actions, quote authority and publication basis require review."] };
  if (![market.price, market.shares].every(v => Number.isFinite(v) && v > 0))
    throw new Error("Positive dated price and explicit common shares required");
  const discountTime = (date: string) => (Date.parse(`${date}T00:00:00Z`) -
    Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const value = (adjustment: number) => {
    let pv = ledger.years.reduce((s, y, i) =>
      s + y.fcfe * (1 + adjustment) ** (i + 1) / (1 + discountRate) ** discountTime(y.cashFlowDate), 0);
    let cash = ledger.years[4].fcfe * (1 + adjustment) ** 5;
    const continuationGrowth = (1 + continuationGrowthAtYear5) * (1 + adjustment) - 1;
    for (let t = 6; t <= 15; t++) {
      const g = continuationGrowth + (terminalGrowth - continuationGrowth) * (t - 5) / 10;
      cash *= 1 + g;
      pv += cash / (1 + discountRate) ** discountTime(`${x.firstYear + t - 1}-12-31`);
    }
    return pv + cash * (1 + terminalGrowth) / (discountRate - terminalGrowth) /
      (1 + discountRate) ** discountTime(`${x.firstYear + 14}-12-31`);
  };
  const forwardWholeEquity = value(0), target = market.price * market.shares;
  if (ledger.years.some(y => y.fcfe <= 0)) return { ...ledger,
    forwardWholeEquity, pairing: "reverse-unavailable",
    pairGaps: ["Non-positive annual FCFE: no monotonic reverse guarantee; forward retains losses, recovery not invented."] };
  let lo = -.5, hi = .5;
  if (value(lo) > target || value(hi) < target) return { ...ledger,
    forwardWholeEquity, pairing: "reverse-unavailable", pairGaps: ["Target outside fixed [-50%,50%] annual adjustment bracket; no extrapolation."] };
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) < target) lo = mid; else hi = mid;
  }
  const impliedAnnualFcfeAdjustment = (lo + hi) / 2;
  const relativeRepricingError = Math.abs(value(impliedAnnualFcfeAdjustment) / target - 1);
  if (relativeRepricingError > 1e-8) throw new Error("Same-basis full-path repricing tolerance failed");
  return { ...ledger, pairing: "conditional-same-basis-whole-equity",
    forwardWholeEquity, marketWholeEquity: target, impliedAnnualFcfeAdjustment, relativeRepricingError,
    definition: "Path-preserving annual FCFE growth adjustment to five explicit years with ten-year fade and terminal at year 15; zero is the frozen forward case.",
    discountTiming: "Explicit calendar year-end cash flows; actual days from market reference /365.25. This convention is identical in forward and reverse.",
    growthComparison: "Not a comparison of endpoint CAGR with a constant-growth reverse DCF; no climate expectation or activity inversion inferred.",
    terminalAssumptions: { discountRate: x.discountRate, terminalGrowth: x.terminalGrowth,
      continuationGrowthAtYear5: x.continuationGrowthAtYear5, evidenceIds: x.terminalEvidenceIds } };
}

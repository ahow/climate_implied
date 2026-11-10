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
  informationContext: z.object({
    mode: z.enum(["prospective-conditional", "historical-point-in-time", "revised-history-conditional"]),
    modelAsOf: z.string().datetime(), informationCutoff: z.string().datetime(),
  }).strict().optional(),
  stub: z.object({
    cashBasis: z.literal("FCFE-whole-issuer-common-equity"), currency: z.literal("USD"),
    throughDate: z.string().date(), rationale: z.string().trim().min(1),
    completenessEvidenceIds: z.array(z.string().min(1)).min(1),
    cashFlows: z.array(z.object({
      date: z.string().date(), fcfe: n, evidenceIds: z.array(z.string().min(1)).min(1),
    }).strict()),
  }).strict().optional(),
  continuation: z.object({
    years: z.array(year).length(10), terminalYear: year,
    rationale: z.string().trim().min(1),
  }).strict().optional(),
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
  const context = x.informationContext;
  if (context && (context.modelAsOf.slice(0, 10) !== x.referenceDate ||
      Date.parse(x.frozenAt) > Date.parse(context.informationCutoff) ||
      (context.mode !== "revised-history-conditional" &&
        Date.parse(context.informationCutoff) > Date.parse(context.modelAsOf))))
    throw new Error("Information cutoff must include actual freeze and not exceed model as-of; referenceDate is model valuation date");
  if (x.evidence.some(e => (context ? Date.parse(e.availableAt) > Date.parse(context.informationCutoff) :
      e.availableAt.slice(0, 10) > x.referenceDate) ||
      Date.parse(e.availableAt) > Date.parse(x.frozenAt)))
    throw new Error("Evidence/assumption unavailable at reference or freeze; no backdating");
  if (x.stub) {
    if (x.stub.throughDate !== `${x.firstYear - 1}-12-31` || x.stub.throughDate < x.referenceDate)
      throw new Error("Stub must cover from model reference through the day before the first full annual year");
    checkIds(x.stub.completenessEvidenceIds);
    let previous = x.referenceDate;
    for (const row of x.stub.cashFlows) {
      checkIds(row.evidenceIds);
      if (row.date <= previous || row.date > x.stub.throughDate)
        throw new Error("Stub cash dates must be ordered after reference and within explicit coverage");
      previous = row.date;
    }
  }
  const allRows = [...x.years, ...(x.continuation ? [...x.continuation.years, x.continuation.terminalYear] : [])];
  const calculatedRows = allRows.map((y, i) => {
    checkIds(y.evidenceIds);
    if (y.year !== x.firstYear + i) throw new Error("Five consecutive ordered annual years required");
    if (y.cashFlowDate !== `${y.year}-12-31`) throw new Error("Explicit calendar year-end cash-flow date required");
    if (i && y.openingReceivables !== allRows[i - 1].closingReceivables)
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
  const years = calculatedRows.slice(0, 5);
  const continuationYears = calculatedRows.slice(5, 15);
  const terminalYear = calculatedRows[15] ?? null;
  if (x.continuation && !hasTerminal) throw new Error("Explicit operating continuation requires terminal discount/growth basis");
  if (terminalYear) {
    const previous = continuationYears[9];
    // An operating terminal must reconcile reinvestment and every cash bridge,
    // not merely assert that a credit-bearing year-five FCFE is sustainable.
    for (const key of ["nonClimateRevenue", "climateRevenue", "climateOperatingCost",
      "recognizedPolicyCredit", "cashPolicyCredit", "depreciation", "otherNonCash",
      "interestPaid", "cashTax", "otherOperatingCash", "capitalSpend", "debtProceeds",
      "debtRepayments", "nonCommonCashClaims", "increaseOtherOperatingWorkingCapital",
      "openingReceivables", "closingReceivables"] as const) {
      if (Math.abs(terminalYear[key] - previous[key] * (1 + x.terminalGrowth!)) > .01)
        throw new Error(`Terminal operating field ${key} does not support declared perpetual growth`);
    }
    if (terminalYear.operatingMarginBeforeClimateCostsAndCredits !==
        previous.operatingMarginBeforeClimateCostsAndCredits)
      throw new Error("Terminal operating margin changes without a sustainable continuation");
    if (Math.abs(terminalYear.fcfe - previous.fcfe * (1 + x.terminalGrowth!)) > .01)
      throw new Error("Terminal FCFE does not reconcile to operating continuation growth");
  }
  const gaps = [...x.unresolvedAccountingClaims];
  if (hasTerminal && years[4].fcfe <= 0) gaps.push("Year-five FCFE must be positive for this continuation; no invented recovery.");
  if (terminalYear && terminalYear.fcfe <= 0)
    gaps.push("Explicit terminal operating year must have positive sustainable FCFE.");
  return { status: gaps.length ? "blocked" as const : "conditional-full-cashflow-case" as const,
    specification: x, years, continuationYears, terminalYear, gaps, productionEligible: false, identityApproved: false,
    completeApprovedIssuerCases: 0,
    stubStatus: x.stub ? (x.stub.cashFlows.length ? "explicit-dated-fcfe-stub" : "explicit-evidenced-zero-stub") :
      "missing-stub-not-assumed-zero-legacy-schedule-only",
    terminalModelStatus: x.continuation ? "explicit-operating-continuation-and-terminal-year" :
      hasTerminal ? "explicit-conditional-continuation" : "withheld-no-justified-terminal-basis",
    cashConventions: {
      wcExcludes: ["trade receivables already in collections", "policy credit receivables separately scheduled"],
      creditTreatment: "Recognized credit removed once; only scheduled cash credit added.",
      cashTax: "Explicit annual cash tax, not automatic refunds or earnings tax rate.",
      financing: "Cash debt proceeds less repayments; common equity issuance is not FCFE.",
      claims: "Explicit non-common cash claims deducted; no second net-debt subtraction or cash add-on.",
    } };
}

/** Same dated FCFE arithmetic for market-free forward work and both pair directions. */
export function valueCompanyFullCashflowCase(input: unknown, adjustment = 0) {
  const ledger = calculateCompanyFullCashflowCase(input), x = ledger.specification;
  if (ledger.status === "blocked") throw new Error(`Unresolved accounting claims: ${ledger.gaps.join("; ")}`);
  if (!x.stub || x.discountRate === undefined || x.terminalGrowth === undefined ||
      x.continuationGrowthAtYear5 === undefined) throw new Error("Explicit stub and complete terminal basis required");
  if (!Number.isFinite(adjustment) || adjustment <= -1) throw new Error("Invalid path adjustment");
  const discountTime = (date: string) => (Date.parse(`${date}T00:00:00Z`) -
    Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const stubCashFlows = x.stub.cashFlows.map(row => ({ ...row, discountYears: discountTime(row.date),
    presentValue: row.fcfe / (1 + x.discountRate!) ** discountTime(row.date) }));
  const stubPresentValue = stubCashFlows.reduce((sum, row) => sum + row.presentValue, 0);
  let pv = stubPresentValue + ledger.years.reduce((sum, row, i) => sum +
    row.fcfe * (1 + adjustment) ** (i + 1) / (1 + x.discountRate!) ** discountTime(row.cashFlowDate), 0);
  let cash = ledger.years[4].fcfe * (1 + adjustment) ** 5;
  if (x.continuation) {
    ledger.continuationYears.forEach((row, i) => {
      pv += row.fcfe * (1 + adjustment) ** (i + 6) /
        (1 + x.discountRate!) ** discountTime(row.cashFlowDate);
    });
    cash = ledger.terminalYear!.fcfe * (1 + adjustment) ** 16;
  } else {
    const continuationGrowth = (1 + x.continuationGrowthAtYear5) * (1 + adjustment) - 1;
    for (let t = 6; t <= 15; t++) {
      cash *= 1 + continuationGrowth + (x.terminalGrowth - continuationGrowth) * (t - 5) / 10;
      pv += cash / (1 + x.discountRate) ** discountTime(`${x.firstYear + t - 1}-12-31`);
    }
    cash *= 1 + x.terminalGrowth;
  }
  const terminalPresentValue = cash / (x.discountRate - x.terminalGrowth) /
    (1 + x.discountRate) ** discountTime(`${x.firstYear + 14}-12-31`);
  const forwardWholeEquity = pv + terminalPresentValue;
  if (![stubPresentValue, terminalPresentValue, forwardWholeEquity].every(Number.isFinite))
    throw new Error("Nonfinite full-path value including dated stub");
  return { forwardWholeEquity, stubPresentValue, stubCashFlows, terminalPresentValue };
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
  quoteAt?: string; observedAt?: string;
}) {
  const ledger = calculateCompanyFullCashflowCase(input);
  const x = ledger.specification;
  if (ledger.status === "blocked") return { ...ledger, pairing: "blocked", pairGaps: ledger.gaps };
  if (x.discountRate === undefined || x.terminalGrowth === undefined || x.continuationGrowthAtYear5 === undefined)
    return { ...ledger, pairing: "blocked", pairGaps: ["Full five-year cash schedule computed; no justified terminal/continuation model supplied."] };
  const discountRate = x.discountRate, terminalGrowth = x.terminalGrowth;
  const continuationGrowthAtYear5 = x.continuationGrowthAtYear5;
  if (!x.stub) return { ...ledger, pairing: "blocked",
    pairGaps: ["Explicit dated FCFE stub and coverage evidence required; legacy annual schedule remains available, no implicit zero stub."] };
  if (["symbol", "cik", "security", "currency", "referenceDate"].some(k =>
    market[k as keyof typeof market] !== x[k as keyof typeof x]))
    throw new Error("Market and full operating case identity/basis mismatch");
  const revisedHistory = x.informationContext?.mode === "revised-history-conditional";
  const prospective = x.informationContext?.mode === "prospective-conditional";
  if (market.priceDate !== market.sharesDate || (prospective ?
      market.priceDate > market.referenceDate : market.referenceDate !== market.priceDate))
    throw new Error("Same-date price and primary common shares required; prospective last-close date cannot exceed model reference");
  if (market.quoteAt) {
    z.string().datetime().parse(market.quoteAt);
    if (market.quoteAt.slice(0, 10) !== market.priceDate ||
        Date.parse(market.quoteAt) > Date.parse(x.informationContext?.informationCutoff ??
          `${x.referenceDate}T23:59:59.999Z`))
      throw new Error("Quote observation exceeds information cutoff or differs from price date");
  }
  if (market.observedAt) {
    z.string().datetime().parse(market.observedAt);
    if (market.quoteAt && Date.parse(market.observedAt) < Date.parse(market.quoteAt))
      throw new Error("Quote retrieval cannot precede quote observation");
  }
  if (!market.datedReferenceReviewed) return { ...ledger, pairing: "blocked",
    pairGaps: ["Primary share/classes/actions, quote authority and publication basis require review."] };
  if (![market.price, market.shares].every(v => Number.isFinite(v) && v > 0))
    throw new Error("Positive dated price and explicit common shares required");
  // Stub FCFE is already net cash to common equity. Do not subtract working
  // capital/debt again. Hold the sourced stub FIXED in both directions: the
  // solved adjustment affects only full forecast years and continuation.
  const forward = valueCompanyFullCashflowCase(input);
  const { stubCashFlows, stubPresentValue } = forward;
  const value = (adjustment: number) => valueCompanyFullCashflowCase(input, adjustment).forwardWholeEquity;
  const forwardWholeEquity = value(0), target = market.price * market.shares;
  const valuationDetails = { stubCashFlows, stubPresentValue,
    stubAdjustmentTreatment: "Fixed sourced stub FCFE in forward and reverse; annual adjustment starts at first full forecast year",
    modelAsOf: x.informationContext?.modelAsOf ?? x.referenceDate,
    informationCutoff: x.informationContext?.informationCutoff ?? null,
    comparisonMode: x.informationContext?.mode ?? "legacy-same-date",
    quoteDate: market.priceDate, quoteAt: market.quoteAt ?? null,
    quoteObservedAt: market.observedAt ?? null,
    priceTiming: revisedHistory ? "Revised history using later filing and actual later assumption freeze; NOT information known at historical close" :
      prospective ? "Explicit last available dated quote; conditional comparison at model as-of, not historical point-in-time attribution" :
      "Same-date historical reference" };
  if ([...ledger.years, ...ledger.continuationYears, ...(ledger.terminalYear ? [ledger.terminalYear] : [])].some(y => y.fcfe <= 0)) return { ...ledger,
    ...valuationDetails, forwardWholeEquity, pairing: "reverse-unavailable",
    pairGaps: ["Non-positive annual FCFE: no monotonic reverse guarantee; forward retains losses, recovery not invented."] };
  let lo = -.5, hi = .5;
  if (value(lo) > target || value(hi) < target) return { ...ledger,
    ...valuationDetails, forwardWholeEquity, pairing: "reverse-unavailable", pairGaps: ["Target outside fixed [-50%,50%] annual adjustment bracket; no extrapolation."] };
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (value(mid) < target) lo = mid; else hi = mid;
  }
  const impliedAnnualFcfeAdjustment = (lo + hi) / 2;
  const relativeRepricingError = Math.abs(value(impliedAnnualFcfeAdjustment) / target - 1);
  if (relativeRepricingError > 1e-8) throw new Error("Same-basis full-path repricing tolerance failed");
  return { ...ledger, pairing: "conditional-same-basis-whole-equity",
    ...valuationDetails, forwardWholeEquity, marketWholeEquity: target, impliedAnnualFcfeAdjustment, relativeRepricingError,
    definition: x.continuation ? "Path-preserving FCFE adjustment to fifteen explicit operating years and terminal-year cash; fixed stub, terminal at year 15. Zero is the frozen forward case." :
      "Path-preserving annual FCFE growth adjustment to five explicit years with ten-year fade and terminal at year 15; zero is the frozen forward case.",
    discountTiming: "Explicit stub cash dates and annual year-end cash flows; actual days from model reference /365.25, identical in forward and reverse. Stub is fixed, not growth-adjusted.",
    growthComparison: "Not a comparison of endpoint CAGR with a constant-growth reverse DCF; no climate expectation or activity inversion inferred.",
    terminalAssumptions: { discountRate: x.discountRate, terminalGrowth: x.terminalGrowth,
      continuationGrowthAtYear5: x.continuationGrowthAtYear5, evidenceIds: x.terminalEvidenceIds } };
}

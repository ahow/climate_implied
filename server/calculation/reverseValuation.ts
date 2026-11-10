import { z } from "zod";

const assumptionsSchema = z.object({
  baseEarnings: z.number().finite().positive(),
  discountRate: z.number().finite().positive().max(1),
  terminalGrowth: z.number().finite().min(0).max(.2),
  returnOnEquity: z.number().finite().positive().max(2),
  sharesBasis: z.literal("total-equity"),
});
type Assumptions = z.infer<typeof assumptionsSchema>;
function checked(input: Assumptions) {
  const a = assumptionsSchema.parse(input);
  if (a.terminalGrowth >= a.discountRate || a.terminalGrowth > a.returnOnEquity)
    throw new Error("Terminal growth must be below discount rate and fundable by return on equity");
  return a;
}

/**
 * Explicit earnings/reinvestment model, NOT reported OCF minus working capital.
 * Years 1–5 fixed growth, years 6–15 fade to terminal growth. Negative growth
 * has no assumed capital release. No debt change, acquisitions or dilution.
 * Applicable only to positive, comparable earnings with defensible ROE.
 */
export function equityProjection(input: Assumptions & { stageOneGrowth: number }) {
  const a = checked(input), g = z.number().finite().gt(-1).parse(input.stageOneGrowth);
  if (g > a.returnOnEquity) throw new Error("Growth exceeds internally funded model capacity");
  let earnings = a.baseEarnings, pv = 0;
  const years = [];
  for (let year = 1; year <= 15; year++) {
    const growth = year <= 5 ? g : g + (a.terminalGrowth - g) * (year - 5) / 10;
    earnings *= 1 + growth;
    const reinvestmentRate = Math.max(0, growth) / a.returnOnEquity;
    const reinvestment = earnings * reinvestmentRate;
    const distributed = earnings - reinvestment;
    const presentValue = distributed / (1 + a.discountRate) ** year;
    pv += presentValue;
    years.push({ year, growth, earnings, reinvestmentRate, reinvestment, distributed, presentValue });
  }
  const terminalCashFlow = earnings * (1 + a.terminalGrowth) * (1 - a.terminalGrowth / a.returnOnEquity);
  pv += terminalCashFlow / (a.discountRate - a.terminalGrowth) / (1 + a.discountRate) ** 15;
  if (!Number.isFinite(pv)) throw new Error("Nonfinite valuation");
  return { equityValue: pv, years, terminalCashFlow,
    terminalReinvestmentRate: a.terminalGrowth / a.returnOnEquity };
}

export function equityValue(input: Assumptions & { stageOneGrowth: number }) {
  return equityProjection(input).equityValue;
}

/** Original nominal specification, distinct from the retained 1–3% CF diagnostic.
 * No issuer ROE, nominal-rate basis or source evidence is inferred.
 */
export const ORIGINAL_NOMINAL_TERMINAL_GRID = [.025, .03, .035, .04] as const;
export function originalNominalEquityProjection(input: unknown) {
  const a = assumptionsSchema.extend({
    terminalGrowth: z.number().finite().min(.025).max(.04),
    stageOneGrowth: z.number().finite().gt(-1),
    rateBasis: z.literal("nominal"),
    returnOnEquityEvidence: z.string().trim().min(1),
    discountRateEvidence: z.string().trim().min(1),
  }).parse(input);
  return equityProjection(a);
}

export function originalNominalEquityAssessment(input: unknown) {
  const schema = assumptionsSchema.omit({ terminalGrowth: true }).extend({
    stageOneGrowth: z.number().finite().gt(-1),
    rateBasis: z.literal("nominal"),
    returnOnEquityEvidence: z.string().trim().min(1),
    discountRateEvidence: z.string().trim().min(1),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { status: "refused" as const,
    reason: "Explicit nominal rates, positive earnings, supported ROE and discount-rate evidence are required",
    issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) };
  const a = parsed.data;
  const rows = ORIGINAL_NOMINAL_TERMINAL_GRID.map(terminalGrowth => {
    if (terminalGrowth >= a.discountRate) return { terminalGrowth, status: "refused" as const,
      reason: "Terminal growth must be strictly below the nominal discount rate" };
    if (Math.max(a.stageOneGrowth, terminalGrowth) > a.returnOnEquity)
      return { terminalGrowth, status: "refused" as const,
        reason: "Growth exceeds supported internally funded ROE; no assumed external funding" };
    return { terminalGrowth, status: "conditional-value" as const,
      projection: originalNominalEquityProjection({ ...a, terminalGrowth }) };
  });
  return {
    status: "conditional-assessment" as const, rateBasis: a.rateBasis,
    terminalRange: { minimum: .025, maximum: .04, grid: ORIGINAL_NOMINAL_TERMINAL_GRID },
    fade: "Years 1–5 constant growth; years 6–15 linear fade, terminal reached in year 15",
    rows, returnOnEquityEvidence: a.returnOnEquityEvidence, discountRateEvidence: a.discountRateEvidence,
    limitations: ["Four-point range assessment, not a continuous-range extremum proof",
      "Evidence references are supplied assumptions, not independent source verification",
      "Earnings/ROE model is separate from the cash-flow-growth diagnostic; no WC double subtraction",
      "No capital release on negative growth; no debt change, acquisitions or dilution"],
    investmentEvidence: false, identityApproved: false, productionEligible: false,
  };
}

export function reverseEquityGrowth(input: Assumptions & {
  marketCap: number; minimumGrowth: number; maximumGrowth: number;
}) {
  const a = checked(input);
  z.number().finite().positive().parse(input.marketCap);
  z.number().finite().gt(-1).parse(input.minimumGrowth);
  z.number().finite().max(a.returnOnEquity).parse(input.maximumGrowth);
  if (input.minimumGrowth >= input.maximumGrowth) throw new Error("Invalid growth search interval");
  const loss = (g: number) => equityValue({ ...a, stageOneGrowth: g }) - input.marketCap;
  const brackets: [number, number][] = [];
  const exact: number[] = [];
  const tolerance = Math.max(1, input.marketCap) * 1e-10;
  // Do not assume monotonicity: reinvestment can generate multiple solutions.
  let previous = input.minimumGrowth, previousLoss = loss(previous);
  if (Math.abs(previousLoss) <= tolerance) exact.push(previous);
  for (let i = 1; i <= 512; i++) {
    const current = input.minimumGrowth + (input.maximumGrowth - input.minimumGrowth) * i / 512;
    const currentLoss = loss(current);
    if (Math.abs(currentLoss) <= tolerance) exact.push(current);
    else if (Math.abs(previousLoss) > tolerance && currentLoss * previousLoss < 0) brackets.push([previous, current]);
    previous = current; previousLoss = currentLoss;
  }
  if (brackets.length + exact.length !== 1) return {
    status: "no-defensible-solution" as const,
    reason: brackets.length + exact.length ? "multiple-candidate-roots" : "no-bracketed-root",
    limitation: "Finite grid search is not proof of global uniqueness; no extrapolation.",
  };
  let growth = exact[0];
  if (brackets.length) {
    let [lo, hi] = brackets[0];
    for (let iteration = 0; iteration < 100; iteration++) {
      const mid = (lo + hi) / 2;
      if (Math.abs(loss(mid)) <= tolerance) { lo = mid; hi = mid; break; }
      if (loss(lo) * loss(mid) <= 0) hi = mid; else lo = mid;
    }
    growth = (lo + hi) / 2;
  }
  return {
    status: "solved" as const, growth,
    repricingError: loss(growth),
    interpretation: "conditional five-year earnings growth under an internally funded equity cash-flow model",
    investmentEvidence: false,
  };
}

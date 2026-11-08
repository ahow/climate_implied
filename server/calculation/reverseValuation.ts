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
export function equityValue(input: Assumptions & { stageOneGrowth: number }) {
  const a = checked(input), g = z.number().finite().gt(-1).parse(input.stageOneGrowth);
  if (g > a.returnOnEquity) throw new Error("Growth exceeds internally funded model capacity");
  let earnings = a.baseEarnings, pv = 0;
  for (let year = 1; year <= 15; year++) {
    const growth = year <= 5 ? g : g + (a.terminalGrowth - g) * (year - 5) / 10;
    earnings *= 1 + growth;
    const distributed = earnings * (1 - Math.max(0, growth) / a.returnOnEquity);
    pv += distributed / (1 + a.discountRate) ** year;
  }
  const terminalCashFlow = earnings * (1 + a.terminalGrowth) * (1 - a.terminalGrowth / a.returnOnEquity);
  pv += terminalCashFlow / (a.discountRate - a.terminalGrowth) / (1 + a.discountRate) ** 15;
  if (!Number.isFinite(pv)) throw new Error("Nonfinite valuation");
  return pv;
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

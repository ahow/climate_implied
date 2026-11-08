import { z } from "zod";
const common = z.object({
  baseCashFlow: z.number().finite(), marketCap: z.number().finite().positive(),
  discountRate: z.number().finite().positive().max(1),
  terminalGrowth: z.number().finite().min(0).max(.2),
  basis: z.enum(["FCFE", "FCFF"]), discountBasis: z.enum(["cost-of-equity", "WACC"]),
  businessType: z.enum(["non-financial", "financial"]),
  cashFlowCurrency: z.string().regex(/^[A-Z]{3}$/),
  valuationCurrency: z.string().regex(/^[A-Z]{3}$/),
  netDebt: z.number().finite().optional(),
  minorityInterest: z.number().finite().nonnegative().optional(),
  preferredEquity: z.number().finite().nonnegative().optional(),
});
function model(input: unknown) {
  const p = common.parse(input);
  if (p.cashFlowCurrency !== p.valuationCurrency) throw new Error("Currency mismatch; no implicit FX conversion");
  if (p.discountRate <= p.terminalGrowth) throw new Error("Discount rate must exceed terminal growth");
  if (p.basis === "FCFE" && p.discountBasis !== "cost-of-equity" ||
      p.basis === "FCFF" && p.discountBasis !== "WACC") throw new Error("Cash-flow and discount-rate bases differ");
  if (p.businessType === "financial") return { status: "not-modelled" as const, reason: "Financial institutions require a separately validated residual-income model" };
  if (p.baseCashFlow <= 0) return { status: "not-modelled" as const, reason: "Non-positive cash flow requires a separately supported recovery model" };
  if (p.basis === "FCFF" && [p.netDebt, p.minorityInterest, p.preferredEquity].some(v => v === undefined))
    throw new Error("FCFF requires explicit net debt, minority interest and preferred equity");
  const bridge = p.basis === "FCFF" ? p.netDebt! + p.minorityInterest! + p.preferredEquity! : 0;
  const target = p.marketCap + bridge;
  if (target <= 0) return { status: "not-modelled" as const, reason: "Non-positive enterprise value" };
  const value = (g: number) => {
    if (!Number.isFinite(g) || g <= -1 || g > 1) throw new Error("Conditional growth must be in (-1,1]");
    let cashFlow = p.baseCashFlow, pv = 0;
    for (let year = 1; year <= 15; year++) {
      const growth = year <= 5 ? g : g + (p.terminalGrowth - g) * (year - 5) / 10;
      cashFlow *= 1 + growth;
      pv += cashFlow / (1 + p.discountRate) ** year;
    }
    return pv + cashFlow * (1 + p.terminalGrowth) /
      (p.discountRate - p.terminalGrowth) / (1 + p.discountRate) ** 15;
  };
  return { status: "eligible-conditional" as const, p, bridge, target, value };
}
export function cashFlowValue(input: unknown) {
  const m = model(input);
  if (m.status !== "eligible-conditional") return m;
  const growth = z.object({ stageOneGrowth: z.number().finite() }).parse(input).stageOneGrowth;
  const value = m.value(growth);
  return { status: "conditional-value", equityValue: value - m.bridge,
    discountedCashFlowValue: value, basis: m.p.basis,
    investmentEvidence: false, identityApproved: false };
}
export function reverseCashFlowGrowth(input: unknown) {
  const m = model(input);
  if (m.status !== "eligible-conditional") return m;
  const bounds = z.object({
    minimumGrowth: z.number().finite().gt(-1).max(1),
    maximumGrowth: z.number().finite().gt(-1).max(1),
  }).parse(input);
  if (bounds.minimumGrowth >= bounds.maximumGrowth) throw new Error("Invalid growth interval");
  let lo = bounds.minimumGrowth, hi = bounds.maximumGrowth;
  // With positive starting cash flow, every growth factor is positive and
  // nondecreasing in g; at least the first-year factor is strictly increasing.
  // PV is therefore strictly increasing over this bounded model, unlike the
  // earnings/reinvestment solver whose payout fraction also changes with g.
  if (m.value(lo) > m.target || m.value(hi) < m.target)
    return { status: "not-modelled", reason: "Market value outside the supplied growth interval; no extrapolation" };
  for (let i = 0; i < 100; i++) {
    const midpoint = (lo + hi) / 2;
    if (m.value(midpoint) < m.target) lo = midpoint; else hi = midpoint;
  }
  const growth = (lo + hi) / 2, relativeRepricingError = (m.value(growth) - m.target) / m.target;
  return { status: "conditional-solution", growth, relativeRepricingError, basis: m.p.basis,
    definition: "five-year annual cash-flow growth; ten-year fade to terminal growth",
    investmentEvidence: false, identityApproved: false,
    limitations: ["Conditional extrapolation of cash flow, not an empirically calibrated forecast",
      "Financing/reinvestment composition is embedded in supplied cash flow; it is not independently projected",
      "Currency, source availability, valuation date and publication history require separate verification"] };
}

/** Source-defined §5.01(d) only, not the complete LLC/tax/liquidation waterfall. */
export function renewablesIiAvailableCashClaim(input: {
  availableCashUsd: number | null; classBFractionHeldByXplr: number;
  period: "pre-flip-restored-95-percent" | "post-flip";
  section701ExceptionApplies: boolean | null; legallyDistributable: boolean | null;
}) {
  const x = input.classBFractionHeldByXplr;
  if (!Number.isFinite(x) || x < 0 || x > 1) throw new Error("Actual or explicitly conditional ClassBownership fraction required");
  if (input.availableCashUsd === null || input.section701ExceptionApplies === null || input.legallyDistributable === null)
    return { status: "unresolved-source-inputs" as const, xplrCashUsd: null, externalClassBCashUsd: null };
  if (!Number.isFinite(input.availableCashUsd) || input.availableCashUsd < 0) throw new Error("Contractual AvailableCash must be finite/nonnegative, not gross EBITDA");
  if (!input.legallyDistributable || input.section701ExceptionApplies)
    return { status: "refused-branch-not-implemented" as const, xplrCashUsd: null, externalClassBCashUsd: null };
  const classA = input.period === "post-flip" ? .01 : .95;
  const classB = 1 - classA;
  const ownB = classB * x;
  // Contract:40%of XPLR-owned ClassBcash diverted, capped25%of ALL ClassBcash,
  // when less than100%of ClassBunits bought. No assumed historical dollar cash.
  const reallocated = input.period === "post-flip" && x < 1 ? Math.min(.4 * ownB, .25 * classB) : 0;
  const xplrFraction = classA + ownB - reallocated;
  return { status: "conditional-contractual-branch-executed" as const,
    xplrCashUsd: input.availableCashUsd * xplrFraction,
    externalClassBCashUsd: input.availableCashUsd * (1 - xplrFraction),
    xplrClaimPerAvailableDollar: xplrFraction, classBReallocationPerAvailableDollar: reallocated,
    scope: "Contractually funded AvailableCash only; not NEEcommonFCFE or commissioned-project IRR. Owner/proportion and exception predicates must be sourced or frozen conditional assumptions." };
}

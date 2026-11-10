import { z } from "zod";

const finite = z.number().finite();
export const longOnlyVariantSchema = z.object({
  sectorNeutral: z.boolean(), maxActiveWeight: finite.nonnegative(),
  participation: finite.positive().max(1), capital: finite.positive(),
  rebalanceMonths: z.union([z.literal(1), z.literal(3)]),
}).strict();
const rowSchema = z.object({
  companyId: z.string().min(1), sector: z.string().min(1), marketCap: finite.positive(),
  score: finite.min(-1).max(1), eligible: z.boolean(),
  // Trailing traded base-currency value and eligibility known before execution.
  liquidity: finite.nonnegative(), availableAt: z.string().datetime(),
}).strict();

/** Constraint overlay only: caller supplies the past-only kernel tilt (warm-up,
 * risk scaling and cap remain in the existing engine). Missing liquidity is not
 * unlimited liquidity. Infeasible constraints reject, never drop holdings. */
export function constrainedLongOnly(
  rowsInput: unknown, variantInput: unknown, tilt: number,
  executionAt: string, monthsSinceInitial: number, prior: Record<string, number>,
) {
  const rows = z.array(rowSchema).min(1).parse(rowsInput);
  const v = longOnlyVariantSchema.parse(variantInput);
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 5 || !Number.isInteger(monthsSinceInitial) || monthsSinceInitial < 0 ||
      !Number.isFinite(Date.parse(executionAt))) throw new Error("Invalid past-only tilt/rebalance date");
  if (new Set(rows.map(r => r.companyId)).size !== rows.length ||
      rows.some(r => Date.parse(r.availableAt) >= Date.parse(executionAt)))
    throw new Error("Duplicate issuer or unavailable origin eligibility/liquidity");
  if (Object.entries(prior).some(([id, w]) => !Number.isFinite(w) || w < 0 || !rows.some(r => r.companyId === id)))
    throw new Error("Unknown/invalid prior holding");
  if (monthsSinceInitial % v.rebalanceMonths !== 0) return { weights: { ...prior }, rebalance: false };
  const eligible = rows.filter(r => r.eligible);
  const cap = eligible.reduce((s, r) => s + r.marketCap, 0);
  if (!cap) throw new Error("No eligible benchmark");
  const benchmark = rows.map(r => r.eligible ? r.marketCap / cap : 0);
  let desired = rows.map((r, i) => benchmark[i] * Math.max(0, 1 + tilt * r.score));
  const sectors = v.sectorNeutral ? Array.from(new Set(rows.map(r => r.sector))) : [null];
  for (const sector of sectors) {
    const indices = rows.map((r, i) => sector === null || r.sector === sector ? i : -1).filter(i => i >= 0);
    const target = indices.reduce((s, i) => s + benchmark[i], 0);
    const total = indices.reduce((s, i) => s + desired[i], 0);
    if (target > 0 && total === 0) throw new Error("Zero positive tilt mass");
    indices.forEach(i => desired[i] = total ? desired[i] * target / total : 0);
  }
  // Intersect the feasible intervals on the line benchmark -> tilted weights.
  let lower = 0, upper = 1;
  rows.forEach((r, i) => {
    const limit = r.liquidity * v.participation / v.capital;
    const old = prior[r.companyId] ?? 0;
    const lo = Math.max(0, benchmark[i] - v.maxActiveWeight, old - limit);
    const hi = Math.min(r.eligible ? 1 : 0, benchmark[i] + v.maxActiveWeight, old + limit);
    const delta = desired[i] - benchmark[i];
    if (Math.abs(delta) < 1e-14) {
      if (benchmark[i] < lo - 1e-12 || benchmark[i] > hi + 1e-12) throw new Error("Infeasible liquidity/eligibility constraints");
    } else {
      const a = (lo - benchmark[i]) / delta, b = (hi - benchmark[i]) / delta;
      lower = Math.max(lower, Math.min(a, b)); upper = Math.min(upper, Math.max(a, b));
    }
  });
  if (lower > upper + 1e-12) throw new Error("Infeasible long-only constraints");
  desired = benchmark.map((b, i) => b + upper * (desired[i] - b));
  return { weights: Object.fromEntries(rows.map((r, i) => [r.companyId, desired[i]])),
    benchmark: Object.fromEntries(rows.map((r, i) => [r.companyId, benchmark[i]])),
    rebalance: true, retainedTiltFraction: upper };
}

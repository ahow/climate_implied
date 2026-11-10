import { z } from "zod";

const time = z.string().datetime();
const finite = z.number().finite();
export const sleeveScheduleSchema = z.object({
  initialCapital: finite.positive(),
  deployments: z.array(z.object({
    id: z.string().min(1), origin: time, executionAt: time, maturityAt: time,
    capital: finite.positive(),
  }).strict()).min(1),
}).strict();
export const sleeveMarksSchema = z.array(z.object({
  at: time, reserveInterest: finite,
  reserveAccrual: z.object({
    fromAt: time, toAt: time, openingReserve: finite.nonnegative(), annualRate: finite,
    availableAt: time, sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  }).strict().optional(),
  sleeves: z.array(z.object({
    id: z.string().min(1), cash: finite, restrictedCash: finite.nonnegative(),
    // Signed position values; cash never includes these values.
    positions: z.record(finite), settlement: z.boolean(),
    sourceHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  }).strict()),
}).strict());

/** Independent capital buckets: no full-NAV reinvestment at every monthly origin.
 * Marks are after deployment/settlement. All live cohorts must be marked at every
 * observation; endpoint returns cannot masquerade as intermediate valuations.
 */
export function accountOverlappingSleeves(scheduleInput: unknown, marksInput: unknown, dataEnd?: string) {
  const schedule = sleeveScheduleSchema.parse(scheduleInput);
  const marks = sleeveMarksSchema.parse(marksInput);
  const ids = new Set<string>();
  for (const d of schedule.deployments) {
    if (ids.has(d.id)) throw new Error("Duplicate sleeve");
    ids.add(d.id);
    const maturity = new Date(d.executionAt);
    maturity.setUTCMonth(maturity.getUTCMonth() + 12);
    if (Date.parse(d.origin) >= Date.parse(d.executionAt) || maturity.getTime() !== Date.parse(d.maturityAt))
      throw new Error("Sleeve requires later deployment and exact 12-month maturity");
  }
  if (!marks.length) throw new Error("Missing sleeve marks");
  const dates = marks.map(m => Date.parse(m.at));
  if (dataEnd !== undefined && (!Number.isFinite(Date.parse(dataEnd)) || dates.some(d => d > Date.parse(dataEnd))))
    throw new Error("Sleeve mark beyond cutoff");
  if (dates.some((d, i) => i > 0 && d <= dates[i - 1])) throw new Error("Unordered sleeve marks");
  for (const d of schedule.deployments) {
    if (![d.executionAt, d.maturityAt].every(t => dates.includes(Date.parse(t))))
      throw new Error("Missing deployment/maturity mark");
  }
  let reserve = schedule.initialCapital, previousNav = reserve;
  return marks.map((mark, index) => {
    const accrual = mark.reserveAccrual;
    if (index === 0 && (mark.reserveInterest !== 0 || accrual))
      throw new Error("Initial sleeve mark cannot accrue reserve interest");
    if (mark.reserveInterest !== 0 && !accrual) throw new Error("Missing dated reserve interest accrual");
    if (accrual) {
      if (Date.parse(accrual.fromAt) !== dates[index - 1] || Date.parse(accrual.toAt) !== dates[index] ||
          Date.parse(accrual.availableAt) > Date.parse(accrual.fromAt) ||
          Math.abs(accrual.openingReserve - reserve) > 1e-9)
        throw new Error("Reserve accrual timing/opening capital mismatch");
      const expected = reserve * accrual.annualRate * (dates[index] - dates[index - 1]) / (365.25 * 86400000);
      if (Math.abs(expected - mark.reserveInterest) > 1e-9)
        throw new Error("Reserve interest reconciliation failed");
    }
    reserve += mark.reserveInterest;
    const at = Date.parse(mark.at);
    const active = schedule.deployments.filter(d => Date.parse(d.executionAt) <= at && at <= Date.parse(d.maturityAt));
    if (new Set(mark.sleeves.map(s => s.id)).size !== mark.sleeves.length ||
        active.length !== mark.sleeves.length || mark.sleeves.some(s => !active.some(d => d.id === s.id)))
      throw new Error("Incomplete or undeclared live sleeve marks");
    // Settlements at this boundary fund new deployments once, before testing
    // available capital. They are not then added to the marked sleeve assets.
    for (const s of mark.sleeves.filter(s => s.settlement)) {
      if (!active.some(d => d.id === s.id && Date.parse(d.maturityAt) === at) ||
          s.restrictedCash !== 0 || Object.values(s.positions).some(v => v !== 0))
        throw new Error("Maturity requires liquidated positions and released collateral");
      reserve += s.cash;
    }
    for (const d of active.filter(d => Date.parse(d.executionAt) === at)) {
      const s = mark.sleeves.find(s => s.id === d.id)!;
      const initialNav = s.cash + s.restrictedCash + Object.values(s.positions).reduce((a, b) => a + b, 0);
      if (Math.abs(initialNav - d.capital) > 1e-9)
        throw new Error("Initial sleeve mark must reconcile deployed capital");
      reserve -= d.capital;
    }
    if (reserve < -1e-9) throw new Error("Sleeve deployment exceeds unallocated capital");
    let cash = reserve, restrictedCash = 0, gross = 0, net = 0;
    const positions: Record<string, number> = {};
    for (const s of mark.sleeves) {
      const d = active.find(d => d.id === s.id)!;
      if (s.settlement !== (Date.parse(d.maturityAt) === at))
        throw new Error("Settlement must occur exactly at maturity");
      if (s.settlement) {
        if (s.restrictedCash !== 0 || Object.values(s.positions).some(v => v !== 0))
          throw new Error("Maturity requires liquidated positions and released collateral");
        // Already included in reserve above.
      } else {
        cash += s.cash; restrictedCash += s.restrictedCash;
        for (const [id, value] of Object.entries(s.positions)) {
          positions[id] = (positions[id] ?? 0) + value;
          gross += Math.abs(value); net += value;
        }
      }
    }
    const nav = cash + restrictedCash + net;
    if (!Number.isFinite(nav) || nav <= 0) throw new Error("Sleeve insolvency/nonfinite NAV");
    const result = { at: mark.at, nav, cash, restrictedCash, unallocatedCapital: reserve,
      grossExposure: gross / nav, netExposure: net / nav, positions, netReturn: nav / previousNav - 1 };
    previousNav = nav;
    return result;
  });
}

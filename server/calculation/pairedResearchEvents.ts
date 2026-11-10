import { z } from "zod";

const finite = z.number().finite();
const eventSchema = z.object({
  at: z.string().datetime(), sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  action: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("dividend"), companyId: z.string(), perShare: finite.nonnegative(), fx: finite.positive() }).strict(),
    z.object({ kind: z.literal("split"), companyId: z.string(), ratio: finite.positive() }).strict(),
    z.object({ kind: z.literal("merger"), companyId: z.string(), successor: z.string(),
      ratio: finite.nonnegative(), cashPerShare: finite.nonnegative(), fx: finite.positive() }).strict(),
    z.object({ kind: z.literal("delisting"), companyId: z.string(), cashPerShare: finite.nonnegative(), fx: finite.positive() }).strict(),
    z.object({ kind: z.literal("collateral"), amount: finite }).strict(),
    z.object({ kind: z.literal("borrow"), companyId: z.string(), available: z.boolean().nullable(),
      observedFee: finite.nonnegative().nullable(), hypotheticalFee: finite.nonnegative().nullable() }).strict(),
    z.object({ kind: z.literal("financing"), expense: finite.nonnegative() }).strict(),
    z.object({ kind: z.literal("interest"), cashAmount: finite }).strict(),
  ]),
}).strict();
export const eventBookSchema = z.object({
  startAt: z.string().datetime(), endAt: z.string().datetime(),
  cash: finite, restrictedCash: finite.nonnegative(), units: z.record(finite),
  // Explicit coverage receipt required even for periods with no actions.
  coverageSourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  events: z.array(eventSchema),
  endMarks: z.record(z.object({ price: finite.nonnegative(), fx: finite.positive() }).strict()),
}).strict();

/** Dated payment FX and units outstanding at the event, not end-date FX or
 * original-share assumptions. Positive collateral transfers restrict cash;
 * borrowing/financing are explicit sourced expenses, never inferred defaults. */
export function accountResearchEvents(input: unknown) {
  const book = eventBookSchema.parse(input);
  let cash = book.cash, restrictedCash = book.restrictedCash, hypothetical = false;
  let financingRequired = cash < 0;
  const units = { ...book.units };
  let last = Date.parse(book.startAt);
  if (last >= Date.parse(book.endAt)) throw new Error("Invalid event window");
  for (const e of book.events) {
    const at = Date.parse(e.at), a = e.action;
    if (at < last || at < Date.parse(book.startAt) || at > Date.parse(book.endAt)) throw new Error("Event outside ordered window");
    last = at;
    if ("companyId" in a && !(a.companyId in units)) throw new Error("Event on unknown holding");
    switch (a.kind) {
      case "dividend": cash += units[a.companyId] * a.perShare * a.fx; break;
      case "split": units[a.companyId] *= a.ratio; break;
      case "merger":
        if (a.successor === a.companyId) throw new Error("Merger successor equals predecessor");
        cash += units[a.companyId] * a.cashPerShare * a.fx;
        units[a.successor] = (units[a.successor] ?? 0) + units[a.companyId] * a.ratio;
        delete units[a.companyId]; break;
      case "delisting":
        cash += units[a.companyId] * a.cashPerShare * a.fx; delete units[a.companyId]; break;
      case "collateral":
        cash -= a.amount; restrictedCash += a.amount;
        if (restrictedCash < 0) throw new Error("Collateral release exceeds balance");
        break;
      case "borrow":
        if (units[a.companyId] >= 0) throw new Error("Borrow expense without short holding");
        if (a.available === false) throw new Error("Explicitly unavailable borrow");
        if (a.available === null || a.observedFee === null) hypothetical = true;
        if (a.observedFee === null && a.hypotheticalFee === null) throw new Error("Missing explicit borrow fee");
        cash -= a.observedFee ?? a.hypotheticalFee!; break;
      case "financing": cash -= a.expense; break;
      case "interest": cash += a.cashAmount; break;
    }
    financingRequired ||= cash < 0;
  }
  if (financingRequired && !book.events.some(e => e.action.kind === "financing"))
    throw new Error("Missing financing coverage for negative cash");
  for (const [id, u] of Object.entries(book.units)) {
    if (u < 0 && !book.events.some(e => e.action.kind === "borrow" && e.action.companyId === id))
      throw new Error("Missing borrow coverage for short holding");
    if (u < 0 && !book.events.some(e => e.action.kind === "collateral"))
      throw new Error("Missing explicit short collateral transfer/release coverage");
  }
  const positions = Object.fromEntries(Object.entries(units).map(([id, u]) => {
    const mark = book.endMarks[id];
    if (!mark) throw new Error(`Missing end mark ${id}`);
    return [id, u * mark.price * mark.fx];
  }));
  const nav = cash + restrictedCash + Object.values(positions).reduce((a, b) => a + b, 0);
  if (!Number.isFinite(nav)) throw new Error("Nonfinite event ledger");
  return { cash, restrictedCash, units, positions, nav, hypothetical, investmentEvidence: false as const };
}

import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { sleeveMarksSchema, sleeveScheduleSchema, accountOverlappingSleeves } from "./pairedResearchSleeves";
import { eventBookSchema, accountResearchEvents } from "./pairedResearchEvents";

const finite = z.number().finite(), time = z.string().datetime(), digest = z.string().regex(/^[a-f0-9]{64}$/);
// Deliberately separate operational contract: never reinterprets an old frozen protocol.
const spec = z.object({ model: z.string().min(1), peer: z.string().min(1), target: z.literal("12-month") }).strict();
const factorDefinition = z.object({
  names: z.array(z.string().min(1)).min(1), constructionHash: digest,
  provider: z.enum(["Kenneth French Data Library", "workbook-universe"]),
  currencyConversion: z.string().min(1),
  valuesConvention: z.literal("decimal-monthly-factor-returns"),
}).strict();
export const portfolioFrequencySchema = z.object({
  version: z.literal("simultaneous-monthly-sleeves-v1"),
  frequency: z.literal("calendar-month"),
  returnConvention: z.literal("net-total-nav-minus-dated-risk-free"),
  entryCostTiming: z.literal("charged-at-deployment-in-first-month"),
  cells: z.array(z.object({
    specification: spec, streamId: z.string().min(1), schedule: sleeveScheduleSchema,
    regionalDeveloped: factorDefinition, workbookUniverse: factorDefinition,
  }).strict()).min(1),
}).strict();
const trade = z.object({
  companyId: z.string().min(1), units: finite, price: finite.positive(), fx: finite.positive(),
}).strict();
export const portfolioStreamsSchema = z.array(z.object({
  id: z.string().min(1), specification: spec, scheduleHash: digest,
  entries: z.array(z.object({
    id: z.string().min(1), trades: z.array(trade), restrictedCash: finite.nonnegative(),
    costBps: finite.nonnegative(), tradingCost: finite.nonnegative(), sourceHash: digest,
  }).strict()),
  marks: sleeveMarksSchema,
  months: z.array(z.object({
    fromAt: time, toAt: time, sourceHash: digest,
    books: z.array(z.object({
      id: z.string().min(1), book: eventBookSchema,
      liquidationTrades: z.array(trade), costBps: finite.nonnegative(), tradingCost: finite.nonnegative(),
    }).strict()),
    factors: z.object({
      frequency: z.literal("calendar-month"), currency: z.string().min(1), geography: z.string().min(1),
      riskFreeReturn: finite,
      regionalDeveloped: z.array(finite).min(1), workbookUniverse: z.array(finite).min(1),
      regionalSourceHash: digest, workbookSourceHash: digest, riskFreeSourceHash: digest,
    }).strict(),
  }).strict()),
}).strict());
export type FrequencyCell = z.infer<typeof portfolioFrequencySchema>["cells"][number];
export type PortfolioStream = z.infer<typeof portfolioStreamsSchema>[number];
type Artifact = { hash: string; payload?: unknown; availableAt: string; capturedAt: string; vintage: string };
const key = (s: { model: string; peer: string; target: string }) => JSON.stringify([s.model, s.peer, s.target]);
const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const close = (a: number, b: number, reason: string) => {
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a - b) > 1e-8) throw new Error(reason);
};
function sameRecord(a: Record<string, number>, b: Record<string, number>, reason: string) {
  for (const id of Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))) close(a[id] ?? 0, b[id] ?? 0, reason);
}
export function exactMonth(from: string, to: string) {
  const a = new Date(from), b = new Date(to);
  if (a.getUTCDate() !== 1 || a.getUTCHours() || a.getUTCMinutes() || a.getUTCSeconds() || a.getUTCMilliseconds() ||
      b.getUTCDate() !== 1 || b.getUTCHours() || b.getUTCMinutes() || b.getUTCSeconds() || b.getUTCMilliseconds())
    throw new Error("Requires exact UTC first-of-month boundaries");
  a.setUTCMonth(a.getUTCMonth() + 1);
  if (a.getTime() !== b.getTime()) throw new Error("Missing or nonmonthly boundary");
}

/** Caller-contract reconciliation only, not authentication. Every payload binding
 * applies to fixtures too. Observed monthly holdings, never 12-month endpoints,
 * supply the portfolio returns; scalar 12-month returns cannot enter this API. */
export function reconcilePortfolioFrequency(
  cell: FrequencyCell, stream: PortfolioStream,
  context: {
    artifacts: Artifact[]; dataEnd: string; mode: string; currency: string; geography: string; costBps: number;
    expectedOrigins: string[];
    selections: Array<{
      origin: string; executionAt: string; endAt: string; weights: Record<string, number>;
      executionQuotes: Record<string, { price: number; fx: number }>;
    }>;
  },
) {
  if (stream.id !== cell.streamId || key(stream.specification) !== key(cell.specification) ||
      stream.scheduleHash !== contentHash(cell.schedule)) throw new Error("Frozen specification/stream/schedule binding mismatch");
  const artifacts = new Map(context.artifacts.map(a => [a.hash, a]));
  const source = (hash: string, payload?: unknown, knownAt?: string) => {
    const a = artifacts.get(hash);
    if (!a || contentHash(a.payload) !== hash) throw new Error("Missing or hash-mismatched retained frequency source");
    if (Date.parse(a.availableAt) > Date.parse(context.dataEnd) || Date.parse(a.capturedAt) > Date.parse(context.dataEnd))
      throw new Error("Frequency source beyond corpus cutoff");
    if (payload !== undefined && contentHash(payload) !== hash) throw new Error("Frequency values not bound to retained source payload");
    if (knownAt && (Date.parse(a.availableAt) > Date.parse(knownAt) ||
        (context.mode === "point-in-time" && (a.vintage !== "original" || Date.parse(a.capturedAt) > Date.parse(knownAt)))))
      throw new Error("Future or non-original frequency input");
    return a;
  };
  for (const f of [cell.regionalDeveloped, cell.workbookUniverse]) {
    if (new Set(f.names).size !== f.names.length) throw new Error("Duplicate factor name");
    source(f.constructionHash, undefined, cell.schedule.deployments[0].origin);
  }
  if (cell.regionalDeveloped.provider !== "Kenneth French Data Library" || cell.workbookUniverse.provider !== "workbook-universe")
    throw new Error("Wrong regional/workbook factor provider binding");
  const deployments = cell.schedule.deployments;
  if (deployments.length !== context.expectedOrigins.length ||
      context.expectedOrigins.some(o => deployments.filter(d => Date.parse(d.origin) === Date.parse(o)).length !== 1))
    throw new Error("Incomplete frozen sleeve origins");
  if (stream.entries.length !== deployments.length || new Set(stream.entries.map(e => e.id)).size !== stream.entries.length)
    throw new Error("Missing or duplicate deployment receipt");
  if (stream.marks.length < 2 || stream.months.length !== stream.marks.length - 1)
    throw new Error("Incomplete monthly marks/factors");
  // Validate frequency before any exact-date deployment lookup: a malformed
  // boundary is a frequency refusal, not an apparently missing deployment.
  for (let i = 1; i < stream.marks.length; i++) exactMonth(stream.marks[i - 1].at, stream.marks[i].at);
  const first = stream.marks[0].at, last = stream.marks[stream.marks.length - 1].at;
  if (Date.parse(first) !== Math.min(...deployments.map(d => Date.parse(d.executionAt))) ||
      Date.parse(last) !== Math.max(...deployments.map(d => Date.parse(d.maturityAt))))
    throw new Error("Monthly stream must cover complete deployment lifecycles");
  const entryCosts: Record<string, number> = {};
  const units = new Map<string, Record<string, number>>();
  const tradeValues = (trades: z.infer<typeof trade>[]) => {
    if (new Set(trades.map(t => t.companyId)).size !== trades.length) throw new Error("Duplicate trade holding");
    return Object.fromEntries(trades.map(t => [t.companyId, t.units * t.price * t.fx]));
  };
  for (const d of deployments) {
    const e = stream.entries.find(e => e.id === d.id);
    const selection = context.selections.find(o => Date.parse(o.origin) === Date.parse(d.origin));
    if (!e || !selection || Date.parse(selection.executionAt) !== Date.parse(d.executionAt) ||
        Date.parse(selection.endAt) !== Date.parse(d.maturityAt)) throw new Error("Missing complete frozen origin selection");
    const { sourceHash, ...entryPayload } = e;
    source(sourceHash, { ...entryPayload, origin: d.origin, executionAt: d.executionAt }, d.executionAt);
    for (const t of e.trades) {
      const quote = selection.executionQuotes[t.companyId];
      if (!quote || !(t.companyId in selection.weights) || selection.weights[t.companyId] === 0)
        throw new Error("Entry trade identity outside frozen selected execution quotes");
      close(t.price, quote.price, "Entry execution price differs from selected period quote");
      close(t.fx, quote.fx, "Entry execution FX differs from selected period quote");
    }
    const values = tradeValues(e.trades);
    sameRecord(values, Object.fromEntries(Object.entries(selection.weights).map(([id, w]) => [id, w * d.capital])),
      "Entry trades differ from frozen ranked sleeve weights");
    if (e.costBps !== context.costBps) throw new Error("Entry cost differs from frozen explicit cost");
    close(e.tradingCost, Object.values(values).reduce((a, b) => a + Math.abs(b), 0) * e.costBps / 10000,
      "Entry cost/notional reconciliation failed");
    const mark = stream.marks.find(m => Date.parse(m.at) === Date.parse(d.executionAt))?.sleeves.find(s => s.id === d.id);
    if (!mark) throw new Error("Missing deployment mark");
    sameRecord(mark.positions, values, "Entry position reconciliation failed");
    close(mark.cash, d.capital - total(values) - e.restrictedCash - e.tradingCost, "Entry cash/cost reconciliation failed");
    close(mark.restrictedCash, e.restrictedCash, "Entry collateral reconciliation failed");
    entryCosts[d.id] = e.tradingCost;
    units.set(d.id, Object.fromEntries(e.trades.map(t => [t.companyId, t.units])));
  }
  // Source-bind every simultaneous mark, including zero reserve accrual.
  for (let i = 0; i < stream.marks.length; i++) {
    const m = stream.marks[i];
    if (Date.parse(m.at) > Date.parse(context.dataEnd)) throw new Error("Future monthly mark");
    for (const s of m.sleeves) {
      const { sourceHashes, ...values } = s;
      if (!sourceHashes.some(h => { source(h); return h === contentHash({ at: m.at, ...values }); }))
        throw new Error("Monthly mark not bound to retained payload");
    }
    if (i > 0) {
      exactMonth(stream.marks[i - 1].at, m.at);
      if (!m.reserveAccrual) throw new Error("Missing explicit reserve rate, including zero");
      source(m.reserveAccrual.sourceHash, {
        annualRate: m.reserveAccrual.annualRate, availableAt: m.reserveAccrual.availableAt,
      }, m.reserveAccrual.fromAt);
    }
  }
  const accounting = accountOverlappingSleeves(cell.schedule, stream.marks, context.dataEnd, entryCosts);
  const usedEvents = new Set<string>();
  let hypothetical = false;
  const rows = stream.months.map((month, i) => {
    const previous = stream.marks[i], current = stream.marks[i + 1];
    if (Date.parse(month.fromAt) !== Date.parse(previous.at) || Date.parse(month.toAt) !== Date.parse(current.at))
      throw new Error("Factor/month boundaries mismatch");
    const { sourceHash, ...payload } = month;
    source(sourceHash, payload);
    const f = month.factors;
    if (f.currency !== context.currency || f.geography !== context.geography) throw new Error("Factor geography/currency mismatch");
    for (const which of ["regionalDeveloped", "workbookUniverse"] as const) {
      if (f[which].length !== cell[which].names.length) throw new Error("Factor dimension mismatch");
      source(which === "regionalDeveloped" ? f.regionalSourceHash : f.workbookSourceHash, {
        fromAt: month.fromAt, toAt: month.toAt, frequency: f.frequency, currency: f.currency, geography: f.geography,
        definition: cell[which], values: f[which],
      });
    }
    source(f.riskFreeSourceHash, { fromAt: month.fromAt, toAt: month.toAt, currency: f.currency, return: f.riskFreeReturn });
    const live = previous.sleeves.filter(s => !s.settlement);
    if (month.books.length !== live.length || new Set(month.books.map(b => b.id)).size !== live.length ||
        month.books.some(b => !live.some(s => s.id === b.id))) throw new Error("Incomplete simultaneous monthly books");
    let costs = 0, monthlyHypothetical = false;
    for (const b of month.books) {
      const opening = live.find(s => s.id === b.id)!;
      const closing = current.sleeves.find(s => s.id === b.id);
      if (!closing || Date.parse(b.book.startAt) !== Date.parse(month.fromAt) || Date.parse(b.book.endAt) !== Date.parse(month.toAt))
        throw new Error("Sleeve book boundary mismatch");
      const { coverageSourceHash, ...bookPayload } = b.book;
      source(coverageSourceHash, bookPayload);
      for (const e of b.book.events) {
        const identity = `${b.id}:${e.sourceHash}`;
        if (usedEvents.has(identity)) throw new Error("Duplicate lifecycle/cash event outcome");
        usedEvents.add(identity);
        source(e.sourceHash, { at: e.at, action: e.action });
      }
      sameRecord(b.book.units, units.get(b.id)!, "Lifecycle units discontinuity");
      close(b.book.cash, opening.cash, "Opening cash discontinuity");
      close(b.book.restrictedCash, opening.restrictedCash, "Opening collateral discontinuity");
      if (!["financing", "interest"].every(kind => b.book.events.some(e => e.action.kind === kind)))
        throw new Error("Missing explicit financing/interest coverage, including zero");
      const ledger = accountResearchEvents(b.book);
      // Unknown borrow limits investability; it does not erase honestly labelled
      // research accounting with an explicit fee assumption. The event engine
      // still refuses unavailable borrow and absent observed AND assumed fees.
      monthlyHypothetical ||= ledger.hypothetical;
      hypothetical ||= ledger.hypothetical;
      const liquidation = tradeValues(b.liquidationTrades);
      if (b.costBps !== context.costBps) throw new Error("Closing cost differs from frozen explicit cost");
      close(b.tradingCost, Object.values(liquidation).reduce((a, b) => a + Math.abs(b), 0) * b.costBps / 10000,
        "Closing cost/notional reconciliation failed");
      if (closing.settlement) {
        sameRecord(Object.fromEntries(b.liquidationTrades.map(t => [t.companyId, -t.units])), ledger.units,
          "Incomplete liquidation units");
        sameRecord(Object.fromEntries(Object.entries(liquidation).map(([id, v]) => [id, -v])), ledger.positions,
          "Liquidation execution mark discontinuity");
        close(ledger.restrictedCash, 0, "Unreleased maturity collateral");
      } else if (b.liquidationTrades.length) throw new Error("Undeclared pre-maturity liquidation");
      close(closing.cash, ledger.cash - total(liquidation) - b.tradingCost, "Monthly cash/cost reconciliation failed");
      close(closing.restrictedCash, ledger.restrictedCash, "Monthly collateral reconciliation failed");
      sameRecord(closing.positions, closing.settlement ? {} : ledger.positions, "Monthly position/lifecycle reconciliation failed");
      units.set(b.id, closing.settlement ? {} : ledger.units);
      costs += b.tradingCost;
    }
    costs += deployments.filter(d => Date.parse(d.executionAt) === Date.parse(month.toAt)).reduce((s, d) => s + entryCosts[d.id], 0);
    // First boundary is post-entry. Charge its cost against original capital in
    // the FIRST monthly observation, rather than dropping it from the sample.
    if (i === 0) costs += deployments.filter(d => Date.parse(d.executionAt) === Date.parse(first)).reduce((s, d) => s + entryCosts[d.id], 0);
    const openingNav = i === 0 ? cell.schedule.initialCapital : accounting[i].nav;
    const netReturn = accounting[i + 1].nav / openingNav - 1;
    return { fromAt: month.fromAt, toAt: month.toAt, openingNav, closingNav: accounting[i + 1].nav,
      netReturn, excessReturn: netReturn - f.riskFreeReturn, tradingCost: costs,
      hypothetical: monthlyHypothetical,
      regionalDeveloped: f.regionalDeveloped, workbookUniverse: f.workbookUniverse };
  });
  return { version: "simultaneous-monthly-sleeves-v1" as const, frequency: "calendar-month" as const,
    accounting, rows, hypothetical,
    label: hypothetical ? "hypothetical-research-accounting-with-explicit-borrow-assumptions" : "caller-contract-reconciled-research-accounting",
    authenticityVerified: false as const, investmentEvidence: false as const, scientificAcceptance: false as const,
    efficacy: "WITHHELD" as const };
}

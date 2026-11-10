import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { rankPairedCompanyGaps } from "./pairedCompanyGap";
import { adjudicateResearchFamily } from "./researchFamily";
import { walkForward } from "../climateValuation/walkForward";
import { adaptPairedResearchCorpus, specificationKey, specificationSchema, type ResearchPeriod } from "./pairedResearchCorpus";
import { accountOverlappingSleeves, sleeveScheduleSchema } from "./pairedResearchSleeves";
import { accountResearchEvents } from "./pairedResearchEvents";
import { constrainedLongOnly, longOnlyVariantSchema } from "./pairedResearchLongOnly";
import { portfolioFrequencySchema, reconcilePortfolioFrequency } from "./pairedResearchFrequency";

const time = z.string().datetime();
const protocolSchema = z.object({
  evidenceMode: z.literal("revised-history"),
  primaryEndpoints: z.tuple([z.literal("evaluation-r2"), z.literal("signal-ic"), z.literal("after-cost-long-short")]),
  specifications: z.array(specificationSchema).min(1),
  expectedOrigins: z.array(time).min(1),
  frozenAt: time, evaluationStart: time, evaluationEnd: time,
  embargoDays: z.number().int().nonnegative(), blockLength: z.number().int().positive(),
  repetitions: z.number().int().min(200).max(10000), seed: z.number().int(),
  currency: z.string().min(1), geography: z.string().min(1),
  quantile: z.number().positive().max(.5), weighting: z.literal("equal-within-sector"),
  costBps: z.literal(25), sensitivityCostBps: z.array(z.number().min(0).max(100)),
  borrowRateMultipliers: z.array(z.number().nonnegative()).min(1),
  terminalStresses: z.tuple([z.literal(0), z.literal(-.3), z.literal(-1)]),
  disclosure: z.literal("locked retrospective evaluation (prior exposure: 2020 onward)"),
  sleeveSchedule: sleeveScheduleSchema.optional(),
  longOnlyVariants: z.array(longOnlyVariantSchema).optional(),
  portfolioFrequency: portfolioFrequencySchema.optional(),
}).strict();
export type PairedResearchProtocol = z.infer<typeof protocolSchema>;
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
const sum = (v: number[]) => v.reduce((s, x) => s + x, 0);
const dot = (a: number[], b: number[]) => sum(a.map((x, i) => x * b[i]));
function fit(x: number[][], y: number[]) {
  const k = x[0].length;
  if (x.length <= k + 2) throw new Error("Insufficient regression observations");
  const a = Array.from({ length: k }, (_, i) => [
    ...Array.from({ length: k }, (_, j) => sum(x.map(r => r[i] * r[j]))), sum(x.map((r, t) => r[i] * y[t])),
  ]);
  for (let i = 0; i < k; i++) {
    let pivot = i;
    for (let j = i + 1; j < k; j++) if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-10) throw new Error("Singular factor/control design");
    const scale = a[i][i]; a[i] = a[i].map(v => v / scale);
    for (let j = 0; j < k; j++) if (j !== i) {
      const scale = a[j][i]; a[j] = a[j].map((v, t) => v - scale * a[i][t]);
    }
  }
  return a.map(r => r[k]);
}
function ranks(x: number[]) {
  return x.map(v => x.filter(w => w < v).length + (x.filter(w => w === v).length - 1) / 2);
}
function correlation(a: number[], b: number[]) {
  const x = ranks(a), y = ranks(b), mx = mean(x), my = mean(y);
  const denominator = Math.sqrt(sum(x.map(v => (v - mx) ** 2)) * sum(y.map(v => (v - my) ** 2)));
  return denominator > 0 ? sum(x.map((v, i) => (v - mx) * (y[i] - my))) / denominator : null;
}
/** All quantities are per unit of start NAV. Costs are cash expenses, never free defaults. */
export function accountResearchPeriod(
  period: ResearchPeriod, weights: Record<string, number>, prior: Record<string, number>,
  costBps: number, borrowMultiplier: number, terminalStress: number | null = null,
) {
  if (![costBps, borrowMultiplier].every(x => Number.isFinite(x) && x >= 0)) throw new Error("Invalid explicit cost");
  const ids = new Set(period.securities.map(s => s.companyId));
  if (Object.keys(prior).some(id => !ids.has(id) && Math.abs(prior[id]) > 1e-12))
    throw new Error("Held security disappeared without lifecycle settlement");
  if (Object.keys(weights).some(id => !ids.has(id)) || Object.values(weights).some(w => !Number.isFinite(w)))
    throw new Error("Unknown/nonfinite holding");
  const years = (Date.parse(period.endAt) - Date.parse(period.executionAt)) / (365.25 * 86400000);
  const turnover = sum(Array.from(new Set([...Object.keys(prior), ...Object.keys(weights)]))
    .map(id => Math.abs((weights[id] ?? 0) - (prior[id] ?? 0))));
  const tradingCost = turnover * costBps / 10000;
  const netExposure = sum(Object.values(weights)), grossExposure = sum(Object.values(weights).map(Math.abs));
  const cashBeforeExpenses = 1 - netExposure;
  let borrowCost = 0, dividendCash = 0, pricePnl = 0, hypothetical = false;
  const holdings = period.securities.map(s => {
    const w = weights[s.companyId] ?? 0;
    if (w < 0 && s.borrowAvailable === false) throw new Error("Explicitly unavailable borrow");
    if (w < 0 && (s.borrowAvailable === null || s.borrowAnnualRate === null)) hypothetical = true;
    const fee = w < 0 ? -w * (s.borrowAnnualRate ?? s.assumedBorrowAnnualRate) * borrowMultiplier * years : 0;
    borrowCost += fee;
    const units = w / (s.executionPrice * s.executionFx);
    const terminal = s.lifecycle !== "continuing";
    // Stress only flagged terminals, never all final observations.
    const proceeds = terminalStress !== null && terminal ?
      s.executionPrice * s.executionFx * (1 + terminalStress) / s.endFx : s.terminalProceeds;
    const finalPrice = terminal ? proceeds : s.endPrice * s.splitRatio;
    if (!terminal && s.terminalProceeds !== 0) throw new Error("Continuing issuer has terminal proceeds");
    const value = units * finalPrice * s.endFx;
    const distribution = units * s.dividends * s.endFx; // Negative for shorts.
    dividendCash += distribution; pricePnl += value - w;
    return { companyId: s.companyId, units, endUnits: terminal ? 0 : units * s.splitRatio, weight: w, endValue: terminal ? 0 : value,
      settlementCash: terminal ? value : 0, dividendCash: distribution, borrowCost: fee,
      lifecycle: s.lifecycle };
  });
  const cashAfterTrading = cashBeforeExpenses - tradingCost;
  const financing = Math.min(0, cashAfterTrading) * period.financingAnnualRate * years;
  const cashInterest = Math.max(0, cashAfterTrading) * period.cashAnnualRate * years;
  const endCash = cashAfterTrading + cashInterest + financing + dividendCash - borrowCost +
    sum(holdings.map(h => h.settlementCash));
  const endNav = endCash + sum(holdings.map(h => h.endValue));
  const grossReturn = pricePnl + dividendCash;
  const netReturn = grossReturn - tradingCost - borrowCost + financing + cashInterest;
  if (![endNav, netReturn].every(Number.isFinite) || Math.abs(endNav - (1 + netReturn)) > 1e-9)
    throw new Error("NAV reconciliation failed");
  return { origin: period.origin, executionAt: period.executionAt, endAt: period.endAt,
    holdings, cashBeforeExpenses, endCash, endNav, grossExposure, netExposure,
    turnover, tradedNotional: turnover, tradingCost, borrowCost, financing, cashInterest,
    shortDividendLiability: -sum(holdings.filter(h => h.weight < 0).map(h => h.dividendCash)),
    grossReturn, netReturn, hypothetical, insolvent: endNav <= 0,
    drifted: endNav > 0 ? Object.fromEntries(holdings.map(h => [h.companyId, h.endValue / endNav])) : {} };
}

function interval(values: number[][], statistic: (rows: number[][]) => number, p: PairedResearchProtocol) {
  if (values.length < Math.max(6, p.blockLength * 2)) throw new Error("Insufficient complete date blocks");
  let seed = p.seed >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const estimate = statistic(values), draws: number[] = [];
  for (let n = 0; n < p.repetitions; n++) {
    const rows: number[][] = [];
    while (rows.length < values.length) {
      const start = Math.floor(random() * values.length);
      for (let b = 0; b < p.blockLength && rows.length < values.length; b++) rows.push(values[(start + b) % values.length]);
    }
    draws.push(statistic(rows));
  }
  if (![estimate, ...draws].every(Number.isFinite)) throw new Error("Nonfinite inference");
  draws.sort((a, b) => a - b);
  return { estimate, improvement95: [draws[Math.floor(.025 * draws.length)], draws[Math.floor(.975 * draws.length)]] as [number, number],
    oneSidedP: (1 + draws.filter(v => v - estimate >= estimate).length) / (draws.length + 1) };
}

/** No IO, production state, archive substitution, selection, approval or promotion. */
export function runPairedResearchPipeline(protocolInput: unknown, expectedProtocolHash: string, corpusInput: unknown) {
  const p = protocolSchema.parse(protocolInput);
  if (contentHash(protocolInput) !== expectedProtocolHash) throw new Error("Frozen protocol hash mismatch");
  if (Date.parse(p.frozenAt) >= Date.parse(p.evaluationStart) || Date.parse(p.evaluationStart) >= Date.parse(p.evaluationEnd))
    throw new Error("Invalid frozen evaluation boundary");
  if (new Set(p.specifications.map(specificationKey)).size !== p.specifications.length) throw new Error("Duplicate specification");
  if (new Set(p.expectedOrigins.map(Date.parse)).size !== p.expectedOrigins.length) throw new Error("Duplicate frozen origin");
  if (p.specifications.some(s => s.target === "12-month") && p.blockLength < 12) throw new Error("Blocks shorter than outcome horizon");
  const c = adaptPairedResearchCorpus(corpusInput);
  const frequencyCells = p.portfolioFrequency?.cells ?? [];
  if (p.portfolioFrequency && p.sleeveSchedule) throw new Error("Legacy and v1 sleeve ledgers cannot share primary capital");
  if (new Set(frequencyCells.map(cell => specificationKey(cell.specification))).size !== frequencyCells.length ||
      new Set(frequencyCells.map(cell => cell.streamId)).size !== frequencyCells.length ||
      new Set((c.portfolioStreams ?? []).map(s => s.id)).size !== (c.portfolioStreams ?? []).length)
    throw new Error("Duplicate frequency cell or reused portfolio stream");
  if (frequencyCells.some(cell => !p.specifications.some(s => specificationKey(s) === specificationKey(cell.specification))) ||
      (c.portfolioStreams ?? []).some(s => !frequencyCells.some(cell => cell.streamId === s.id &&
        specificationKey(cell.specification) === specificationKey(s.specification))))
    throw new Error("Portfolio stream outside frozen specification binding");
  if (!!p.sleeveSchedule !== !!c.sleeveMarks) throw new Error("Sleeve schedule and complete marks must be supplied together");
  if (p.sleeveSchedule?.deployments.some(d => !p.expectedOrigins.some(o => Date.parse(o) === Date.parse(d.origin))))
    throw new Error("Sleeve origin outside frozen schedule");
  const sleeveAccounting = p.sleeveSchedule ? {
    label: "separate-overlapping-12-month-capital-ledger-not-primary-factor-evidence",
    accounting: accountOverlappingSleeves(p.sleeveSchedule, c.sleeveMarks, c.dataEnd),
    investmentEvidence: false,
  } : { unavailable: "Requires frozen deployments and complete simultaneous live-cohort marks" };
  const eventAccounting = (c.eventBooks ?? []).map(accountResearchEvents);
  const declared = new Set(p.specifications.map(specificationKey));
  if (c.periods.some(t => !declared.has(specificationKey(t.specification)))) throw new Error("Corpus outside frozen family");
  if (c.periods.some(t => !p.expectedOrigins.some(o => Date.parse(o) === Date.parse(t.origin))))
    throw new Error("Origin outside frozen schedule");
  const results: Array<{ model: string; peer: string; target: string; endpoint: "evaluation-r2" | "signal-ic" | "after-cost-long-short";
    estimate: number; improvement95: [number, number]; oneSidedP: number }> = [];
  const specifications = p.specifications.map(spec => {
    const periods = c.periods.filter(t => specificationKey(t.specification) === specificationKey(spec)).sort((a, b) => Date.parse(a.origin) - Date.parse(b.origin));
    const missing: string[] = [];
    for (const origin of p.expectedOrigins) if (!periods.some(t => Date.parse(t.origin) === Date.parse(origin)))
      missing.push(`${origin}: missing frozen origin`);
    const usable = periods.filter(t => {
      if (t.missing.length || t.pairs.some(r => r.medianPairedGap === null) || !t.complete) {
        missing.push(`${t.origin}: ${t.missing.length ? `missing members ${t.missing.join(",")}` : !t.complete ? "incomplete outcome" : "incomplete member pairs"}`); return false;
      }
      return true;
    });
    if (!periods.length) missing.unshift("No retained origin periods");
    // Missing declared members invalidate inference, not the correction denominator.
    const observations = usable.map(t => {
      const monthSpan = (new Date(t.endAt).getUTCFullYear() - new Date(t.executionAt).getUTCFullYear()) * 12 +
        new Date(t.endAt).getUTCMonth() - new Date(t.executionAt).getUTCMonth();
      const expectedEnd = new Date(t.executionAt);
      expectedEnd.setUTCMonth(expectedEnd.getUTCMonth() + (spec.target === "next-month" ? 1 : 12));
      if (monthSpan !== (spec.target === "next-month" ? 1 : 12) || expectedEnd.getTime() !== Date.parse(t.endAt))
        throw new Error("Outcome horizon/target mismatch (use first-of-month holding boundaries)");
      if (t.factors.currency !== p.currency || t.factors.geography !== p.geography) throw new Error("Factor geography/currency mismatch");
      const scored = rankPairedCompanyGaps(t.pairs);
      const scores = Object.fromEntries(scored.map(r => [r.companyId, r.score]));
      if (scored.some(r => r.score === null)) missing.push(`${t.origin}: incomplete peer ranks`);
      const returns = t.securities.map(s => {
        const final = s.lifecycle === "continuing" ? s.endPrice * s.splitRatio : s.terminalProceeds;
        return ((final + s.dividends) * s.endFx) / (s.executionPrice * s.executionFx) - 1;
      });
      const sectorReturns = (sector: string) => mean(returns.filter((_, i) => t.securities[i].sector === sector));
      return { t, scores, returns, outcomes: returns.map((r, i) => r - sectorReturns(t.securities[i].sector)) };
    });
    const weightsFor = (o: typeof observations[number]) => {
      const sectors = Array.from(new Set(o.t.securities.map(s => s.sector))), weights: Record<string, number> = {};
      for (const sector of sectors) {
        const rows = o.t.securities.filter(s => s.sector === sector).sort((a, b) => (o.scores[a.companyId] ?? 0) - (o.scores[b.companyId] ?? 0));
        const n = Math.floor(rows.length * p.quantile);
        if (!n || o.scores[rows[0].companyId] === o.scores[rows[rows.length - 1].companyId]) throw new Error("Unavailable distinct quantile legs");
        // Do not split boundary ties arbitrarily by identifier.
        const low = o.scores[rows[n - 1].companyId]!, high = o.scores[rows[rows.length - n].companyId]!;
        if (low >= high) throw new Error("Overlapping tied quantile legs");
        const short = rows.filter(s => o.scores[s.companyId]! <= low), long = rows.filter(s => o.scores[s.companyId]! >= high);
        short.forEach(s => weights[s.companyId] = -1 / (sectors.length * short.length));
        long.forEach(s => weights[s.companyId] = 1 / (sectors.length * long.length));
      }
      return weights;
    };
    const evaluation = observations.filter(o => Date.parse(o.t.origin) >= Date.parse(p.evaluationStart) && Date.parse(o.t.endAt) <= Date.parse(p.evaluationEnd));
    const training = observations.filter(o => Date.parse(o.t.outcomeAvailableAt) + p.embargoDays * 86400000 < Date.parse(p.evaluationStart));
    const trajectories: Array<{ label: string; costBps: number; borrowMultiplier: number; stress: number | null;
      accounting: ReturnType<typeof accountResearchPeriod>[]; error?: string }> = [];
    for (const variant of [
      { label: "primary-long-short", costBps: p.costBps, borrowMultiplier: 1, stress: null },
      ...p.sensitivityCostBps.map(costBps => ({ label: "cost-sensitivity", costBps, borrowMultiplier: 1, stress: null })),
      ...p.borrowRateMultipliers.map(borrowMultiplier => ({ label: "borrow-sensitivity", costBps: p.costBps, borrowMultiplier, stress: null })),
      ...p.terminalStresses.map(stress => ({ label: "flagged-terminal-sensitivity", costBps: p.costBps, borrowMultiplier: 1, stress })),
    ]) {
      const accounting: ReturnType<typeof accountResearchPeriod>[] = [];
      let prior: Record<string, number> = {}, error: string | undefined;
      try {
        for (const o of evaluation) {
          if (accounting.length && Date.parse(accounting[accounting.length - 1].endAt) !== Date.parse(o.t.executionAt))
            throw new Error("Portfolio periods require contiguous nonoverlapping holding windows");
          if (accounting.length) {
            const last = accounting[accounting.length - 1];
            for (const h of last.holdings.filter(h => h.endUnits !== 0)) {
              const current = o.t.securities.find(s => s.companyId === h.companyId);
              if (!current || Math.abs(h.endUnits * current.executionPrice * current.executionFx - h.endValue) > 1e-8)
                throw new Error("Execution mark discontinuity: supply intervening FX/price/action reconciliation");
            }
          }
          if (Object.values(o.scores).some(s => s === null)) throw new Error("Missing score cannot become zero");
          const row = accountResearchPeriod(o.t, weightsFor(o), prior, variant.costBps, variant.borrowMultiplier, variant.stress);
          accounting.push(row); prior = row.drifted;
          if (row.insolvent) { error = "Terminal insolvency; no restart"; break; }
        }
      } catch (e) { error = (e as Error).message; }
      trajectories.push({ ...variant, accounting, ...(error ? { error } : {}) });
    }
    const primary = trajectories[0];
    const endpoints: Record<string, unknown> = {};
    const attempt = (endpoint: "signal-ic" | "evaluation-r2" | "after-cost-long-short", calculate: () => ReturnType<typeof interval>) => {
      try {
        if (missing.length) throw new Error("Incomplete declared corpus");
        const result = calculate(); endpoints[endpoint] = result;
        // Fixtures exercise inference but can NEVER become scientific evidence.
        // Hash consistency is not independent review. No caller-supplied corpus
        // currently satisfies an authenticated review gate for family evidence.
        if (c.authenticityVerified) results.push({ ...spec, endpoint, ...result });
      } catch (e) { endpoints[endpoint] = { unavailable: (e as Error).message }; }
    };
    attempt("signal-ic", () => interval(evaluation.map(o => {
      const ic = correlation(o.t.securities.map(s => o.scores[s.companyId]!), o.outcomes);
      if (ic === null) throw new Error("Constant signal/outcome IC");
      return [ic];
    }), rows => mean(rows.map(r => r[0])), p));
    const ablations: Record<string, unknown> = {};
    const predictLoss = (additions: number) => {
      const features = (o: typeof observations[number], i: number) => {
        const s = o.t.securities[i];
        return [1, ...s.controls, ...(additions === 5 ? [o.scores[s.companyId]!] :
          [s.baselineGrowth, s.transitionDemand, s.carbonDrag, s.intensity].slice(0, additions))];
      };
      const baseline = fit(training.flatMap(o => o.t.securities.map((_, i) => features(o, i))), training.flatMap(o => o.outcomes));
      return evaluation.map(o => o.outcomes.map((y, i) => (y - dot(features(o, i), baseline)) ** 2));
    };
    attempt("evaluation-r2", () => {
      const base = predictLoss(0), extended = predictLoss(5);
      const trainMean = mean(training.flatMap(o => o.outcomes));
      const rows = evaluation.map((o, i) => [sum(base[i]) - sum(extended[i]), sum(o.outcomes.map(y => (y - trainMean) ** 2))]);
      for (let n = 1; n <= 4; n++) {
        const loss = predictLoss(n);
        ablations[["baseline-growth", "plus-transition-demand", "plus-carbon-drag", "plus-intensity"][n - 1]] =
          { mse: mean(loss.flat()), controlsOnlyMse: mean(base.flat()) };
      }
      return interval(rows, r => sum(r.map(x => x[0])) / sum(r.map(x => x[1])), p);
    });
    const attribution: Record<string, unknown> = {};
    let portfolioEvidence: ReturnType<typeof reconcilePortfolioFrequency> | { unavailable: string } =
      { unavailable: "Requires explicit simultaneous-monthly-sleeves-v1 frozen specification binding" };
    attempt("after-cost-long-short", () => {
      if (spec.target === "12-month") {
        const cell = frequencyCells.find(cell => specificationKey(cell.specification) === specificationKey(spec));
        const stream = cell && c.portfolioStreams?.find(s => s.id === cell.streamId);
        if (!cell || !stream) throw new Error("12-month factor inference requires explicitly bound monthly simultaneous sleeves; legacy unbound streams are unavailable");
        const bridge = reconcilePortfolioFrequency(cell, stream, {
          artifacts: c.artifacts, dataEnd: c.dataEnd, mode: c.mode, currency: p.currency, geography: p.geography,
          costBps: p.costBps, expectedOrigins: p.expectedOrigins,
          selections: observations.map(o => ({
            origin: o.t.origin, executionAt: o.t.executionAt, endAt: o.t.endAt, weights: weightsFor(o),
            executionQuotes: Object.fromEntries(o.t.securities.map(s => [s.companyId, { price: s.executionPrice, fx: s.executionFx }])),
          })),
        });
        portfolioEvidence = bridge;
        if (!bridge.rows.some(r => Date.parse(r.fromAt) === Date.parse(p.evaluationStart)) ||
            !bridge.rows.some(r => Date.parse(r.toAt) === Date.parse(p.evaluationEnd)))
          throw new Error("Monthly inference requires exact retained evaluation boundaries");
        const monthly = bridge.rows.filter(r => Date.parse(r.fromAt) >= Date.parse(p.evaluationStart) &&
          Date.parse(r.toAt) <= Date.parse(p.evaluationEnd));
        for (const source of ["regionalDeveloped", "workbookUniverse"] as const) {
          attribution[source] = { ...interval(monthly.map(r => [r.excessReturn, ...r[source]]),
            rows => fit(rows.map(r => [1, ...r.slice(1)]), rows.map(r => r[0]))[0], p),
            frequency: "calendar-month", returnConvention: p.portfolioFrequency!.returnConvention,
            hypothetical: bridge.hypothetical, accountingLabel: bridge.label,
            investmentEvidence: false, authenticityVerified: false,
            dates: monthly.map(r => ({ fromAt: r.fromAt, toAt: r.toAt })), observations: monthly.length };
        }
        return attribution.regionalDeveloped as ReturnType<typeof interval>;
      }
      if (primary.error || primary.accounting.length !== evaluation.length) throw new Error(primary.error ?? "Incomplete accounting");
      if (primary.accounting.some(r => r.hypothetical)) throw new Error("Borrow history absent: hypothetical only");
      for (const source of ["regionalDeveloped", "workbookUniverse"] as const) {
        attribution[source] = interval(evaluation.map((o, i) => [
          primary.accounting[i].netReturn - o.t.cashAnnualRate * (Date.parse(o.t.endAt) - Date.parse(o.t.executionAt)) / (365.25 * 86400000),
          ...o.t.factors[source]]),
          rows => fit(rows.map(r => [1, ...r.slice(1)]), rows.map(r => r[0]))[0], p);
      }
      return attribution.regionalDeveloped as ReturnType<typeof interval>;
    });
    if (spec.target === "12-month" && "unavailable" in (endpoints["after-cost-long-short"] as object))
      portfolioEvidence = endpoints["after-cost-long-short"] as { unavailable: string };
    // Preserve the existing kernel unchanged; its output is NOT the spread test.
    let longOnly: unknown = { unavailable: "Requires complete next-month rows" };
    const longOnlyVariants: unknown[] = [];
    if (spec.target === "next-month" && !missing.length && observations.length) {
      for (let i = 1; i < observations.length; i++) {
        if (Date.parse(observations[i - 1].t.outcomeAvailableAt) > Date.parse(observations[i].t.executionAt))
          throw new Error("Prior return unavailable for long-only risk scaling");
      }
      const monthly = new Map(observations.map(o => [o.t.executionAt.slice(0, 7), o.t.securities.map((s, i) =>
        ({ companyId: s.numericId, marketCap: s.marketCap, monthlyReturn: o.returns[i] }))]));
      if (monthly.size !== observations.length) throw new Error("Duplicate kernel month");
      const scores = new Map(observations.map(o => [o.t.executionAt.slice(0, 7), new Map(o.t.securities.map(s => [s.numericId, o.scores[s.companyId]!]))]));
      const kernel = walkForward(monthly, scores, .02, p.costBps);
      longOnly = { label: "existing-long-only-tilt-kernel-not-long-short-evidence", result: kernel };
      for (const variant of p.longOnlyVariants ?? []) {
        const accounting: ReturnType<typeof accountResearchPeriod>[] = [];
        let prior: Record<string, number> = {};
        try {
          for (let i = 0; i < evaluation.length; i++) {
            const o = evaluation[i];
            const last = accounting.at(-1);
            if (last && Date.parse(last.endAt) !== Date.parse(o.t.executionAt))
              throw new Error("Constraint variants require contiguous monthly observations");
            if (last) for (const h of last.holdings.filter(h => h.endUnits !== 0)) {
              const s = o.t.securities.find(s => s.companyId === h.companyId);
              if (!s || Math.abs(h.endUnits * s.executionPrice * s.executionFx - h.endValue) > 1e-8)
                throw new Error("Constraint variant execution mark discontinuity");
            }
            const tilt = kernel.series.find(r => r.date === o.t.executionAt.slice(0, 7))?.tiltScale;
            if (tilt === undefined) throw new Error("Missing past-only kernel tilt");
            const rows = o.t.securities.map(s => {
              if (!s.longOnlyInputs) throw new Error(`Missing origin eligibility/liquidity: ${s.companyId}`);
              return { companyId: s.companyId, sector: s.sector, marketCap: s.marketCap, score: o.scores[s.companyId],
                eligible: s.longOnlyInputs.eligible, liquidity: s.longOnlyInputs.liquidity, availableAt: s.longOnlyInputs.availableAt };
            });
            const selection = constrainedLongOnly(rows, variant, tilt, o.t.executionAt, i, prior);
            const row = accountResearchPeriod(o.t, selection.weights, prior, p.costBps, 1);
            accounting.push(row); prior = row.drifted;
            if (row.insolvent) throw new Error("Terminal insolvency; no restart");
          }
          longOnlyVariants.push({ variant, accounting, label: "constrained-long-only-not-spread-evidence" });
        } catch (e) {
          longOnlyVariants.push({ variant, accounting, unavailable: (e as Error).message });
        }
      }
    }
    return { ...spec, missing, originCount: periods.length, trainingDates: training.length, evaluationDates: evaluation.length,
      endpoints, ablations, attribution, trajectories, longOnly, longOnlyVariants,
      portfolioEvidence: portfolioEvidence as ReturnType<typeof reconcilePortfolioFrequency> | { unavailable: string } };
  });
  return { protocolId: expectedProtocolHash, corpusHash: c.corpusHash, disclosure: p.disclosure, mode: c.mode,
    sleeveAccounting, eventAccounting,
    specifications, family: adjudicateResearchFamily({ protocolId: expectedProtocolHash, specifications: p.specifications, results }),
    efficacy: "WITHHELD", scientificAcceptance: false, investmentEvidence: false, authenticityVerified: false,
    tracks: { A: c.mode === "revised-history" ? "conditional revised-history" : "unavailable",
      B: c.mode === "point-in-time" ? "contract-checked; independent archive verification required" : "unavailable",
      prospective: "unavailable: requires independently retained live signal archive" },
    limitations: ["Caller-supplied origin and provenance claims are not authenticated.",
      "Historical efficacy requires independent archive verification and review; engineering fixtures never adjudicate positively.",
      "Long-only output preserves the existing kernel, whose accounting is separate from the explicit long-short cash ledger.",
      "Legacy overlapping sleeves remain separate and unavailable for primary inference. Explicit simultaneous-monthly-sleeves-v1 cells reconcile monthly NAV and dated factors, but do not authenticate historical evidence.",
      "Dated event books and constrained long-only overlays are separate research accounting, not replacements for the unchanged primary hypothesis."] };
}

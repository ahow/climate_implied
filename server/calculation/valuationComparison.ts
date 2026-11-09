import { z } from "zod";
import { SeededRandom } from "./random";
import { contentHash } from "./analysisManifest";

const finite = z.number().finite();
const rowSchema = z.object({
  companyId: z.string().min(1), origin: z.string().date(),
  outcomeAvailableAt: z.string().date(),
  cashFlowHorizonYears: z.literal(3), cashFlowBasis: z.enum(["FCFE", "FCFF"]),
  currency: z.string().regex(/^[A-Z]{3}$/),
  actualCashFlowGrowth: finite.nullable(),
  gordonCashFlowGrowth: finite.nullable(), dcfCashFlowGrowth: finite.nullable(),
  gordonSignal: finite.nullable(), dcfSignal: finite.nullable(),
  validationReturn: finite.nullable(),
}).strict();
const schema = z.object({
  protocolId: z.string().regex(/^[a-f0-9]{64}$/),
  evidenceMode: z.enum(["revised-history", "point-in-time"]),
  evaluationAsOf: z.string().date(), blockLength: z.number().int().min(3).max(10),
  bootstrapReplications: z.number().int().min(500).max(10000),
  seed: z.number().int().nonnegative().max(4294967295),
  rows: z.array(rowSchema).max(100000),
}).strict();
type Row = z.infer<typeof rowSchema>;
const mean = (xs: number[]) => xs.reduce((sum, x) => sum + x, 0) / xs.length;

/** Average ranks retain ties; constant ranks cannot produce a correlation. */
function ranks(xs: number[]) {
  const ordered = xs.map((value, i) => ({ value, i })).sort((a, b) => a.value - b.value);
  const output = xs.map(() => 0);
  for (let i = 0; i < ordered.length;) {
    let j = i + 1;
    while (j < ordered.length && ordered[j].value === ordered[i].value) j++;
    for (let k = i; k < j; k++) output[ordered[k].i] = (i + j - 1) / 2;
    i = j;
  }
  return output;
}
function spearman(a: number[], b: number[]) {
  const ar = ranks(a), br = ranks(b), am = mean(ar), bm = mean(br);
  const av = ar.map(v => v - am), bv = br.map(v => v - bm);
  const denominator = Math.sqrt(av.reduce((s, v) => s + v * v, 0) * bv.reduce((s, v) => s + v * v, 0));
  return denominator === 0 ? null : av.reduce((s, v, i) => s + v * bv[i], 0) / denominator;
}
function quantile(sorted: number[], p: number) {
  const index = (sorted.length - 1) * p, lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}
function complete(r: Row) {
  return [r.actualCashFlowGrowth, r.gordonCashFlowGrowth, r.dcfCashFlowGrowth,
    r.gordonSignal, r.dcfSignal, r.validationReturn].every(v => v !== null);
}

/** D8 numerical decision only; never grants identity or investment approval. */
export function compareValuationModels(input: unknown) {
  const p = schema.parse(input);
  const rows = [...p.rows].sort((a, b) => a.origin.localeCompare(b.origin) || a.companyId.localeCompare(b.companyId));
  const keys = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify([row.companyId, row.origin]);
    if (keys.has(key)) throw new Error("Duplicate company/origin");
    keys.add(key);
    const end = new Date(`${row.origin}T00:00:00Z`);
    // Completed three-year outcome is mandatory, not merely a positive lag.
    end.setUTCFullYear(end.getUTCFullYear() + 3);
    if (row.outcomeAvailableAt < end.toISOString().slice(0, 10))
      throw new Error("Cash-flow outcome is not a completed three-year horizon");
  }
  const coverage = { supplied: rows.length,
    incomplete: rows.filter(r => !complete(r)).length,
    notYetAvailable: rows.filter(r => complete(r) && r.outcomeAvailableAt > p.evaluationAsOf).length,
    completeAvailable: rows.filter(r => complete(r) && r.outcomeAvailableAt <= p.evaluationAsOf).length };
  const common = rows.filter(r => complete(r) && r.outcomeAvailableAt <= p.evaluationAsOf);
  const groups = new Map<string, Row[]>();
  for (const row of common) groups.set(row.origin, [...(groups.get(row.origin) ?? []), row]);
  const dates = Array.from(groups.keys()).sort();
  const diagnostics = dates.map(date => {
    const group = groups.get(date)!;
    const gordonIC = spearman(group.map(r => r.gordonSignal!), group.map(r => r.validationReturn!));
    const dcfIC = spearman(group.map(r => r.dcfSignal!), group.map(r => r.validationReturn!));
    return { date, count: group.length, gordonIC, dcfIC,
      gordonMAE: mean(group.map(r => Math.abs(r.gordonCashFlowGrowth! - r.actualCashFlowGrowth!))),
      dcfMAE: mean(group.map(r => Math.abs(r.dcfCashFlowGrowth! - r.actualCashFlowGrowth!))) };
  });
  const metadata = { protocolId: p.protocolId, inputHash: contentHash(p), coverage,
    evidenceMode: p.evidenceMode, investmentEvidence: false, automaticPromotionAllowed: false,
    aggregation: "equal-weight origin dates; common company sample within each date",
    uncertainty: "paired circular origin-date blocks", blockLength: p.blockLength,
    limitations: ["Historical availability, identities, currency and frozen protocol require independent verification.",
      "Supplied Gordon growth must be a defined three-year cash-flow comparator, not an unlabelled steady-state rate.",
      "Resampling retains all companies per date and short temporal dependence, not every issuer or regime dependence.",
      "A numerical pass does not promote a model or establish investment evidence."] };
  const reasons: string[] = [];
  if (dates.length < Math.max(6, 2 * p.blockLength)) reasons.push("At least six origin dates and two temporal blocks required");
  if (diagnostics.some(d => d.count < 10)) reasons.push("At least ten common companies per origin required");
  if (diagnostics.some(d => d.gordonIC === null || d.dcfIC === null)) reasons.push("Constant signal or outcome makes IC unidentified");
  if (new Set(common.map(r => r.cashFlowBasis)).size > 1) reasons.push("FCFE and FCFF comparisons must be separate");
  if (dates.some((date, i) => i > 0 &&
    (Number(date.slice(0, 4)) !== Number(dates[i - 1].slice(0, 4)) + 1 ||
      date.slice(4) !== dates[i - 1].slice(4)))) reasons.push("Annual origin-date grid must be consecutive");
  if (reasons.length) return { ...metadata, status: "unavailable" as const, reasons, diagnostics };
  const paired = diagnostics.map(d => ({ mae: d.gordonMAE - d.dcfMAE, ic: d.dcfIC! - d.gordonIC! }));
  const rng = new SeededRandom(p.seed);
  const draws = Array.from({ length: p.bootstrapReplications }, () => {
    const selected: typeof paired = [];
    while (selected.length < paired.length) {
      const start = Math.floor(rng.next() * paired.length);
      for (let j = 0; j < p.blockLength && selected.length < paired.length; j++)
        selected.push(paired[(start + j) % paired.length]);
    }
    return { mae: mean(selected.map(r => r.mae)), ic: mean(selected.map(r => r.ic)) };
  });
  const interval = (key: "mae" | "ic") => {
    const sorted = draws.map(d => d[key]).sort((a, b) => a - b);
    return [quantile(sorted, .025), quantile(sorted, .975)];
  };
  const forecastImprovement95 = interval("mae"), signalIcImprovement95 = interval("ic");
  return { ...metadata, status: "evaluated" as const,
    forecastMAEImprovement: mean(paired.map(r => r.mae)), forecastImprovement95,
    signalICImprovement: mean(paired.map(r => r.ic)), signalIcImprovement95,
    passesNumericalGate: forecastImprovement95[0] > 0 && signalIcImprovement95[0] > 0,
    diagnostics };
}

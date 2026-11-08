import { z } from "zod";
const rowSchema = z.object({
  date: z.string().date(), publishedAt: z.string().date().nullable(), outcomeAvailableAt: z.string().date(),
  controls: z.array(z.number().finite()).min(1).max(20),
  signal: z.number().finite(), outcome: z.number().finite(),
});
// Small ridge-stabilized least-squares system, fitted on training rows only.
function fit(x: number[][], y: number[]) {
  const n = x[0].length;
  const a = Array.from({ length: n }, (_, i) =>
    [...Array.from({ length: n }, (_, j) => x.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? 1e-8 : 0)),
      x.reduce((s, r, k) => s + r[i] * y[k], 0)]);
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let k = i + 1; k < n; k++) if (Math.abs(a[k][i]) > Math.abs(a[pivot][i])) pivot = k;
    [a[i], a[pivot]] = [a[pivot], a[i]];
    if (Math.abs(a[i][i]) < 1e-14) throw new Error("Singular controls");
    const scale = a[i][i]; a[i] = a[i].map(v => v / scale);
    for (let k = 0; k < n; k++) if (k !== i) {
      const factor = a[k][i]; a[k] = a[k].map((v, j) => v - factor * a[i][j]);
    }
  }
  return a.map(r => r[n]);
}
export function evaluateSignal(input: unknown, maximumRows = 10000) {
  if (!Number.isInteger(maximumRows) || maximumRows < 30 || maximumRows > 1000000) throw new Error("Invalid research row budget");
  const p = z.object({
    frozenAt: z.string().date(), splitDate: z.string().date(),
    minimumMseImprovement: z.number().gt(0).lt(1),
    specificationCount: z.literal(1),
    evidenceMode: z.enum(["point-in-time", "revised-history"]).default("point-in-time"),
    uncertainty: z.enum(["independent-rows", "date-blocks"]).default("independent-rows"),
    blockLength: z.number().int().min(1).max(24).default(3),
    rows: z.array(rowSchema).min(30).max(maximumRows),
  }).parse(input);
  if ((p.evidenceMode === "point-in-time" && p.frozenAt >= p.splitDate) || p.rows.some(r =>
    (r.publishedAt !== null && r.publishedAt > r.date) ||
    (p.evidenceMode === "point-in-time" && r.publishedAt === null) ||
    r.outcomeAvailableAt <= r.date ||
    r.controls.length !== p.rows[0].controls.length)) throw new Error("Invalid preregistration, availability or controls");
  const train = p.rows.filter(r => r.date < p.splitDate);
  const holdout = p.rows.filter(r => r.date >= p.splitDate);
  if (train.length < 20 || holdout.length < 10 || train.some(r => r.outcomeAvailableAt >= p.splitDate))
    throw new Error("Insufficient training/holdout or unavailable training outcomes");
  const predict = (features: number[], beta: number[]) => features.reduce((s, v, i) => s + v * beta[i], 0);
  const base = fit(train.map(r => [1, ...r.controls]), train.map(r => r.outcome));
  const extended = fit(train.map(r => [1, ...r.controls, r.signal]), train.map(r => r.outcome));
  const losses = holdout.map(r => ({
    baseline: (r.outcome - predict([1, ...r.controls], base)) ** 2,
    extended: (r.outcome - predict([1, ...r.controls, r.signal], extended)) ** 2,
  }));
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const baselineMSE = mean(losses.map(r => r.baseline)), candidateMSE = mean(losses.map(r => r.extended));
  const delta = losses.map(r => r.baseline - r.extended);
  const improvement = baselineMSE > 1e-12 ? (baselineMSE - candidateMSE) / baselineMSE : 0;
  const dates = Array.from(new Set(holdout.map(r => r.date))).sort();
  const dateLosses = dates.map(date => delta.filter((_, i) => holdout[i].date === date));
  const dateSums = dateLosses.map(values => ({ sum: values.reduce((a, b) => a + b, 0), count: values.length }));
  if (p.uncertainty === "date-blocks" && dates.length < Math.max(6, 2 * p.blockLength))
    throw new Error("At least six dates and two blocks required for date-block uncertainty");
  // Circular moving blocks preserve all companies on each sampled date together.
  // Consecutive dates within a block also retain short-range temporal dependence.
  let seed = 1741;
  const random = (length: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return Math.floor(seed / 4294967296 * length);
  };
  const samples = Array.from({ length: 500 }, () => {
    if (p.uncertainty === "independent-rows") return mean(delta.map(() => delta[random(delta.length)]));
    const selected: number[] = [];
    while (selected.length < dates.length) {
      const start = random(dates.length);
      for (let i = 0; i < p.blockLength && selected.length < dates.length; i++) selected.push((start + i) % dates.length);
    }
    return selected.reduce((sum, i) => sum + dateSums[i].sum, 0) /
      selected.reduce((sum, i) => sum + dateSums[i].count, 0);
  }).sort((a, b) => a - b);
  const positive = improvement >= p.minimumMseImprovement && samples[12] > 0;
  return { decision: p.evidenceMode === "revised-history" ? (positive ? "exploratory-positive-not-validated" : "exploratory-no-improvement") :
      positive ? "go-for-further-validation" : "no-go-for-this-specification",
    baselineMSE, candidateMSE, improvement, pairedLossImprovement95: [samples[12], samples[487]],
    trainingCount: train.length, holdoutCount: holdout.length, coefficients: extended,
    evidenceMode: p.evidenceMode, uncertainty: p.uncertainty, blockLength: p.blockLength, holdoutDates: dates.length,
    limitations: ["Supplied publication dates and preregistration need independent verification.",
      p.uncertainty === "date-blocks" ? "Date blocks account for contemporaneous dependence and short temporal dependence; sector and block-length stability still require assessment." :
        "Bootstrap assumes independent rows; time/sector stability and clustered uncertainty remain required before investment claims.",
      ...(p.evidenceMode === "revised-history" ? ["Historical publication vintages are unavailable; this is retrospective exploration, not a preregistered point-in-time finding."] : [])] };
}

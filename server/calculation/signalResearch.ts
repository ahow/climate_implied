import { z } from "zod";
const rowSchema = z.object({
  date: z.string().date(), publishedAt: z.string().date(), outcomeAvailableAt: z.string().date(),
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
export function evaluateSignal(input: unknown) {
  const p = z.object({
    frozenAt: z.string().date(), splitDate: z.string().date(),
    minimumMseImprovement: z.number().gt(0).lt(1),
    specificationCount: z.literal(1),
    rows: z.array(rowSchema).min(30).max(10000),
  }).parse(input);
  if (p.frozenAt >= p.splitDate || p.rows.some(r => r.publishedAt > r.date ||
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
  // Deterministic paired bootstrap; independent rows assumed, not a time-series certification.
  let seed = 1741;
  const samples = Array.from({ length: 500 }, () => mean(delta.map(() => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return delta[Math.floor(seed / 4294967296 * delta.length)];
  }))).sort((a, b) => a - b);
  return { decision: improvement >= p.minimumMseImprovement && samples[12] > 0 ? "go-for-further-validation" : "no-go-for-this-specification",
    baselineMSE, candidateMSE, improvement, pairedLossImprovement95: [samples[12], samples[487]],
    trainingCount: train.length, holdoutCount: holdout.length, coefficients: extended,
    limitations: ["Supplied publication dates and preregistration need independent verification.",
      "Bootstrap assumes independent rows; time/sector stability and clustered uncertainty remain required before investment claims."] };
}

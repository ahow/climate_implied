import { z } from "zod";
import { SeededRandom } from "./random";
const observation = z.object({ year: z.number().int(), value: z.number().finite().positive() }).strict();
function line(values: number[]) {
  const mx = (values.length - 1) / 2, my = values.reduce((s, v) => s + v, 0) / values.length;
  let numerator = 0, denominator = 0;
  values.forEach((value, i) => { numerator += (i - mx) * (value - my); denominator += (i - mx) ** 2; });
  const slope = numerator / denominator;
  return { intercept: my - slope * mx, slope };
}
const mean = (v: number[]) => v.reduce((s, x) => s + x, 0) / v.length;
function interval(samples: number[]) {
  samples.sort((a, b) => a - b);
  const q = (p: number) => {
    const x = (samples.length - 1) * p, a = Math.floor(x), b = Math.ceil(x);
    return samples[a] + (samples[b] - samples[a]) * (x - a);
  };
  return [q(.025), q(.975)];
}
export function shortHorizonEmissions(input: unknown) {
  const rows = z.array(observation).parse(input).sort((a, b) => a.year - b.year);
  if (new Set(rows.map(r => r.year)).size !== rows.length) throw new Error("Duplicate annual observation");
  const data = new Map(rows.map(r => [r.year, r.value]));
  for (let year = 2010; year <= 2025; year++)
    if (!data.has(year)) throw new Error(`Missing frozen observation ${year}`);
  const predictions = Array.from({ length: 8 }, (_, i) => {
    const origin = 2015 + i;
    const train = Array.from({ length: 6 }, (_, j) => data.get(origin - 5 + j)!);
    const log = line(train.map(Math.log)), linear = line(train);
    return [1, 2, 3].map(horizon => {
      const x = 5 + horizon;
      return { origin, horizon, targetYear: origin + horizon, actual: data.get(origin + horizon)!,
        candidate: Math.exp(log.intercept + log.slope * x),
        persistence: train[5], linearTrend: linear.intercept + linear.slope * x };
    });
  }).flat();
  if (predictions.some(p => [p.candidate, p.linearTrend].some(v => !Number.isFinite(v) || v <= 0)))
    throw new Error("Non-positive or nonfinite model prediction; no clipping");
  const rng = new SeededRandom(20261111);
  const indices = Array.from({ length: 2000 }, () => {
    const chosen: number[] = [];
    while (chosen.length < 8) {
      const start = Math.floor(rng.next() * 8);
      for (let j = 0; j < 3 && chosen.length < 8; j++) chosen.push((start + j) % 8);
    }
    return chosen;
  });
  const horizons = [1, 2, 3].map(horizon => {
    const selected = predictions.filter(p => p.horizon === horizon);
    const metrics = (model: "candidate" | "persistence" | "linearTrend") => {
      const errors = selected.map(p => p[model] - p.actual);
      return { bias: mean(errors), mae: mean(errors.map(Math.abs)), rmse: Math.sqrt(mean(errors.map(e => e * e))) };
    };
    const comparisons = (["persistence", "linearTrend"] as const).map(baseline => {
      const differences = selected.map(p => Math.abs(p[baseline] - p.actual) - Math.abs(p.candidate - p.actual));
      return { baseline, meanMAEImprovement: mean(differences),
        pairedImprovement95: interval(indices.map(draw => mean(draw.map(i => differences[i])))) };
    });
    return { horizon, origins: selected.length, candidate: metrics("candidate"),
      persistence: metrics("persistence"), linearTrend: metrics("linearTrend"), comparisons,
      passesDiagnosticGate: comparisons.every(c => c.meanMAEImprovement > 0 && c.pairedImprovement95[0] > 0) };
  });
  return { variable: "fossil CO2", unit: "GtCO2/year", evidenceMode: "revised-curated-history",
    publicationVintageSkillEstablished: false, validates2100Warming: false,
    productionEligible: false, horizons, predictions };
}

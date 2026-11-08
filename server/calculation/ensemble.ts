import { z } from "zod";
export const ensembleSchema = z.object({
  baseline: z.literal("1850-1900"),
  memberIds: z.array(z.string().min(1)).min(2).max(10000),
  years: z.array(z.number().int()).min(1).max(400),
  temperature: z.array(z.array(z.number().finite()).max(10000)).max(400),
}).superRefine((e, ctx) => {
  if (new Set(e.memberIds).size !== e.memberIds.length || e.temperature.length !== e.years.length ||
    e.temperature.some(row => row.length !== e.memberIds.length) ||
    e.years.some((y, i) => i > 0 && y <= e.years[i - 1])) {
    ctx.addIssue({ code: "custom", message: "Unique members, ordered years and rectangular ensemble required" });
  }
});
export type TemperatureEnsemble = z.infer<typeof ensembleSchema>;
function quantile(sorted: number[], p: number) {
  const index = (sorted.length - 1) * p, lo = Math.floor(index), hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}
export function summarizeEnsemble(input: unknown) {
  const e = ensembleSchema.parse(input);
  const trajectory = e.temperature.map((row, i) => {
    const sorted = [...row].sort((a, b) => a - b);
    return { year: e.years[i], mean: row.reduce((s, v) => s + v, 0) / row.length,
      p10: quantile(sorted, .1), median: quantile(sorted, .5), p90: quantile(sorted, .9),
      probabilityAbove1_5: row.filter(v => v > 1.5).length / row.length,
      probabilityAbove2: row.filter(v => v > 2).length / row.length,
      probabilityAbove3: row.filter(v => v > 3).length / row.length };
  });
  const last = e.temperature[e.temperature.length - 1];
  const lo = Math.min(...last), hi = Math.max(...last);
  const width = hi === lo ? 1 : (hi - lo) / 20;
  const counts = Array(20).fill(0) as number[];
  for (const value of last) counts[Math.min(19, Math.floor((value - lo) / width))]++;
  return { baseline: e.baseline, members: e.memberIds.length, trajectory,
    headline: trajectory[trajectory.length - 1],
    density: counts.map((count, i) => ({ lower: lo + i * width, upper: lo + (i + 1) * width,
      count, probability: count / last.length })),
    status: "submitted-ensemble-summary-not-independent-model-validation" };
}
export function compareEnsembles(candidate: unknown, reference: unknown, toleranceC = .01) {
  if (!Number.isFinite(toleranceC) || toleranceC <= 0 || toleranceC > .01) throw new Error("Reference tolerance must be positive and at most 0.01C");
  const a = ensembleSchema.parse(candidate), b = ensembleSchema.parse(reference);
  if (JSON.stringify(a.years) !== JSON.stringify(b.years) ||
    a.memberIds.length !== b.memberIds.length || a.memberIds.some(id => !b.memberIds.includes(id))) throw new Error("Reference years/member identities mismatch");
  const indexes = a.memberIds.map(id => b.memberIds.indexOf(id));
  let maxAnnualDifferenceC = 0;
  a.temperature.forEach((row, year) => row.forEach((value, member) =>
    maxAnnualDifferenceC = Math.max(maxAnnualDifferenceC, Math.abs(value - b.temperature[year][indexes[member]]))));
  return { passed: maxAnnualDifferenceC <= toleranceC, maxAnnualDifferenceC, toleranceC };
}

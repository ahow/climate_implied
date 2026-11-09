import { z } from "zod";
import { contentHash } from "./analysisManifest";

const schema = z.object({
  manifestId: z.string().min(1), baselineId: z.string().min(1), targetId: z.string().min(1),
  unit: z.enum(["degC", "GtCO2e", "GtCO2"]),
  memberIds: z.array(z.string().min(1)).min(1).max(10000),
  groups: z.array(z.string().min(1)).min(1).max(8),
  coalitions: z.array(z.object({
    groups: z.array(z.string().min(1)).max(8),
    values: z.array(z.number().finite()).min(1).max(10000),
  }).strict()).min(2).max(256),
}).strict();

/** All coalition runs must use the same paired members, baseline and manifest.
 * Does not generate counterfactuals or claim that submitted runs are calibrated.
 */
export function exactMemberAttribution(input: unknown) {
  const x = schema.parse(input), groups = [...x.groups].sort();
  if (new Set(groups).size !== groups.length || new Set(x.memberIds).size !== x.memberIds.length)
    throw new Error("Unique driver groups and member IDs required");
  const order = x.memberIds.map((id, index) => ({ id, index })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const values = new Map<number, number[]>();
  for (const c of x.coalitions) {
    if (new Set(c.groups).size !== c.groups.length || c.groups.some(g => !groups.includes(g)) ||
        c.values.length !== x.memberIds.length) throw new Error("Invalid coalition groups or member dimensions");
    const mask = c.groups.reduce((bits, g) => bits | (1 << groups.indexOf(g)), 0);
    if (values.has(mask)) throw new Error("Duplicate coalition");
    values.set(mask, order.map(m => c.values[m.index]));
  }
  if (values.size !== 2 ** groups.length) throw new Error("Every coalition, including baseline, is required");
  const factorial = (n: number): number => n <= 1 ? 1 : n * factorial(n - 1);
  const contributions = groups.map((group, index) => {
    const result = order.map(() => 0);
    for (let mask = 0; mask < 2 ** groups.length; mask++) {
      if (mask & (1 << index)) continue;
      const size = mask.toString(2).replace(/0/g, "").length;
      const weight = factorial(size) * factorial(groups.length - size - 1) / factorial(groups.length);
      const a = values.get(mask)!, b = values.get(mask | (1 << index))!;
      result.forEach((_, m) => { result[m] += weight * (b[m] - a[m]); });
    }
    return { group, values: result };
  });
  const baseline = values.get(0)!, target = values.get(2 ** groups.length - 1)!;
  const change = baseline.map((v, m) => target[m] - v);
  const residual = change.map((v, m) => v - contributions.reduce((s, c) => s + c.values[m], 0));
  const maxResidual = Math.max(...residual.map(Math.abs));
  if (!Number.isFinite(maxResidual) || maxResidual > .001) throw new Error("Attribution reconciliation exceeds 0.001 native units");
  const canonical = { manifestId: x.manifestId, baselineId: x.baselineId, targetId: x.targetId,
    unit: x.unit, memberIds: order.map(m => m.id), groups,
    coalitions: Array.from(values.entries()).sort(([a], [b]) => a - b).map(([mask, v]) => ({ mask, values: v })) };
  return { inputHash: contentHash(canonical), manifestId: x.manifestId, baselineId: x.baselineId,
    targetId: x.targetId, unit: x.unit, memberIds: canonical.memberIds, contributions, change,
    maxResidual, approximationError: 0, method: "exact-Shapley",
    evidenceState: "Bounded/conditional estimate",
    claim: "contribution within the model and chosen baseline; not causal attribution" };
}

import { createHash } from "node:crypto";
import { z } from "zod";
const protocolSchema = z.object({
  frozenAt: z.string().date(), trainingEnd: z.string().date(), holdoutStart: z.string().date(),
  baseline: z.enum(["persistence", "trend"]),
  maxDeteriorationFraction: z.number().min(0).max(.1),
  nominalCoverage: z.number().gt(0).lt(1), coverageTolerance: z.number().min(0).max(.2),
});
const rowSchema = z.object({
  origin: z.string().date(), inputsAvailableThrough: z.string().date(), targetYear: z.number().int(),
  actual: z.number().finite(), candidate: z.number().finite(),
  persistence: z.number().finite(), trend: z.number().finite(),
  lower: z.number().finite(), upper: z.number().finite(), revisedHistory: z.boolean(),
});
export function evaluateHoldout(protocolInput: unknown, rowInput: unknown) {
  const protocol = protocolSchema.parse(protocolInput);
  const rows = z.array(rowSchema).min(5).max(10000).parse(rowInput);
  if (protocol.frozenAt > protocol.holdoutStart || protocol.trainingEnd >= protocol.holdoutStart)
    throw new Error("Protocol must be frozen and training must end before holdout");
  for (const row of rows) {
    if (row.origin < protocol.holdoutStart || row.inputsAvailableThrough > row.origin ||
        row.targetYear <= Number(row.origin.slice(0, 4)) || row.lower > row.upper) throw new Error("Invalid holdout availability, horizon or bounds");
  }
  const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
  const errors = rows.map(r => r.candidate - r.actual);
  const mae = mean(errors.map(Math.abs));
  const baselineMAE = mean(rows.map(r => Math.abs(r[protocol.baseline] - r.actual)));
  const coverage = mean(rows.map(r => Number(r.actual >= r.lower && r.actual <= r.upper)));
  const pointInTime = rows.every(r => !r.revisedHistory);
  return { protocolId: createHash("sha256").update(JSON.stringify(protocol)).digest("hex"),
    count: rows.length, bias: mean(errors), mae, baselineMAE, coverage, pointInTime,
    passed: pointInTime && mae <= baselineMAE * (1 + protocol.maxDeteriorationFraction) &&
      Math.abs(coverage - protocol.nominalCoverage) <= protocol.coverageTolerance,
    limitation: "Numerical evaluation of supplied evidence. Publication dates, protocol precommitment and source independence require verification." };
}
export const PROMOTION_REQUIREMENTS = ["native-pathways", "independent-fair-reference", "historical-forcing",
  "human-induced-validation", "holdout", "consumer-consistency", "production-runtime"] as const;
export function promotionDecision(evidence: Record<string, boolean>) {
  const unmet = PROMOTION_REQUIREMENTS.filter(id => evidence[id] !== true);
  return { canPromote: unmet.length === 0, unmet };
}

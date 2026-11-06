import { createHash } from "node:crypto";
import { z } from "zod";
import { ensembleSchema } from "./ensemble";

/** A diagnostic comparison with supplied published ranges, not an attribution model. */
export function historicalValidation(input: unknown) {
  const p = z.object({
    ensemble: ensembleSchema,
    simulationKind: z.enum(["total", "anthropogenic"]),
    reference: z.object({
      source: z.string().url().startsWith("https://"),
      kind: z.enum(["total", "anthropogenic"]),
      baseline: z.literal("1850-1900"),
      startYear: z.number().int(), endYear: z.number().int(),
      lower: z.number().finite(), upper: z.number().finite(),
    }),
  }).parse(input);
  const r = p.reference;
  if (r.endYear < r.startYear || r.endYear - r.startYear >= 400 || r.lower >= r.upper || r.kind !== p.simulationKind)
    throw new Error("Invalid reference range or total/anthropogenic mismatch");
  const indexes = Array.from({ length: r.endYear - r.startYear + 1 }, (_, i) => p.ensemble.years.indexOf(r.startYear + i));
  if (indexes.some(i => i < 0)) throw new Error("Full reference window is required");
  const memberMeans = p.ensemble.memberIds.map((_, member) =>
    indexes.reduce((sum, year) => sum + p.ensemble.temperature[year][member], 0) / indexes.length).sort((a, b) => a - b);
  const mid = Math.floor(memberMeans.length / 2);
  const median = memberMeans.length % 2 ? memberMeans[mid] : (memberMeans[mid - 1] + memberMeans[mid]) / 2;
  return {
    median, fractionWithinReferenceRange: memberMeans.filter(v => v >= r.lower && v <= r.upper).length / memberMeans.length,
    medianWithinReferenceRange: median >= r.lower && median <= r.upper,
    reference: r, simulationKind: p.simulationKind,
    evidenceHash: createHash("sha256").update(JSON.stringify(p)).digest("hex"),
    status: "range-diagnostic-not-independent-validation",
    limitations: ["A range comparison is not an independent implementation check.",
      "Total warming cannot certify anthropogenic attribution; supplied source provenance must be reviewed."],
  };
}

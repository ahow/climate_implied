import { z } from "zod";
import { THRESHOLD_DIAGNOSTIC_LABEL, THRESHOLD_DIAGNOSTIC_VERSION } from "./thresholdDiagnostic";

const n = z.number().finite();
export const thresholdBasisSchema = z.object({
  selectionId: z.string().min(1), trajectoryId: z.string().min(1),
  memberId: z.string().min(1), gasBasis: z.string().min(1), unit: z.string().min(1),
}).strict();
export const thresholdDiagnosticSchema = z.object({
  version: z.literal(THRESHOLD_DIAGNOSTIC_VERSION),
  label: z.literal(THRESHOLD_DIAGNOSTIC_LABEL),
  year: n.int().nullable(),
  status: z.enum(["reached", "right-censored", "withheld"]),
  reason: z.string().min(1).nullable(),
  baselineYear: z.literal(2024),
  baselineValue: n.positive().nullable(),
  baselineEvidenceId: z.string().min(1).nullable(),
  thresholdFraction: z.literal(0.05),
  thresholdValue: n.positive().nullable(),
  horizonYear: n.int(),
  basis: thresholdBasisSchema.nullable(),
  crossingRule: z.literal("first annual value <= 0.05 * selected 2024 baseline; no interpolation or extrapolation"),
  notNetZero: z.literal(true),
}).strict().superRefine((d, ctx) => {
  const withheld = d.status === "withheld";
  if (withheld ? d.year !== null || d.baselineValue !== null || d.thresholdValue !== null ||
      d.baselineEvidenceId !== null || d.reason === null :
      d.baselineValue === null || d.thresholdValue !== 0.05 * d.baselineValue ||
      d.baselineEvidenceId === null || d.basis === null || d.reason !== null ||
      (d.status === "reached" ? d.year === null || d.year < 2024 || d.year > d.horizonYear : d.year !== null))
    ctx.addIssue({ code: "custom", message: "Inconsistent threshold diagnostic status, evidence, threshold or censoring" });
});

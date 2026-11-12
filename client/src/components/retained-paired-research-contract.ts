import { z } from "zod";

/**
 * Public-only presentation contract. The retained-report adapter must construct
 * this projection from the actual paired pipeline, not from legacy backtests.
 * No private corpus payload, arbitrary path, approval or publishing input exists.
 */
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const text = z.string().min(1);
const timestamp = z.string().datetime();
export const retainedPairedPinSchema = z.object({
  protocolHash: hash,
  reportHash: hash,
  disclosureHash: hash,
  pipelineResultHash: hash,
  corpusHash: hash,
  originDomainHash: hash,
  sourceContextHash: hash,
  codeContextHash: hash,
}).strict();
export type RetainedPairedPin = z.infer<typeof retainedPairedPinSchema>;

export const retainedPairedCatalogSchema = z.object({
  contract: z.literal("retained-paired-research-catalog-1"),
  reports: z.array(retainedPairedPinSchema),
  operatorPrerequisite: text,
  scientificAcceptance: z.literal(false),
  investmentEvidence: z.literal(false),
}).strict();
export type RetainedPairedCatalog = z.infer<typeof retainedPairedCatalogSchema>;

const metricSchema = z.object({
  label: text,
  value: z.number().finite(),
  unit: text,
  qualification: text,
}).strict();
export const retainedPairedSectionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("available"),
    label: text,
    metrics: z.array(metricSchema),
    notes: z.array(text).min(1),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    reason: text,
  }).strict(),
]);
export type RetainedPairedSection = z.infer<typeof retainedPairedSectionSchema>;

export const retainedPairedReportSchema = z.object({
  contract: z.literal("retained-paired-research-report-1"),
  producer: z.literal("paired-research-pipeline"),
  classification: z.enum(["retained-research", "engineering-fixture"]),
  protocolHash: hash,
  pipelineResultHash: hash,
  corpusHash: hash,
  disclosure: z.literal("locked retrospective evaluation (prior exposure: 2020 onward)"),
  protocol: z.object({
    evidenceMode: z.literal("revised-history"),
    frozenAt: timestamp,
    evaluationStart: timestamp,
    evaluationEnd: timestamp,
    expectedOrigins: z.array(timestamp).min(1),
    primaryEndpoints: z.tuple([
      z.literal("evaluation-r2"), z.literal("signal-ic"), z.literal("after-cost-long-short"),
    ]),
    embargoDays: z.number().int().nonnegative(),
    blockLength: z.number().int().positive(),
    repetitions: z.number().int().min(200),
    seed: z.number().int(),
    currency: text,
    geography: text,
    weighting: z.literal("equal-within-sector"),
    costBps: z.literal(25),
  }).strict(),
  originDomain: z.array(z.object({
    specification: text,
    origin: timestamp,
    informationCutoff: timestamp.nullable(),
    executionAt: timestamp.nullable(),
    endAt: timestamp.nullable(),
    missingReasons: z.array(text),
  }).strict()),
  sourceContext: z.object({
    qualification: text,
    sources: z.array(z.object({
      hash,
      availableAt: timestamp,
      capturedAt: timestamp,
      vintage: z.enum(["original", "revised", "engineering-fixture"]),
    }).strict()),
    missingReasons: z.array(text),
  }).strict(),
  codeContext: z.object({
    qualification: text,
    entries: z.array(z.object({ module: text, hash }).strict()),
    missingReasons: z.array(text),
  }).strict(),
  tracks: z.object({
    A: retainedPairedSectionSchema,
    B: retainedPairedSectionSchema,
    prospective: retainedPairedSectionSchema,
  }).strict(),
  specifications: z.array(z.object({
    model: text,
    peer: text,
    target: z.enum(["next-month", "12-month"]),
    originCount: z.number().int().nonnegative(),
    trainingDates: z.number().int().nonnegative(),
    evaluationDates: z.number().int().nonnegative(),
    missing: z.array(text),
    endpoints: z.object({
      "evaluation-r2": retainedPairedSectionSchema,
      "signal-ic": retainedPairedSectionSchema,
      "after-cost-long-short": retainedPairedSectionSchema,
    }).strict(),
    longOnly: retainedPairedSectionSchema,
    longShort: retainedPairedSectionSchema,
    factorAdjusted: retainedPairedSectionSchema,
    robustness: retainedPairedSectionSchema,
  }).strict()).min(1),
  limitations: z.array(text).min(1),
  efficacy: z.literal("WITHHELD"),
  scientificAcceptance: z.literal(false),
  investmentEvidence: z.literal(false),
  authenticityVerified: z.literal(false),
}).strict();
export type RetainedPairedReport = z.infer<typeof retainedPairedReportSchema>;

export function retainedPairedPinKey(pin: RetainedPairedPin) {
  return Object.values(retainedPairedPinSchema.parse(pin)).join(":");
}

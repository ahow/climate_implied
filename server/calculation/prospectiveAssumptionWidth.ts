import { z } from "zod";
import { contentHash } from "./analysisManifest";

const text = z.string().trim().min(1);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const finite = z.number().finite();
const segmentSchema = z.object({
  segmentId: text, measure: text, unit: text, horizon: text,
  // Absolute full envelope, not a dispersion statistic over a selected subset.
  metric: z.literal("maximum-minus-minimum-across-all-declared-assumption-sets"),
  assumptions: z.array(z.object({
    id: text, commodityPriceDeck: text, margins: text, discountRate: text,
    capitalAllocation: text, otherAssumptions: z.array(text),
    defensibilityReferences: z.array(text).min(1),
  }).strict()).min(1).max(1000),
  // Intentionally no numeric defaults: no original width threshold was supplied.
  thresholds: z.object({ looser: finite.nonnegative(), tighter: finite.nonnegative() }).strict(),
}).strict().superRefine((x, ctx) => {
  if (new Set(x.assumptions.map(a => a.id)).size !== x.assumptions.length)
    ctx.addIssue({ code: "custom", message: "Duplicate assumption-set identity" });
  if (x.thresholds.tighter > x.thresholds.looser)
    ctx.addIssue({ code: "custom", message: "Tighter width must not exceed looser width" });
});
export const prospectiveWidthSchema = z.object({
  version: z.literal("prospective-assumption-width-1"), studyId: text,
  thresholdProvenance: z.literal("new-unscored-prospective-assumptions-not-original-thresholds"),
  ownerConfirmationReference: text.nullable(),
  segments: z.array(segmentSchema).min(1).max(100),
}).strict().superRefine((x, ctx) => {
  if (new Set(x.segments.map(s => s.segmentId)).size !== x.segments.length)
    ctx.addIssue({ code: "custom", message: "Duplicate segment identity" });
});

export function registerProspectiveWidth(input: unknown) {
  const specification = prospectiveWidthSchema.parse(input);
  return { specification, registerHash: contentHash(specification), status: "unscored-prospective-specification" as const,
    originalThresholds: "unknown; not reconstructed or backdated",
    ownerConfirmation: specification.ownerConfirmationReference === null
      ? "missing" : "submitted-reference-not-authenticated",
    sourceEvidenceVerified: false, marketExpectationClaim: false, productionEligible: false };
}

const resultsSchema = z.object({
  registerHash: hash,
  segments: z.array(z.object({
    segmentId: text, measure: text, unit: text, horizon: text,
    results: z.array(z.object({ assumptionId: text, value: finite.nullable(), unavailableReason: text.nullable() })
      .strict().refine(x => x.value !== null || x.unavailableReason !== null,
        "Unavailable assumption result requires a reason")).max(1000),
  }).strict()).max(100),
}).strict();

/** Pure engineering evaluator. No corpus access, threshold selection, owner
 * approval or identification promotion. Complete domains must match exactly.
 */
export function evaluateProspectiveWidth(specification: unknown, input: unknown) {
  const register = registerProspectiveWidth(specification), x = resultsSchema.parse(input);
  if (x.registerHash !== register.registerHash) throw new Error("Prospective width register hash mismatch");
  const declared = register.specification.segments;
  if (new Set(x.segments.map(s => s.segmentId)).size !== x.segments.length ||
      x.segments.length !== declared.length || x.segments.some(s => !declared.some(d => d.segmentId === s.segmentId)))
    throw new Error("Exact declared segment domain required; no subset scoring");
  const segments = declared.map(s => {
    const row = x.segments.find(r => r.segmentId === s.segmentId)!;
    if (row.measure !== s.measure || row.unit !== s.unit || row.horizon !== s.horizon)
      throw new Error("Width result measure, unit or horizon differs from specification");
    if (new Set(row.results.map(r => r.assumptionId)).size !== row.results.length ||
        row.results.some(r => !s.assumptions.some(a => a.id === r.assumptionId)))
      throw new Error("Duplicate or undeclared assumption result");
    const missingAssumptions = s.assumptions.filter(a => !row.results.some(r => r.assumptionId === a.id)).map(a => a.id);
    const unavailableAssumptions = row.results.filter(r => r.value === null);
    if (missingAssumptions.length || unavailableAssumptions.length)
      return { segmentId: s.segmentId, status: "unavailable" as const, missingAssumptions,
        unavailableAssumptions, width: null, looser: null, tighter: null,
        reason: "Complete defensible-assumption envelope is unavailable; no partial range substituted" };
    const values = row.results.map(r => r.value!);
    const minimum = Math.min(...values), maximum = Math.max(...values), width = maximum - minimum;
    if (!Number.isFinite(width)) throw new Error("Nonfinite assumption range width");
    return { segmentId: s.segmentId, status: "submitted-input-width-diagnostic" as const,
      measure: s.measure, unit: s.unit, horizon: s.horizon, minimum, maximum, width,
      thresholds: s.thresholds, looser: width < s.thresholds.looser, tighter: width < s.thresholds.tighter,
      comparison: "strictly narrower; equality does not pass" };
  });
  return { registerHash: register.registerHash, segments, marketExpectationClaim: false,
    identification: "not-established", productionEligible: false, oldCorpusScored: false,
    limitations: ["Width is one conjunct, not identification. Controls, price decks and policy-event evidence remain separate.",
      "Neither numeric diagnostic passes nor a supplied owner reference authenticate pre-result confirmation.",
      "All declared sets are included; their defensibility and completeness still require independent review.",
      "Original thresholds and historical precommitment remain unknown; no frozen study is changed."] };
}

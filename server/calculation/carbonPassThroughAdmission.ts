import { z } from "zod";
import { contentHash } from "./analysisManifest";
import {
  carbonPassThroughEvidenceSchema, carbonPassThroughSourceSchema,
  carbonPassThroughEvidence, carbonPassThroughSources, carbonPassThroughRemainingInputs,
  carbonPassThroughOriginalIndustrialInputs,
} from "../../shared/carbonPassThroughEvidence";

const nonempty = z.string().trim().min(1);
const references = z.array(nonempty).min(1);

/** Pure admission: no database mutation, remote retrieval, approval or engine change. */
export function admitCarbonPassThroughRegister(sources: unknown, evidence: unknown) {
  const s = z.array(carbonPassThroughSourceSchema).min(1).parse(sources);
  const e = z.array(carbonPassThroughEvidenceSchema).min(1).parse(evidence);
  if (new Set(s.map(r => r.id)).size !== s.length || new Set(e.map(r => r.id)).size !== e.length)
    throw new Error("Duplicate carbon pass-through source/evidence identity");
  const bySource = new Map(s.map(r => [r.id, r]));
  for (const r of e) {
    if (!bySource.has(r.sourceId)) throw new Error(`Unregistered original source: ${r.sourceId}`);
  }
  const payload = { contract: "s12-007-source-evidence-1", sources: [...s].sort((a, b) => a.id.localeCompare(b.id)),
    evidence: [...e].sort((a, b) => a.id.localeCompare(b.id)) };
  return { ...payload, registerHash: contentHash(payload), status: "source-qualified-context-not-issuer-validation" as const };
}

export const qualifiedCarbonDragAssumptionSchema = z.object({
  version: z.literal("s12-007-qualified-drag-assumption-1"), evidenceId: nonempty,
  sector: nonempty, product: nonempty, jurisdiction: nonempty, regime: nonempty,
  projectionYear: z.number().int().min(1900).max(2100), recoveryFraction: z.number().finite().min(0).max(1),
  channel: z.literal("direct-scope1-same-cost-recovery"),
  temporalTransferRationale: nonempty, // Required even when within the sample: no blind contemporaneous causal claim.
  denominatorReconciliationEvidence: references,
  issuerOperatingExposureEvidence: references,
  incrementalLiabilityEvidence: references,
  collectionAndTaxTreatmentEvidence: references,
  baselineExcludesCarbonCostAndRecoveryEvidence: references,
  classification: z.literal("analyst-assumption-not-source-observation"),
}).strict();
export type QualifiedCarbonDragAssumption = z.infer<typeof qualifiedCarbonDragAssumptionSchema>;
export const qualifiedProjectionPassThroughSchema = z.object({
  companyId: nonempty,
  treatment: z.literal("replace-legacy-drag-with-qualified-incremental-scope1-component"),
  priceBasis: z.literal("increment-above-cost-already-in-baseline"),
  accountingBasis: z.literal("pre-tax-accrual-not-common-cash"),
  cashBridge: z.object({
    classification: z.literal("analyst-declared-not-observed-cash"),
    workingCapitalCollectionTimingEvidence: references,
    cashTaxRealizationEvidence: references,
    noDuplicateRevenueMarginRecoveryEvidence: references,
  }).strict(),
  assumption: qualifiedCarbonDragAssumptionSchema,
}).strict();
const dragInputSchema = z.object({
  scope: z.literal("scope1"), year: z.number().int(), currency: z.string().regex(/^[A-Z]{3}$/),
  incrementalLiableTonnesNetAllocation: z.number().finite().nonnegative(),
  incrementalEffectivePricePerTonne: z.number().finite().nonnegative(),
  priceBasis: z.literal("increment-above-cost-already-in-baseline"),
  accountingBasis: z.literal("pre-tax-accrual-not-common-cash"),
}).strict();

/**
 * Opt-in component for a NEW separately frozen ledger only. Existing projection
 * calls it solely through the explicit qualifiedPassThrough request. Price recovery becomes an assumption only after
 * matching the same product/direct-cost denominator; neither source nor caller
 * can turn a market-price regression into observed common-owner cash.
 */
export function calculateQualifiedCarbonDrag(assumption: unknown, input: unknown) {
  const a = qualifiedCarbonDragAssumptionSchema.parse(assumption), x = dragInputSchema.parse(input);
  const register = admitCarbonPassThroughRegister(carbonPassThroughSources, carbonPassThroughEvidence);
  const row = register.evidence.find(r => r.id === a.evidenceId);
  if (!row) throw new Error("Unknown pass-through evidence identity");
  if (row.metric !== "cost-pass-through-ratio")
    throw new Error("A log-price elasticity is not a recovery fraction");
  if (row.channel !== "direct-product-price-recovery")
    throw new Error("Wholesale electricity price formation is not issuer same-cost recovery");
  for (const key of ["sector", "product", "jurisdiction", "regime"] as const) {
    if (a[key] !== row[key]) throw new Error(`Pass-through evidence ${key} mismatch`);
  }
  if (x.year !== a.projectionYear) throw new Error("Assumption and carbon cost years differ");
  // Retain >100% results in the register, never clip them into this bounded model.
  if (row.reported.kind === "lower-bound-only") throw new Error("Unbounded source ratio cannot bind this0–1 recovery model");
  if (row.reported.kind === "point" && a.recoveryFraction !== row.reported.value)
    throw new Error("Source reports only an indicative point; no invented literature interval");
  if (row.reported.kind === "point-with-bootstrap-span" &&
      (a.recoveryFraction < row.reported.interval.lower || a.recoveryFraction > row.reported.interval.upper))
    throw new Error("Assumption lies outside reported sensitivity span");
  const grossIncrementalCost = x.incrementalLiableTonnesNetAllocation * x.incrementalEffectivePricePerTonne;
  const assumedSameCostRecovery = grossIncrementalCost * a.recoveryFraction;
  const carbonDrag = grossIncrementalCost - assumedSameCostRecovery;
  if (![grossIncrementalCost, assumedSameCostRecovery, carbonDrag].every(Number.isFinite))
    throw new Error("Nonfinite qualified carbon-drag component");
  return {
    status: "conditional-component-not-issuer-case" as const, productionEligible: false,
    definition: "Incremental pre-tax accrual carbon drag; not profit validation or collected common FCFE",
    registerHash: register.registerHash, evidence: row, assumption: a,
    assumptionHash: contentHash(a), inputHash: contentHash(x), currency: x.currency, year: x.year,
    grossIncrementalCost, assumedSameCostRecovery, carbonDrag,
    limitations: [
      "Source-referenced analyst transfer, not measured issuer pass-through or causally identified universal range.",
      "No Scope2/Scope3 charge, free-allocation windfall, tax refund, demand response or cash collection inferred.",
      "Baseline must exclude these incremental legs; parent ledger must reconcile margins, collection timing, tax and working capital before FCFE use.",
    ],
  };
}

/** One public-safe representation for read-only UI/API/JSON export; no raw source files. */
export function getCarbonPassThroughReview() {
  return {
    ...admitCarbonPassThroughRegister(carbonPassThroughSources, carbonPassThroughEvidence),
    qualifiedIssuerCases: 0, issuerStudiesRun: 0, oldCasesRetuned: false,
    productionEligible: false,
    classification: "Historical product-price evidence; no actual issuer assumption admitted",
    protocol: "docs/carbon-pass-through-protocol.json",
    protocolSha256: "5084a8314270a1d8b365f4c17e99832b1947414a3689ddd2f4f5744170a3779e",
    consumerIntegration: {
      contract: "optional-projectCompanyMembers-year-qualifiedPassThrough",
      protocol: "docs/carbon-pass-through-consumer-protocol.json",
      protocolSha256: "3bf5d6f374c1b4454d64756e92aea8d43f4386f3df5430fe7732b85bf00c1ce3",
      legacy: "Absent opt-in, raw passThrough remains unqualified conditional input with unchanged calculation/output/hash.",
      sourceQualifiedPath: "Declared direct incremental Scope1 accrual component feeds same carbonDrag/preTaxIncome/tax/FCFE consumer; not observed company cash.",
      actualCompanyCashGap: "Neither wholesale price-formation estimates nor indicative refinery price ratios identify issuer-owned eligible tonnes/product sales, net allowance cash cost, recoverable revenue, collection lag, demand response, tax realization or common-owner cash. Explicit bridge references remain unvalidated analyst declarations, not empirical source support.",
    },
    remainingThreeCaseInputs: carbonPassThroughRemainingInputs,
    originalOperatingCorpusIndustrialInputs: carbonPassThroughOriginalIndustrialInputs,
    nextGate: "Separately freeze issuer-specific denominator, operating exposure, period/regime transfer and incremental ledger before any numerical study; owner approval does not supply missing economics.",
  };
}

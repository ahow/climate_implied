import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { equityProjection } from "./reverseValuation";

const text = z.string().trim().min(1);
const finite = z.number().finite();
const range = z.object({ minimum: finite, maximum: finite }).strict()
  .refine(x => x.minimum <= x.maximum, "Range endpoints must be ordered");

/** Exact five children of S11-001, with the OCF correction in amendment 7.
 * This additive contract does not rewrite any frozen study or supply rates.
 */
export const prospectiveValuationChoiceSchema = z.object({
  version: z.literal("prospective-valuation-choices-1"),
  studyId: text,
  cashFlowBasis: z.object({
    primary: z.literal("FCFE"), primaryDiscount: z.literal("cost-of-equity"),
    crossCheck: z.enum(["FCFF-at-WACC-where-debt-reliable", "unavailable"]),
    debtReliabilityRule: text,
  }).strict(),
  cashFlows: z.object({
    operatingCashFlowFormula: z.literal("OCF-capex+netBorrowing"),
    earningsFormula: z.literal("netIncome+nonCashCharges-capex-increaseWorkingCapital+netBorrowing"),
    interestClassification: text, reinvestmentReturnOnCapitalRule: text,
  }).strict(),
  discountRate: z.object({
    betaMonths: z.literal(60), shrinkageTarget: z.literal(1),
    shrinkageWeight: finite.min(0).max(1),
    benchmarkDefinition: text, riskFreeRange: range, equityRiskPremiumRange: range,
    observedDebtCostRule: text, commonRateVariant: z.literal(.08),
    rateBasis: z.literal("nominal"),
  }).strict(),
  financials: z.object({
    method: z.literal("not-modelled"), reason: text,
  }).strict(),
  lossMakers: z.object({
    method: z.literal("history-or-close-peer-supported-normalised-margin-else-no-defensible-solution"),
    historyOrPeerEligibilityRule: text, marginIdentificationRule: text,
  }).strict(),
}).strict();

export function registerProspectiveValuationChoices(input: unknown) {
  const choices = prospectiveValuationChoiceSchema.parse(input);
  return {
    choices, registerHash: contentHash(choices), status: "unscored-prospective-specification" as const,
    originalPreBuildTiming: "unknown; this new register is not historical timing evidence",
    sourceEvidenceVerified: false, modelSelectionRun: false, productionEligible: false,
    remaining: [
      "Retain this exact hash before any new build/fit/results and independently authenticate that sequence.",
      "Supply and review source-qualified rates, benchmark, accounting classifications, debt and margin evidence.",
      "Original full seven-criterion comparison and owner confirmation remain separate; no old study is rescored.",
    ],
  };
}

const assessmentSchema = z.object({
  registerHash: z.string().regex(/^[a-f0-9]{64}$/),
  businessType: z.enum(["non-financial", "bank", "insurer"]),
  revenue: finite.nonnegative().nullable(), netIncome: finite.nullable(),
  normalisedMargin: finite.nullable(),
  marginEvidence: z.object({
    basis: z.enum(["company-history", "close-peers"]), sourceReferences: z.array(text).min(1),
    identificationExplanation: text,
  }).strict().nullable(),
  discountRate: finite.positive().max(1), terminalGrowth: finite.min(.025).max(.04),
  returnOnEquity: finite.positive().max(2), stageOneGrowth: finite.gt(-1),
  returnOnEquityEvidence: text, discountRateEvidence: text,
}).strict();

/** Missing S11-001 branches are evaluated only as submitted-input diagnostics.
 * Financials legitimately remain not modelled. Supported loss-maker earnings
 * feed the existing internally funded ROE model, never a free-growth CF model.
 */
export function assessProspectiveValuationBranch(choicesInput: unknown, input: unknown) {
  const register = registerProspectiveValuationChoices(choicesInput);
  const x = assessmentSchema.parse(input);
  if (x.registerHash !== register.registerHash) throw new Error("Prospective valuation register hash mismatch");
  const metadata = {
    registerHash: register.registerHash, scientificAcceptance: false, productionEligible: false,
    identityApproved: false, investmentEvidence: false, modelSelectionRun: false,
    basis: "separate earnings/ROE sensitivity; not the FCFE primary or D8 comparison",
    evidenceBoundary: "Submitted references are not independently authenticated; no historic specification claim",
  };
  if (x.businessType !== "non-financial") return { ...metadata, status: "not-modelled" as const,
    reason: register.choices.financials.reason };
  const unavailable = (reason: string) => ({ ...metadata, status: "no-defensible-solution" as const, reason });
  if (x.netIncome === null) return unavailable("Net income missing; loss-maker status cannot be inferred");
  const lossMaker = x.netIncome <= 0;
  if (lossMaker && (x.revenue === null || x.revenue <= 0 || x.normalisedMargin === null ||
      x.normalisedMargin <= 0 || x.normalisedMargin > 1 || x.marginEvidence === null))
    return unavailable("Loss-maker requires positive revenue and an identifiable positive history/close-peer margin with evidence");
  const baseEarnings = lossMaker ? x.revenue! * x.normalisedMargin! : x.netIncome;
  if (!Number.isFinite(baseEarnings)) return unavailable("Normalised earnings are nonfinite");
  if (x.terminalGrowth >= x.discountRate ||
      Math.max(x.terminalGrowth, x.stageOneGrowth) > x.returnOnEquity)
    return unavailable("Terminal rate must be below discount rate and all growth fundable by supported ROE");
  const projection = equityProjection({ ...x, baseEarnings, sharesBasis: "total-equity" });
  return { ...metadata, status: "conditional-assessment" as const, baseEarnings,
    earningsBasis: lossMaker ? "revenue-times-supported-normalised-margin" : "positive-reported-earnings",
    marginEvidence: lossMaker ? x.marginEvidence : null, projection };
}

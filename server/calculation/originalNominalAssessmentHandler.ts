import type { RequestHandler } from "express";
import { z } from "zod";
import { originalNominalEquityAssessment } from "./reverseValuation";
import { bindNestedOutput, requireOutputSemantic } from "../../shared/outputFieldSemantics";
import { originalNominalAssessmentInputKeys } from "../../shared/originalNominalAssessmentSemantics";

const scalarNumber = z.string().trim().min(1).max(64)
  .refine(value => Number.isFinite(Number(value)), "Expected a finite numeric scalar")
  .transform(Number);
const querySchema = z.object({
  baseEarnings: scalarNumber,
  discountRate: scalarNumber,
  returnOnEquity: scalarNumber,
  stageOneGrowth: scalarNumber,
  sharesBasis: z.literal("total-equity"),
  rateBasis: z.literal("nominal"),
  returnOnEquityEvidence: z.string().trim().min(1).max(1200),
  discountRateEvidence: z.string().trim().min(1).max(1200),
  acknowledgeConditionalModel: z.literal("true"),
}).strict();

/**
 * Parent registers the GET route. Pure, read-only, explicit assumptions only:
 * no datasets, collectors, approvals, D8 studies, database access or writes.
 */
export const originalNominalAssessmentHandler: RequestHandler = (req, res) => {
  res.set("Cache-Control", "no-store");
  const send = (status: number, body: object) => {
    const inputIds = originalNominalAssessmentInputKeys.filter(key => req.query[key] !== undefined)
      .map(key => requireOutputSemantic(`originalNominalAssessment.input.${key}`).id);
    const ids = [
      ...inputIds,
      ...bindNestedOutput("originalNominalAssessment", body).map(field => field.id),
      requireOutputSemantic("originalNominalAssessment.http.status").id,
      requireOutputSemantic("originalNominalAssessment.http.cacheControl").id,
      ...(status === 405 ? [requireOutputSemantic("originalNominalAssessment.http.allow").id] : []),
    ];
    res.set("X-Field-Semantics", Array.from(new Set(ids)).sort().join(","));
    res.status(status).json(body);
  };
  if (req.method !== "GET") {
    res.set("Allow", "GET");
    send(405, { status: "refused", reason: "Read-only GET endpoint; no mutations are supported" });
    return;
  }
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    send(400, {
      status: "refused",
      reason: "Supply explicit nominal model assumptions, evidence references and acknowledgeConditionalModel=true; no inferred/default issuer assumptions",
      issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }
  try {
    const result = originalNominalEquityAssessment(parsed.data);
    send(result.status === "refused" ? 422 : 200, result);
  } catch (error) {
    send(422, {
      status: "refused",
      reason: error instanceof Error ? error.message : "Invalid original nominal valuation assumptions",
      investmentEvidence: false, identityApproved: false, productionEligible: false,
    });
  }
};

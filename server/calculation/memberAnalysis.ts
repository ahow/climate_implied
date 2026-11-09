import { summarizeMemberMetrics } from "./memberMetrics";
import { checkMemberConvergence } from "./memberConvergence";
import { z } from "zod";

const contract = z.object({
  manifestId: z.string().min(1),
  emissionsToleranceGtCO2e: z.number().finite().positive(),
  ensemble: z.unknown(),
}).strict();

/** One validated member population supplies both metrics and convergence.
 * Missing climate responses are never replaced with fabricated temperatures.
 */
export function analyzeMemberEnsemble(input: unknown) {
  const x = contract.parse(input);
  const metrics = summarizeMemberMetrics(x.ensemble);
  // summarizeMemberMetrics has already validated all matrix shapes/values.
  const ensemble = x.ensemble as {
    memberIds: string[]; temperature: number[][]; ghgGtCO2e: number[][];
  };
  const index = new Map(ensemble.memberIds.map((id, i) => [id, i]));
  const members = metrics.members.map(member => {
    const i = index.get(member.id)!;
    return {
      id: member.id,
      temperature2100C: ensemble.temperature[76][i],
      emissions2050GtCO2e: ensemble.ghgGtCO2e[26][i],
      emissions2100GtCO2e: ensemble.ghgGtCO2e[76][i],
      durableGhgZero: member.durableGhgZero,
      durableCo2Zero: member.durableCo2Zero,
    };
  });
  const convergence = members.length === 10000
    ? { status: "evaluated" as const, result: checkMemberConvergence({
      manifestId: x.manifestId, emissionsToleranceGtCO2e: x.emissionsToleranceGtCO2e, members,
    }) }
    : { status: "unavailable" as const, reason: "Exactly 10,000 aligned members required; no resampling or padding",
      observedMembers: members.length };
  return { manifestId: x.manifestId, metrics, convergence,
    productionEligible: false, scientificValidation: false,
    claim: "Supplied-member analysis; numerical convergence does not establish empirical calibration" };
}

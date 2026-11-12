import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { scientificEvidenceStrandKeys } from "./scientificEvidence";

/** Exact fourteen leaves of scientificEvidenceStatuses(), reused under each
 * actual producer namespace. No wildcard, merged readiness or numeric promotion.
 */
export function scientificEvidenceSemantics(prefix: string): OutputFieldSemantic[] {
  const specs: [string, string, string, string][] = [
    ["version", "Version of the separate program-level scientific evidence policy", "scientificEvidenceStatuses().version", "version label"],
    ["scope", "Program-level scope explicitly excludes certification of submitted inputs", "scientificEvidenceStatuses().scope", "scope disclosure"],
    ...scientificEvidenceStrandKeys.flatMap(key => [
      [`${key}.status`, `Independent ${key} evidence status, not a numerical diagnostic pass`, `scientificEvidenceStatuses().${key}.status`, "status label"],
      [`${key}.label`, `Displayed name of the ${key} evidence strand`, `scientificEvidenceStatuses().${key}.label`, "label"],
      [`${key}.reason`, `Reason the ${key} strand is not independently accepted`, `scientificEvidenceStatuses().${key}.reason`, "evidence limitation"],
      [`${key}.evidence[]`, `Checked-in implementation references for ${key}; not acceptance receipts`, `scientificEvidenceStatuses().${key}.evidence`, "source path"],
    ] as [string, string, string, string][]),
  ];
  return specs.map(([field, meaning, formula, unit]) => ({
    id: `${prefix}.${field}`, meaning, formula, unit, role: "Output",
    dependencies: ["scientificEvidenceStatuses"], source: "shared/scientificEvidence.ts:scientificEvidenceStatuses",
    period: "Current checked-in program evidence policy, not a forecast or observation period",
    geography: "Program-level evidence; does not certify any submitted geographic coverage",
    status: "Three independent scientific evidence strands; no readiness gate or acceptance changed",
    missingness: "All fourteen policy leaves are required; missing/unknown fields refuse semantic binding",
    uncertainty: "Deterministic policy metadata; no sampling, confidence level or predictive distribution",
    scope: "Physical response, Stage9 skill and scenario interpretation remain separate; no inferred scientific approval",
    asOfRule: "Current checked-in policy only; no original-vintage or precommitment timestamp inferred",
  }));
}

/**
 * S07-003: independent evidence strands, not a replacement readiness gate.
 * Engineering diagnostics, accounting passes and replacement code cannot change
 * these scientific statuses. No caller-supplied booleans authorize acceptance.
 */
export function scientificEvidenceStatuses() {
  return {
    version: "scientific-evidence-strands-v1",
    scope: "dashboard-program-evidence; not certification of submitted inputs",
    physicalResponse: {
      status: "verification-incomplete",
      label: "Physical-response verification",
      reason: "Retained FaIR execution is not independent physical acceptance. Independent reference, historical forcing reconciliation and pulse evidence remain separate requirements.",
      evidence: ["server/calculation/readiness.ts", "server/calculation/historicalValidation.ts"],
    },
    stage9Skill: {
      status: "not-established",
      label: "Stage 9 emissions-model skill",
      reason: "Submitted holdout arithmetic does not establish publication-vintage eligibility, precommitment or independently accepted forecasting skill.",
      evidence: ["server/calculation/evaluation.ts", "server/calculation/vintageAudit.ts"],
    },
    scenarioInterpretation: {
      status: "conditional-only",
      label: "Scenario interpretation",
      reason: "Pathways represent their explicit assumptions; published references and illustrative candidates are not dashboard forecasts. Complete native commitments coverage remains unresolved.",
      evidence: ["server/calculation/nativePathwayContract.ts", "server/calculation/emissionsCandidate.ts"],
    },
  } as const;
}

export type ScientificEvidenceStatuses = ReturnType<typeof scientificEvidenceStatuses>;
export const scientificEvidenceStrandKeys = ["physicalResponse", "stage9Skill", "scenarioInterpretation"] as const;

/** Stable rows for the actual download Interpretation sheet; no merged status. */
export function scientificEvidenceExportNotes() {
  const evidence = scientificEvidenceStatuses();
  return scientificEvidenceStrandKeys.map(key => ({
    Field: `Scientific evidence: ${key}`,
    Value: `${evidence[key].status} — ${evidence[key].reason}`,
  }));
}

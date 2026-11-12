import register from "../docs/S16-013-warning-resolution-register.json";

/** Existing records are reported, never reclassified as accepted resolutions. */
export function interimWarningSummary() {
  return {
    version: "interim-warning-evidence-v1",
    originalSourceRevision: register.originalSourceRevision,
    originalHostCount: register.originalHosts.length,
    recordedRemovalBindings: register.removedWarnings.length,
    recordedResolutionIds: register.resolutions.map(resolution => resolution.id),
    acceptance: "existing-resolution-records-only; no-new-acceptance",
    policy: "Retain each warning until its specific underlying limitation has an evidenced accepted resolution; replacement calculations and passing guards are insufficient.",
    unresolved: register.resolutions.flatMap(resolution => resolution.notResolved),
    coverageLimit: register.residuals.join(" "),
    evidenceReport: "docs/scientific-strands-warning-evidence.json",
  } as const;
}

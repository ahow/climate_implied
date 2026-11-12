import { scientificEvidenceStatuses, scientificEvidenceStrandKeys } from "./scientificEvidence";

/** Finite current API domain. Headers leave legacy analytical wire values and
 * FaIR content hashes untouched; no catch-all engine or scientific promotion.
 */
export const scientificEvidenceApiConsumers = [
  ["GET", "/api/projection"], ["GET", "/api/projection/categories"],
  ["GET", "/api/projection/regions"], ["GET", "/api/projection/sensitivity"],
  ["GET", "/api/projection/historical-trend"], ["GET", "/api/projection/categories/historical-trend"],
  ["GET", "/api/indicators/historical"], ["GET", "/api/emissions/candidate"],
  ["GET", "/api/reference-scenarios"], ["GET", "/api/calculation/readiness"],
  ["GET", "/api/calculation-contract"], ["GET", "/api/calculation/fair-artifacts"],
  ["GET", "/api/calculation/fair-artifacts/:artifactId/manifest"],
  ["GET", "/api/calculation/fair-artifacts/:artifactId/ensemble"],
  ["GET", "/api/calculation/fair-artifacts/:artifactId/summary"],
  ["GET", "/api/calculation/fair-artifacts/:artifactId/members/:memberId"],
  ["POST", "/api/emissions/validate-native-pathways"],
  ["POST", "/api/emissions/regional-residual-diagnostics"],
  ["POST", "/api/calculation/ensemble-summary"], ["POST", "/api/calculation/evaluate-holdout"],
  ["POST", "/api/calculation/evaluate-signal"], ["POST", "/api/calculation/validate-history"],
  ["POST", "/api/calculation/audit-vintages"], ["POST", "/api/calculation/research-contracts"],
] as const;

export function scientificEvidenceApiConsumer(method: string, path: string) {
  return scientificEvidenceApiConsumers.some(([verb, pattern]) => verb === method &&
    new RegExp(`^${pattern.split("/").map(part => part.startsWith(":") ? "[^/]+" : part).join("/")}/?$`).test(path));
}

/** One shared source for headers and compact chart labels. Exactly three
 * independent statuses; never reduce them to a ready/accepted boolean.
 */
export function scientificEvidenceStatusRows() {
  const evidence = scientificEvidenceStatuses();
  return scientificEvidenceStrandKeys.map(key => ({ key, ...evidence[key] }));
}

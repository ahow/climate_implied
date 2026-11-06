import { z } from "zod";
const row = z.object({
  companyId: z.number().int().positive(), decisionDate: z.string().date(),
  publicationDate: z.string().date().nullable(), universeKnownAt: z.string().date().nullable(),
  returnEnd: z.string().date(), returnValue: z.number().finite().min(-1).nullable(),
  corporateActionsVerified: z.boolean(), delistingTreatmentVerified: z.boolean(),
});
/** Evidence completeness and chronology only; declarations are not source authentication. */
export function auditVintages(input: unknown) {
  const rows = z.array(row).min(1).max(100000).parse(input);
  const seen = new Set<string>();
  const counts = { missingPublication: 0, futurePublication: 0, missingUniverse: 0,
    futureUniverse: 0, missingReturns: 0, invalidHorizon: 0, corporateActionsUnverified: 0,
    delistingsUnverified: 0, duplicates: 0 };
  for (const r of rows) {
    if (!r.publicationDate) counts.missingPublication++;
    else if (r.publicationDate > r.decisionDate) counts.futurePublication++;
    if (!r.universeKnownAt) counts.missingUniverse++;
    else if (r.universeKnownAt > r.decisionDate) counts.futureUniverse++;
    if (r.returnValue === null) counts.missingReturns++;
    if (r.returnEnd <= r.decisionDate) counts.invalidHorizon++;
    if (!r.corporateActionsVerified) counts.corporateActionsUnverified++;
    if (!r.delistingTreatmentVerified) counts.delistingsUnverified++;
    const key = `${r.companyId}:${r.decisionDate}`;
    if (seen.has(key)) counts.duplicates++;
    seen.add(key);
  }
  const complete = Object.values(counts).every(n => n === 0);
  return { observations: rows.length, counts, evidenceComplete: complete,
    classification: complete ? "declared-evidence-complete-awaiting-source-review" : "revised-history-not-point-in-time",
    certified: false,
    limitation: "Chronology checks cannot authenticate supplied dates, survivor coverage or corporate-action declarations." };
}

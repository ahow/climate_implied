import {
  scientificEvidenceStatuses, scientificEvidenceStrandKeys,
  type ScientificEvidenceStatuses,
} from "@shared/scientificEvidence";

/** Program-level evidence, explicitly not an inference from displayed numbers. */
export function ScientificEvidenceStrands({ evidence = scientificEvidenceStatuses(), compact = false }: {
  evidence?: ScientificEvidenceStatuses;
  compact?: boolean;
}) {
  if (compact) return (
    <aside className="text-xs text-muted-foreground my-2" aria-label="Separate scientific evidence strands"
      data-testid="scientific-evidence-strands">
      <p>Program evidence only; this chart does not certify inputs or change readiness gates.</p>
      {scientificEvidenceStrandKeys.map(key => (
        <p key={key} data-evidence-strand={key} data-evidence-status={evidence[key].status}
          title={evidence[key].reason}>{evidence[key].label}: {evidence[key].status}</p>
      ))}
    </aside>
  );
  return (
    <section className="rounded-md border p-3 space-y-2" aria-label="Separate scientific evidence strands"
      data-testid="scientific-evidence-strands">
      <h3 className="text-sm font-semibold">Three separate evidence strands</h3>
      <p className="text-xs text-muted-foreground">Program-level evidence only. Passing a diagnostic does not establish scientific acceptance or change the existing readiness gates.</p>
      <dl className="space-y-3">
        {scientificEvidenceStrandKeys.map(key => (
          <div key={key} data-evidence-strand={key} data-evidence-status={evidence[key].status}>
            <dt className="text-sm font-medium">{evidence[key].label}: {evidence[key].status}</dt>
            <dd className="text-xs text-muted-foreground">{evidence[key].reason}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

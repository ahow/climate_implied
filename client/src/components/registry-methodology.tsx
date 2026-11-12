import React from "react";
import { methodologyRegistry } from "@shared/methodologyRegistry";
import { Card } from "@/components/ui/card";

/** Render registry values verbatim, rather than another hand-maintained formula
 * table. Large dictionaries stay collapsed; no legacy claims are promoted. */
export function RegistryMethodology() {
  const registry = methodologyRegistry();
  return <Card className="p-5 mb-6 space-y-4" data-testid="registry-methodology">
    <h2 className="text-lg font-semibold">Authoritative implemented definitions</h2>
    <p className="text-sm text-muted-foreground">{registry.boundary}</p>
    <a className="text-sm underline" href="/api/methodology/registry">Machine-readable methodology registry</a>
    <h3 className="font-medium">Download claim labels</h3>
    {Object.entries(registry.downloadClaims).map(([kind, claim]) =>
      <details key={kind} className="text-sm"><summary>{kind}: {claim.status}</summary>
        <p>{claim.interpretation}</p><p>{claim.limitation}</p></details>)}
    <h3 className="font-medium">Independent scientific evidence strands</h3>
    {(["physicalResponse", "stage9Skill", "scenarioInterpretation"] as const).map(key => {
      const strand = registry.scientificEvidence[key];
      return <p key={key} className="text-sm"><strong>{strand.label}: {strand.status}</strong> — {strand.reason}</p>;
    })}
    <details className="text-sm"><summary>Exact historical type definitions</summary>
      <dl>{Object.entries(registry.historicalTypes).map(([code, label]) =>
        <div key={code}><dt><code>{code}</code></dt><dd>{label}</dd></div>)}</dl>
      <p>A missing declaration is not assigned an archived or verified type. A declaration does not authenticate original vintage.</p>
    </details>
    <details className="text-sm"><summary>Core input/calculation definitions ({registry.coreFields.length})</summary>
      {registry.coreFields.map(field => <details key={field.field} className="my-2">
        <summary>{field.field} — {field.role} ({field.unit})</summary>
        <dl>{Object.entries(field).map(([key, value]) =>
          <div key={key}><dt className="font-medium">{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : value}</dd></div>)}</dl>
      </details>)}
    </details>
    <details className="text-sm"><summary>Qualified output definitions ({registry.outputFields.length})</summary>
      {registry.outputFields.map(field => <details key={field.id} className="my-2">
        <summary>{field.id} — {field.meaning} ({field.unit})</summary>
        <dl>{Object.entries(field).map(([key, value]) =>
          <div key={key}><dt className="font-medium">{key}</dt><dd>{Array.isArray(value) ? value.join(", ") : value}</dd></div>)}</dl>
      </details>)}
    </details>
    <p className="text-xs text-muted-foreground">Every central spreadsheet includes a Download manifest sheet; JSON includes a manifest.
      Server attachments carry X-Download-Manifest (base64url JSON) and an exact claim header. UI server-download links opt in to embedded
      metadata; default API bodies remain unchanged. Requested UI selections are not certified producer input/model/run identities.
      Producer identity is unavailable (null); data hashes do not close that binding gap. Manifests identify exported data, not approved inputs or a complete immutable analysis archive.</p>
  </Card>;
}

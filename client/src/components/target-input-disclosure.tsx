import { useReadQuery as useQuery } from "@/lib/use-read-query";
import type { OutputFieldSemantic } from "@shared/outputFieldSemantics";
import { Card, CardContent } from "@/components/ui/card";

/** Reads the existing semantics registry, not company values or an approval action. */
export function TargetInputDisclosure() {
  const registry=useQuery<{qualifiedFields:OutputFieldSemantic[]}>({
    queryKey:["/api/calculation/field-semantics"],
  });
  const fields=registry.data?.qualifiedFields?.filter(f=>f.id.startsWith("targetInput."));
  return <Card><CardContent className="p-4 space-y-3">
    <h2 className="font-semibold">Company target input contract — read only</h2>
    <p className="text-sm text-muted-foreground">
      This is the input definition, not a list of approved company targets. Target changes use the existing
      operator review/capture CLI only. No target editing or approval is available here; public mutations remain denied.
      Reviewed inputs are revised-history declarations, not verified original vintages or scientific acceptance.
    </p>
    <p className="text-sm" data-field-id="targetInput.value">
      Scope 1+2 cumulative change is fractional: −0.5 means a 50% reduction relative to the source-explicit
      base year by 2050. Scope 3 is not substituted. Publication day, observation day, availability and approval
      time are distinct. Missing base-year or boundary evidence leaves annual decline unavailable, not zero;
      2024 is never assumed.
    </p>
    {registry.isLoading ? <p>Loading input definitions…</p> : registry.isError ?
      <p role="alert">Target input definitions could not be loaded. No substitute definitions or target values are shown.</p> :
      !fields?.length ? <p role="alert">Target input definitions are unavailable in the registry.</p> :
      <details><summary className="cursor-pointer text-sm font-medium">Inspect input rules and conditional annual-rate formula ({fields.length} definitions)</summary>
        <dl className="space-y-4 pt-3 text-sm">{fields.map(field=><div key={field.id}>
          <dt className="font-medium">{field.id} · {field.role} · {field.unit}</dt>
          <dd>{field.meaning}</dd><dd>{field.formula}</dd>
          <dd className="text-muted-foreground">Source: {field.source}</dd>
          <dd className="text-muted-foreground">As of: {field.asOfRule}</dd>
          <dd className="text-muted-foreground">Missingness: {field.missingness}</dd>
          <dd className="text-muted-foreground">Uncertainty: {field.uncertainty}</dd>
        </div>)}</dl>
      </details>}
  </CardContent></Card>;
}

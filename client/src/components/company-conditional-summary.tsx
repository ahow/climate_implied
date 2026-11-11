import { useState } from "react";
import { Download, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanyConditionalSummaries } from "@/hooks/use-company-conditional-summaries";
import type { ConditionalIssuer, ConditionalCompany, ConditionalFact } from "@shared/companyConditionalData";

export function publicCompanyIssues(company?: ConditionalCompany): string[] {
  if (!company) return ["No allowlisted summary is available for this issuer."];
  const issues: string[] = [];
  for (const key of ["name", "experimentVersion", "evidenceDocument", "informationContext"] as const)
    if (typeof company[key] !== "string" || !company[key].trim()) issues.push(`${key} not returned.`);
  for (const key of ["sourced", "conditions", "missingness", "refusalReasons"] as const)
    if (!Array.isArray(company[key]) || !company[key].length || company[key].some(value => typeof value !== "string" || !value.trim()))
      issues.push(`${key} disclosure is incomplete.`);
  if (!Array.isArray(company.facts) || !company.facts.length) issues.push("Facts array not returned or empty.");
  else company.facts.forEach((fact, index) => {
    if (!fact || typeof fact !== "object") { issues.push(`Fact row ${index + 1} not returned.`); return; }
    const missing = ["id", "label", "unit", "formula", "sourceLocator", "boundary"].filter(key =>
      typeof fact[key as keyof ConditionalFact] !== "string" || !String(fact[key as keyof ConditionalFact]).trim());
    if (missing.length) issues.push(`Fact ${fact.id ?? index + 1}: ${missing.join(", ")} not returned.`);
    if (fact.value !== null && !(typeof fact.value === "number" && Number.isFinite(fact.value))) issues.push(`Fact ${fact.id ?? index + 1}: finite value or explicit null not returned.`);
    if (!["conditional", "sourced-derived"].includes(fact.classification)) issues.push(`Fact ${fact.id ?? index + 1}: classification not returned.`);
  });
  return issues;
}

export function CompanyConditionalSummary() {
  const [issuer, setIssuer] = useState<ConditionalIssuer>("NEE");
  const { data, isLoading, isError, refetch, isFetching } = useCompanyConditionalSummaries();
  const company = data?.companies.find(row => row.issuer === issuer);
  const issues = publicCompanyIssues(company);
  const exportBase = `/api/cv/company-conditional-summaries/export`;

  return (
    <Card className="p-4 sm:p-6 space-y-5" data-testid="company-conditional-summary">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Conditional company cashflows</h2>
            <Badge variant="outline">S12 / S16 · Supplemental</Badge>
            <Badge variant="secondary" data-testid="conditional-qualified-count">0/3 qualified</Badge>
          </div>
          <p className="text-sm text-muted-foreground">Public derived aggregates, separate from accepted market or scientific claims.</p>
        </div>
        <Badge variant="outline">Read only · Frozen protocols</Badge>
      </div>
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0" />
        <p>Supplemental research, not original closure. Zero qualified original pairs; no Tier 2 or efficacy promotion. Calculations, assumptions and source approval are immutable. Issuer selection changes presentation only. This published snapshot is independent of the selected analysis archive.</p>
      </div>
      {isLoading ? (
        <div className="space-y-3" aria-label="Loading public conditional summaries" aria-busy="true">
          <Skeleton className="h-9 w-52" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-md border border-destructive/30 p-4 space-y-2">
          <h3 className="font-medium text-sm">Public conditional summaries unavailable</h3>
          <p className="text-sm text-muted-foreground">The read-only service could not be loaded. No source or calculation is substituted.</p>
          <Button variant="outline" size="sm" disabled={isFetching} onClick={() => void refetch()}>Retry public summary</Button>
        </div>
      ) : !data?.companies.length ? (
        <div className="rounded-md border border-dashed p-6 space-y-1">
          <h3 className="font-medium text-sm">No public aggregate summaries published</h3>
          <p className="text-sm text-muted-foreground">Private evidence and unapproved source rows are never used as a fallback.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <label htmlFor="conditional-issuer" className="text-xs font-medium">Issuer · presentation only</label>
              <Select value={issuer} onValueChange={value => setIssuer(value as ConditionalIssuer)}>
                <SelectTrigger id="conditional-issuer" className="w-56" data-testid="select-conditional-issuer"><SelectValue /></SelectTrigger>
                <SelectContent>{data.companies.map(row => <SelectItem key={row.issuer} value={row.issuer}>{row.issuer} · {row.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {company && issues.length === 0 ? <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild><a href={`${exportBase}.json?issuer=${issuer}`} download><Download className="mr-2 h-3.5 w-3.5" />Public JSON</a></Button>
              <Button variant="outline" size="sm" asChild><a href={`${exportBase}.xlsx?issuer=${issuer}`} download><Download className="mr-2 h-3.5 w-3.5" />Public XLSX</a></Button>
            </div> : <p role="status" className="text-xs text-muted-foreground">Public exports unavailable: the selected issuer summary is missing required fields. No complete result is substituted.</p>}
          </div>
          {company ? (
            <div className="space-y-5" data-testid={`conditional-company-${company.issuer}`}>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">{company.name ?? "Company name unavailable"} <span className="font-normal text-muted-foreground">· Conditional, not qualified</span></h3>
                <p className="text-xs text-muted-foreground">{company.informationContext ?? "Information context not returned."}</p>
                <p className="text-xs text-muted-foreground break-all">Public evidence: <code>{company.evidenceDocument ?? "Evidence locator not returned"}</code><br />Frozen experiment: <code>{company.experimentVersion ?? "Experiment version not returned"}</code></p>
              </div>
              {!!issues.length && <ul role="status" className="text-xs text-muted-foreground list-disc pl-4">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <DisclosureList title="Sourced observations and boundaries" items={company.sourced} />
                <DisclosureList title="Conditional assumptions · not observations" items={company.conditions} />
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs text-left">
                  <caption className="text-left px-3 py-2 font-medium bg-muted/30">Cash and unit reconciliation · null means unknown, never zero</caption>
                  <thead className="border-y bg-muted/20"><tr><th className="p-3 font-medium">Aggregate / status</th><th className="p-3 font-medium">Value / unit</th><th className="p-3 font-medium">Formula, provenance and limitation</th></tr></thead>
                  <tbody>{Array.isArray(company.facts) && company.facts.map((fact, index) =>
                    <ConditionalFactRow key={fact?.id ?? index} issuer={issuer} fact={fact} />)}</tbody>
                </table>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <DisclosureList title="Missingness · unresolved source fields" items={company.missingness} />
                <DisclosureList title="Refusals · why this does not qualify" items={company.refusalReasons} />
              </div>
              <p className="text-xs text-muted-foreground border-t pt-3">JSON and XLSX share the explicit public allowlist, units, formulas and limitations shown here. No raw quotes, provider rows, private artifacts or runtime source files. Original closure and frozen protocols remain unchanged.</p>
            </div>
          ) : <p className="text-sm text-muted-foreground">No allowlisted summary is available for this issuer.</p>}
        </>
      )}
    </Card>
  );
}

export function DisclosureList({ title, items }: { title: string; items?: readonly string[] | null }) {
  return <section className="space-y-2"><h4 className="text-xs font-semibold">{title}</h4>
    {!Array.isArray(items) ? <p role="status" className="text-xs text-muted-foreground">Disclosure array not returned for {title}. Absence does not establish completeness.</p>
      : !items.length ? <p role="status" className="text-xs text-muted-foreground">No disclosure items returned for {title}; this does not establish no assumptions or refusals.</p>
      : <ul className="space-y-2 text-xs text-muted-foreground list-disc pl-4">{items.map((item, index) => <li key={index}>{typeof item === "string" && item.trim() ? item : "Disclosure text unavailable — not returned."}</li>)}</ul>}
  </section>;
}

export function ConditionalFactRow({ fact, issuer }: { fact?: ConditionalFact | null; issuer: ConditionalIssuer }) {
  if (!fact || typeof fact !== "object") return <tr><td colSpan={3} role="status">Conditional fact row unavailable — not returned. No aggregate value is substituted.</td></tr>;
  return <tr className="border-b last:border-b-0 align-top" data-testid={`conditional-fact-${issuer}-${fact.id ?? "missing-id"}`}>
    <th scope="row" className="p-3 min-w-40 font-medium">{fact.label ?? "Fact label not returned"}<span className="block mt-1 text-muted-foreground font-normal">{fact.classification === "conditional" ? "Conditional calculation" : fact.classification === "sourced-derived" ? "Sourced / derived" : "Classification unavailable — not returned"}</span></th>
    <td className="p-3 min-w-32"><span className="font-mono tabular-nums">{fact.value === null ? "Unknown (null)" : typeof fact.value === "number" && Number.isFinite(fact.value) ? fact.value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "Unavailable — finite value not returned"}</span><span className="block text-muted-foreground mt-1">{fact.unit ?? "Unit not returned"}</span></td>
    <td className="p-3 min-w-64 space-y-1"><p className="font-mono">{fact.formula ?? "Formula not returned"}</p><p className="text-muted-foreground">{fact.boundary ?? "Boundary not returned"}</p><p className="text-muted-foreground break-all">Evidence locator: <code>{fact.sourceLocator ?? "Source locator not returned"}</code></p></td>
  </tr>;
}

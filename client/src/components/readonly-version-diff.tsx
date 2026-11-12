import { useState } from "react";
import { useReadQuery } from "@/lib/use-read-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DownloadDataButton } from "@/components/download-data-button";
import { HISTORICAL_TYPES, requireHistoricalType } from "@shared/historicalTypes";
import { z } from "zod";
import { bindProducerReadonlyConsumer } from "@/lib/producer-download";

export interface VersionDiffResponse {
  version: string; from: string; to: string; kind: string; approvalState: string;
  fields: { domain: string; field: string; added: number; removed: number; changed: number; beforeHash: string; afterHash: string }[];
  affectedAnalyses: { resultId: string; manifestId: string; scenario: string; recordedAt: string;
    historicalTypeCode: string; historicalTypeLabel: string; relation: string }[];
  scannedResults: number; nextCursor: string | null; disclosure: string; historicalBasis: string; affectedMeaning: string;
}
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative();
const diffViewSchema = z.object({
  version: z.literal("readonly-diff-1"), from: sha, to: sha,
  kind: z.enum(["workbook-baseline", "company-overlay", "indicator-overrides", "material-inputs"]),
  approvalState: z.enum(["archived-reviewed-overlay", "archived-approved-indicators", "not-established-by-archive"]),
  fields: z.array(z.object({ domain: z.string().min(1), field: z.string().min(1),
    added: count, removed: count, changed: count, beforeHash: sha, afterHash: sha })),
  affectedAnalyses: z.array(z.object({ resultId: sha, manifestId: sha, scenario: z.string().min(1),
    recordedAt: z.string().datetime(), historicalTypeCode: z.string(), historicalTypeLabel: z.string(),
    relation: z.enum(["consumed-before-version", "consumed-after-version", "consumed-both-versions"]),
  }).superRefine((row, ctx) => {
    try { requireHistoricalType(row); }
    catch { ctx.addIssue({ code: "custom", message: "Missing or inconsistent historical evidence type" }); }
  })),
  scannedResults: count, nextCursor: sha.nullable(),
  disclosure: z.string().min(1), historicalBasis: z.string().min(1), affectedMeaning: z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.affectedAnalyses.length > data.scannedResults ||
      new Set(data.fields.map(f => `${f.domain}:${f.field}`)).size !== data.fields.length ||
      new Set(data.affectedAnalyses.map(a => a.resultId)).size !== data.affectedAnalyses.length)
    ctx.addIssue({ code: "custom", message: "Invalid or duplicate diff populations" });
});
export function versionDiffExportRows(data: VersionDiffResponse) {
  diffViewSchema.parse(data);
  return bindProducerReadonlyConsumer(data, "version-diff", data.fields.map(field => ({ From: data.from, To: data.to, Kind: data.kind,
    Domain: field.domain, Field: field.field, Added: field.added, Removed: field.removed,
    Changed: field.changed, "Before content SHA-256": field.beforeHash, "After content SHA-256": field.afterHash,
    "Approval state": data.approvalState, "History basis": data.historicalBasis })));
}
export function affectedAnalysisExportRows(data: VersionDiffResponse) {
  diffViewSchema.parse(data);
  return bindProducerReadonlyConsumer(data, "affected-analyses", data.affectedAnalyses.map(a => ({ From: data.from, To: data.to,
    "Result ID": a.resultId, "Manifest ID": a.manifestId, Scenario: a.scenario,
    "Recorded at": a.recordedAt, Relation: a.relation, ...requireHistoricalType(a),
    "Result scan scope": data.affectedMeaning })));
}
/** Read-only view: no raw provider rows, source excerpts or mutation controls. */
export function ReadonlyVersionDiff() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState("workbook-baseline");
  const [selection, setSelection] = useState<{ from: string; to: string; kind: string; after?: string } | null>(null);
  const valid = /^[a-f0-9]{64}$/.test(from) && /^[a-f0-9]{64}$/.test(to);
  const unchanged = !!selection && selection.from === from && selection.to === to && selection.kind === kind;
  const url = `/api/data/version-diff?${new URLSearchParams(selection ?? {}).toString()}`;
  const { data: result, isLoading, error } = useReadQuery<VersionDiffResponse>({
    queryKey: [url], enabled: unchanged,
  });
  const data = unchanged && !error && !isLoading ? result : undefined;
  const identityMismatch = !!data && (data.from !== from || data.to !== to || data.kind !== kind);
  return <Card data-testid="readonly-version-diff"><CardContent className="p-4 space-y-3">
    <h2 className="font-semibold">Versioned data diffs and affected analyses</h2>
    <details className="text-xs text-muted-foreground">
      <summary>Historical evidence classes (S09-001)</summary>
      <ul>{Object.entries(HISTORICAL_TYPES).map(([code, label]) => <li key={code}>{label} — {code}</li>)}</ul>
      <p>Current historical recalculations and descriptive valuation archives are revised-history reconstructions.
        Neither archive time nor a supplied date certifies original input availability or cutoff-only parameter fitting.
        No verified-past-input simulation is certified by this view.</p>
    </details>
    <p className="text-xs text-muted-foreground">
      Select exact retained source identities from the snapshot inventory. No current-data fallback.
      Carbon, SDG and financial workbook/overlay changes and retained driver changes are shown as counts and hashes only.
    </p>
    <div className="grid gap-3 md:grid-cols-3">
      <div><Label htmlFor="diff-kind">Archive kind</Label>
        <select id="diff-kind" className="w-full border rounded-md bg-background p-2 text-sm" value={kind} onChange={e => setKind(e.target.value)}>
          <option value="workbook-baseline">Workbook: carbon / SDG / financial</option>
          <option value="company-overlay">Reviewed company overlay</option>
          <option value="indicator-overrides">Approved driver overrides</option>
          <option value="material-inputs">Consumed effective drivers</option>
        </select></div>
      <div><Label htmlFor="diff-from">Before source SHA-256</Label><Input id="diff-from" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div><Label htmlFor="diff-to">After source SHA-256</Label><Input id="diff-to" value={to} onChange={e => setTo(e.target.value)} /></div>
    </div>
    <Button variant="outline" disabled={!valid} onClick={() => setSelection({ from, to, kind })}>Compare retained versions</Button>
    {unchanged && isLoading && <p role="status">Reading retained versions…</p>}
    {unchanged && error && <p role="alert">Version diff unavailable: {error.message}. No values are substituted.</p>}
    {unchanged && !isLoading && !error && !data &&
      <p role="status">No retained version diff response was returned. Counts, analysis references and downloads are unavailable.</p>}
    {identityMismatch && <p role="alert">Returned version identities do not match the current selection. Diff and exports withheld; no source substituted.</p>}
    {data && !identityMismatch && <VersionDiffResult data={data} onNext={() => setSelection({ from, to, kind, after: data.nextCursor! })} />}
  </CardContent></Card>;
}
export function VersionDiffResult({ data, onNext }: { data: VersionDiffResponse; onNext: () => void }) {
  if (!diffViewSchema.safeParse(data).success)
    return <p role="alert">Version diff unavailable: missing, invalid or inconsistent retained response. Counts, analysis references and exports withheld.</p>;
  return <div className="space-y-3">
    <p className="text-xs break-all">Before: {data.from}<br />After: {data.to}</p>
    <p className="text-xs">Approval: {data.approvalState}. {data.historicalBasis}. {data.disclosure}.</p>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr><th className="text-left">Domain / field</th><th>Added</th><th>Removed</th><th>Changed</th></tr></thead>
      <tbody>{data.fields.map(f => <tr key={`${f.domain}:${f.field}`}>
        <td>{f.domain} / {f.field}</td><td className="text-center">{f.added}</td><td className="text-center">{f.removed}</td><td className="text-center">{f.changed}</td>
      </tr>)}</tbody></table></div>
    {!data.fields.length && <p>No comparable cells in these retained versions.</p>}
    <DownloadDataButton requireDerivedParent kind="indicators" filename="readonly-version-diff" rows={() => versionDiffExportRows(data)}
      interpretationNotes={[{ Field: "Readonly comparison claim", Value: "Exact source-cell counts and content hashes from verified retained source archives. Not source observation values, model execution, inferred impacts or original-vintage evidence." }]}
      disabled={!data.fields.length} sheetName="Version diff" fieldBindings={{
        From: { id: "readonlyDiff.from", transform: "Identity: selected before source SHA-256" },
        To: { id: "readonlyDiff.to", transform: "Identity: selected after source SHA-256" },
        Kind: { id: "readonlyDiff.kind", transform: "Identity: validated archive kind" },
        Domain: { id: "readonlyDiff.domain", transform: "Identity: exact compared cell domain" },
        Field: { id: "readonlyDiff.field", transform: "Identity: exact grouped source field" },
        Added: { id: "readonlyDiff.added", transform: "Identity integer count; zero retained" },
        Removed: { id: "readonlyDiff.removed", transform: "Identity integer count; zero retained" },
        Changed: { id: "readonlyDiff.changed", transform: "Identity integer count; zero retained" },
        "Before content SHA-256": { id: "readonlyDiff.beforeHash", transform: "Identity: sorted before-group cell content hash" },
        "After content SHA-256": { id: "readonlyDiff.afterHash", transform: "Identity: sorted after-group cell content hash" },
        "Approval state": { id: "readonlyDiff.approvalState", transform: "Identity: retained archive review state, no new approval" },
        "History basis": { id: "readonlyDiff.historicalBasis", transform: "Identity: revised-history caveat, not original vintage" },
      }} />
    <h3 className="text-sm font-semibold">Affected archived analyses</h3>
    <p className="text-xs text-muted-foreground">{data.affectedMeaning}. Scanned {data.scannedResults} results on this page.</p>
    {!data.affectedAnalyses.length && <p className="text-sm">No exact references found on this page; this does not establish absence elsewhere.</p>}
    {data.affectedAnalyses.map(a => <div key={a.resultId} className="text-xs border rounded-md p-2 break-all">
      <p>{a.scenario} · {a.relation}</p><p>Result: {a.resultId}</p><p>Manifest: {a.manifestId}</p>
      <p>Recorded: {a.recordedAt} · {a.historicalTypeLabel} ({a.historicalTypeCode})</p>
    </div>)}
    <DownloadDataButton requireDerivedParent kind="indicators" filename="affected-archived-analyses" sheetName="Affected analyses"
      interpretationNotes={[{ Field: "Readonly dependency claim", Value: "Exact retained result references on this frozen scan page only. Not recomputed impacts, exhaustive dependency discovery, model execution or scientific acceptance." }]}
      rows={() => affectedAnalysisExportRows(data)} disabled={!data.affectedAnalyses.length} fieldBindings={{
        From: { id: "readonlyDiff.from", transform: "Identity: selected before source SHA-256" },
        To: { id: "readonlyDiff.to", transform: "Identity: selected after source SHA-256" },
        "Result ID": { id: "readonlyDiff.resultId", transform: "Identity: exact referencing archived result" },
        "Manifest ID": { id: "readonlyDiff.manifestId", transform: "Identity: retained result manifest" },
        Scenario: { id: "readonlyDiff.scenario", transform: "Identity: recorded scenario label" },
        "Recorded at": { id: "readonlyDiff.recordedAt", transform: "Identity ISO datetime; not source publication" },
        Relation: { id: "readonlyDiff.relation", transform: "Identity: exact before/after/both reference enum" },
        "Historical type code": { id: "readonlyDiff.historicalTypeCode", transform: "requireHistoricalType exact validated code; no fallback" },
        "Historical type label": { id: "readonlyDiff.historicalTypeLabel", transform: "requireHistoricalType exact matching S09-001 label" },
        "Result scan scope": { id: "readonlyDiff.affectedMeaning", transform: "Identity: paginated exact-reference scan caveat" },
      }} />
    {data.nextCursor && <Button variant="outline" onClick={onNext}>Next affected-analysis page</Button>}
  </div>;
}

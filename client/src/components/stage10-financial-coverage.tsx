import { withDownloadManifest } from "@shared/serverDownloadRegistry";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { stage10CoverageSchema, stage10Fields, stage10IdentityStates, stage10LifecycleStates, type Stage10CoverageReport } from "@shared/stage10Coverage";
export function stage10DownloadUrl(report: Stage10CoverageReport, suffix: string) {
  return `/api/research/stage10-coverage${suffix}?${new URLSearchParams({
    workbookHash: report.workbookHash, cutoff: report.informationCutoff, expectedInputHash: report.inputHash,
    firstYear: String(report.fiscalYears[0]), lastYear: String(report.fiscalYears.at(-1)),
  })}`;
}
export async function fetchStage10Coverage() {
  const response = await fetch("/api/research/stage10-coverage");
  if (!response.ok) throw new Error("Retained financial coverage unavailable; source failure is not zero coverage");
  const report = stage10CoverageSchema.parse(await response.json());
  if (response.headers.get("X-Stage10-Input-SHA256") !== report.inputHash) throw new Error("Coverage input identity mismatch");
  return report;
}
export function Stage10FinancialCoverage({ readState }: { readState?: { loading?: boolean; error?: string; data?: unknown } }) {
  const [population, setPopulation] = useState("full-workbook"), [field, setField] = useState("operatingCashFlow");
  const [page, setPage] = useState(0);
  const query = useQuery({ queryKey: ["/api/research/stage10-coverage"], queryFn: fetchStage10Coverage, enabled: !readState, retry: false });
  const state = readState ?? { loading: query.isPending || query.isFetching,
    error: query.isError ? query.error?.message || "Retained coverage read failed" : undefined, data: query.data };
  const parsed = stage10CoverageSchema.safeParse(state.data), report = parsed.success ? parsed.data : undefined;
  const selectedRows = report?.rows.filter(r => r.population === population && r.dimension === "financial-field" && r.key === field) ?? [];
  const lastPage = Math.max(0, Math.ceil(selectedRows.length / 25) - 1), visiblePage = Math.min(page, lastPage);
  const visibleRows = selectedRows.slice(visiblePage * 25, (visiblePage + 1) * 25);
  const share = (x: number | null) => x === null ? "Unavailable" : `${(100 * x).toFixed(1)}%`;
  return <Card className="p-5 my-6 space-y-3" data-testid="stage10-financial-coverage">
    <h2 className="text-lg font-semibold">Stage10 · retained identity and financial-field coverage</h2>
    {state.loading ? <p role="status">Loading retained coverage… Previous values/downloads withheld.</p> :
      state.error ? <p role="alert">{state.error}</p> :
      !report ? <p role="alert">Retained coverage absent or invalid; not zero coverage.</p> :
      <section className="space-y-3">
        <p className="text-sm"><span data-field-id="stage10Coverage.fullWorkbookCompanies">Full workbook: {report.fullWorkbookCompanies}</span>{" · "}
          <span data-field-id="stage10Coverage.verifiedEligibleCompanies">Verified eligible: {report.verifiedEligibleCompanies}</span>{" · "}
          <span data-field-id="stage10Coverage.admittedStage11To15Records">Original-dated Stage11–15 records: {report.admittedStage11To15Records}</span></p>
        <p className="text-xs break-all" data-field-id="stage10Coverage.inputHash">Input SHA256: {report.inputHash}</p>
        <p className="text-xs break-all" data-field-id="stage10Coverage.workbookHash">Full immutable workbook SHA256: {report.workbookHash}; separate from the active analysis selection.</p>
        <p className="text-xs break-all" data-field-id="stage10Coverage.denominatorVersion">Denominator/as-of rule version: {report.denominatorVersion}</p>
        <p className="text-xs"><span data-field-id="stage10Coverage.retainedSourceVersions">Retained candidate source versions: {report.retainedSourceVersions}</span>{" · "}
          <span data-field-id="stage10Coverage.selectedSourceVersions">Selected as-of versions: {report.selectedSourceVersions}</span>; neither count establishes identity or publication approval.</p>
        <p className="text-xs" data-field-id="stage10Coverage.informationCutoff">Information cutoff: {report.informationCutoff}; fiscal years {report.fiscalYears.join(", ")}</p>
        <p className="text-xs" data-field-id="stage10Coverage.limitation">{report.limitation}</p>
        <nav className="flex flex-wrap gap-4 text-sm"><a className="underline" href={withDownloadManifest(stage10DownloadUrl(report, "/export.json"))}>Exact aggregate JSON</a>
          <a className="underline" href={withDownloadManifest(stage10DownloadUrl(report, "/export.xlsx"))}>Exact aggregate XLSX</a></nav>
        <div className="text-sm space-y-1">{report.rows.filter(r => r.sector === "All sectors" &&
          r.population === population && r.dimension === "identity").map(r => <p key={r.key}>
            <span data-field-id="stage10Coverage.rows[].key">{r.key}</span>:{" "}
            <span data-field-id="stage10Coverage.rows[].present">{r.present === null ? "Suppressed" : r.present}</span>{" / "}
            <span data-field-id="stage10Coverage.rows[].companies">{r.companies}</span></p>)}</div>
        <h3 className="font-medium">Independent lifecycle × seven identity states</h3>
        <p className="text-xs">Listed means a dated exact-security provider active-listing observation,not a verified continuous exchange listing.
          Inactive status,last workbook observation and accepted identity never imply delisting,acquisition or merger.</p>
        <div className="overflow-x-auto"><table className="text-xs"><thead><tr><th>Lifecycle / identity</th>
          {stage10IdentityStates.map(s => <th className="p-2" key={s}>{s}</th>)}<th>Lifecycle total</th></tr></thead>
          <tbody>{stage10LifecycleStates.map(lifecycle => <tr key={lifecycle}><th className="p-2" data-field-id="stage10Coverage.rows[].key">{lifecycle}</th>
            {stage10IdentityStates.map(identity => {
              const joint = report.rows.find(r => r.population === population && r.sector === "All sectors" &&
                r.dimension === "lifecycle-identity" && r.key === `${lifecycle}|${identity}`);
              return <td className="p-2" key={identity} data-field-id="stage10Coverage.rows[].present">{joint?.present === null ? "Suppressed" : joint?.present ?? "Unavailable"}</td>;
            })}
            <td className="p-2" data-field-id="stage10Coverage.rows[].present">{report.rows.find(r => r.population === population &&
              r.sector === "All sectors" && r.dimension === "lifecycle" && r.key === lifecycle)?.present ?? "Suppressed"}</td>
          </tr>)}</tbody></table></div>
        <p className="text-xs"><span data-field-id="stage10Coverage.lifecycleNonUnknownCompanies">Full-workbook nonunknown lifecycle companies: {report.lifecycleNonUnknownCompanies}</span>{" · "}
          <span data-field-id="stage10Coverage.lifecycleAuditedNonUnknownCompanies">Source-audited: {report.lifecycleAuditedNonUnknownCompanies}</span>{" · "}
          <span data-field-id="stage10Coverage.lifecycleUnverifiedNonUnknownCompanies">Unverified nonunknown: {report.lifecycleUnverifiedNonUnknownCompanies}</span></p>
        <details className="text-xs"><summary>Every nonunknown lifecycle’s dated source audit</summary>
          <p className="break-all" data-field-id="stage10Coverage.lifecycleSourceSetHash">Source-set SHA256: {report.lifecycleSourceSetHash}</p>
          {report.lifecycleEvidenceAudit.map(row => <div key={row.sourceKind} className="py-2 border-t">{Object.entries(row).map(([key, value]) =>
            <p key={key} className="break-all" data-field-id={`stage10Coverage.lifecycleEvidenceAudit[].${key}`}>{key}: {value === null ? "Unavailable" : value}</p>)}</div>)}
        </details>
        <div className="flex flex-wrap gap-3 text-sm">
          <label>Population <select value={population} onChange={e => { setPopulation(e.target.value); setPage(0); }} className="border rounded bg-background p-1">
            <option value="full-workbook">Full workbook</option><option value="verified-eligible">Verified eligible only</option></select></label>
          <label>Field <select value={field} onChange={e => { setField(e.target.value); setPage(0); }} className="border rounded bg-background p-1">
            {stage10Fields.map(f => <option key={f} value={f}>{f}</option>)}</select></label>
        </div>
        <p className="text-xs">Sector×workbook-region cells retain Unknown and zero-company combinations.
          Local page {visiblePage + 1} / {lastPage + 1}; {selectedRows.length} fixed cells. Exports retain every population/field/cell.</p>
        <div className="overflow-x-auto"><table className="text-xs min-w-max"><thead><tr>
          {["Sector", "Workbook region", "Companies", "Expected year slots", "Present", "Missing", "Null", "Invalid", "Conflict",
            "Original", "Restated", "Unknown provenance", "Original filing verified", "Provider date unverified", "No filing date", "Coverage",
            "Explicit restated flags / present (NOT prevalence)", "Unknown provenance / present", "Restated / known provenance"].map(h => <th className="p-2 text-left" key={h}>{h}</th>)}
        </tr></thead><tbody>{visibleRows.map(r => <tr key={`${r.sector}-${r.region}`} className="border-t">
          <td className="p-2" data-field-id="stage10Coverage.rows[].sector">{r.sector}</td><td className="p-2" data-field-id="stage10Coverage.rows[].region">{r.region}</td>
          <td className="p-2" data-field-id="stage10Coverage.rows[].companies">{r.companies}</td><td className="p-2" data-field-id="stage10Coverage.rows[].expectedSlots">{r.expectedSlots}</td>
          {(["present", "missing", "explicitNull", "invalid", "conflicted", "original", "restated", "restatementUnknown",
            "originalFilingDateVerified", "providerFilingDateUnverified", "filingDateMissing"] as const).map(key =>
            <td className="p-2" key={key} data-field-id={`stage10Coverage.rows[].${key}`}>{r[key] === null ? "Suppressed" : r[key]}</td>)}
          <td className="p-2" data-field-id="stage10Coverage.rows[].availableShare">{share(r.availableShare)}</td>
          <td className="p-2" data-field-id="stage10Coverage.rows[].explicitRestatedFlagShareOfPresent">{share(r.explicitRestatedFlagShareOfPresent)}</td>
          <td className="p-2" data-field-id="stage10Coverage.rows[].restatementUnknownShareOfPresent">{share(r.restatementUnknownShareOfPresent)}</td>
          <td className="p-2" data-field-id="stage10Coverage.rows[].restatedShareOfKnownProvenance">{share(r.restatedShareOfKnownProvenance)}</td>
        </tr>)}</tbody></table></div>
        <nav aria-label="Coverage table pages" className="flex gap-4 text-sm">
          <button type="button" disabled={visiblePage === 0} onClick={() => setPage(visiblePage - 1)}>Previous25 cells</button>
          <button type="button" disabled={visiblePage === lastPage} onClick={() => setPage(visiblePage + 1)}>Next25 cells</button>
        </nav>
        <details className="text-xs" data-field-id="stage10Coverage.sourceGaps[]"><summary>Actual source/authority gaps and field classifications</summary>
          <ul>{report.sourceGaps.map(gap => <li key={gap}>{gap}</li>)}</ul></details>
      </section>}
  </Card>;
}

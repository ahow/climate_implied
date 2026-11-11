import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CompanyCoverageReport } from "../../../server/calculation/companyCoverage";
import { currentSelection } from "@/lib/analysis-selection";
import { DownloadJsonButton } from "@/components/download-data-button";
import { validateCompanyCoverageJson } from "@/lib/export-contract";

/** Standalone S12-018 surface. Server JSON download preserves null/status details. */
export function CompanyCoverage() {
  const [observationDate, setObservationDate] = useState("");
  const query = useQuery<CompanyCoverageReport>({
    queryKey: ["/api/calculation/company-coverage", observationDate],
    queryFn: async () => {
      const selection = currentSelection();
      if (selection?.overlays?.length) throw new Error("Coverage requires the baseline workbook; remove overlays to report baseline coverage.");
      const params = new URLSearchParams();
      if (selection?.workbook) params.set("snapshotId", selection.workbook);
      if (observationDate) params.set("observationDate", observationDate);
      const response = await fetch(`/api/calculation/company-coverage?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(`Coverage request unavailable (${response.status}); no zero-coverage inference is permitted.`);
      const report: CompanyCoverageReport = await response.json();
      validateCompanyCoverageJson(report);
      if (selection && report.sourceId !== selection.workbook) throw new Error("Coverage response workbook conflicts with the selected workbook.");
      return report;
    },
  });
  const percentage = (value: number | null) => value === null ? "Unavailable (no denominator)" : `${(value * 100).toFixed(2)}%`;
  return <Card><CardContent className="pt-6 space-y-3">
    <h2 className="font-semibold">Company market-cap, emissions and geography coverage</h2>
    <label className="text-sm block">Exact observation date (blank = latest available workbook day)
      <input type="date" className="block border rounded p-1 mt-1" value={observationDate} onChange={event => setObservationDate(event.target.value)} />
    </label>
    {query.isLoading ? <p>Loading full-workbook coverage…</p> : query.isError ?
      <div role="alert">Coverage unavailable; this is not zero coverage. {query.error instanceof Error ? query.error.message : ""} <Button onClick={() => void query.refetch()}>Retry</Button></div> :
      query.data ? <>
        <p className="text-sm">Observation <span data-field-id="companyCoverage.observationDate">{query.data.observationDate}</span>; information cutoff <span data-field-id="companyCoverage.informationCutoff">{query.data.informationCutoff}</span>.</p>
        <p className="text-sm break-all" data-field-id="companyCoverage.sourceId">Workbook: {query.data.sourceId}</p>
        <p className="text-sm" data-field-id="companyCoverage.eligibilityRule">{query.data.eligibilityRule}</p>
        <p className="text-sm">Eligible issuer share of full workbook: <span data-field-id="companyCoverage.eligibleCompanyShare">{percentage(query.data.eligibleCompanyShare)}</span>.</p>
        <div className="text-sm">Eligible share of full-workbook known values (unknown values excluded):
          {Object.entries(query.data.eligibleKnownValueCoverage).map(([metric, share]) =>
            <p key={metric} data-field-id={`companyCoverage.eligibleKnownValueCoverage.${metric}`}>{metric}: {percentage(share)}</p>)}
        </div>
        {(["fullWorkbook", "eligible"] as const).map(population => {
          const report = query.data![population];
          return <section key={population} className="border rounded p-3 space-y-2">
            <h3 className="font-medium">{population === "fullWorkbook" ? "Full workbook" : "Eligible reviewed identities"}: <span data-field-id={`companyCoverage.${population}.denominator`}>{report.denominator}</span> issuers</h3>
            <div className="text-sm">{Object.entries(report.mapping).map(([basis, value]) =>
              <p key={basis}>{basis}: <span data-field-id={`companyCoverage.${population}.mapping.${basis}.count`}>{value.count}</span> (<span data-field-id={`companyCoverage.${population}.mapping.${basis}.share`}>{percentage(value.share)}</span>)</p>)}</div>
            <div className="overflow-x-auto"><table className="text-sm w-full"><thead><tr><th className="text-left">Metric</th><th>Available / denominator</th><th>Null / missing / conflicted / invalid</th><th>Operating / HQ share of known value</th></tr></thead>
              <tbody>{Object.entries(report.metrics).map(([metric, value]) => <tr key={metric} className="border-t">
                <td>{metric}</td><td className="text-center" data-field-id={`companyCoverage.${population}.metrics.${metric}.availableShare`}>{value.availableCount} / {report.denominator} ({percentage(value.availableShare)})</td>
                <td className="text-center">{(["null", "missing", "conflicted", "invalid"] as const).map((state, i) =>
                  <span key={state} data-field-id={`companyCoverage.${population}.metrics.${metric}.states.${state}`}>{i ? " / " : ""}{value.states[state]}</span>)}</td>
                <td className="text-center"><span data-field-id={`companyCoverage.${population}.metrics.${metric}.operatingGeography.shareOfKnownValue`}>{percentage(value.operatingGeography.shareOfKnownValue)}</span> / <span data-field-id={`companyCoverage.${population}.metrics.${metric}.headquartersFallback.shareOfKnownValue`}>{percentage(value.headquartersFallback.shareOfKnownValue)}</span></td>
              </tr>)}</tbody></table></div>
          </section>;
        })}
        <p className="text-sm">Financial eligibility conflicts: <span data-field-id="companyCoverage.eligibilityConflicts">{query.data.eligibilityConflicts}</span>. Scientific acceptance: <span data-field-id="companyCoverage.scientificAcceptance">not established</span>.</p>
        <ul className="text-xs list-disc pl-5" data-field-id="companyCoverage.limitations[]">{query.data.limitations.map(note => <li key={note}>{note}</li>)}</ul>
        <DownloadJsonButton kind="coverage" filename={`company-coverage-${query.data.observationDate}.json`}
          payload={query.data} validatePayload={validateCompanyCoverageJson} label="Export complete coverage JSON" />
      </> : <p role="alert">No coverage report returned.</p>}
  </CardContent></Card>;
}

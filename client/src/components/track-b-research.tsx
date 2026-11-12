import { withDownloadManifest } from "@shared/serverDownloadRegistry";
import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { fetchTrackBCatalog, fetchTrackBReport, trackBReportUrl } from "@/lib/trackBPublicReports";
import { bindTrackBAdmission, type TrackBAdmissionReport } from "@shared/trackBAdmissionContract";
import { trackBPublicCatalogSchema } from "@shared/trackBDisclosureContract";
import type { z } from "zod";

type Read<T> = { loading?: boolean; error?: string; data?: T };
export type TrackBResearchReadState = {
  catalog: Read<z.infer<typeof trackBPublicCatalogSchema>>;
  selectedProtocol?: string; selectedReportHash?: string; selectedDisclosureHash?: string; report?: Read<TrackBAdmissionReport>;
};
/** Supplied readState supports direct bounded state tests; production always
 * queries the genuine catalog/resolver. No default sample reports or approvals. */
export function TrackBResearch({ readState }: { readState?: TrackBResearchReadState }) {
  const [selection, setSelection] = useState("");
  const catalogQuery = useQuery({ queryKey: ["/api/research/track-b-admission/catalog"],
    queryFn: () => fetchTrackBCatalog(), enabled: !readState, retry: false });
  const catalogState = readState?.catalog ?? { loading: catalogQuery.isFetching || catalogQuery.isPending,
    error: catalogQuery.isError ? catalogQuery.error?.message || "Public catalog read failed" : undefined, data: catalogQuery.data };
  const parsedCatalog = trackBPublicCatalogSchema.safeParse(catalogState.data);
  const catalog = parsedCatalog.success ? parsedCatalog.data : undefined;
  const pin = catalog?.reports.find(p => readState
    ? p.protocolHash === readState.selectedProtocol && (!readState.selectedReportHash || p.reportHash === readState.selectedReportHash) &&
      (!readState.selectedDisclosureHash || p.disclosureHash === readState.selectedDisclosureHash)
    : `${p.protocolHash}:${p.reportHash}:${p.disclosureHash}` === selection);
  const reportQuery = useQuery({ queryKey: ["/api/research/track-b-admission", pin?.protocolHash, pin?.reportHash, pin?.disclosureHash],
    queryFn: () => { if (!pin) throw new Error("No exact source-pinned selection"); return fetchTrackBReport(pin); },
    enabled: !readState && !!pin && !catalogState.loading && !catalogState.error, retry: false });
  const reportState = readState ? readState.report ?? {} : { loading: reportQuery.isFetching || reportQuery.isPending,
    error: reportQuery.isError ? reportQuery.error?.message || "Selected public report read failed" : undefined, data: reportQuery.data };
  let report: TrackBAdmissionReport | undefined;
  let invalid = "";
  if (reportState.data && pin) {
    try {
      report = bindTrackBAdmission(reportState.data).report;
      if (report.protocolHash !== pin.protocolHash) { report = undefined; invalid = "Selected protocol does not match report; values/downloads withheld."; }
    } catch { invalid = "Invalid public report; values/downloads withheld."; }
  }
  return <Card className="p-5 my-6 space-y-3" data-testid="track-b-research">
    <h2 className="text-lg font-semibold">Track B · retained per-period evidence</h2>
    <p className="text-sm text-muted-foreground">Publication permits this exact allowlisted report only. It is not Stage9 authentication, scientific acceptance or investment evidence. Missing earnings/results are never replaced with zero.</p>
    {catalogState.loading ? <p role="status">Loading public disclosure catalog…</p> :
      catalogState.error ? <p role="alert">Public catalog unavailable: {catalogState.error}</p> :
      !catalog ? <p role="alert">Public catalog response absent or invalid; no reports/downloads available.</p> :
      !catalog.reports.length ? <section data-field-id="trackBPublicCatalog.reports[]"><p>No authorized public Track B reports have been published.</p>
        <p className="text-xs" data-field-id="trackBPublicCatalog.operatorPrerequisite">{catalog.operatorPrerequisite}</p></section> :
      <section className="space-y-3">
        <label className="text-sm" data-field-id="trackBPublicCatalog.reports[].protocolHash">Exact frozen protocol <select aria-label="Track B frozen protocol" className="ml-2 border rounded p-1 bg-background"
          value={pin ? `${pin.protocolHash}:${pin.reportHash}:${pin.disclosureHash}` : ""} onChange={event => setSelection(event.target.value)}>
          <option value="">Select a source-pinned publication</option>
          {catalog.reports.map(item => <option key={`${item.protocolHash}-${item.reportHash}`} value={`${item.protocolHash}:${item.reportHash}:${item.disclosureHash}`}>{item.protocolHash}</option>)}
        </select></label>
        {!pin ? <p>Select an exact publication; no latest report or current inputs are substituted.</p> :
          reportState.loading ? <p role="status">Loading selected retained report… Previous results/downloads withheld.</p> :
          reportState.error ? <p role="alert">Selected report unavailable: {reportState.error}</p> :
          invalid ? <p role="alert">{invalid}</p> :
          !report ? <p>Selected report response absent; no results/downloads available.</p> :
          <section className="space-y-3">
            <dl className="text-xs break-all">{(["reportHash", "disclosureHash", "pipelineResultHash", "periodDomainHash"] as const).map(key =>
              <div key={key} data-field-id={`trackBPublicCatalog.reports[].${key}`}><dt>{key}</dt><dd>{pin[key]}</dd></div>)}</dl>
            <p data-field-id="trackBAdmission.limitation" className="text-xs">{report.limitation}</p>
            <nav className="flex gap-4 text-sm"><a className="underline" href={withDownloadManifest(trackBReportUrl(pin, "/export.json"))}>Download exact JSON</a>
              <a className="underline" href={withDownloadManifest(trackBReportUrl(pin, "/export.xlsx"))}>Download exact XLSX</a></nav>
            {report.periods.map((period, index) => <section key={`${period.specification}-${period.origin}-${index}`} className="border rounded p-3 text-xs space-y-2">
              <p data-field-id="trackBAdmission.periods[].specification">{period.specification}</p>
              <p data-field-id="trackBAdmission.periods[].origin">Origin: {period.origin}</p>
              <p data-field-id="trackBAdmission.periods[].informationCutoff">Information cutoff: {period.informationCutoff}</p>
              <p data-field-id="trackBAdmission.periods[].executionAt">Execution: {period.executionAt ?? "Unavailable (null)"}</p>
              <p data-field-id="trackBAdmission.periods[].endAt">Holding end: {period.endAt ?? "Unavailable (null)"}</p>
              <p data-field-id="trackBAdmission.periods[].manifestHash">Period manifest: {period.manifestHash ?? "Unavailable (null)"}</p>
              <p data-field-id="trackBAdmission.periods[].status">Track B: {period.status} · <span data-field-id="trackBAdmission.periods[].result">Result unavailable (null)</span></p>
              <ul className="space-y-2">{period.reasons.map((reason, i) => <li key={i}>
                <strong data-field-id="trackBAdmission.periods[].reasons[].code">{reason.code}</strong>{" · "}
                <span data-field-id="trackBAdmission.periods[].reasons[].gate">{reason.gate}</span>{" · "}
                <span data-field-id="trackBAdmission.periods[].reasons[].companyId">{reason.companyId ?? "Period-wide (null)"}</span>
                <p data-field-id="trackBAdmission.periods[].reasons[].detail">{reason.detail}</p>
                <p className="break-all" data-field-id="trackBAdmission.periods[].reasons[].artifactHash">{reason.artifactHash ?? "No referenced artifact (null)"}</p>
              </li>)}</ul>
            </section>)}
          </section>}
      </section>}
  </Card>;
}

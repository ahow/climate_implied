import { useState } from "react";
import { Download, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DisclosureList } from "@/components/company-conditional-summary";
import { ReserveLiteral } from "@/components/producer-reserve-panel";
import { useLocationElectricity } from "@/hooks/use-location-electricity";
import { readBoundLocationElectricityExport, type LocationElectricityDocument } from "@/lib/location-electricity-reader";
import type { LocationElectricityPublicSource } from "@shared/locationElectricityPublicTypes";

function Source({ source }: { source: LocationElectricityPublicSource }) {
  return <details className="text-xs [overflow-wrap:anywhere]">
    <summary className="cursor-pointer font-medium">Source · {source.id}</summary>
    <dl className="space-y-2 border-l pl-3 mt-2 text-muted-foreground">
      <div><dt>Document</dt><dd>{/^https?:\/\//.test(source.url)
        ? <a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>
        : source.url}</dd></div>
      <div><dt>Locator</dt><dd>{source.locator}</dd></div>
      <div><dt>SHA-256</dt><dd className="font-mono">{source.sha256}</dd></div>
      <div><dt>Observed at</dt><dd>{source.observedAt}</dd></div>
      <div><dt>Available at</dt><dd><ReserveLiteral value={source.availableAt} /></dd></div>
      <div><dt>Historical origin claim</dt><dd><ReserveLiteral value={source.historicalOriginClaim} /></dd></div>
    </dl>
  </details>;
}
function LocationElectricityReportView({ document }: { document: LocationElectricityDocument }) {
  const report = document.report;
  const [downloading, setDownloading] = useState<"json" | "xlsx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  async function download(format: "json" | "xlsx") {
    setDownloading(format);
    setDownloadError(null);
    try {
      const blob = await readBoundLocationElectricityExport(document, format);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `supplemental-locationElectricity-${document.identity.id}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Export refused; no fallback file offered.");
    } finally { setDownloading(null); }
  }
  return <div className="space-y-5" data-testid="location-electricity-ready">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="text-xs space-y-1">
        <h3 className="text-sm font-semibold">Source findings · issuer cash result unresolved</h3>
        <p className="text-muted-foreground">{report.criterion} · {report.status}</p>
        <p className="text-muted-foreground">Public source capture cutoff: {report.cutoff} · Not a historical forecast origin.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["json", "xlsx"] as const).map(format => <Button key={format} size="sm" variant="outline"
          disabled={downloading !== null} onClick={() => void download(format)}>
          <Download className="mr-2 h-3.5 w-3.5" />{downloading === format ? "Checking exact result…" : `Public ${format.toUpperCase()}`}
        </Button>)}
      </div>
    </div>
    {downloadError && <p role="alert" className="text-xs text-destructive">{downloadError} No file substituted. Refresh the result or retry the export.</p>}
    <section className="rounded-md border p-3 space-y-3 text-xs" data-testid="location-electricity-partial">
      <div className="font-semibold"><h4>Actual issuer result:</h4><ReserveLiteral value={report.actualIssuerResult} /></div>
      <p className="text-muted-foreground">Null means no issuer cash bridge result, not zero electricity expense or cash impact. Regional observations and property rows are source findings, not a qualified issuer execution.</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><dt className="text-muted-foreground">Operating property rows</dt><dd><ReserveLiteral value={report.counts.operatingPropertyRows} /></dd></div>
        <div><dt className="text-muted-foreground">Construction property rows · not operating at source date</dt><dd><ReserveLiteral value={report.counts.constructionPropertyRows} /></dd></div>
        <div><dt className="text-muted-foreground">Regional context price records</dt><dd><ReserveLiteral value={report.counts.regionalPriceRecords} /></dd></div>
        <div><dt className="text-muted-foreground">Assumption values assigned to issuers · reported count, not an assumed input</dt><dd><ReserveLiteral value={report.assumptionValuesAssignedToIssuers} /></dd></div>
      </dl>
      <details><summary className="cursor-pointer font-medium">Exact coverage counts and qualification flags</summary>
        <div className="mt-3 space-y-3"><ReserveLiteral value={report.counts} />
          <ReserveLiteral value={{
            sourceQualifiedIssuerExecution: report.sourceQualifiedIssuerExecution,
            productionEligible: report.productionEligible, sourceApproval: report.sourceApproval,
            scientificAcceptance: report.scientificAcceptance,
          }} />
        </div>
      </details>
    </section>
    <section className="space-y-3">
      <h4 className="text-xs font-semibold">Sourced property register · FSLR · status at the disclosed period end</h4>
      <p className="text-xs text-muted-foreground">Property evidence is not site electricity consumption. Construction does not establish commissioning. No capacity-to-MWh conversion, Scope 2 conversion or company gross-up is made.</p>
      {!report.sourceFacts.operatingLocations.length ? <p role="status" className="text-xs text-muted-foreground">No property rows returned. No site or operating status substituted.</p> :
        report.sourceFacts.operatingLocations.map((row, index) => <section key={`${row.location}-${index}`} className="rounded-md border p-3 space-y-3 text-xs">
          <div className="space-y-1">
            <h5 className="font-semibold">{row.location}</h5>
            <p className="text-muted-foreground">{row.companyId} · Period end: {row.periodEnd}</p>
            <Badge variant={row.operatingStatus === "operating" ? "secondary" : "outline"}>{row.operatingStatus}</Badge>
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div><dt className="text-muted-foreground">Purchased electricity · MWh/year</dt><dd><ReserveLiteral value={row.purchasedElectricityMWh} /></dd></div>
            <div><dt className="text-muted-foreground">Supplier</dt><dd><ReserveLiteral value={row.supplier} /></dd></div>
            <div><dt className="text-muted-foreground">Tariff eligibility</dt><dd><ReserveLiteral value={row.tariffEligibility} /></dd></div>
            <div><dt className="text-muted-foreground">Customer recovery · fraction</dt><dd><ReserveLiteral value={row.customerRecoveryFraction} /></dd></div>
            <div><dt className="text-muted-foreground">Supplier payment · fraction</dt><dd><ReserveLiteral value={row.supplierPaymentFraction} /></dd></div>
            <div><dt className="text-muted-foreground">Customer collection · fraction</dt><dd><ReserveLiteral value={row.customerCollectionFraction} /></dd></div>
          </dl>
          <div>Issuer cash bridge executable: <ReserveLiteral value={row.issuerCashBridgeExecutable} /></div>
          <Source source={row.source} />
        </section>)}
    </section>
    <section className="space-y-3">
      <h4 className="text-xs font-semibold">EIA industrial prices · Ohio regional context only</h4>
      <p className="text-xs text-muted-foreground">These are nominal regional observations, not applicable issuer tariffs or same-year scenario prices for named sites. USD/MWh is the server's unit conversion, not a modeled cash result.</p>
      {!report.sourceFacts.contextualElectricityPrices.length ? <p role="status" className="text-xs text-muted-foreground">No regional price observations returned. No tariff, interpolation or zero price substituted.</p> :
        <div className="overflow-x-auto max-w-full rounded-md border" role="region" aria-label="Contextual industrial electricity prices" tabIndex={0}>
          <table className="w-full text-left text-xs">
            <caption className="p-3 text-left bg-muted/30">Reported US cents/kWh × 0.01 USD/cent × 1000 kWh/MWh = USD/MWh. Exact returned precision retained.</caption>
            <thead className="border-y bg-muted/20"><tr>
              <th scope="col" className="p-3">Delivery year / scope</th>
              <th scope="col" className="p-3">Reported observation</th>
              <th scope="col" className="p-3">Converted nominal context</th>
              <th scope="col" className="p-3">Provenance / limitations</th>
            </tr></thead>
            <tbody>{report.sourceFacts.contextualElectricityPrices.map(row => <tr className="border-b last:border-b-0 align-top" key={`${row.jurisdiction}-${row.year}`}>
              <th scope="row" className="p-3 min-w-32 font-medium">{row.year}<span className="block font-normal text-muted-foreground">{row.jurisdiction} · {row.sector}</span></th>
              <td className="p-3 min-w-32"><ReserveLiteral value={row.reportedValue} /><span className="block text-muted-foreground">{row.reportedUnit}</span></td>
              <td className="p-3 min-w-36"><ReserveLiteral value={row.nominalMajorCurrencyPerMWh} /><span className="block text-muted-foreground">{row.currency}/MWh · {row.kind}</span></td>
              <td className="p-3 min-w-64 space-y-2">
                <p className="font-mono">{row.conversion}</p>
                <div>Issuer tariff: <ReserveLiteral value={row.issuerTariff} /> · Applicable to named issuer site: <ReserveLiteral value={row.applicableToNamedIssuerSite} /></div>
                <Source source={row.source} />
              </td>
            </tr>)}</tbody>
          </table>
        </div>}
    </section>
    <DisclosureList title="Exact missing issuer inputs · no assumption values assigned as substitutes" items={report.missingIssuerInputs} />
    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-2">
      <h4 className="font-semibold">Optional companyProjection integration · not executed by this source report</h4>
      <p className="text-muted-foreground">The optional location-electricity bridge is wired into companyProjection, but complete admissible issuer inputs are still required. This report executes source projection and contextual unit conversion only; it does not execute an issuer cash bridge or companyProjection. Purchased-electricity prices are not a direct Scope 2 carbon tax.</p>
      <p>{report.boundary}</p>
    </div>
    <details className="rounded-md border text-xs [overflow-wrap:anywhere]">
      <summary className="cursor-pointer p-3 font-medium">Exact prospective identity and source protocol · read only</summary>
      <div className="border-t p-3 space-y-3">
        <p>{document.identity.claim}</p>
        <p className="text-muted-foreground">Server-supplied identity, not independent source authentication. Downloads are offered only after complete JSON or literal XLSX readback matches this response. No query pins, assumption tuning, historical archive selection or issuer override is supported.</p>
        <ReserveLiteral value={report.freeze} /><ReserveLiteral value={document.identity} />
      </div>
    </details>
  </div>;
}

export type LocationElectricityReadState = {
  data?: LocationElectricityDocument | null;
  isLoading: boolean; isFetching: boolean; isError: boolean;
  error?: Error | null; refetch: () => unknown;
};
export function LocationElectricityPanelContent({ state }: { state: LocationElectricityReadState }) {
  return <Card className="min-w-0 max-w-full p-4 sm:p-6 space-y-5" data-testid="location-electricity-panel">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2 items-center"><h2 className="text-base font-semibold">Location electricity source findings</h2><Badge variant="outline">Supplemental · Prospective</Badge></div>
        <p className="text-sm text-muted-foreground">Property evidence and regional price observations, with issuer economics explicitly unresolved.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Read only · Frozen protocols</Badge>
        {!state.isError && state.data && <Button size="sm" variant="outline" disabled={state.isLoading || state.isFetching}
          onClick={() => void state.refetch()}>Refresh electricity findings</Button>}
      </div>
    </div>
    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
      <Info className="h-4 w-4 shrink-0" /><p>Independent of the selected historical analysis archive and issuer presentation. Source findings are not qualified issuer execution, original historical availability, owner approval, scientific acceptance or a three-case acceptance claim.</p>
    </div>
    {state.isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 space-y-2" data-testid="location-electricity-error">
      <h3 className="text-sm font-medium">Location electricity findings unavailable</h3>
      <p className="text-xs text-muted-foreground">{state.error?.message ?? "The read-only service could not be loaded. No previous result or synthetic issuer case is substituted."}</p>
      <Button size="sm" variant="outline" disabled={state.isFetching} onClick={() => void state.refetch()}>Retry electricity findings</Button>
    </div> : state.isLoading || state.isFetching ? <div className="space-y-3" aria-busy="true" aria-label="Loading location electricity findings">
      <Skeleton className="h-9 w-52" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
    </div> : !state.data ? <div className="rounded-md border border-dashed p-6 space-y-1" role="status" data-testid="location-electricity-empty">
      <h3 className="text-sm font-medium">No location electricity report returned</h3>
      <p className="text-xs text-muted-foreground">An absent or null document is unavailable, not zero electricity use or expense. No producer reserve, private source or selected archive fallback is used. Exports are withheld.</p>
    </div> : <LocationElectricityReportView key={state.data.identity.id} document={state.data} />}
  </Card>;
}
export function LocationElectricityPanel() {
  const state = useLocationElectricity();
  return <LocationElectricityPanelContent state={state} />;
}

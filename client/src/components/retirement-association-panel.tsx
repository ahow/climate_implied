import { useState } from "react";
import { Download, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DisclosureList } from "@/components/company-conditional-summary";
import { ReserveLiteral } from "@/components/producer-reserve-panel";
import { useRetirementAssociation } from "@/hooks/use-retirement-association";
import { readBoundRetirementAssociationExport, type RetirementAssociationDocument } from "@/lib/retirement-association-reader";

function RetirementAssociationReportView({ document }: { document: RetirementAssociationDocument }) {
  const { report } = document;
  const [downloading, setDownloading] = useState<"json" | "xlsx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  async function download(format: "json" | "xlsx") {
    setDownloading(format);
    setDownloadError(null);
    try {
      const blob = await readBoundRetirementAssociationExport(document, format);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `supplemental-retirementAssociation-${document.identity.id}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Export refused; no fallback file offered.");
    } finally { setDownloading(null); }
  }
  return <div className="space-y-5 text-xs" data-testid="retirement-association-ready">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="space-y-1"><h3 className="text-sm font-semibold">{report.source.issuer} · {report.source.unit}</h3>
        <p className="text-muted-foreground">{report.source.site} · {report.source.fuel} · Fiscal end {report.source.fiscalEnd}</p></div>
      <div className="flex flex-wrap gap-2">{(["json", "xlsx"] as const).map(format =>
        <Button key={format} size="sm" variant="outline" disabled={downloading !== null} onClick={() => void download(format)}>
          <Download className="mr-2 h-3.5 w-3.5" />{downloading === format ? "Checking exact result…" : `Public ${format.toUpperCase()}`}
        </Button>)}</div>
    </div>
    {downloadError && <p role="alert" className="text-destructive">{downloadError} No file substituted. Refresh the report or retry the export.</p>}
    <section className="rounded-md border p-3 space-y-3" data-testid="retirement-association-partial">
      <h4 className="font-semibold">Calculated · source-defined book arithmetic only</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><dt className="text-muted-foreground">Owned book balance · USD million</dt><dd><ReserveLiteral value={report.calculated.ownedBookValueUsdMillion} /></dd>
          <dd className="text-muted-foreground">{report.source.ownedPlantInServiceUsdMillion} − {report.source.ownedAccumulatedDepreciationUsdMillion}; already issuer share. Ownership is not applied again.</dd></div>
        <div><dt className="text-muted-foreground">Capacity rounding residual · MW</dt><dd><ReserveLiteral value={report.calculated.capacityRoundingResidualMW} /></dd>
          <dd className="text-muted-foreground">{report.source.reportedOwnedMW} − {report.source.facilityNetMW} × {report.source.ownershipPercent}/100. Disclosure rounding, not a correction.</dd></div>
      </dl>
      <p className="text-muted-foreground">{report.calculated.claim}. Neither figure is recoverable cash, retirement loss or common-equity value.</p>
    </section>
    <section className="space-y-3">
      <h4 className="font-semibold">Input · disclosed source facts, not editable assumptions</h4>
      <ReserveLiteral value={report.source} />
      <a href={report.source.url} target="_blank" rel="noopener noreferrer" className="inline-block underline">Open source filing · {report.source.locator}</a>
      <p className="text-muted-foreground">Cover date {report.source.coverDate} is not a publication instant. Publication instant: null (not established). Source hash and locator are disclosed above; this browser does not independently authenticate the filing.</p>
    </section>
    <section className="rounded-md border p-3 space-y-3">
      <h4 className="font-semibold">Output · actual issuer execution unavailable</h4>
      <dl className="space-y-2">
        <div><dt>Retirement valuation</dt><dd><ReserveLiteral value={report.retirementResult} /></dd></div>
        <div><dt>Market-implied retirement</dt><dd><ReserveLiteral value={report.marketImpliedRetirement} /></dd></div>
        <div><dt>Association estimate</dt><dd><ReserveLiteral value={report.association.actualEstimate} /></dd></div>
        <div><dt>Qualified issuer case</dt><dd><ReserveLiteral value={report.qualifiedIssuerCase} /></dd></div>
        <div><dt>Actual association study executed</dt><dd><ReserveLiteral value={report.association.actualStudyExecuted} /></dd></div>
      </dl>
      <p className="text-muted-foreground">Null means unavailable, not zero valuation, zero association or no retirement. No issuer calculations are accepted by this public read-only report.</p>
    </section>
    <DisclosureList title="Missing retirement inputs · no zero-fills or issuer substitutes" items={report.missingRetirementInputs} />
    <section className="rounded-md border bg-muted/30 p-3 space-y-3">
      <h4 className="font-semibold">Offline conditional engine · separate from this public report</h4>
      <p className="text-muted-foreground">All report controls are read-only because actual issuer input execution is unavailable. The offline conditional engine requires explicit admissible inputs; its prospective methods are not executed issuer results here. There is no public input, override, run or acceptance action.</p>
      <ReserveLiteral value={report.assumptions} />
      <details><summary className="cursor-pointer font-medium">Declared formulas · not executed valuation outputs</summary>
        <div className="mt-3"><ReserveLiteral value={report.formulas} /></div></details>
    </section>
    <section className="space-y-3">
      <h4 className="font-semibold">Prospective association protocol · unscored</h4>
      <p className="text-muted-foreground">{report.association.basis}. {report.association.claim}.</p>
      <ReserveLiteral value={report.association} />
      <DisclosureList title="Missing association evidence" items={report.association.missing} />
    </section>
    <details className="rounded-md border [overflow-wrap:anywhere]">
      <summary className="cursor-pointer p-3 font-medium">Exact prospective identity · read only</summary>
      <div className="border-t p-3 space-y-3"><p>{document.identity.claim}</p>
        <p className="text-muted-foreground">Server-supplied identity, not independent authentication. JSON and literal XLSX downloads require complete readback equality with this response. No historical selection, query pins or arbitrary writes.</p>
        <ReserveLiteral value={document.identity} /></div>
    </details>
  </div>;
}

export type RetirementAssociationReadState = {
  data?: RetirementAssociationDocument | null;
  isLoading: boolean; isFetching: boolean; isError: boolean;
  error?: Error | null; refetch: () => unknown;
};
export function RetirementAssociationPanelContent({ state }: { state: RetirementAssociationReadState }) {
  return <Card className="min-w-0 max-w-full p-4 sm:p-6 space-y-5" data-testid="retirement-association-panel">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div className="space-y-1"><div className="flex flex-wrap gap-2 items-center">
        <h2 className="text-base font-semibold">Retirement and association source report</h2><Badge variant="outline">Supplemental · Prospective</Badge></div>
        <p className="text-sm text-muted-foreground">Coal-unit book arithmetic and unscored methods; actual valuation and association remain unresolved.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Read only · Frozen protocols</Badge>
        {!state.isError && state.data && <Button size="sm" variant="outline" disabled={state.isLoading || state.isFetching}
          onClick={() => void state.refetch()}>Refresh retirement report</Button>}</div>
    </div>
    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
      <Info className="h-4 w-4 shrink-0" /><p>Independent of the selected historical archive and issuer presentation. No market-implied retirement, issuer FCFE, causal inference, efficacy, source approval or scientific acceptance. Original 1001 and fixed prior matrix are unchanged.</p>
    </div>
    {state.isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 space-y-2" data-testid="retirement-association-error">
      <h3 className="text-sm font-medium">Retirement/association report unavailable</h3>
      <p className="text-xs text-muted-foreground">{state.error?.message ?? "The read-only service could not be loaded. No previous or synthetic result substituted."}</p>
      <Button size="sm" variant="outline" disabled={state.isFetching} onClick={() => void state.refetch()}>Retry retirement report</Button>
    </div> : state.isLoading || state.isFetching ? <div className="space-y-3" aria-busy="true" aria-label="Loading retirement and association report">
      <Skeleton className="h-9 w-52" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
    </div> : !state.data ? <div className="rounded-md border border-dashed p-6 space-y-1" role="status" data-testid="retirement-association-empty">
      <h3 className="text-sm font-medium">No retirement/association report returned</h3>
      <p className="text-xs text-muted-foreground">Absent or null document means unavailable, not zero book value or a completed study. No archive or other economic report fallback. Exports are withheld.</p>
    </div> : <RetirementAssociationReportView key={state.data.identity.id} document={state.data} />}
  </Card>;
}
export function RetirementAssociationPanel() {
  const state = useRetirementAssociation();
  return <RetirementAssociationPanelContent state={state} />;
}

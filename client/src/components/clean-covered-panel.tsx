import { useEffect, useRef, useState } from "react";
import { Download, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DisclosureList } from "@/components/company-conditional-summary";
import { ReserveLiteral } from "@/components/producer-reserve-panel";
import { useCleanCovered } from "@/hooks/use-clean-covered";
import { readBoundCleanCoveredExport, type CleanCoveredDocument } from "@/lib/clean-covered-reader";

function CleanCoveredReportView({ document }: { document: CleanCoveredDocument }) {
  const { report } = document;
  const [downloading, setDownloading] = useState<"json" | "xlsx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const current = useRef(true);
  const currentDocument = useRef(document);
  currentDocument.current = document;
  useEffect(() => {
    current.current = true;
    return () => { current.current = false; };
  }, []);
  async function download(format: "json" | "xlsx") {
    setDownloading(format);
    setDownloadError(null);
    try {
      const blob = await readBoundCleanCoveredExport(document, format);
      // A refresh or error can unmount this view during readback. Never offer
      // the old document's file after the currently consumed result changes.
      const url = URL.createObjectURL(blob);
      if (!current.current || currentDocument.current !== document) { URL.revokeObjectURL(url); return; }
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `supplemental-cleanCovered-${document.identity.id}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      if (current.current) setDownloadError(error instanceof Error ? error.message : "Export refused; no fallback file offered.");
    } finally { if (current.current) setDownloading(null); }
  }
  return <div className="space-y-5 text-xs [overflow-wrap:anywhere]" data-testid="clean-covered-ready">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="space-y-1"><h3 className="text-sm font-semibold">EPA eGRID2023 · metric revision 2</h3>
        <p className="text-muted-foreground">Wyodak · Unit BW91 · Generator 1 · ORIS 6101</p></div>
      <div className="flex flex-wrap gap-2">{(["json", "xlsx"] as const).map(format =>
        <Button key={format} size="sm" variant="outline" disabled={downloading !== null} onClick={() => void download(format)}>
          <Download className="mr-2 h-3.5 w-3.5" />{downloading === format ? "Checking exact result…" : `Public ${format.toUpperCase()}`}
        </Button>)}</div>
    </div>
    {downloadError && <p role="alert" className="text-destructive">{downloadError} No file substituted. Refresh the report or retry the export.</p>}
    <section className="space-y-3">
      <h4 className="font-semibold">Input · observed physical source facts, not editable assumptions</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><dt className="text-muted-foreground">2023 net generation · MWh</dt><dd><ReserveLiteral value={report.observed.generationMWh} /></dd></div>
        <div><dt className="text-muted-foreground">2023 native CO2 · metric tonnes</dt><dd><ReserveLiteral value={report.observed.co2Tonnes} /></dd></div>
      </dl>
      <ReserveLiteral value={report.source} />
      <a href={report.source.url} target="_blank" rel="noopener noreferrer" className="inline-block underline">Open EPA source</a>
      <p className="text-muted-foreground">Release day: {report.source.releaseDay}. Current capture bound: {report.source.captureBound}. The capture bound is not the original publication timestamp or publication history. This browser does not independently authenticate the source or verify a full archive.</p>
    </section>
    <section className="rounded-md border p-3 space-y-3" data-testid="clean-covered-calculated">
      <h4 className="font-semibold">Calculated · unit ratio and conditional 80% equity-share arithmetic</h4>
      <dl className="space-y-3">
        <div><dt>Calculated native intensity · tonnes CO2/MWh</dt><dd><ReserveLiteral value={report.calculated.nativeIntensityTonnesPerMWh} /></dd>
          <dd className="text-muted-foreground">{report.observed.co2Tonnes} ÷ {report.observed.generationMWh}. Observed reconstruction from source totals, not an independently observed intensity or independent validation.</dd></div>
        <div><dt>Conditional equity-share CO2 · tonnes</dt><dd><ReserveLiteral value={report.calculated.conditionalEquityShareCO2Tonnes} /></dd>
          <dd className="text-muted-foreground">{report.observed.co2Tonnes} × 0.8</dd></div>
        <div><dt>Conditional equity-share generation · MWh</dt><dd><ReserveLiteral value={report.calculated.conditionalEquityShareMWh} /></dd>
          <dd className="text-muted-foreground">{report.observed.generationMWh} × 0.8</dd></div>
      </dl>
      <p className="text-muted-foreground">Conditional accounting only; not an operational-control inventory, avoided emissions, forecast, market inference, owner acceptance or a qualified company case.</p>
      <details><summary className="cursor-pointer font-medium">Source comparisons · boundary and rounding differences, not corrections</summary>
        <dl className="mt-3 space-y-3">
          <div><dt>Unit minus plant CO2 · tonnes</dt><dd><ReserveLiteral value={report.calculated.unitPlantCO2Difference} /></dd></div>
          <div><dt>Generator minus plant generation · MWh</dt><dd><ReserveLiteral value={report.calculated.generatorPlantMWhDifference} /></dd></div>
          <div><dt>Reconstructed minus reported rate · kg CO2/MWh</dt><dd><ReserveLiteral value={report.calculated.reportedRateDifferenceKgPerMWh} /></dd>
            <dd className="text-muted-foreground">Native intensity × 1000 − source-reported rounded rate. Neither rate is tuned.</dd></div>
          <div><dt>GHGRP facility minus electricity-unit CO2 · tonnes</dt><dd><ReserveLiteral value={report.calculated.facilityMinusElectricityUnitCO2Tonnes} /></dd>
            <dd className="text-muted-foreground">Different facility/electricity-unit boundaries; the difference is not forced closed. AR4 CO2e is not native CO2 mass.</dd></div>
        </dl></details>
    </section>
    <section className="space-y-3">
      <h4 className="font-semibold">Covered physical scenarios and ranges · read-only source context</h4>
      <p className="text-muted-foreground">One provisional source case, not the accepted full-workbook covered universe. One declared accounting case is not a statistical uncertainty interval or an accepted physical ensemble.</p>
      <ReserveLiteral value={report.covered.scenarios} />
      <ReserveLiteral value={report.covered.ranges} />
      <p className="text-muted-foreground">{report.covered.expansionReason}. Global expansion remains null; no covered-to-global extrapolation is performed.</p>
      <p className="text-muted-foreground">Scenario and range labels do not establish a company forecast or scientific acceptance.</p>
    </section>
    <section className="rounded-md border p-3 space-y-3" data-testid="clean-covered-stage7">
      <h4 className="font-semibold">Stage 7 · four measures separately unavailable</h4>
      <p className="text-muted-foreground">{report.covered.stage7.reason}</p>
      <dl className="space-y-3">
        <div><dt>Warming in 2100 · unavailable</dt><dd><ReserveLiteral value={report.covered.stage7.warming2100} /></dd></div>
        <div><dt>Net-zero years · unavailable</dt><dd><ReserveLiteral value={report.covered.stage7.netZeroYears} /></dd></div>
        <div><dt>Probability of net zero by 2050 · unavailable</dt><dd><ReserveLiteral value={report.covered.stage7.probabilityNetZero2050} /></dd></div>
        <div><dt>Reduction rates · unavailable</dt><dd><ReserveLiteral value={report.covered.stage7.reductionRates} /></dd></div>
      </dl>
      <div>Scientific acceptance: <ReserveLiteral value={report.covered.scientificAcceptance} /></div>
    </section>
    <section className="rounded-md border bg-muted/30 p-3 space-y-3" data-testid="clean-covered-manufacturing">
      <h4 className="font-semibold">Clean manufacturing · actual economics unavailable</h4>
      <p className="text-muted-foreground">{report.manufacturing.reason}</p>
      <DisclosureList title="Products · source context, not qualified company cases" items={report.manufacturing.products} />
      <dl><dt>Actual manufacturing result · {report.manufacturing.status}</dt><dd><ReserveLiteral value={report.manufacturing.actualResult} /></dd></dl>
      <p className="text-muted-foreground">Null means unavailable, not zero economics. No invented, editable or source-approved manufacturing values. No public input, override, run or acceptance action.</p>
    </section>
    <DisclosureList title="Claims and boundaries" items={report.claims} />
    <DisclosureList title="Limitations · no unavailable inference filled" items={report.limitations} />
    <details className="rounded-md border">
      <summary className="cursor-pointer p-3 font-medium">Exact prospective identity · read only</summary>
      <div className="border-t p-3 space-y-3"><p>{document.identity.claim}</p>
        <p className="text-muted-foreground">Runtime source and parent identity are supplied by the server, never UI state. JSON and literal XLSX require complete readback equality with this response, not full-archive verification or source approval. No historical selection, query pins or arbitrary writes.</p>
        <ReserveLiteral value={document.identity} /></div>
    </details>
  </div>;
}

export type CleanCoveredReadState = {
  data?: CleanCoveredDocument | null;
  isLoading: boolean; isFetching: boolean; isError: boolean;
  error?: Error | null; refetch: () => unknown;
};
export function CleanCoveredPanelContent({ state }: { state: CleanCoveredReadState }) {
  return <Card className="min-w-0 max-w-full p-4 sm:p-6 space-y-5" data-testid="clean-covered-panel">
    <div className="flex flex-wrap justify-between items-start gap-3">
      <div className="space-y-1"><div className="flex flex-wrap gap-2 items-center">
        <h2 className="text-base font-semibold">Clean manufacturing and covered physical source report</h2><Badge variant="outline">Supplemental · Prospective</Badge></div>
        <p className="text-sm text-muted-foreground">Observed source facts, conditional accounting and unavailable inference remain separate.</p></div>
      <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">Read only · Source inputs</Badge>
        {!state.isError && state.data && <Button size="sm" variant="outline" disabled={state.isLoading || state.isFetching}
          onClick={() => void state.refetch()}>Refresh clean/covered report</Button>}</div>
    </div>
    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
      <Info className="h-4 w-4 shrink-0" /><p>Independent of the selected historical archive and issuer presentation. No market inference, owner acceptance, source approval or scientific acceptance. Original 1001 and fixed prior matrix are unchanged.</p>
    </div>
    {state.isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 space-y-2" data-testid="clean-covered-error">
      <h3 className="text-sm font-medium">Clean/covered report unavailable</h3>
      <p className="text-xs text-muted-foreground">{state.error?.message ?? "The read-only service could not be loaded. No previous or synthetic result substituted."}</p>
      <Button size="sm" variant="outline" disabled={state.isFetching} onClick={() => void state.refetch()}>Retry clean/covered report</Button>
    </div> : state.isLoading || state.isFetching ? <div className="space-y-3" aria-busy="true" aria-label="Loading clean manufacturing and covered physical report">
      <Skeleton className="h-9 w-52" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
    </div> : !state.data ? <div className="rounded-md border border-dashed p-6 space-y-1" role="status" data-testid="clean-covered-empty">
      <h3 className="text-sm font-medium">No clean/covered report returned</h3>
      <p className="text-xs text-muted-foreground">Absent or null document means unavailable, not zero physical output or completed manufacturing economics. No archive or other report fallback. Exports are withheld.</p>
    </div> : <CleanCoveredReportView key={state.data.identity.id} document={state.data} />}
  </Card>;
}
export function CleanCoveredPanel() {
  const state = useCleanCovered();
  return <CleanCoveredPanelContent state={state} />;
}

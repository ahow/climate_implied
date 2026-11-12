import { useState, type ReactNode } from "react";
import { Download, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DisclosureList } from "@/components/company-conditional-summary";
import { useProducerReserve } from "@/hooks/use-producer-reserve";
import { readBoundProducerReserveExport, type ProducerReserveDocument } from "@/lib/producer-reserve-reader";
import type { ProducerReserveSolve, ProducerReserveYear } from "@shared/producerReserveSchema";

export function ReserveLiteral({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">Unknown (null)</span>;
  if (value === undefined) return <span className="text-muted-foreground">Unavailable — not returned</span>;
  if (typeof value === "number") return <span className="font-mono tabular-nums">{Number.isFinite(value) ? String(value) : "Unavailable — nonfinite value"}</span>;
  if (typeof value === "string" || typeof value === "boolean") return <span>{String(value)}</span>;
  if (Array.isArray(value)) return value.length
    ? <ol className="list-decimal pl-4 space-y-2">{value.map((item, index) => <li key={index}><ReserveLiteral value={item} /></li>)}</ol>
    : <span className="text-muted-foreground">No entries returned (empty array)</span>;
  if (typeof value === "object") return <dl className="space-y-2">{Object.entries(value).map(([key, item]) =>
    <div key={key} className="border-l pl-3"><dt className="font-medium">{key}</dt><dd className="mt-1 text-muted-foreground"><ReserveLiteral value={item} /></dd></div>)}</dl>;
  return <span>Unavailable — unsupported field</span>;
}
function Disclosure({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="rounded-md border min-w-0" open={open}>
    <summary className="cursor-pointer px-3 py-3 text-sm font-medium">{title}</summary>
    <div className="border-t p-3 text-xs space-y-3 [overflow-wrap:anywhere]">{children}</div>
  </details>;
}
function Result({ result }: { result: ProducerReserveSolve }) {
  return <div className="space-y-2 text-xs">
    <p className="font-medium">{result.status}</p>
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <div><dt className="text-muted-foreground">Conditional decline · fraction/year, not market-implied</dt><dd><ReserveLiteral value={result.decline} /></dd></div>
      <div><dt className="text-muted-foreground">PV residual · USD million</dt><dd><ReserveLiteral value={result.residualUsdMillion} /></dd></div>
    </dl>
    <p>{result.reason}</p>
    <div className="text-muted-foreground">Iterations: <ReserveLiteral value={result.iterations} /> · Roots: <ReserveLiteral value={result.roots} /></div>
    <p className="text-muted-foreground break-all">Frozen domain hash: <code>{result.domainHash}</code></p>
  </div>;
}
const annualColumns: { key: keyof ProducerReserveYear; label: string; unit: string }[] = [
  { key: "year", label: "Year", unit: "calendar year" },
  { key: "openingReserves", label: "Opening reserves", unit: "million boe" },
  { key: "production", label: "Production", unit: "million boe/year" },
  { key: "replacement", label: "Replacement · conditional", unit: "million boe/year" },
  { key: "closingReserves", label: "Closing reserves", unit: "million boe" },
  { key: "revenue", label: "Revenue", unit: "USD million/year" },
  { key: "productionCostsIncludingAbandonment", label: "Production + abandonment costs", unit: "USD million/year" },
  { key: "developmentCapex", label: "Development capex", unit: "USD million/year" },
  { key: "cashTaxes", label: "Cash taxes", unit: "USD million/year" },
  { key: "deltaWorkingCapital", label: "Δ working capital · conditional", unit: "USD million/year" },
  { key: "unleveredCashFlow", label: "Conditional unlevered cash flow", unit: "USD million/year" },
  { key: "discountedCashFlow", label: "Discounted cash flow", unit: "USD million" },
];

function ProducerReserveReportView({ document }: { document: ProducerReserveDocument }) {
  const report = document.report;
  const sourceArtifactValue = document.identity.sourceArtifact.value;
  const primaryAuthentication = sourceArtifactValue && typeof sourceArtifactValue === "object"
    && !Array.isArray(sourceArtifactValue)
    ? (sourceArtifactValue as Record<string, unknown>).primaryAuthentication : undefined;
  const [downloading, setDownloading] = useState<"json" | "xlsx" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  async function download(format: "json" | "xlsx") {
    setDownloading(format);
    setDownloadError(null);
    try {
      const blob = await readBoundProducerReserveExport(document, format);
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = `supplemental-producerReserve-${document.identity.id}.${format}`;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Export refused; no fallback file offered.");
    } finally { setDownloading(null); }
  }
  return <div className="space-y-5" data-testid="producer-reserve-ready">
    <div className="flex flex-wrap justify-between gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">{report.title}</h3>
        <p className="text-xs text-muted-foreground">{report.entity} · Valuation date: {report.valuationDate}</p>
        <p className="text-xs text-muted-foreground">{report.label}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["json", "xlsx"] as const).map(format => <Button key={format} size="sm" variant="outline"
          disabled={downloading !== null} onClick={() => void download(format)}>
          <Download className="mr-2 h-3.5 w-3.5" />{downloading === format ? "Checking exact result…" : `Public ${format.toUpperCase()}`}
        </Button>)}
      </div>
    </div>
    {downloadError && <p role="alert" className="text-xs text-destructive">{downloadError} No file substituted. Retry the export or refresh the result.</p>}
    <p className="text-xs text-muted-foreground">Scope: {report.calculationBasis}<br />Money: {report.moneyUnit} · Physical stocks: {report.physicalUnit}. Exact returned numeric precision is retained; no zero-fill or client-side solver.</p>
    <section className="rounded-md border p-3 space-y-3 text-xs [overflow-wrap:anywhere]" data-testid="producer-primary-authentication">
      <h4 className="font-semibold">Current primary-source assessment · supplemental to the frozen report</h4>
      {primaryAuthentication === undefined || primaryAuthentication === null
        ? <p role="status" className="text-muted-foreground">Current primary authentication was not returned with this response. No completed authentication, SEC acceptance timestamp or approval is inferred.</p>
        : <ReserveLiteral value={primaryAuthentication} />}
      <p className="text-muted-foreground">This current assessment is returned in identity.sourceArtifact.value.primaryAuthentication. The unchanged original report's source register and gaps below are declaration-time records, not a substitute for this current assessment. Primary-source table authentication and a filing acceptance timestamp do not establish market-implied decline, successor-security continuity, owner approval, scientific acceptance or a qualified issuer case. They do not change the frozen model, domain, numerical inputs or solved roots.</p>
    </section>
    <section className="rounded-md border p-3 space-y-3">
      <h4 className="text-xs font-semibold">Computed base · finite disclosed-reserve PV10 diagnostic only</h4>
      <Result result={report.baseResult} />
      <div className="border-t pt-3"><ReserveLiteral value={{ marketEquityTarget: report.marketEquityTarget, marketImpliedDecline: report.marketImpliedDecline, fcfe: report.fcfe }} /></div>
      <p className="text-xs text-muted-foreground">These nulls are unavailable market/equity claims, not observed zeros. No whole-equity valuation, FCFE, owner approval, scientific acceptance or three-case acceptance is established.</p>
    </section>
    <Disclosure title="Sourced inputs · original frozen-report source register, scope, period and provenance">
      <p className="text-muted-foreground">Original source declarations are preserved verbatim. Read the current primary-source assessment above separately; later source authentication does not rewrite the frozen model's original provenance record.</p>
      {report.sourceRegister.length ? report.sourceRegister.map(source => <section key={source.id} className="border-b last:border-b-0 pb-3 space-y-2">
        <h4 className="font-semibold">{source.id} · {source.entity}</h4>
        <p>{source.scope} · Period: {source.period} · Units: {source.unit}</p>
        <p>Document date: {source.documentDate} ({source.documentDateBasis}) · Retained at: {source.retainedAt}</p>
        <p>Locator: {source.locator}</p>
        <p>Source URL: {/^(https?):\/\//.test(source.url) ? <a className="underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a> : source.url}</p>
        <p>PDF SHA-256: <code>{source.pdfSha256}</code><br />Text SHA-256: <code>{source.textSha256}</code></p>
      </section>) : <p>No source register returned. This does not authenticate the inputs.</p>}
      <h4 className="font-semibold">Historical measurements and derived reconciliations · exact server field names</h4>
      <p className="text-muted-foreground">Read units and caveats with each aggregate. Commodity production × price proxies are derived diagnostics, not observed sales or reserve-model inputs. Costs incurred are not cash capex.</p>
      <ReserveLiteral value={report.historical} />
    </Disclosure>
    <Disclosure title="Conditional assumptions · frozen, not observed or editable">
      {report.assumptionRegister.length ? report.assumptionRegister.map(assumption => <section key={assumption.id} className="space-y-1 border-b last:border-b-0 pb-2">
        <h4 className="font-semibold">{assumption.id} · {assumption.status}</h4>
        <ReserveLiteral value={assumption.value} /><p className="text-muted-foreground">{assumption.justification}</p>
      </section>) : <p>No assumptions returned; absence does not establish an assumption-free model.</p>}
    </Disclosure>
    <Disclosure title="Target, formulas and cash / reserve reconciliation">
      <ReserveLiteral value={report.target} />
      <section className="space-y-2">
        <h4 className="font-semibold">Conditional mapping · not the issuer's production schedule</h4>
        <p>R₀ = disclosed closing reserves; Q₀ = disclosed annual reserve depletion (positive magnitude); d = conditional decline fraction; r = frozen discount fraction; t = modeled annual step; H = frozen horizon.</p>
        <p className="font-mono">Qₜ = min(Rₜ₋₁, Q₀ × (1 − d)^(t − 1)); Rₜ = Rₜ₋₁ − Qₜ; additions = 0 (conditional).</p>
        <p>Reserve quantities are million boe; Qₜ is annual production in million boe/year. Fraction produced = Qₜ / R₀.</p>
        <p className="font-mono">Revenueₜ = (Qₜ / R₀) × disclosed future inflows × revenue multiplier.</p>
        <p>Production/abandonment and development cash = fraction produced × corresponding disclosed future total × cost multiplier. Cash tax = fraction produced × disclosed future income tax; no marginal price-responsive tax model.</p>
        <p className="font-mono">FCFFₜ = Revenueₜ − Production/abandonmentₜ − Developmentₜ − CashTaxₜ − ΔWCₜ.</p>
        <p className="font-mono">PV = Σ[t=1…H] FCFFₜ / (1 + r)^t; terminal value = 0 (conditional).</p>
        <p>Annual cash is USD million/year; discounted cash and PV are USD million. Replacement, ΔWC and terminal zeros are assumptions, never measurements. Solve PV(d) = disclosed reserve PV10 only within the frozen domain.</p>
      </section>
      <ReserveLiteral value={report.reconciliation} />
    </Disclosure>
    <Disclosure title={`Annual conditional cash and reserve path · ${report.annualRows.length} returned rows`}>
      {!report.annualRows.length ? <p role="status">Annual path unavailable — no rows returned. No trajectory or zero cash flow substituted.</p> :
        <div className="max-w-full overflow-x-auto" role="region" aria-label="Annual cash and reserve path" tabIndex={0}>
          <table className="w-full text-left text-xs">
            <caption className="text-left pb-3">Conditional projection, not observed annual cash. All returned years shown at exact numeric precision.</caption>
            <thead className="border-y bg-muted/20"><tr>{annualColumns.map(column => <th key={column.key} scope="col" className="p-3 min-w-36 font-medium">{column.label}<span className="block text-muted-foreground font-normal">{column.unit}</span></th>)}</tr></thead>
            <tbody>{report.annualRows.map(row => <tr key={row.year} className="border-b last:border-b-0">{annualColumns.map(column =>
              <td className="p-3 align-top" key={column.key}><ReserveLiteral value={row[column.key]} /></td>)}</tr>)}</tbody>
          </table>
        </div>}
    </Disclosure>
    <Disclosure title={`Computed sensitivities · ${report.sensitivityRows.length} frozen cases, not probability ranges`}>
      {!report.sensitivityRows.length ? <p>No sensitivity cases returned. No base result substituted.</p> :
        report.sensitivityRows.map(row => <section key={row.id} className="space-y-2 border-b last:border-b-0 pb-3">
          <h4 className="font-semibold">{row.id}</h4>
          <div>Discount rate (fraction/year): <ReserveLiteral value={row.discountRate} /> · Revenue multiplier: <ReserveLiteral value={row.revenueMultiplier} /> · Cost multiplier: <ReserveLiteral value={row.costMultiplier} /></div>
          <div>PV at zero decline: <ReserveLiteral value={row.valueAtZeroDecline} /> USD million · PV at frozen maximum decline: <ReserveLiteral value={row.valueAtMaximumDecline} /> USD million</div>
          <Result result={row.result} />
        </section>)}
    </Disclosure>
    <Disclosure title="Refusals and unresolved source fields" open>
      {report.refusalRows.length ? report.refusalRows.map((row, index) => <section key={index} className="border-b last:border-b-0 pb-3"><Result result={row} /></section>) : <p>No refusal rows returned; no acceptance inferred.</p>}
      <DisclosureList title="Original frozen-report source gaps · declaration-time record, not current primary-authentication status" items={report.sourceGaps} />
      <DisclosureList title="Independent validation still required" items={report.privateValidationRequired} />
      <DisclosureList title="Preserved protocols and boundaries" items={report.preservation} />
    </Disclosure>
    <Disclosure title="Exact prospective response identity · not retained historical execution">
      <p>{document.identity.claim}</p>
      <p>Identity is supplied by the server, not independently authenticated by this display. Export readback compares the complete current response, including all identity fields. No archive, issuer, assumption or query-pin overrides are supported by this endpoint.</p>
      <ReserveLiteral value={document.identity} />
      <h4 className="font-semibold">Worker-declared hashes</h4><ReserveLiteral value={report.hashes} />
    </Disclosure>
  </div>;
}

export type ProducerReserveReadState = {
  data?: ProducerReserveDocument | null;
  isLoading: boolean; isError: boolean; isFetching: boolean; error?: Error | null;
  refetch: () => unknown;
};
export function ProducerReservePanelContent({ state }: { state: ProducerReserveReadState }) {
  return <Card className="min-w-0 max-w-full p-4 sm:p-6 space-y-5" data-testid="producer-reserve-panel">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold">Producer reserve diagnostic</h2><Badge variant="outline">Supplemental · Prospective</Badge></div>
        <p className="text-sm text-muted-foreground">Sourced reserve disclosures, conditional calculations and unavailable market claims remain separate.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Read only · Frozen protocols</Badge>
        {!state.isError && state.data && <Button size="sm" variant="outline" disabled={state.isFetching || state.isLoading}
          onClick={() => void state.refetch()}>Refresh producer result</Button>}
      </div>
    </div>
    <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
      <Info className="h-4 w-4 shrink-0" /><p>Independent of the selected historical analysis archive and issuer presentation above. This finite disclosed-reserve PV10 diagnostic is not whole-equity valuation, FCFE or market-implied decline. No source approval, scientific acceptance or qualified three-case claim.</p>
    </div>
    {state.isError ? <div role="alert" className="rounded-md border border-destructive/30 p-4 space-y-2" data-testid="producer-reserve-error">
      <h3 className="text-sm font-medium">Producer reserve result unavailable</h3>
      <p className="text-xs text-muted-foreground">{state.error?.message ?? "The read-only service could not be loaded. No prior result or synthetic calculation is substituted."}</p>
      <Button size="sm" variant="outline" disabled={state.isFetching} onClick={() => void state.refetch()}>Retry producer result</Button>
    </div> : state.isLoading || state.isFetching ? <div className="space-y-3" aria-label="Loading producer reserve calculation" aria-busy="true">
      <Skeleton className="h-9 w-52" /><Skeleton className="h-24 w-full" /><Skeleton className="h-40 w-full" />
    </div> : !state.data ? <div className="rounded-md border border-dashed p-6 space-y-1" role="status" data-testid="producer-reserve-empty">
      <h3 className="text-sm font-medium">No producer reserve report returned</h3>
      <p className="text-xs text-muted-foreground">An absent or null result is unavailable, not zero. No private evidence, historical archive or issuer-summary fallback is used. Exports are withheld.</p>
    </div> : <ProducerReserveReportView key={state.data.identity.id} document={state.data} />}
  </Card>;
}
export function ProducerReservePanel() {
  const state = useProducerReserve();
  return <ProducerReservePanelContent state={state} />;
}

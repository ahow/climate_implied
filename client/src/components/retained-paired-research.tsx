import React from "react";
import { useReadQuery } from "@/lib/use-read-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchRetainedPairedCatalog, fetchRetainedPairedReport, RETAINED_PAIRED_REPORT_ENDPOINT,
} from "./retained-paired-research-reader";
import {
  retainedPairedCatalogSchema, retainedPairedPinKey, retainedPairedReportSchema,
  type RetainedPairedCatalog, type RetainedPairedReport, type RetainedPairedSection,
} from "./retained-paired-research-contract";

type Read<T> = { loading?: boolean; error?: string; data?: T };
export type RetainedPairedResearchReadState = {
  catalog: Read<RetainedPairedCatalog>;
  selectedKey?: string;
  report?: Read<RetainedPairedReport>;
};

function ReportSkeleton({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-muted motion-reduce:animate-none ${className}`} />;
}

function EvidenceSection({ title, section }: { title: string; section: RetainedPairedSection }) {
  return <section className="border rounded-md p-3 space-y-2">
    <h4 className="text-sm font-semibold">{title}</h4>
    {section.status === "unavailable" ? <p className="text-xs text-muted-foreground">
      <strong>Unavailable:</strong> {section.reason}
    </p> : <>
      <p className="text-xs font-medium">{section.label}</p>
      {section.metrics.length > 0 && <dl className="space-y-2 text-xs">
        {section.metrics.map((metric, index) => <div key={`${metric.label}-${index}`}>
          <dt className="text-muted-foreground">{metric.label}</dt>
          <dd className="font-medium tabular-nums">{String(metric.value)} {metric.unit}</dd>
          <dd className="text-muted-foreground">{metric.qualification}</dd>
        </div>)}
      </dl>}
      <ul className="text-xs text-muted-foreground space-y-1">
        {section.notes.map((note, index) => <li key={index}>{note}</li>)}
      </ul>
    </>}
  </section>;
}

export function RetainedPairedResearchReport({ report }: { report: RetainedPairedReport }) {
  const p = report.protocol;
  return <div className="space-y-4" data-testid="retained-paired-report">
    <div className="rounded-md border p-3 space-y-1 text-sm">
      <p className="font-semibold">{report.disclosure}</p>
      <p className="text-xs text-muted-foreground">
        {report.classification === "engineering-fixture"
          ? "Engineering fixture only. Synthetic data and synthetic publication controls are not actual research evidence."
          : "Retained research. Public availability does not authenticate source vintages or establish historical efficacy."}
      </p>
      <p className="text-xs">Efficacy: {report.efficacy}. Scientific acceptance: false.
        Investment evidence: false. Authenticity verified: false.</p>
    </div>
    <section className="space-y-2" aria-label="Frozen protocol">
      <h3 className="text-sm font-semibold">Frozen protocol and prior exposure</h3>
      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
        <div><dt className="text-muted-foreground">Evidence mode</dt><dd>{p.evidenceMode}</dd></div>
        <div><dt className="text-muted-foreground">Frozen at</dt><dd>{p.frozenAt}</dd></div>
        <div><dt className="text-muted-foreground">Evaluation boundary</dt><dd>{p.evaluationStart} to {p.evaluationEnd}</dd></div>
        <div><dt className="text-muted-foreground">Population and currency</dt><dd>{p.geography} · {p.currency}</dd></div>
        <div><dt className="text-muted-foreground">Declared weighting and costs</dt><dd>{p.weighting} · {p.costBps} bps per traded dollar</dd></div>
        <div><dt className="text-muted-foreground">Inference protocol</dt><dd>{p.embargoDays} embargo days · {p.blockLength} date blocks · {p.repetitions} repetitions · seed {p.seed}</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Primary endpoints: {p.primaryEndpoints.join(", ")}.
        Long-only accounting is not the after-cost long-short endpoint. No intensity proxy or legacy backtest is substituted.</p>
      <details className="text-xs border rounded-md p-3">
        <summary className="cursor-pointer font-medium">Frozen expected origins ({p.expectedOrigins.length})</summary>
        <ul className="mt-2 space-y-1">{p.expectedOrigins.map((origin, index) => <li key={`${origin}-${index}`}>{origin}</li>)}</ul>
      </details>
    </section>
    <section className="space-y-2" aria-label="Evidence tracks">
      <h3 className="text-sm font-semibold">Evidence tracks</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <EvidenceSection title="Track A · revised history" section={report.tracks.A} />
        <EvidenceSection title="Track B · original-vintage admission" section={report.tracks.B} />
      </div>
      <EvidenceSection title="Prospective archive · independently retained live signals" section={report.tracks.prospective} />
    </section>
    {report.specifications.map((spec, index) => <section key={`${spec.model}-${spec.peer}-${spec.target}-${index}`}
      className="space-y-3 border-t pt-4" aria-label={`Specification ${spec.model} ${spec.peer} ${spec.target}`}>
      <div>
        <h3 className="text-sm font-semibold">{spec.model} · {spec.peer} · {spec.target}</h3>
        <p className="text-xs text-muted-foreground">{spec.originCount} retained origin periods · {spec.trainingDates} training dates · {spec.evaluationDates} evaluation dates.
          Counts do not establish complete or authenticated coverage.</p>
      </div>
      {spec.missing.length > 0 && <section className="text-xs space-y-1">
        <h4 className="font-medium">Exact missing-data reasons</h4>
        <ul className="space-y-1">{spec.missing.map((reason, i) => <li key={i}>{reason}</li>)}</ul>
      </section>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <EvidenceSection title="Long-only · separate tilt-kernel accounting" section={spec.longOnly} />
        <EvidenceSection title="Long-short · explicit cash and borrowing ledger" section={spec.longShort} />
        <EvidenceSection title="Evaluation R² · controls comparison" section={spec.endpoints["evaluation-r2"]} />
        <EvidenceSection title="Signal IC · sector-relative outcomes" section={spec.endpoints["signal-ic"]} />
      </div>
      <EvidenceSection title="Primary after-cost long-short endpoint" section={spec.endpoints["after-cost-long-short"]} />
      <EvidenceSection title="Factor-adjusted evidence · dated, currency/geography-bound factors" section={spec.factorAdjusted} />
      <EvidenceSection title="Robustness · cost, borrow, terminal and ablation checks" section={spec.robustness} />
    </section>)}
    <details className="border rounded-md p-3 text-xs space-y-2">
      <summary className="font-medium cursor-pointer">Retained origin, source and code context</summary>
      <p className="text-muted-foreground">These are retained content identities, not authentication or redistribution approval.
        Null dates remain unavailable; no date or vintage is backfilled.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <caption className="text-left py-2 font-medium">Exact origin domain ({report.originDomain.length})</caption>
          <thead><tr className="border-b text-muted-foreground">
            {["Specification", "Origin", "Information cutoff", "Execution", "Holding end", "Missing reasons"].map(label =>
              <th key={label} className="py-2 pr-3 font-medium">{label}</th>)}
          </tr></thead>
          <tbody>{report.originDomain.map((origin, index) => <tr className="border-b" key={index}>
            <td className="py-2 pr-3">{origin.specification}</td><td className="py-2 pr-3">{origin.origin}</td>
            <td className="py-2 pr-3">{origin.informationCutoff ?? "Unavailable (null)"}</td>
            <td className="py-2 pr-3">{origin.executionAt ?? "Unavailable (null)"}</td>
            <td className="py-2 pr-3">{origin.endAt ?? "Unavailable (null)"}</td>
            <td className="py-2 pr-3">{origin.missingReasons.length ? origin.missingReasons.join("; ") : "No missing reason recorded; not independent verification"}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <h4 className="font-semibold pt-2">Source context</h4>
      <p>{report.sourceContext.qualification}</p>
      {report.sourceContext.sources.map((source, index) => <dl key={index} className="break-all border-t pt-2 space-y-1">
        <div><dt className="text-muted-foreground">Source SHA256</dt><dd className="font-mono">{source.hash}</dd></div>
        <div><dt className="text-muted-foreground">Vintage / available / captured</dt>
          <dd>{source.vintage} · {source.availableAt} · {source.capturedAt}</dd></div>
      </dl>)}
      {report.sourceContext.missingReasons.map((reason, i) => <p key={i}>Unavailable: {reason}</p>)}
      <h4 className="font-semibold pt-2">Code context</h4>
      <p>{report.codeContext.qualification}</p>
      {report.codeContext.entries.map((entry, index) => <dl key={index} className="break-all border-t pt-2">
        <dt>{entry.module}</dt><dd className="font-mono">{entry.hash}</dd>
      </dl>)}
      {report.codeContext.missingReasons.map((reason, i) => <p key={i}>Unavailable: {reason}</p>)}
    </details>
    <section className="text-xs text-muted-foreground space-y-1">
      <h3 className="font-semibold text-foreground">Remaining evidence limitations</h3>
      <ul className="space-y-1">{report.limitations.map((limitation, i) => <li key={i}>{limitation}</li>)}</ul>
    </section>
  </div>;
}

/** Place once on the existing backtest/research page, outside dataset guards.
 * No connection to the legacy backtest response or its producer download chain.
 * readState is solely a bounded render-test seam; production uses genuine reads.
 */
export function RetainedPairedResearch({ readState }: { readState?: RetainedPairedResearchReadState }) {
  const [selectedKey, setSelectedKey] = React.useState("");
  const catalogQuery = useReadQuery<RetainedPairedCatalog>({
    queryKey: [`${RETAINED_PAIRED_REPORT_ENDPOINT}/catalog`],
    queryFn: ({ signal }) => fetchRetainedPairedCatalog(undefined, signal),
    enabled: !readState, retry: false,
  });
  const catalogState = readState?.catalog ?? {
    loading: catalogQuery.isLoading, error: catalogQuery.error?.message, data: catalogQuery.data,
  };
  const parsedCatalog = retainedPairedCatalogSchema.safeParse(catalogState.data);
  const catalog = !catalogState.loading && !catalogState.error && parsedCatalog.success ? parsedCatalog.data : undefined;
  const pin = catalog?.reports.find(item => retainedPairedPinKey(item) === (readState?.selectedKey ?? selectedKey));
  const reportQuery = useReadQuery<RetainedPairedReport>({
    queryKey: [RETAINED_PAIRED_REPORT_ENDPOINT, pin ? retainedPairedPinKey(pin) : null],
    queryFn: ({ signal }) => {
      if (!pin) throw new Error("Select an exact authorized retained report.");
      return fetchRetainedPairedReport(pin, undefined, signal);
    },
    enabled: !readState && !!pin, retry: false,
  });
  const reportState = readState ? readState.report ?? {} : {
    loading: reportQuery.isLoading, error: reportQuery.error?.message, data: reportQuery.data,
  };
  const parsedReport = retainedPairedReportSchema.safeParse(reportState.data);
  const report = pin && !reportState.loading && !reportState.error && parsedReport.success &&
    parsedReport.data.protocolHash === pin.protocolHash && parsedReport.data.pipelineResultHash === pin.pipelineResultHash &&
    parsedReport.data.corpusHash === pin.corpusHash ? parsedReport.data : undefined;
  return <Card className="p-4 space-y-4" data-testid="retained-paired-research">
    <header className="space-y-1">
      <h2 className="text-base font-semibold">Retained paired-research report</h2>
      <p className="text-xs text-muted-foreground">Evidence-first report reader, separate from legacy peer-yield diagnostics.
        Select an exact authorized publication. No latest-report fallback, current-data recomputation or private archive access.</p>
    </header>
    {catalogState.loading ? <div role="status" aria-label="Loading authorized report catalog" className="space-y-2">
      <ReportSkeleton className="h-8 w-full" /><ReportSkeleton className="h-16 w-full" />
    </div> : catalogState.error ? <div role="alert" className="text-sm space-y-2">
      <p>Authorized report catalog unavailable: {catalogState.error}</p>
      {!readState && <Button size="sm" variant="outline" onClick={() => void catalogQuery.refetch()}>Retry catalog</Button>}
    </div> : !catalog ? <p role="alert" className="text-sm">Authorized catalog absent or invalid. All retained report results are withheld.</p>
      : !catalog.reports.length ? <section className="border rounded-md p-4 text-sm space-y-2">
        <h3 className="font-medium">No authorized retained paired-research reports</h3>
        <p className="text-xs text-muted-foreground">{catalog.operatorPrerequisite}</p>
        <p className="text-xs text-muted-foreground">This is a publication/data gap, not a zero result or a completed scientific evaluation.</p>
      </section> : <>
        <label className="block text-xs space-y-2">
          <span className="font-medium">Exact retained protocol / report / disclosure</span>
          <select aria-label="Retained paired-research exact publication" className="w-full min-w-0 border rounded-md bg-background p-2 text-xs"
            value={pin ? retainedPairedPinKey(pin) : ""} disabled={!!readState}
            onChange={event => setSelectedKey(event.target.value)}>
            <option value="">Select an authorized publication</option>
            {catalog.reports.map(item => <option key={retainedPairedPinKey(item)} value={retainedPairedPinKey(item)}>
              {item.protocolHash} / {item.reportHash} / {item.disclosureHash}
            </option>)}
          </select>
        </label>
        {!pin ? <p className="text-xs text-muted-foreground">No exact publication selected. Reports are never chosen automatically.</p> : <>
          <details className="border rounded-md p-3 text-xs">
            <summary className="font-medium cursor-pointer">Exact selected identities</summary>
            <dl className="mt-3 grid grid-cols-1 gap-2 break-all">{Object.entries(pin).map(([key, value]) =>
              <div key={key}><dt className="text-muted-foreground">{key}</dt><dd className="font-mono">{value}</dd></div>)}</dl>
          </details>
          {reportState.loading ? <div role="status" aria-label="Loading exact retained report" className="space-y-2">
            <p className="text-xs text-muted-foreground">Reading selected retained bytes. Previous results are withheld.</p>
            <ReportSkeleton className="h-20 w-full" /><ReportSkeleton className="h-32 w-full" />
          </div> : reportState.error ? <div role="alert" className="text-sm space-y-2">
            <p>Selected report unavailable: {reportState.error}</p>
            {!readState && <Button size="sm" variant="outline" onClick={() => void reportQuery.refetch()}>Retry exact report</Button>}
          </div> : !report ? <p role="alert" className="text-sm">Selected report absent, corrupt or identity-mismatched. No replacement results are shown.</p>
            : <RetainedPairedResearchReport report={report} />}
        </>}
      </>}
    <p className="text-xs text-muted-foreground">Read-only surface. Existing source permissions and authorization gates apply.
      No report publication, approval, provider payload or new export path is available here.</p>
  </Card>;
}

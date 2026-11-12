import { withDownloadManifest } from "@shared/serverDownloadRegistry";
import {
  carbonPassThroughEvidence, carbonPassThroughSources, carbonPassThroughRemainingInputs,
} from "@shared/carbonPassThroughEvidence";

/** Standalone parent-mountable review; factual source register, never a coefficient control. */
export function CarbonPassThroughReview() {
  return <section className="space-y-4 rounded-lg border p-4" aria-labelledby="carbon-pass-through-heading">
    <h2 id="carbon-pass-through-heading" className="text-lg font-semibold">Carbon-price pass-through: source-qualified context</h2>
    <p className="text-sm">Historical price evidence, not issuer profit or collected cash. No actual issuer assumption admitted;
      0 qualified cases. No old cases changed. Indicative points and sensitivity spans are not universal causal ranges.</p>
    <a className="text-sm underline" href={withDownloadManifest("/api/cv/carbon-pass-through-evidence/export.json")}>Export public source review (JSON)</a>
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr>{["Product / market", "Location / period", "Reported result", "Qualification"].map(h =>
        <th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead>
      <tbody>{carbonPassThroughEvidence.map(row => <tr key={row.id} className="border-t">
        <td className="p-2">{row.product}<br /><span className="text-xs">{row.market}</span></td>
        <td className="p-2">{row.jurisdiction}<br />{row.observedPeriod.start}–{row.observedPeriod.end}<br />{row.frequency}</td>
        <td className="p-2">{row.reported.kind === "lower-bound-only" ? `>${row.reported.lower * 100}%` :
          row.metric === "log-price-elasticity" ? `${row.reported.value} log elasticity; NO recovery ratio` :
            `${Math.round(row.reported.value * 100)}% indicative price ratio`}
          {row.reported.kind === "point-with-bootstrap-span" &&
            <p>Omitted-sample span {Math.round(row.reported.interval.lower * 100)}–{Math.round(row.reported.interval.upper * 100)}%; not95% CI</p>}
        </td>
        <td className="p-2"><p>{row.uncertainty}</p><p className="text-xs">{row.locator}</p></td>
      </tr>)}</tbody>
    </table></div>
    {carbonPassThroughSources.map(source => <details key={source.id}>
      <summary>{source.authors} — {source.publication}</summary>
      <p className="text-sm"><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.title}</a></p>
      <p className="text-xs">{source.version}. {source.rights}</p>
      <p className="break-all text-xs">Original PDF SHA-256: {source.sha256}; retrieved {source.retrievedAt}</p>
    </details>)}
    <details><summary>Exact remaining three-case inputs (NEE / FSLR / XOM)</summary>
      {Object.entries(carbonPassThroughRemainingInputs).map(([issuer, inputs]) =>
        <div key={issuer}><h3 className="font-semibold">{issuer}</h3><ul className="list-disc pl-5 text-sm">
          {inputs.map(item => <li key={item}>{item}</li>)}</ul></div>)}
    </details>
    <p className="text-xs">No numerical issuer study run. Source matching, cost denominator reconciliation, transfer rationale and
      incremental cash/accounting bridge remain required; approvals cannot replace these missing inputs.</p>
  </section>;
}

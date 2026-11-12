import { useState } from "react";
import { useReadQuery } from "@/lib/use-read-query";
import { captureExactProducerIdentity } from "@/lib/producer-download";
import { headlineDrilldownLabels, headlineDrilldownUrl, requireMatchingHeadlineDrilldown,
  verifyHeadlineDrilldownIdentity, type HeadlineDrilldown, type HeadlineDrilldownMode, type HeadlineDrilldownSelection } from "@shared/headlineDrilldown";
import type { RetainedProducerIdentity } from "@shared/downloadManifest";
import { withDownloadManifest } from "@shared/serverDownloadRegistry";

export function HeadlineDrilldownReview({ headline }: { headline: unknown }) {
  let parent: RetainedProducerIdentity | null = null;
  try { parent = captureExactProducerIdentity(headline); } catch { /* Explicit unavailable state below. */ }
  return parent ? <RetainedHeadlineDrilldown key={parent.resultId} parent={parent} /> :
    <p role="status" className="text-xs text-muted-foreground">Selected-headline drilldown unavailable: no unchanged retained producer identity. No other headline or current-input fallback is used.</p>;
}
function RetainedHeadlineDrilldown({ parent }: { parent: RetainedProducerIdentity }) {
  const [year, setYear] = useState(2050);
  const [mode, setMode] = useState<HeadlineDrilldownMode>("contributions");
  const [sector, setSector] = useState("");
  const [gas, setGas] = useState("");
  const [driver, setDriver] = useState("");
  const selection: HeadlineDrilldownSelection = { parent: parent.resultId, year,
    ...(sector ? { sector } : {}), ...(gas ? { gas } : {}), ...(driver ? { driver } : {}) };
  const query = useReadQuery<HeadlineDrilldown>({
    queryKey: [headlineDrilldownUrl(mode, selection)],
    queryFn: async ({ signal }) => {
      const response = await fetch(headlineDrilldownUrl(mode, selection), { signal, credentials: "include" });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error ?? "Selected-headline drilldown unavailable");
      }
      return verifyHeadlineDrilldownIdentity(await response.json());
    },
    select: value => requireMatchingHeadlineDrilldown(value, parent, mode, selection),
  });
  const data = query.data;
  return <section className="rounded-md border p-3 space-y-3" aria-label="Selected-headline drilldown">
    <h3 className="text-sm font-semibold">Selected retained native headline · driver drilldown</h3>
    <p className="text-xs break-all">Headline manifest: {parent.manifestId}. Result: {parent.resultId}.</p>
    <p className="text-xs text-muted-foreground">Global source account only. Six-region and international-transport allocations are unavailable for this headline and are not inferred. Signed land is retained.</p>
    <div className="flex flex-wrap gap-3 text-xs">
      <label>Analysis <select aria-label="Drilldown analysis" value={mode} onChange={event => setMode(event.target.value as HeadlineDrilldownMode)}>
        <option value="contributions">Within-model contributions</option>
        <option value="sensitivities">One-at-a-time sensitivities (nonadditive)</option>
      </select></label>
      <label>Year <select aria-label="Drilldown year" value={year} onChange={event => setYear(Number(event.target.value))}>
        {[2024, 2030, 2050, 2100].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Sector <select aria-label="Drilldown sector" value={sector} onChange={event => setSector(event.target.value)}>
        <option value="">All sectors</option>
        {["power", "transport", "industry", "buildings", "agriculture", "other", "land"].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Gas <input aria-label="Drilldown gas" className="border rounded px-1 w-24" value={gas} placeholder="All gases" onChange={event => setGas(event.target.value)} /></label>
      <label>Driver <select aria-label="Drilldown driver" value={driver} onChange={event => setDriver(event.target.value)}>
        <option value="">All available drivers</option>
        {["electricity", "road", "policy", "corporate", "delivery", "activity", "unchanged-control"].map(value => <option key={value}>{value}</option>)}
      </select></label>
    </div>
    <p className="text-xs font-medium">{headlineDrilldownLabels[mode]}</p>
    {query.isLoading ? <p role="status" className="text-xs">Loading exact retained-headline drilldown…</p> :
      query.isError || !data ? <p role="alert" className="text-xs">Selected drilldown unavailable or invalid: {query.error?.message ?? "No matched response"}. No default, other-manifest or regional substitute is shown.</p> :
      <>
        <p className="text-xs">Derivation: <span className="break-all">{data.derivation.id}</span>. {data.rows.length} signed source-cell × driver rows. Native Mt/year is gas-specific; do not sum different gases or repeated baseline/target columns.</p>
        <div className="flex gap-4 text-xs">
          <a className="underline" href={withDownloadManifest(headlineDrilldownUrl(mode, selection, "json"))}>Download selected JSON</a>
          <a className="underline" href={withDownloadManifest(headlineDrilldownUrl(mode, selection, "xlsx"))}>Download selected XLSX</a>
        </div>
        <div className="overflow-auto max-h-72"><table className="w-full text-xs">
          <caption className="text-left">All selected source rows, unrounded values in downloads · {data.label}</caption>
          <thead><tr>{["Region", "Sector / source code", "Gas", "Driver", "Signed native Mt/year", "GtCO2e/year"].map(column => <th key={column} scope="col" className="text-left p-1">{column}</th>)}</tr></thead>
          <tbody>{data.rows.map((row, index) => <tr key={index}>
            <td>{row.region}</td><td>{row.sector} / {row.sectorCode}</td><td>{row.gas}</td><td>{row.driver}</td>
            <td>{row.valueNativeMt.toPrecision(8)}</td><td>{row.valueGtCO2e.toPrecision(8)}</td>
          </tr>)}</tbody>
        </table></div>
        <p className="text-xs text-muted-foreground">{data.limitations.join(" ")}</p>
      </>}
  </section>;
}

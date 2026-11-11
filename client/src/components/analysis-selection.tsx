import { useState } from "react";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { currentSelection, parseSelection, selectionKey, selectedRequest } from "@/lib/analysis-selection";

export function AnalysisSelectionControl() {
  let active = null;
  let invalid = false;
  try { active = currentSelection(); } catch { invalid = true; }
  const [workbook, setWorkbook] = useState(active?.workbook ?? "");
  const [indicators, setIndicators] = useState(active?.indicators ?? "");
  const [regional, setRegional] = useState(active?.regional ?? "");
  const [overlays, setOverlays] = useState(active?.overlays?.join(",") ?? "");
  const [asOf, setAsOf] = useState(active?.asOf ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inventory = useQuery({
    queryKey: ["analysis-selection-inventory"],
    select: items => {
      if (!Array.isArray(items) || items.some(item => !item || typeof item.id !== "string" || typeof item.kind !== "string"))
        throw new Error("Snapshot inventory records unavailable.");
      return items;
    },
    queryFn: async () => {
      const items: { id: string; kind: string; createdAt: string }[] = [];
      for (const kind of ["workbook-baseline", "indicator-overrides", "regional-intensity"]) {
        let after: string | null = null;
        do {
          const r: Response = await fetch(`/api/analysis/snapshots?kind=${kind}${after ? `&after=${after}` : ""}`);
          if (!r.ok) throw new Error("Snapshot inventory unavailable");
          const page: { status: string; nextCursor: string | null; items: typeof items } = await r.json();
          if (page.status === "not-provisioned") return [];
          items.push(...page.items);
          if (page.nextCursor === after && after) throw new Error("Invalid snapshot cursor");
          after = page.nextCursor;
        } while (after);
      }
      return items;
    },
  });
  async function apply() {
    setBusy(true); setError("");
    try {
      const selection = parseSelection({ workbook, indicators, ...(regional ? { regional } : {}),
        ...(overlays.trim() ? { overlays: overlays.split(",").map(x => x.trim()), asOf } : {}) });
      const r = await fetch(selectedRequest("/api/cv/summary", selection).url);
      if (!r.ok || r.headers.get("X-Analysis-Snapshot") !== selection.workbook ||
        r.headers.get("X-Indicator-Data-State") !== "archived-approved-indicators")
        throw new Error("Selected archives could not be verified. Current selection was not changed.");
      if (selection.overlays && r.headers.get("X-Analysis-Overlays") !== selection.overlays.join(","))
        throw new Error("Selected overlays could not be verified. Current selection was not changed.");
      if (selection.regional) {
        const regionResponse = await fetch(`/api/projection/regions?regionalSnapshotId=${selection.regional}&indicatorSnapshotId=${selection.indicators}`);
        if (!regionResponse.ok || regionResponse.headers.get("X-Regional-Snapshot") !== selection.regional
          || regionResponse.headers.get("X-Indicator-Data-State") !== "archived-approved-indicators")
          throw new Error("Regional archive could not be verified. Current selection was not changed.");
      }
      window.sessionStorage.setItem(selectionKey, JSON.stringify(selection));
      // A new client cache prevents late requests from the prior selection
      // from repopulating newly selected views.
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Selection failed"); }
    finally { setBusy(false); }
  }
  return <section className="border-b p-4 space-y-2" aria-label="Analysis input selection">
    <p className="text-sm font-semibold">{invalid ? "Invalid saved selection — reset required" :
      active ? "Archived workbook and indicators selected" : "Current analysis inputs"}</p>
    <p className="text-xs text-muted-foreground">Applies to company diagnostics and supported legacy climate calculations.
      Published references, news, provider status and data-management records remain current.
      This is input replay with current code, not original-vintage evidence. Regional replay requires the optional external-input archive below.</p>
    {active && <p className="text-xs break-all">Workbook: {active.workbook}<br />Indicators: {active.indicators}
      <br />Regional inputs: {active.regional ?? "Not selected — regional history unavailable"}</p>}
    <details>
      <summary className="text-sm cursor-pointer">Change analysis inputs</summary>
      <div className="grid gap-2 mt-2">
        <label className="text-sm">Workbook snapshot
          <select className="block border rounded p-2 w-full bg-background" value={workbook} onChange={e => setWorkbook(e.target.value)}>
            <option value="">Select workbook</option>
            {inventory.data?.filter(x => x.kind === "workbook-baseline").map(x =>
              <option key={x.id} value={x.id}>{x.createdAt ?? "Created date not returned"} — {x.id}</option>)}
          </select>
        </label>
        <label className="text-sm">Ordered company-overlay IDs (optional, comma separated)
          <input className="block border rounded p-2 w-full bg-background" value={overlays}
            onChange={e => setOverlays(e.target.value)} />
        </label>
        <label className="text-sm">Overlay information cutoff
          <input type="date" className="block border rounded p-2 bg-background" value={asOf}
            disabled={!overlays.trim()} onChange={e => setAsOf(e.target.value)} />
        </label>
        <p className="text-xs text-muted-foreground">Only already-reviewed archived financial, carbon and SDG overlays may be selected.
          Later entries override earlier ones. This does not approve data or establish original-vintage evidence.</p>
        <label className="text-sm">Approved-indicator snapshot
          <select className="block border rounded p-2 w-full bg-background" value={indicators} onChange={e => setIndicators(e.target.value)}>
            <option value="">Select indicators</option>
            {inventory.data?.filter(x => x.kind === "indicator-overrides").map(x =>
              <option key={x.id} value={x.id}>{x.createdAt ?? "Created date not returned"} — {x.id}</option>)}
          </select>
        </label>
        <label className="text-sm">Regional external-input snapshot (optional)
          <select className="block border rounded p-2 w-full bg-background" value={regional} onChange={e => setRegional(e.target.value)}>
            <option value="">Regional history unavailable</option>
            {inventory.data?.filter(x => x.kind === "regional-intensity").map(x =>
              <option key={x.id} value={x.id}>{x.createdAt ?? "Created date not returned"} — {x.id}</option>)}
          </select>
        </label>
        {inventory.isError && <p role="alert">Snapshot inventory unavailable. No current-data fallback is used.</p>}
        {inventory.isLoading && <p role="status">Loading archived inputs…</p>}
        {inventory.data?.length === 0 && <p>No archived inputs are provisioned.</p>}
        <button className="border rounded p-2" disabled={busy || !workbook || !indicators} onClick={() => void apply()}>
          {busy ? "Verifying inputs…" : "Apply archived inputs and reload"}</button>
      </div>
    </details>
    {(active || invalid) && <button className="border rounded p-2 text-sm" onClick={() => {
      window.sessionStorage.removeItem(selectionKey); window.location.reload();
    }}>Return to current inputs</button>}
    {error && <p role="alert" className="text-sm">{error}</p>}
  </section>;
}

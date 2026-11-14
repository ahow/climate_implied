import { useEffect, useRef, useState } from "react";
import { FileJson, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createPrivateFiniteLoadGuard, readPrivateFiniteDocument, type VerifiedPrivateFinite,
} from "@/lib/private-finite-reader";

export function PrivateFiniteEvidence({ evidence }: { evidence: VerifiedPrivateFinite }) {
  const { document, recalculatedId, cells } = evidence;
  const [page,setPage]=useState(0);
  const pageSize=document.version==="private-finite-company-document-1"?cells.length:500;
  const pages=Math.max(1,Math.ceil(cells.length/pageSize)),current=Math.min(page,pages-1),offset=current*pageSize;
  return <div className="space-y-5" data-testid="private-finite-ready">
    <Card><CardContent className="p-4 space-y-4 text-sm [overflow-wrap:anywhere]">
      <h2 className="font-semibold">Document identity · integrity matched</h2>
      <dl className="space-y-3">
        <div><dt className="text-muted-foreground">Declared document ID</dt><dd className="font-mono text-xs" data-testid="private-finite-id">{document.id}</dd></div>
        <div><dt className="text-muted-foreground">Browser-calculated SHA-256</dt><dd className="font-mono text-xs" data-testid="private-finite-calculated-id">{recalculatedId}</dd></div>
        <div><dt className="text-muted-foreground">Export retrievalMode</dt><dd data-testid="private-finite-mode">{document.retrievalMode}</dd></div>
        <div><dt className="text-muted-foreground">Export executionVerifiedNow</dt><dd data-testid="private-finite-execution">{JSON.stringify(document.executionVerifiedNow)}</dd></div>
        <div><dt className="text-muted-foreground">Information cutoff · as exported</dt><dd>{document.cutoff}</dd></div>
      </dl>
      <p className="text-muted-foreground">{document.retrievalMode === "stored"
        ? "Stored evidence: the export does not claim execution was verified at retrieval."
        : "Recalculated evidence: the export claims execution was verified at retrieval, not by this browser."} This viewer only hashes the document; it never executes its financial or scientific model.</p>
    </CardContent></Card>
    <section className="space-y-3" aria-labelledby="finite-cells-title">
      <div>
        <h2 id="finite-cells-title" className="font-semibold">Complete literal evidence</h2>
        <p className="text-sm text-muted-foreground">All {cells.length} ordered pointer/jsonValue rows, including the root (empty pointer), container types, manifest, source IDs, Input / Calculated / Output, equations, units and dates. Periodic, whole-equity and terminal nested balances remain exactly as exported; null is never replaced by zero. No underlying rows are filtered or shortened. Large renewal documents use local pages of500 rows.</p>
        {pages>1&&<div className="flex flex-wrap items-center gap-3 text-sm">
          <Button variant="outline" disabled={current===0} onClick={()=>setPage(current-1)}>Previous rows</Button>
          <label>Page <input aria-label="Literal row page" data-testid="private-renewal-page" className="w-24 rounded border p-2" type="number" min={1} max={pages} value={current+1}
            onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n))setPage(Math.max(0,Math.min(pages-1,n-1)));}}/> of {pages}</label>
          <Button variant="outline" disabled={current===pages-1} onClick={()=>setPage(current+1)}>Next rows</Button>
          <span data-testid="private-renewal-range">Rows {offset+1}–{Math.min(offset+pageSize,cells.length)} of {cells.length}</span>
        </div>}
      </div>
      <div className="rounded-md border">
        <table className="w-full table-fixed text-xs" data-testid="private-finite-cells">
          <caption className="sr-only">Exact owner-export cells in shared economicBridgeCells order</caption>
          <thead className="border-b bg-muted/40"><tr>
            <th scope="col" className="w-2/5 p-3 text-left font-medium">pointer</th>
            <th scope="col" className="p-3 text-left font-medium">jsonValue</th>
          </tr></thead>
          <tbody>{cells.slice(offset,offset+pageSize).map((cell, index) => <tr key={cell.pointer} className="border-b last:border-0 align-top" data-testid="private-finite-cell-row" data-row-index={offset+index} data-pointer={cell.pointer}>
            <td className="p-3"><code className="whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="private-finite-cell-pointer">{cell.pointer}</code></td>
            <td className="p-3"><code className="whitespace-pre-wrap [overflow-wrap:anywhere]" data-testid="private-finite-cell-value">{cell.jsonValue}</code></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  </div>;
}

export default function PrivateFiniteViewer() {
  const [evidence, setEvidence] = useState<VerifiedPrivateFinite | null>(null);
  const [status, setStatus] = useState<"empty" | "pending" | "error" | "ready">("empty");
  const inputRef = useRef<HTMLInputElement>(null);
  const guard = useRef(createPrivateFiniteLoadGuard());
  useEffect(() => () => { guard.current.next(); }, []);

  function reset() {
    guard.current.next();
    setEvidence(null);
    setStatus("empty");
    if (inputRef.current) inputRef.current.value = "";
  }
  async function load(file: File | undefined) {
    const ticket = guard.current.next();
    setEvidence(null);
    setStatus(file ? "pending" : "empty");
    if (!file) return;
    try {
      const verified = await readPrivateFiniteDocument(await file.text());
      if (!guard.current.isCurrent(ticket)) return;
      setEvidence(verified);
      setStatus("ready");
    } catch {
      if (!guard.current.isCurrent(ticket)) return;
      // Never echo file contents, names, or parser messages into logs or UI.
      setEvidence(null);
      setStatus("error");
    }
  }
  return <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-w-0" data-testid="private-finite-viewer">
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight">Private finite and renewal document viewer</h1>
      <p className="text-sm text-muted-foreground">Browser-local inspection of archived owner-export calculation evidence.</p>
    </div>
    <aside role="note" className="rounded-md border bg-muted/40 p-4 space-y-2 text-sm" data-testid="private-finite-boundary">
      <div className="flex items-center gap-2 font-semibold"><ShieldAlert className="h-4 w-4 shrink-0" />Integrity is not authentication or acceptance</div>
      <p>Matching SHA-256 confirms only that the document body matches its declared ID. It does not authenticate a source, owner, producer, reviewer, decision or financial review. An altered document can be rehashed by anyone.</p>
      <p>HTTP-operator authentication is unsupported. Public retained routes remain denied (403); this viewer does not access or unlock them. Obtain the JSON through the existing owner/operator workflow.</p>
      <p>scientificAcceptance: false · publicDisclosureAuthorized: false. Conditional finite project distributions are not whole-equity/FCFE valuation, market identification, legal/GAAP acceptance or calibrated science.</p>
    </aside>
    <Card><CardContent className="p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><FileJson className="h-4 w-4 text-primary" />Open a local owner export</div>
      <p className="text-sm text-muted-foreground" id="private-finite-file-help">Select private finite, renewal or funded company document JSON. Funded transitions are conditional project cash, not certified deployment growth or whole equity. Renewal price shifts are not physical growth. File contents stay in this page's memory: no upload, persistence, analytics or network sends. New selections, failed loads and Reset clear prior evidence.</p>
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <label htmlFor="private-finite-file" className="text-sm font-medium">Owner-export JSON file</label>
          <input ref={inputRef} id="private-finite-file" type="file" accept=".json,application/json" aria-describedby="private-finite-file-help" data-testid="private-finite-file"
            className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-foreground"
            onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; void load(file); }} />
        </div>
        <Button variant="outline" onClick={reset} data-testid="private-finite-reset">Reset local view</Button>
      </div>
    </CardContent></Card>
    {status === "empty" && <div className="rounded-md border border-dashed p-8 text-center space-y-2" data-testid="private-finite-empty">
      <h2 className="font-medium">No private document loaded</h2><p className="text-sm text-muted-foreground">Choose an owner-export JSON file to check its document ID and inspect its complete read-only evidence.</p>
    </div>}
    {status === "pending" && <div role="status" aria-busy="true" className="space-y-3" data-testid="private-finite-pending">
      <p className="text-sm text-muted-foreground">Reading local JSON and checking canonical SHA-256…</p><Skeleton className="h-16 w-full" /><Skeleton className="h-28 w-full" />
    </div>}
    {status === "error" && <div role="alert" className="rounded-md border border-destructive/40 p-4 space-y-2" data-testid="private-finite-error">
      <h2 className="font-semibold text-destructive">Document could not be verified</h2>
      <p className="text-sm">The file may contain invalid JSON, an unsupported contract, inconsistent retrieval flags, nonfinite values, unsupported literal cells or a mismatched SHA-256 ID. WebCrypto also requires a secure browser context. No previous evidence is retained.</p>
      <Button variant="outline" onClick={() => inputRef.current?.click()}>Choose JSON again</Button>
    </div>}
    {status === "ready" && evidence && <PrivateFiniteEvidence key={evidence.document.id} evidence={evidence} />}
  </div>;
}

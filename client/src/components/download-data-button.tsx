import React, { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportNotes, prepareQualifiedJsonExport, type ExportKind } from "@/lib/export-contract";
import { semanticRows, requireOutputSemantic } from "@shared/fieldSemantics";
import { bindExportColumns,type ExportFieldBinding } from "@shared/outputFieldSemantics";
import { exportDataIdentity, loadExportWorkbook } from "@/lib/export-identity";
import { certifySupplementalSheetRows } from "@shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "@shared/downloadManifest";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "@/lib/download-selection";
import { exactProducerDownload, captureDerivedConsumer, derivedConsumerIdentity } from "@/lib/producer-download";
import { appendDerivedConsumerWorkbookLineage } from "@/lib/derived-consumer-workbook";
import { withDownloadManifest } from "@shared/serverDownloadRegistry";

type Cell = string | number | boolean | null | undefined;
export type DownloadRow = Record<string, Cell>;

interface DownloadDataButtonProps {
  interpretationNotes?: Array<{ Field: string; Value: string; SemanticField?: string }>;
  fieldBindings?:Record<string,ExportFieldBinding>;
  kind: ExportKind;
  filename: string;
  rows: DownloadRow[] | (() => DownloadRow[]);
  sheetName?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
  requireDerivedParent?: boolean;
  /** Ordinary exports remain available without retained storage; expose the
   * same JSON companion without implying a required producer identity. */
  jsonCompanion?: boolean;
}

export function DownloadDataButton({
  interpretationNotes = [],
  fieldBindings,
  kind,
  filename,
  rows,
  sheetName = "Data",
  label = "Download data",
  disabled,
  className,
  testId = "button-download-data",
  requireDerivedParent = false,
  jsonCompanion = false,
}: DownloadDataButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedEmpty = typeof rows === "function" ? false : !rows || rows.length === 0;

  const handleClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const requestedUiSelection = captureDownloadSelection();
      const sourceRows = typeof rows === "function" ? rows() : rows;
      const capturedConsumer = captureDerivedConsumer(sourceRows);
      if (requireDerivedParent && !capturedConsumer)
        throw new Error("Export unavailable — required retained producer parent is missing. No current-data fallback.");
      const data = structuredClone(sourceRows);
      if (!data || data.length === 0) {
        setError("Export unavailable — no rows returned. No completed download was produced.");
        return;
      }
      const capturedNotes = structuredClone([...interpretationNotes]);
      const capturedBindings = fieldBindings ? structuredClone(fieldBindings) : undefined;
      for (const note of capturedNotes)
        if (note.SemanticField) requireOutputSemantic(note.SemanticField);
      const XLSX = await loadExportWorkbook();
      const identity=await exportDataIdentity(data);
      const consumerIdentity = await derivedConsumerIdentity(capturedConsumer, data);
      const ws = XLSX.utils.json_to_sheet(identity.normalized);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet([...exportNotes(kind, filename, new Date().toISOString(), requestedUiSelection),
          ...capturedNotes,
          {Field:"Exported data SHA-256",Value:identity.hash},
          {Field:"Export hash method",Value:"SHA-256 of JSON array in exported row order; object keys sorted; missing cells normalized to null. Identifies exported data, not scientific acceptance."}]),
        sheetName.slice(0, 31) === "Interpretation" ? "Export Notes" : "Interpretation");
      XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(certifySupplementalSheetRows("Field semantics",semanticRows())),
        sheetName.slice(0,31)==="Field semantics" ? "Semantic definitions" : "Field semantics");
      if(capturedBindings) XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(
        certifySupplementalSheetRows("Column bindings",
          bindExportColumns(identity.normalized,capturedBindings).map(row=>({...row,dependencies:row.dependencies.join(", ")})))
      ),"Column bindings");
      const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
      const manifest = createDownloadManifest({ filename: name, kind, exportedAt: new Date().toISOString(),
        dataHash: identity.hash,
        hashMethod: "SHA-256 of JSON array in exported row order; object keys sorted; missing cells normalized to null",
        selection: requestedUiSelection, rows: identity.normalized, columnBindings: capturedBindings,
        sheets: [...wb.SheetNames, "Download manifest"] });
      if (consumerIdentity) Object.assign(manifest, { derivedConsumerIdentity: consumerIdentity,
        sheets: [...manifest.sheets, "Derived lineage"] });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(downloadManifestRows(manifest)), "Download manifest");
      await appendDerivedConsumerWorkbookLineage(XLSX, wb, consumerIdentity);
      requireUnchangedDownloadSelection(requestedUiSelection);
      XLSX.writeFile(wb, name);
    } catch (err) {
      console.error("Failed to export data to Excel:", err);
      setError(err instanceof Error ? `${err.message} No completed download was produced.` : "Export failed. No completed download was produced. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const handleJsonClick = async () => {
    setBusy(true); setError(null);
    let url: string | undefined;
    try {
      const selection = captureDownloadSelection();
      const source = typeof rows === "function" ? rows() : rows;
      const captured = captureDerivedConsumer(source);
      if (!captured) throw new Error("Export unavailable — required retained producer parent is missing.");
      const data = structuredClone(source);
      const notes = structuredClone(interpretationNotes);
      if (!data.length) throw new Error("Export unavailable — no rows returned.");
      const identity = await derivedConsumerIdentity(captured, data);
      const prepared = await prepareQualifiedJsonExport(data, kind, filename, new Date().toISOString(),
        value => {
          if (JSON.stringify(value) !== JSON.stringify(data)) throw new Error("Derived JSON rows conflict");
          return value;
        }, selection);
      const envelope = JSON.parse(prepared.text);
      envelope.manifest.derivedConsumerIdentity = identity;
      envelope.interpretation.push(...notes);
      requireUnchangedDownloadSelection(selection);
      url = URL.createObjectURL(new Blob([JSON.stringify(envelope, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = `${filename.replace(/\.xlsx$/, "")}.json`;
      requireUnchangedDownloadSelection(selection);
      link.click();
    } catch (err) {
      setError(`${err instanceof Error ? err.message : "Export failed"} No completed JSON download was produced.`);
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  };

  return (
    <>
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled || busy || resolvedEmpty}
      className={className}
      data-testid={testId}
    >
      <Download className="h-3.5 w-3.5 mr-1.5" />
      {busy ? "Preparing\u2026" : label}
    </Button>
    {(requireDerivedParent || jsonCompanion) && <Button type="button" variant="outline" size="sm"
      disabled={disabled || busy || resolvedEmpty} onClick={() => void handleJsonClick()}
      data-testid={`${testId}-json`}>Download JSON</Button>}
    {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    {fieldBindings && <details className="basis-full text-xs text-muted-foreground">
      <summary className="cursor-pointer">Export column bindings ({Object.keys(fieldBindings).length})</summary>
      <ul className="space-y-1 py-2">{Object.entries(fieldBindings).map(([column,binding])=>
        <li key={column}><strong>{column}</strong>: <code>{binding.id}</code> — {binding.transform}</li>
      )}</ul>
    </details>}
    <details className="text-xs text-muted-foreground">
      <summary>Input, calculation and output definitions</summary>
      <p>Core field definitions; not yet a complete dictionary of every displayed or exported column. Null means unavailable, not zero.</p>
      <dl>{semanticRows().map(row=><div key={row.Field} className="my-2">
        <dt className="font-medium">{row.Field} — {row.Classification} ({row.Unit})</dt>
        <dd>{row.Formula}. Depends on: {row.Dependencies || "source input"}.</dd>
        <dd>{row.Source}. {row.Vintage}. {row.AsOf}.</dd>
      </div>)}</dl>
    </details>
    </>
  );
}

/** JSON uses the SAME central writer and mandatory evidence-contract boundary.
 * The report remains lossless in envelope.data; interpretation and identity
 * travel with it instead of being omitted or flattened into spreadsheet rows.
 */
export function DownloadJsonButton({ kind, filename, payload, validatePayload, label = "Download JSON" }: {
  kind: ExportKind; filename: string; payload: unknown; validatePayload: (value: unknown) => unknown; label?: string;
}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true); setError(null);
    let url: string | undefined;
    try {
      const requestedUiSelection = captureDownloadSelection();
      const prepared = await prepareQualifiedJsonExport(payload, kind, filename, new Date().toISOString(), validatePayload, requestedUiSelection);
      requireUnchangedDownloadSelection(requestedUiSelection);
      url = URL.createObjectURL(new Blob([prepared.text], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url; link.download = filename.endsWith(".json") ? filename : `${filename}.json`;
      requireUnchangedDownloadSelection(requestedUiSelection);
      link.click();
    } catch (error) {
      setError(error instanceof Error ? `${error.message} No completed JSON download was produced.` : "Export failed validation or serialization. No completed JSON download was produced.");
    } finally {
      if (url) URL.revokeObjectURL(url);
      setBusy(false);
    }
  };
  return <><ProducerDownloadLink payload={payload} /><Button variant="outline" onClick={() => void download()} disabled={busy}>{busy ? "Preparing…" : label}</Button>
    {error && <span role="alert" className="text-sm text-destructive">{error}</span>}</>;
}

/** A derived chart/view export retains null producer identity. This separate
 * link exports the exact server-retained source response, never relabelled rows. */
export function ProducerDownloadLink({ payload }: { payload: unknown }) {
  const href = exactProducerDownload(payload);
  return href ? <a href={withDownloadManifest(href)} className="text-sm underline" data-testid="download-exact-producer-result">
    Download exact retained result JSON (not chart-transformed rows)
  </a> : null;
}

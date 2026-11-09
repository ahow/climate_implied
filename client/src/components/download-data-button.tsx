import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportNotes, type ExportKind } from "@/lib/export-contract";

type Cell = string | number | boolean | null | undefined;
export type DownloadRow = Record<string, Cell>;

interface DownloadDataButtonProps {
  kind: ExportKind;
  filename: string;
  rows: DownloadRow[] | (() => DownloadRow[]);
  sheetName?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export function DownloadDataButton({
  kind,
  filename,
  rows,
  sheetName = "Data",
  label = "Download data",
  disabled,
  className,
  testId = "button-download-data",
}: DownloadDataButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedEmpty = typeof rows === "function" ? false : !rows || rows.length === 0;

  const handleClick = async () => {
    const data = typeof rows === "function" ? rows() : rows;
    if (!data || data.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      XLSX.utils.book_append_sheet(wb,
        XLSX.utils.json_to_sheet(exportNotes(kind, filename, new Date().toISOString())),
        sheetName.slice(0, 31) === "Interpretation" ? "Export Notes" : "Interpretation");
      const name = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
      XLSX.writeFile(wb, name);
    } catch (err) {
      console.error("Failed to export data to Excel:", err);
      setError("Export failed. No completed download was produced. Please try again.");
    } finally {
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
    {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </>
  );
}

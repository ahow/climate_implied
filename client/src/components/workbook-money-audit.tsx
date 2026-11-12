import { withDownloadManifest } from "@shared/serverDownloadRegistry";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { workbookMoneyAuditSchema, workbookMoneyRootPaths, workbookMoneySheetPaths, workbookMoneySemantics } from "@shared/workbookMoneyAudit";
export async function fetchWorkbookMoneyAudit() {
  const response = await fetch("/api/financial-data/workbook-money-audit");
  if (!response.ok) throw new Error("Retained monetary audit unavailable; no source/FX fallback and no monetary zero inferred.");
  const report = workbookMoneyAuditSchema.parse(await response.json()), auditHash = response.headers.get("X-Workbook-Money-Audit-SHA256");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(report)));
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  if (!auditHash || actual !== auditHash) throw new Error("Monetary audit disclosure identity mismatch; values/downloads withheld.");
  return { report, auditHash };
}
export function WorkbookMoneyAudit({ readState }: {
  readState?: { loading?: boolean; error?: string; data?: unknown; auditHash?: string };
}) {
  const query = useQuery({ queryKey: ["/api/financial-data/workbook-money-audit"], queryFn: fetchWorkbookMoneyAudit, enabled: !readState, retry: false });
  const state = readState ?? { loading: query.isPending || query.isFetching, error: query.isError ? query.error.message : undefined,
    data: query.data?.report, auditHash: query.data?.auditHash };
  const parsed = workbookMoneyAuditSchema.safeParse(state.data);
  const report = parsed.success ? parsed.data : undefined;
  const identified = typeof state.auditHash === "string" && /^[a-f0-9]{64}$/.test(state.auditHash);
  const label = (path: string) => workbookMoneySemantics.find(s => s.id === `workbookMoney.${path}`)!.meaning;
  return <Card className="p-5 my-6 space-y-3" data-testid="workbook-money-audit">
    <h2 className="text-lg font-semibold">Workbook monetary qualification · totals intentionally withheld</h2>
    {state.loading ? <p role="status">Loading retained monetary audit… Previous counts and downloads withheld.</p> :
      state.error ? <p role="alert" data-field-id="workbookMoney.error">{state.error}</p> :
      !report || !identified ? <p role="alert" data-field-id="workbookMoney.error">Retained monetary audit absent,invalid or unidentified. No currency/scale/FX or approval is inferred; this is not zero monetary coverage.</p> :
      <section className="space-y-3">
        <p data-field-id="workbookMoney.label">{report.label}</p>
        <p><span data-field-id="workbookMoney.sourceCompanyCount">{report.sourceCompanyCount} original source companies</span>{" · "}
          <span data-field-id="workbookMoney.sheets[].numericCells">{report.sheets.reduce((n, row) => n + row.numericCells, 0)} numeric source cells across MV + Profit (not money)</span></p>
        <p className="text-sm">Withholding is intentional: numeric cells alone establish neither currency nor magnitude.
          No default USD,common scale or nearest-day FX is assumed. Independently reported dimensionless P/E is not a monetary total;
          a P/E derived from money still requires matching qualified numerator and denominator.</p>
        <p data-field-id="workbookMoney.monetaryTotals">Monetary totals: {report.monetaryTotals === null ? "Withheld — unknown/unconverted,not zero" : "Invalid"}</p>
        <p data-field-id="workbookMoney.sourceDatePolicy">{report.sourceDatePolicy}</p>
        <div className="grid gap-4 md:grid-cols-2">{report.sheets.map(sheet => <section className="rounded border p-3" key={sheet.sheet}>
          <h3 className="font-medium" data-field-id="workbookMoney.sheets[].sheet">{sheet.sheet} · actual source metadata</h3>
          <dl className="text-xs space-y-1">{workbookMoneySheetPaths.filter(path => path !== "sheet").map(path =>
            <div key={path}><dt>{label(`sheets[].${path}`)}</dt><dd className="font-mono break-all" data-field-id={`workbookMoney.sheets[].${path}`}>{sheet[path]}</dd></div>)}</dl>
        </section>)}</div>
        <p data-field-id="workbookMoney.limitation">{report.limitation}</p>
        <p data-field-id="workbookMoney.approval">{report.approval}</p>
        <p className="text-xs break-all" data-field-id="workbookMoney.auditHash">Exact disclosure SHA256: {state.auditHash}</p>
        <details className="text-xs"><summary>Exact original source pins and pending-review quantities</summary>
          <dl>{workbookMoneyRootPaths.filter(path => !["label", "limitation", "approval", "sourceDatePolicy", "monetaryTotals"].includes(path)).map(path =>
            <div className="py-1" key={path}><dt>{label(path)}</dt><dd className="font-mono break-all" data-field-id={`workbookMoney.${path}`}>
              {typeof report[path] === "boolean" ? String(report[path]) : report[path]}</dd></div>)}</dl>
        </details>
        <div className="flex gap-4 text-sm">
          <a className="underline" href={`/api/financial-data/workbook-money-audit?expectedAuditHash=${state.auditHash}`}>Exact audit JSON</a>
          <a className="underline" href={withDownloadManifest(`/api/financial-data/workbook-money-audit.xlsx?expectedAuditHash=${state.auditHash}`)}>Exact audit XLSX</a>
        </div>
      </section>}
  </Card>;
}

import type { Express } from "express";
import { buildWorkbookMoneyAuditWorkbook, readWorkbookMoneyAudit, workbookMoneyAuditSchema, workbookMoneyAuditHash } from "./financialData/workbookMoneyExport";
/** Read-only safe aggregate router. Lifecycle/approval/coverage ownership remains separate. */
export function registerWorkbookMoneyAuditApi(app: Express, reader: () => Promise<unknown> = readWorkbookMoneyAudit) {
  const handler = (xlsx: boolean) => async (req: import("express").Request, res: import("express").Response) => {
    res.setHeader("Cache-Control", "no-store");
    const refuse = (status: number, error: string) => res.status(status).json({ error, monetaryTotals: null, status: "pending-review" });
    if (Object.keys(req.query).some(k => k !== "expectedAuditHash") ||
      (req.query.expectedAuditHash !== undefined && (typeof req.query.expectedAuditHash !== "string" || !/^[a-f0-9]{64}$/.test(req.query.expectedAuditHash))))
      return refuse(400, "Unsupported audit query; no source paths,currency overrides or public refresh");
    try {
      const report = workbookMoneyAuditSchema.parse(await reader()), hash = workbookMoneyAuditHash(report);
      if (req.query.expectedAuditHash && req.query.expectedAuditHash !== hash) return refuse(409, "Retained monetary audit changed; reload exact disclosure,no prior replacement");
      if (!xlsx) { res.setHeader("X-Workbook-Money-Audit-SHA256", hash); return res.json(report); }
      const bytes = buildWorkbookMoneyAuditWorkbook(report);
      res.setHeader("X-Workbook-Money-Audit-SHA256", hash);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="workbook-money-audit-pending-review.xlsx"'); res.send(bytes);
    } catch { return refuse(503, "Retained monetary audit unavailable or invalid; no currency/FX fallback"); }
  };
  app.get("/api/financial-data/workbook-money-audit", handler(false));
  app.get("/api/financial-data/workbook-money-audit.xlsx", handler(true));
}

import type { Express, Response } from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { registerWorkbookMoneyAuditApi } from "./workbookMoneyAuditApi";
import { readWorkbookMoneyExportRelease } from "./financialData/workbookMoneyExportRelease";
import { bindReportRelease } from "./snapshots/reportExportProducer";

/** Preserve the exact frozen original reader/API sources. Only the existing
 * public safe XLSX path receives an additive request-local release binding;
 * the original validation/expectedAuditHash/refusal/body writer still runs. */
export function registerWorkbookMoneyAuditExportApi(app: Express,
  reader: () => Promise<unknown> = readWorkbookMoneyExportRelease,
  bindRelease: typeof bindReportRelease = bindReportRelease) {
  const responseContext = new AsyncLocalStorage<{ res: Response; query: Record<string, unknown> }>();
  app.use("/api/financial-data/workbook-money-audit.xlsx", (req, res, next) => {
    if (req.method !== "GET") return next();
    responseContext.run({ res, query: req.query }, next);
  });
  registerWorkbookMoneyAuditApi(app, async () => {
    const report = await reader(), context = responseContext.getStore();
    if (context && report && typeof report === "object")
      await bindRelease(context.res, report, report, context.query);
    return report;
  });
}

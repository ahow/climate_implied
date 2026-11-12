import type { Express } from "express";
import { z } from "zod";
import { getStage10Coverage } from "./financialData/stage10Source";
import { stage10CoverageSchema, type Stage10CoverageReport } from "../shared/stage10Coverage";
import { buildStage10Workbook, stage10ExportDocument } from "./financialData/stage10Export";
import { bindReportRelease } from "./snapshots/reportExportProducer";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const query = z.object({ workbookHash: hash.optional(), cutoff: z.string().datetime().optional(),
  firstYear: z.coerce.number().int().min(1900).max(2100).optional(), lastYear: z.coerce.number().int().min(1900).max(2100).optional(),
  expectedInputHash: hash.optional() }).strict();
export function registerStage10CoverageRoutes(app: Express, reader: (options: Parameters<typeof getStage10Coverage>[0]) =>
  Promise<Stage10CoverageReport> = getStage10Coverage, bindRelease: typeof bindReportRelease = bindReportRelease) {
  for (const suffix of ["", "/export.json", "/export.xlsx"]) app.get(`/api/research/stage10-coverage${suffix}`, async (req, res) => {
    res.set("Cache-Control", "no-store");
    const p = query.safeParse(req.query);
    if (!p.success || (p.data.lastYear ?? 2025) < (p.data.firstYear ?? 2015) || (p.data.lastYear ?? 2025) - (p.data.firstYear ?? 2015) > 50) {
      res.set("X-Field-Semantics", "stage10Coverage.error").status(400).json({ error: "Invalid exact retained coverage selection; no source paths/review/refresh inputs supported" }); return;
    }
    try {
      const { expectedInputHash, ...options } = p.data, raw = await reader(options), report = stage10CoverageSchema.parse(raw);
      if ((options.workbookHash && report.workbookHash !== options.workbookHash) ||
        (options.cutoff && Date.parse(report.informationCutoff) !== Date.parse(options.cutoff)) ||
        report.fiscalYears.join(",") !== Array.from({ length: (options.lastYear ?? 2025) - (options.firstYear ?? 2015) + 1 },
          (_, i) => (options.firstYear ?? 2015) + i).join(",")) throw new Error("Returned report does not match exact selection");
      if (expectedInputHash && expectedInputHash !== report.inputHash) {
        res.set("X-Field-Semantics", "stage10Coverage.error").status(409).json({ error: "Retained input identity changed; no substitute report/export returned" }); return;
      }
      res.set("X-Stage10-Input-SHA256", report.inputHash).set("X-Field-Semantics-Family", "stage10Coverage");
      if (suffix) await bindRelease(res, raw, report, p.data);
      if (suffix === "/export.xlsx") res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .attachment(`stage10-${report.inputHash}.xlsx`).send(buildStage10Workbook(report));
      else if (suffix) res.attachment(`stage10-${report.inputHash}.json`).json(stage10ExportDocument(report));
      else res.json(report);
    } catch {
      res.removeHeader("Content-Disposition");
      res.removeHeader("X-Stage10-Input-SHA256");
      res.type("application/json").set("X-Field-Semantics", "stage10Coverage.error").status(503)
        .json({ error: "Retained Stage10 source/storage unavailable or inconsistent; no zero/restatement/unqueried fallback" });
    }
  });
}

import type { Express, RequestHandler } from "express";
import * as XLSX from "xlsx";
import { deriveHeadlineDrilldown } from "./calculation/headlineDrilldown";
import { loadAnalysisResult } from "./snapshots/results";
import { loadMaterialArchive } from "./snapshots/materialInputs";
import type { HeadlineDrilldownMode } from "../shared/headlineDrilldown";

export function headlineDrilldownHandler(mode: HeadlineDrilldownMode, format?: "json" | "xlsx",
  loadResult = loadAnalysisResult, loadMaterial = loadMaterialArchive): RequestHandler {
  return async (req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      if (typeof req.query.parent !== "string" || !/^[a-f0-9]{64}$/.test(req.query.parent))
        throw new Error("Exact retained headline result identity required");
      const loaded = await loadResult(req.query.parent);
      const data = await deriveHeadlineDrilldown(loaded, req.query, mode, loadMaterial);
      // Deliberately do NOT bindProducerIdentity: this is a derived response,
      // not the exact retained native parent's completed response.
      res.set("X-Headline-Parent", data.parent.resultId);
      res.set("X-Headline-Derivation", data.derivation.id);
      if (!format) return void res.json(data);
      res.set("Content-Disposition", `attachment; filename="headline-${mode}-${data.derivation.id}.${format}"`);
      if (format === "json") return void res.type("application/json").send(JSON.stringify(data));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data.rows), "Drilldown");
      const { rows, ...contract } = data;
      XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(
        Object.entries(contract).map(([Field, value]) => ({ Field, Value: JSON.stringify(value) }))), "Headline contract");
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    } catch (error) {
      res.removeHeader("Content-Disposition");
      res.status(422).json({ error: error instanceof Error ? error.message : "Selected headline drilldown unavailable",
        fallback: "none; no current inputs, other parent identity, regional proxy, or scientific promotion" });
    }
  };
}
export function registerHeadlineDrilldownApi(app: Express, loadResult = loadAnalysisResult,
  loadMaterial = loadMaterialArchive) {
  for (const mode of ["contributions", "sensitivities"] as const) {
    app.get(`/api/headline-drilldown/${mode}`, headlineDrilldownHandler(mode, undefined, loadResult, loadMaterial));
    for (const format of ["json", "xlsx"] as const)
      app.get(`/api/headline-drilldown/${mode}/export.${format}`,
        headlineDrilldownHandler(mode, format, loadResult, loadMaterial));
  }
}

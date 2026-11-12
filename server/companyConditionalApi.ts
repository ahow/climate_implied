import type { Express, Request, Response } from "express";
import ExcelJS from "exceljs";
import { conditionalExportCells, getConditionalCompanySummary, type ConditionalIssuer } from "../shared/companyConditionalData";
import { bindNestedOutput } from "../shared/outputFieldSemantics";
import { bindConditionalExportCells } from "../shared/companyConditionalSemantics";
import { bindStaticReference } from "./staticReferenceLineage";

export const CONDITIONAL_COMPANY_ROUTE = "/api/cv/company-conditional-summaries";

/** Parent server registers this once. GET only; never reads runtime evidence files. */
export function registerCompanyConditionalRoutes(app: Express) {
  function readIssuer(req: Request, res: Response): ConditionalIssuer | undefined | false {
    if (Object.keys(req.query).some(key => key !== "issuer")) {
      res.status(400).json({ error: "Only the optional issuer presentation selection is supported." });
      return false;
    }
    const issuer = req.query.issuer;
    if (issuer !== undefined && issuer !== "NEE" && issuer !== "FSLR" && issuer !== "XOM") {
      res.status(400).json({ error: "issuer must be NEE, FSLR or XOM." });
      return false;
    }
    return issuer as ConditionalIssuer | undefined;
  }
  for (const suffix of ["", "/export.json", "/export.xlsx"]) {
    app.get(`${CONDITIONAL_COMPANY_ROUTE}${suffix}`, async (req, res, next) => {
      const issuer = readIssuer(req, res);
      if (issuer === false) return;
      const summary = getConditionalCompanySummary(issuer);
      bindNestedOutput("conditionalCompany", summary);
      const cells = conditionalExportCells(summary);
      bindConditionalExportCells(summary, cells);
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (!suffix) { res.json(summary); return; }
       await bindStaticReference(res, `conditional-${issuer ?? "all"}`, summary);
      const filename = `supplemental-conditional-${issuer ?? "all"}-not-qualified`;
      if (suffix === "/export.json") {
        res.attachment(`${filename}.json`).json(summary);
        return;
      }
      try {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "Climate Dashboard — public derived aggregates";
        workbook.title = "Supplemental conditional research — 0/3 qualified";
        workbook.subject = summary.scope;
        const sheet = workbook.addWorksheet("Public allowlist");
        sheet.columns = [
          { header: "Allowlisted field", key: "field", width: 62 },
          { header: "JSON value (null means unknown)", key: "jsonValue", width: 115 },
        ];
        sheet.addRows(cells);
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: "frozen", ySplit: 1 }];
        res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.attachment(`${filename}.xlsx`);
        res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
      } catch (error) { next(error); }
    });
  }
}

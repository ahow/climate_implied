import type { Express, Request, Response, NextFunction } from "express";
import { registerProspectiveValuationChoices, assessProspectiveValuationBranch } from "./calculation/prospectiveValuationChoices";
import { registerProspectiveWidth, evaluateProspectiveWidth } from "./calculation/prospectiveAssumptionWidth";

/** Additive handler mounted after existing releaseSafety/body limits and before
 * frozen routes. Other operations fall through unchanged to their old handler.
 * No edits to the protected routes/model bundle or any artifact pin required.
 */
export function prospectiveResearchHandler(req: Request, res: Response, next: NextFunction) {
  const x = req.body;
  try {
    let result: unknown;
    switch (x?.operation) {
      case "prospective-valuation-choices": result = registerProspectiveValuationChoices(x.input); break;
      case "prospective-valuation-branch": result = assessProspectiveValuationBranch(x.choices, x.input); break;
      case "prospective-width-specification": result = registerProspectiveWidth(x.input); break;
      case "prospective-assumption-width": result = evaluateProspectiveWidth(x.specification, x.input); break;
      default: return next();
    }
    return res.set("Cache-Control", "no-store").json({
      result, status: "submitted-input-diagnostic", modelPromoted: false, investmentEvidence: false,
    });
  } catch {
    return res.status(422).json({ error: "Invalid or incompatible prospective research inputs" });
  }
}

export function registerProspectiveResearchApi(app: Express) {
  app.post("/api/calculation/research-contracts", prospectiveResearchHandler);
}

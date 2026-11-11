import type { Express } from "express";
import { WARMING_VALIDATION_REFERENCE } from "../shared/warmingValidationReference";
import { warmingReferenceExportDocument } from "../shared/warmingValidationReferenceSemantics";

/** Registered from index.ts after releaseSafety; no routes.ts or protected model edits.
 * No query overrides, runtime source reads, model calls or acceptance methods. */
export function registerWarmingValidationReferenceRoutes(app: Express) {
  app.get("/api/reference/warming-validation", (req, res) => {
    if (Object.keys(req.query).length) {
      res.status(400).json({ error: "The dated validation reference accepts no overrides." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(WARMING_VALIDATION_REFERENCE);
  });
  app.get("/api/reference/warming-validation/export.json", (req, res) => {
    if (Object.keys(req.query).length) {
      res.status(400).json({ error: "The dated validation reference accepts no overrides." });
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.attachment("igcc-2025-validation-reference-not-model-acceptance.json").json(warmingReferenceExportDocument());
  });
}

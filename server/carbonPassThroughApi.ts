import type { Express } from "express";
import { getCarbonPassThroughReview } from "./calculation/carbonPassThroughAdmission";
import { bindNestedOutput } from "../shared/outputFieldSemantics";
import { bindStaticReference, type StaticReferenceArchiveReader } from "./staticReferenceLineage";

export const CARBON_PASS_THROUGH_ROUTE = "/api/cv/carbon-pass-through-evidence";

/** Parent mounts explicitly. Read-only metadata/facts; never executes an issuer study. */
export function registerCarbonPassThroughRoutes(app: Express, archive?: StaticReferenceArchiveReader) {
  for (const suffix of ["", "/export.json"]) {
    app.get(`${CARBON_PASS_THROUGH_ROUTE}${suffix}`, async (req, res) => {
      if (Object.keys(req.query).length) {
        res.status(400).json({ error: "This read-only source register accepts no query inputs." });
        return;
      }
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
      try {
        const review = getCarbonPassThroughReview();
        if (suffix) {
          await bindStaticReference(res, "carbon-pass-through-evidence", review, archive);
          res.attachment("s12-007-price-evidence-not-issuer-validation.json");
        }
        res.setHeader("X-Field-Semantics", bindNestedOutput("carbonPassThroughReview", review).map(f => f.id).join(","));
        res.json(review);
      } catch {
        res.removeHeader("Content-Disposition");
        res.status(503).set("Cache-Control", "no-store").json({
          error: "Static carbon evidence/code artifact missing, stale or corrupt; no issuer assumption or study fallback",
        });
      }
    });
  }
}

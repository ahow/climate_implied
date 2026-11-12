import type { Express } from "express";
import { scientificEvidenceApiConsumer, scientificEvidenceStatusRows } from "../shared/scientificEvidenceConsumers";

/** Additive metadata only, including refusal/empty responses. Does not intercept
 * JSON, bypass guards, load artifacts, mutate caches or change legacy hashes.
 */
export function registerScientificEvidenceApi(app: Express) {
  app.use((req, res, next) => {
    if (scientificEvidenceApiConsumer(req.method, req.path)) {
      for (const row of scientificEvidenceStatusRows())
        res.set(`X-Scientific-Evidence-${row.key}`, row.status);
      res.set("X-Scientific-Evidence-Scope", "program-policy-not-input-certification");
    }
    next();
  });
}

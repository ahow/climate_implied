import type { Express } from "express";
import {
  retainedPairedPinSchema, retainedPairedCatalogSchema, retainedPairedPinKey,
} from "../client/src/components/retained-paired-research-contract";
import { retainedPairedResearchCatalog, RETAINED_PAIRED_PREREQUISITE } from "./retainedPairedResearchCatalog";
import {
  loadPublishedRetainedPairedResearch, RetainedPairedError, retainedPairedIdentity,
} from "./retainedPairedResearchStore";

/** Read-only public disclosure boundary: no solver, uploads, request paths,
 * review submissions or private pipeline/source reads. */
export function registerRetainedPairedResearchRoutes(app: Express, options: {
  readReport?: typeof loadPublishedRetainedPairedResearch;
  catalog?: typeof retainedPairedResearchCatalog;
} = {}) {
  const catalog = options.catalog ?? retainedPairedResearchCatalog;
  const reader = options.readReport ?? loadPublishedRetainedPairedResearch;
  app.get("/api/research/paired-research/catalog", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (Object.keys(req.query).length) { res.status(400).json({ error: "Catalog accepts no overrides" }); return; }
    try {
      const body = retainedPairedCatalogSchema.parse({
        contract: "retained-paired-research-catalog-1", reports: catalog,
        operatorPrerequisite: RETAINED_PAIRED_PREREQUISITE, scientificAcceptance: false, investmentEvidence: false,
      });
      if (new Set(body.reports.map(retainedPairedPinKey)).size !== body.reports.length) throw new Error("Duplicate pins");
      res.json(body);
    } catch { res.status(503).json({ error: "Trusted retained catalog failed its exact public contract" }); }
  });
  app.get("/api/research/paired-research", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const parsed = retainedPairedPinSchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: "All eight exact SHA256 pins required; no override inputs accepted" }); return; }
    try {
      const { report, identity } = await reader(parsed.data);
      if (retainedPairedPinKey(identity) !== retainedPairedPinKey(parsed.data) ||
        retainedPairedPinKey(retainedPairedIdentity(report, identity.disclosureHash)) !== retainedPairedPinKey(identity))
        throw new RetainedPairedError(503, "Resolver returned mismatched public report identity");
      for (const [key, value] of Object.entries(identity)) {
        const header = `X-Paired-Research-${key.replace(/Hash$/, "").replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}-SHA256`;
        res.set(header, value);
      }
      res.json(report);
    } catch (error) {
      res.status(error instanceof RetainedPairedError ? error.status : 503).json({
        error: error instanceof RetainedPairedError ? error.message : "Retained paired report failed its exact public evidence contract",
      });
    }
  });
}

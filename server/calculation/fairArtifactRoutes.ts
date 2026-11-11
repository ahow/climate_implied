import type { Express, Request, Response } from "express";
import { z } from "zod";
import { fairArtifactCatalog, fairArtifactSelection } from "./fairArtifactCatalog";
import { FairArtifactError, fairArtifactSelectionSchema, fairMember, loadFairArtifact,
  type LoadedFairArtifact } from "./fairArtifacts";
import { summarizeEnsemble } from "./ensemble";
import { historicalValidation } from "./historicalValidation";

/** Exhaustive inventory of current climate-response surfaces, not a migration
 * certificate. A route listed as withheld/legacy does NOT consume an ensemble. */
export const fairRouteInventory = [
  ...["/api/projection", "/api/projection/categories", "/api/projection/regions",
    "/api/projection/sensitivity", "/api/projection/historical-trend",
    "/api/projection/categories/historical-trend"].map(path => ({
    method: "GET", path, disposition: "legacy-default; engine=fair-withheld-409; unsupported-engine-400",
    artifactConsumer: false,
  })),
  ...["/api/emissions/candidate", "/api/reference-scenarios", "/api/indicators/historical",
    "/api/calculation/readiness", "/api/calculation-contract"].map(path => ({
    method: "GET", path, disposition: "inventory-reference-or-readiness-only; no-FaIR-temperature",
    artifactConsumer: false,
  })),
  ...["/api/emissions/validate-native-pathways", "/api/emissions/regional-residual-diagnostics",
    "/api/calculation/evaluate-holdout", "/api/calculation/evaluate-signal",
    "/api/calculation/audit-vintages", "/api/calculation/research-contracts"].map(path => ({
    method: "POST", path, disposition: "submitted-input-diagnostic-only; artifact-selection-unsupported",
    artifactConsumer: false,
  })),
  ...["/api/calculation/ensemble-summary", "/api/calculation/validate-history"].map(path => ({
    method: "POST", path, disposition: "explicit-artifactSelection-or-unchanged-submitted-input-diagnostic",
    artifactConsumer: true,
  })),
  { method: "GET", path: "/api/calculation/fair-artifacts",
    disposition: "pinned-catalog-not-a-claim-of-runtime-availability", artifactConsumer: false },
  ...["manifest", "ensemble", "summary", "members/:memberId"].map(operation => ({
    method: "GET", path: `/api/calculation/fair-artifacts/:artifactId/${operation}`,
    disposition: "exact-version-and-hashes; retained-unaccepted-research-only", artifactConsumer: true,
  })),
] as const;

function refusal(res: Response, error: unknown) {
  const e = error instanceof FairArtifactError ? error :
    new FairArtifactError("FAIR_REQUEST_INVALID", 422, "Invalid retained-artifact diagnostic request.");
  return res.status(e.status).json({ error: e.message, code: e.code, modelPromoted: false,
    scientificAcceptance: "not-accepted", fallbackUsed: false });
}
function provenanceHeaders(res: Response, loaded: LoadedFairArtifact) {
  res.set("Cache-Control", "no-store");
  res.set("X-FaIR-Artifact-Version", loaded.identity.version);
  res.set("X-FaIR-Manifest-SHA256", loaded.identity.manifestSha256);
  res.set("X-FaIR-Ensemble-SHA256", loaded.identity.ensembleSha256);
  res.set("X-FaIR-Member-IDs-SHA256", loaded.identity.memberIdsSha256);
}
const warnings = [
  "Retained upstream example or conditional sensitivity, not an accepted dashboard forecast.",
  "Ensemble fractions are descriptive, not validated real-world probabilities.",
  "Total surface-temperature anomaly is not human-induced attribution or established observational GMST.",
  "Hash identity proves retained content, not scientific acceptance or source publication vintage.",
];
function envelope(loaded: LoadedFairArtifact) {
  return { artifact: loaded.identity, manifest: loaded.manifest, modelPromoted: false,
    scientificAcceptance: "not-accepted", warnings };
}

/** Registered before the original submitted-input handlers; calls next() unless
 * a caller explicitly selects a retained artifact. No default engine changes. */
export function registerFairArtifactRoutes(app: Express, loader = loadFairArtifact) {
  app.get("/api/calculation/fair-artifacts", (req, res) => {
    if (Object.keys(req.query).length) return refusal(res,
      new FairArtifactError("FAIR_SELECTION_INVALID", 400, "Catalog does not accept selection or engine parameters."));
    res.set("Cache-Control", "no-store").json({
      version: "s07-offline-fair-v1", artifacts: fairArtifactCatalog.map(entry => ({
        ...fairArtifactSelection(entry), manifest: entry.manifest,
        availability: "not-checked-until-exact-selection-is-loaded",
      })), routeInventory: fairRouteInventory, modelPromoted: false, scientificAcceptance: "not-accepted", warnings,
    });
  });
  for (const operation of ["manifest", "ensemble", "summary", "members/:memberId"] as const) {
    app.get(`/api/calculation/fair-artifacts/:artifactId/${operation}`, async (req, res) => {
      try {
        const query = { ...req.query };
        const memberSha256 = query.memberSha256;
        if (operation === "members/:memberId") delete query.memberSha256;
        if ("artifactId" in query) throw new FairArtifactError("FAIR_SELECTION_INVALID", 400,
          "artifactId must appear only in the route path.");
        const loaded = await loader({ artifactId: req.params.artifactId, ...query });
        provenanceHeaders(res, loaded);
        if (operation === "members/:memberId") {
          const member = fairMember(loaded, String((req.params as Record<string, string>).memberId));
          if (typeof memberSha256 !== "string" || memberSha256 !== member.memberSha256)
            throw new FairArtifactError("FAIR_MEMBER_HASH_MISMATCH", 409,
              "An exact memberSha256 from the verified manifest is required; no positional or nearest-member fallback.");
          return res.json({ ...envelope(loaded), member });
        }
        if (operation === "manifest") return res.json({ ...envelope(loaded), provenance: loaded.provenance,
          members: loaded.ensemble.memberIds.map(id => {
            const member = fairMember(loaded, id);
            return { memberId: id, memberSha256: member.memberSha256 };
          }) });
        if (operation === "ensemble") return res.json({ ...envelope(loaded), ensemble: loaded.ensemble });
        return res.json({ ...envelope(loaded), summary: summarizeEnsemble(loaded.ensemble) });
      } catch (error) { return refusal(res, error); }
    });
  }
  const summaryRequest = z.object({ artifactSelection: fairArtifactSelectionSchema }).strict();
  app.post("/api/calculation/ensemble-summary", async (req, res, next) => {
    if (req.body?.artifactSelection === undefined) return next();
    try {
      const request = summaryRequest.parse(req.body);
      const loaded = await loader(request.artifactSelection);
      provenanceHeaders(res, loaded);
      return res.json({ ...summarizeEnsemble(loaded.ensemble), ...envelope(loaded) });
    } catch (error) { return refusal(res, error); }
  });
  const historyRequest = z.object({
    artifactSelection: fairArtifactSelectionSchema, simulationKind: z.literal("total"),
    reference: z.unknown(),
  }).strict();
  app.post("/api/calculation/validate-history", async (req, res, next) => {
    if (req.body?.artifactSelection === undefined) return next();
    try {
      const request = historyRequest.parse(req.body);
      const loaded = await loader(request.artifactSelection);
      const diagnostic = historicalValidation({ ensemble: loaded.ensemble,
        simulationKind: "total", reference: request.reference });
      provenanceHeaders(res, loaded);
      return res.json({ ...diagnostic, ...envelope(loaded) });
    } catch (error) { return refusal(res, error); }
  });
  // Explicit selections on incompatible physical/attribution/legacy surfaces
  // must not be silently dropped and passed off as retained-member calculations.
  app.use((req: Request, res: Response, next) => {
    if (!fairRouteInventory.some(route => route.path === req.path)) return next();
    if (req.body?.artifactSelection !== undefined || req.query.artifactId !== undefined) {
      return refusal(res, new FairArtifactError("FAIR_ROUTE_UNSUPPORTED", 409,
        "This surface cannot consume a retained temperature-only ensemble. Use an explicit supported artifact diagnostic; no physical metric substitution."));
    }
    return next();
  });
}

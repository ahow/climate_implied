import type { Express, RequestHandler, Response } from "express";
import { contentHash } from "./calculation/analysisManifest";
import { unpackAnalysisResult } from "./snapshots/resultContract";
import type { RetainedProducerIdentity } from "../shared/downloadManifest";
import { READONLY_PRODUCER_SCENARIO } from "../shared/readonlyConsumer";
import { NATIVE_PRODUCER_SCENARIO } from "../shared/nativeConsumer";

/** Only these completed-response producers retain material inputs today.
 * Headers, query pins, caller payloads and source hashes alone are not proof. */
export const retainedProducerPaths = [
  "/api/cv/summary", "/api/cv/carbon-price", "/api/cv/pe-comparison",
  "/api/cv/sdg-growth", "/api/cv/decarb-bands", "/api/cv/decarb-terciles",
  "/api/cv/decarb-gap/summary", "/api/cv/decarb-gap/timeseries", "/api/cv/backtest",
] as const;
type Loader = (id: string) => Promise<any>;
const proofs = new WeakMap<Response, ReturnType<typeof verifiedProducer>>();
export function responseProducerIdentity(res: Response) {
  return proofs.get(res) ?? null;
}

/** Loader must be the retained archive reader, which verifies referenced source,
 * workbook and ordered overlays, not an HTTP request or a submitted manifest. */
export function verifiedProducer(id: string, loaded: any, result: unknown, producerPath?: string): RetainedProducerIdentity {
  const packed = unpackAnalysisResult(id, {
    version: loaded.version, manifest: loaded.manifest, result: loaded.result,
  });
  const manifest = packed.manifest;
  const material = manifest.settings.materialInputsId;
  if (loaded.materialReplayState !== "referenced-material-archives-verified" ||
      typeof material !== "string" || !/^[a-f0-9]{64}$/.test(material) ||
      !/^[a-f0-9]{64}$/.test(manifest.codeVersion) ||
      !(manifest.scenario === READONLY_PRODUCER_SCENARIO || manifest.scenario === NATIVE_PRODUCER_SCENARIO ||
        retainedProducerPaths.some(path => manifest.scenario === `descriptive-valuation:${path.slice("/api/cv".length)}`)) ||
      (producerPath !== undefined && manifest.scenario !== `descriptive-valuation:${producerPath.slice("/api/cv".length)}`) ||
      // The existing completed-result writer archives Express JSON encoding,
      // including Date/optional-field serialization, not route object identity.
      contentHash(JSON.parse(JSON.stringify(result))) !== contentHash(packed.result))
    throw new Error("Verified retained producer binding unavailable");
  return {
    version: "retained-producer-binding-v1",
    resultId: id, resultHash: contentHash(packed.result), manifestId: manifest.id,
    materialInputsId: material, codeArchiveId: manifest.codeVersion,
    modelVersion: manifest.modelVersion, orderedSnapshotHashes: [...manifest.snapshotHashes],
    scenario: manifest.scenario,
    meaning: "Verified retained completed response and referenced material archives; stored output, not recalculation, original vintage or scientific acceptance",
    scientificAcceptance: false,
  };
}
export function bindProducerIdentity(res: Response, proof: ReturnType<typeof verifiedProducer>) {
  proofs.set(res, proof);
  res.set("X-Producer-Identity", Buffer.from(JSON.stringify(proof)).toString("base64url"));
  res.set("X-Producer-Identity-Encoding", "base64url-json-utf8");
}

/** Does not persist or recompute anything. Existing body bytes remain unchanged.
 * Legacy/current responses without a persisted completed producer remain null. */
export function producerDownloadMiddleware(load: Loader): RequestHandler {
  return (req, res, next) => {
    const producerPath = req.path;
    const stored = /^\/api\/analysis\/results\/([a-f0-9]{64})$/.exec(req.path);
    if (req.method !== "GET" || (!retainedProducerPaths.includes(req.path as any) && !stored)) return next();
    const json = res.json.bind(res);
    res.json = (body: unknown) => {
      const id = stored?.[1] ?? res.getHeader("X-Analysis-Result");
      if (res.statusCode >= 400 || typeof id !== "string") return json(body);
      void load(id).then(loaded => {
        // Preserve legacy replay bodies; lacking material references is not a
        // license to certify them or to silently load today's inputs.
        if (stored && loaded.materialReplayState === "legacy-result-without-material-bundle") {
          json(body);
          return;
        }
        const proof = verifiedProducer(id, loaded, stored ? (body as any)?.result : body, stored ? undefined : producerPath);
        if (!stored) {
          // These are server-written, resolved request-context headers, not
          // request headers, browser selection or query attestation.
          const snapshot = res.getHeader("X-Analysis-Snapshot");
          const overlays = res.getHeader("X-Analysis-Overlays");
          const indicator = res.getHeader("X-Indicator-Snapshot");
          const expected = [snapshot, ...(typeof overlays === "string" ? overlays.split(",") : []),
            ...(typeof indicator === "string" ? [indicator] : [])];
          if (res.getHeader("X-Analysis-Manifest") !== proof.manifestId ||
              res.getHeader("X-Analysis-Material-Inputs") !== proof.materialInputsId ||
              JSON.stringify(expected) !== JSON.stringify(proof.orderedSnapshotHashes))
            throw new Error("Completed producer conflicts with resolved server input context");
        }
        bindProducerIdentity(res, proof);
        json(body);
      }).catch(() => {
        res.status(503);
        json({ error: "Retained producer verification failed; completed response withheld" });
      });
      return res;
    };
    next();
  };
}

/** Same public archive reader and identity as stored replay; never a source
 * reader fallback, write endpoint, caller attestation or private-source export. */
export function registerProducerDownloadRoutes(app: Express, load: Loader) {
  app.get("/api/analysis/results/:id/export.json", async (req, res) => {
    try {
      if (Object.keys(req.query).length) throw new Error("Unexpected export selection");
      const loaded = await load(String(req.params.id));
      const proof = verifiedProducer(String(req.params.id), loaded, loaded.result);
      bindProducerIdentity(res, proof);
      res.set("Cache-Control", "no-store");
      res.set("Content-Type", "application/json; charset=utf-8");
      res.set("Content-Disposition", `attachment; filename="analysis-${proof.resultId}.json"`);
      // Export the exact retained result, not administrative replay metadata.
      res.send(JSON.stringify(loaded.result));
    } catch {
      res.status(422).json({ error: "Exact retained producer export unavailable or invalid; no current fallback" });
    }
  });
}

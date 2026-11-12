import type { Express } from "express";
import { z } from "zod";
import { diffQuerySchema, compareReadonlyArchives, type DiffArchive } from "./snapshots/readonlyDiffContract";
import { unpackAnalysisResult } from "./snapshots/resultContract";
import { historicalType, revisedHistoryType } from "../shared/historicalTypes";

export interface ReadonlyDiffRepository {
  load(id: string, kind: DiffArchive["kind"]): Promise<DiffArchive>;
  results(after?: string): Promise<{ items: { id: string; payload: unknown; recordedAt: string }[]; nextCursor: string | null }>;
}
export function registerReadonlyDiffApi(app: Express, repository: ReadonlyDiffRepository) {
  // Presentation metadata only: keep stored response bytes/analytical hashes intact.
  // A descriptive valuation archive is never promoted to an archived forecast.
  const revisedPaths = new Set(["/api/cv/summary", "/api/cv/carbon-price", "/api/cv/pe-comparison",
    "/api/cv/sdg-growth", "/api/cv/decarb-bands", "/api/cv/decarb-terciles",
    "/api/cv/decarb-gap/summary", "/api/cv/decarb-gap/timeseries", "/api/cv/backtest",
    "/api/projection/historical-trend", "/api/projection/categories/historical-trend"]);
  app.use((req, res, next) => {
    if (req.method !== "GET" || !revisedPaths.has(req.path)) return next();
    const send = res.json;
    res.json = function(body: unknown) {
      if (this.statusCode < 400) {
        this.set("X-Historical-Type-Code", revisedHistoryType.historicalTypeCode);
        this.set("X-Historical-Type-Label", revisedHistoryType.historicalTypeLabel);
      }
      return send.call(this, body);
    };
    next();
  });
  app.get("/api/data/version-diff", async (req, res) => {
    const parsed = diffQuerySchema.extend({ after: z.string().regex(/^[a-f0-9]{64}$/).optional() }).safeParse(req.query);
    if (!parsed.success) return res.status(422).json({ error: "Explicit from, to and supported kind required; no current fallback" });
    try {
      const { after, ...query } = parsed.data;
      const [before, next, page] = await Promise.all([
        repository.load(query.from, query.kind), repository.load(query.to, query.kind), repository.results(after),
      ]);
      const diff = compareReadonlyArchives(query, before, next);
      const affectedAnalyses = page.items.flatMap(item => {
        const result = unpackAnalysisResult(item.id, item.payload);
        const references = [...result.manifest.snapshotHashes, result.manifest.settings.materialInputsId];
        if (!references.includes(query.from) && !references.includes(query.to)) return [];
        return [{ resultId: item.id, manifestId: result.manifest.id,
          scenario: result.manifest.scenario, recordedAt: item.recordedAt,
          ...revisedHistoryType,
          relation: references.includes(query.from) && references.includes(query.to) ? "consumed-both-versions" :
            references.includes(query.from) ? "consumed-before-version" : "consumed-after-version" }];
      });
      return res.set("Cache-Control", "no-store").json({ ...diff, affectedAnalyses,
        scannedResults: page.items.length, nextCursor: page.nextCursor,
        affectedMeaning: "Exact archived dependency references on this page, not recomputed impacts or all possible consumers" });
    } catch {
      return res.status(422).json({ error: "Requested version diff unavailable: missing, corrupt, unsupported-version or mismatched archive; no current fallback" });
    }
  });
  app.get("/api/data/history-types", (_req, res) => {
    res.set("Cache-Control", "no-store").json({
      types: [
        { ...historicalType("ACTUAL_ARCHIVED_FORECAST"),
          rule: "Only a retained output produced at the time; stored-output retrieval is not independent recalculation. Descriptive valuations are not forecasts." },
        { ...historicalType("VERIFIED_PAST_INPUT_SIMULATION"),
          rule: "Every input meets the cutoff, including filings, emissions, classifications, universe, macro and policy; model parameters must be re-estimated without later data." },
        { ...revisedHistoryType, rule: "Everything else, including current-model historical recalculation and revised workbook valuations." },
      ],
      certification: "No verified-past-input run is certified by this read-only view",
    });
  });
}

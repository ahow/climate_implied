import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { candidateInventory, constantScenario, illustrativeScenario, projectNativeEmissions } from "./calculation/emissionsCandidate";
import { resolveEmissionsInputs } from "./calculation/emissionsInputs";
import catReferences from "./calculation/data/catReferences.json";
import {
  getCurrentIndicators,
  getCurrentIndicatorsFromHistorical,
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getTemperatureStats,
  calculateSensitivityAnalysis,
} from "./calculation/forwardProjection";
import { getAllHistoricalIndicatorsWithNowcast } from "./calculation/historicalIndicators";
import { calculateAllCategoryProjections, applyCategoryModifications, type Category } from "./calculation/categoryProjections";
import { calculateRegionalProjections } from "./calculation/regionalProjections";
import { getRecalculatedHistoricalTrend } from "./calculation/historicalRecalculation";
import { getCategoryHistoricalTrend } from "./calculation/categoryHistoricalTrend";
import multer from "multer";
import os from "os";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { cvCompanies, cvTimeSeries, cvDataUploads, cvCarbonPriceCache } from "@shared/schema";
import { carryForwardEmissions, computeImputationStats } from "./climateValuation/emissionsCarryForward";
import { validateRequiredSheets, parseAndPrepare, generateTimeSeriesStreaming } from "./climateValuation/dataProcessor";
import { calculateTotalBasedCarbonPrice, type InferenceMethod } from "./climateValuation/carbonPriceCalculator";
import { computeTercilesOnTheFly } from "./climateValuation/tercileCalculator";
import { calculateSDGGrowthDifferential } from "./climateValuation/sdgGrowthCalculator";
import { calculateDecarbBands } from "./climateValuation/decarbBandCalculator";
import { calculateDecarbTerciles } from "./climateValuation/decarbTercileCalculator";
import { eq, and, desc, sql } from "drizzle-orm";
import { getClimateNewsAnalysis } from "./newsApi/newsService";
import { calculateBacktest, type SignalType } from "./climateValuation/backtestCalculator";
import { validateCvRequest } from "./climateValuation/queryValidation";
import { calculateDecarbGapSummary, calculateDecarbGapTimeSeries, type ScoringMethod as GapScoringMethod } from "./climateValuation/decarbGapCalculator";
import { z } from "zod";
import { runFetch } from "./dataIngestion/orchestrator";
import { startScheduler } from "./dataIngestion/scheduler";
import { loadApprovedOverrides, getOverrideMeta } from "./dataIngestion/overrideStore";
import {
  getPendingValues,
  getValuesForKey,
  approveProposal,
  rejectProposal,
  createManualApproved,
  getRecentRuns,
} from "./dataIngestion/dataStore";
import { INDICATORS, getCuratedValue, getIndicatorDef } from "./dataIngestion/indicatorRegistry";
import { calculationKey } from "./calculation/identity";
import { CALCULATION_VERSION, legacyContext } from "../shared/calculationContract";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `cv_upload_${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

let projectionResultCache: any = null;
let categoryCacheResult: any = null;
let regionalCacheResult: any = null;
let regionalCacheFetchedAt = 0;
const REGIONAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let historicalTrendCacheResult: any = null;
let sensitivityCacheResult: any = null;
let categoryHistoricalTrendCache: any = null;
let projectionInputRevision = "";
const routeCacheRevisions = new Map<string, string>();

function currentProjectionRevision() {
  return calculationKey("climate-inputs", getAllHistoricalIndicatorsWithNowcast());
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use("/api/cv", validateCvRequest);

  await db.update(cvDataUploads)
    .set({ status: "failed", errorMessage: "Processing interrupted by server restart", completedAt: new Date() })
    .where(eq(cvDataUploads.status, "processing"));

  try {
    const dupCheck = await db.execute(sql`
      SELECT COUNT(*) as dup_count FROM (
        SELECT company_id, date FROM cv_time_series GROUP BY company_id, date HAVING COUNT(*) > 1 LIMIT 1
      ) t
    `);
    const hasDuplicates = Number((dupCheck as any).rows?.[0]?.dup_count ?? 0) > 0;
    if (hasDuplicates) {
      console.log("[Startup] Duplicate time series records detected, deduplicating...");
      const delResult = await db.execute(sql`
        DELETE FROM cv_time_series WHERE id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, date ORDER BY id) as rn
            FROM cv_time_series
          ) t WHERE rn > 1
        )
      `);
      console.log("[Startup] Deduplication complete");
    }
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS cv_time_series_company_date_idx ON cv_time_series (company_id, date)`);
    console.log("[Startup] Unique index on cv_time_series(company_id, date) ensured");
  } catch (e: any) {
    console.error("[Startup] Error during dedup/index:", e.message);
  }

  try {
    await db.execute(sql`DELETE FROM cv_carbon_price_cache`);
  } catch (_e) {}

  // Live indicator data pipeline: load approved overrides into memory and start
  // the monthly scheduler. Safe no-ops when there are no approved overrides.
  // A transient DB error at boot must not crash the server; overrides simply
  // stay empty (curated baseline) until the next successful reload.
  try {
    await loadApprovedOverrides();
  } catch (e) {
    console.error("[startup] Failed to load approved overrides:", e);
  }
  startScheduler();

  function clearProjectionCaches() {
    projectionResultCache = null;
    categoryCacheResult = null;
    regionalCacheResult = null;
    historicalTrendCacheResult = null;
    sensitivityCacheResult = null;
    categoryHistoricalTrendCache = null;
    routeCacheRevisions.clear();
  }

  // Revisions include the full effective history (including nowcast), engine,
  // assumptions and RNG. Store a per-route revision to reject late async writes.
  app.use(["/api/projection", "/api/cv"], async (req, res, next) => {
    if (req.method !== "GET") return next();
    try {
      const revision = currentProjectionRevision();
      res.locals.calculationRevision = revision;
      res.setHeader("X-Calculation-Version", CALCULATION_VERSION);
      res.setHeader("X-Calculation-Input-Revision", revision);
      if (revision !== projectionInputRevision) {
        clearProjectionCaches();
        await storage.clearProjectionCaches();
        await db.execute(sql`DELETE FROM projection_cache`);
        projectionInputRevision = revision;
      }
      next();
    } catch (error) { next(error); }
  });

  const validRouteCache = (name: string, res: any) =>
    routeCacheRevisions.get(name) === res.locals.calculationRevision;
  const tagRouteCache = (name: string, res: any) =>
    routeCacheRevisions.set(name, res.locals.calculationRevision);

  app.get("/api/calculation-contract", (_req, res) => {
    const history = getAllHistoricalIndicatorsWithNowcast();
    const latest = history[history.length - 1];
    res.json({
      ...legacyContext(latest?.year ?? new Date().getFullYear(), "all"),
      inputRevision: currentProjectionRevision(),
      indicatorUnits: INDICATORS.map(({ key, unit }) => ({ key, unit })),
      metricDefinitions: {
        reductionRate: "First-decade compound annual emissions decline, percentage points/year",
        temperature: "Legacy 2100 warming; not a validated physical forecast",
        physicalResidualThreshold: "Legacy 5 Gt annual residual (not net zero)",
        financeResidualThreshold: "Legacy 5% of starting annual emissions (not net zero)",
        financeGrowth: "Legacy r - E/P; not a calibrated emissions-decline inference",
      },
      remainingScientificWork: ["inventory reconciliation", "emissions mechanisms", "FaIR",
        "coherent ensemble propagation", "valuation inference", "point-in-time backtesting"],
    });
  });

  app.get("/api/emissions/candidate", (req, res) => {
    if (req.query.scenario !== undefined && !["constant", "transition", "dashboard"].includes(String(req.query.scenario))) {
      return res.status(400).json({ error: "scenario must be constant, transition or dashboard" });
    }
    try {
      const inputs = resolveEmissionsInputs();
      res.json({
        promotion: "blocked-pending-calibration-and-Packages-3-4",
        inventory: candidateInventory(),
        inputs,
        result: projectNativeEmissions(req.query.scenario === "dashboard" ? inputs.diagnostic :
          req.query.scenario === "transition" ? illustrativeScenario : constantScenario),
      });
    } catch (error) {
      res.status(422).json({ error: error instanceof Error ? error.message : "Invalid candidate inputs" });
    }
  });

  // Published reference information only: never feeds the projection engine.
  app.get("/api/reference-scenarios", (_req, res) => {
    res.json(catReferences);
  });

  app.post("/api/refresh", async (_req, res) => {
    try {
      projectionResultCache = null;
      categoryCacheResult = null;
      regionalCacheResult = null;
      historicalTrendCacheResult = null;
      sensitivityCacheResult = null;
      categoryHistoricalTrendCache = null;

      await storage.clearProjectionCaches();
      await db.execute(sql`DELETE FROM projection_cache`);

      res.json({ success: true, message: "All caches cleared. Analysis will re-run on next request." });
    } catch (error: any) {
      console.error("[Refresh] Error clearing caches:", error);
      res.status(500).json({ error: "Failed to refresh analysis" });
    }
  });

  app.get("/api/projection", async (req, res) => {
    try {
      const category = (req.query.category as string) || "all";
      const cacheKey = calculationKey("projection", res.locals.calculationRevision, { category, runs: 10000 });

      if (category === "all" && projectionResultCache && validRouteCache("projection", res)) {
        return res.json(projectionResultCache);
      }

      const cached = await storage.getProjectionCache(cacheKey);
      if (cached) {
        return res.json(cached.resultData);
      }

      const allNowcast = getAllHistoricalIndicatorsWithNowcast();
      const latestData = allNowcast[allNowcast.length - 1];
      let indicators = latestData ? getCurrentIndicatorsFromHistorical(latestData) : getCurrentIndicators();
      const startYear = latestData?.year || new Date().getFullYear();

      const validCategories: Category[] = ['technology', 'policy', 'corporate', 'socioeconomic', 'financial', 'emissions'];
      if (category !== "all" && validCategories.includes(category as Category)) {
        indicators = applyCategoryModifications(indicators, category as Category);
      }

      const trajectory = calculateEmissionsTrajectory(indicators, startYear, 2100, 10000);
      const temperatureDistribution = calculateTemperatureDistribution(trajectory, 10000);
      const tempStats = getTemperatureStats(temperatureDistribution, trajectory);

      const emissionsStart = trajectory[0]?.emissions || 60;
      const emissionsDecadeLater = trajectory[10]?.emissions || 55;
      const emissions2100 = trajectory[trajectory.length - 1]?.emissions || 20;
      const reductionRate = -((Math.pow(emissionsDecadeLater / emissionsStart, 1 / 10) - 1) * 100);

      let netZeroYear: number | null = null;
      const netZeroPoint = trajectory.find(p => p.p50 <= 5.0);
      if (netZeroPoint) {
        netZeroYear = netZeroPoint.year;
      } else if (trajectory.length > 0) {
        const finalPoint = trajectory[trajectory.length - 1];
        const firstPoint = trajectory[0];
        const yearsElapsed = finalPoint.year - firstPoint.year;
        const totalReduction = firstPoint.p50 - finalPoint.p50;
        const avgAnnualReduction = totalReduction / yearsElapsed;
        if (avgAnnualReduction > 0 && finalPoint.p50 > 5.0) {
          const yearsToNetZero = (finalPoint.p50 - 5.0) / avgAnnualReduction;
          netZeroYear = Math.round(finalPoint.year + yearsToNetZero);
        }
      }

      const result = {
        calculation: {
          ...legacyContext(startYear, category),
          inputHash: calculationKey("effective-projection", indicators, { startYear, endYear: 2100, runs: 10000, category }),
          inputRevision: res.locals.calculationRevision,
          runs: 10000,
          seeds: { emissions: startYear * 12345, temperaturePdf: 42 * 12345, temperatureSummary: 99 * 12345 },
          warnings: ["Legacy scientific assumptions retained; RNG corrected only. Not scientifically validated.",
            "Temperature still resamples median cumulative emissions; coherent propagation is deferred to Package 3.",
            "Input observation and availability dates, GWP, GDP basis and currency are not yet reconciled."],
        },
        emissionsTrajectory: trajectory,
        temperatureDistribution: {
          median: tempStats.median,
          mean: tempStats.mean,
          p10: tempStats.p10,
          p90: tempStats.p90,
          pdf: temperatureDistribution,
        },
        indicators,
        metrics: {
          reductionRate,
          temperatureRise: tempStats.median,
          netZeroYear,
          emissionsStart,
          emissionsDecadeLater,
          emissions2100,
        },
      };

      if (category === "all") {
        projectionResultCache = result;
        tagRouteCache("projection", res);
      }

      await storage.setProjectionCache({
        cacheKey,
        projectionYear: startYear,
        category: category === "all" ? null : String(category),
        region: null,
        resultData: result,
      });

      res.json(result);
    } catch (error) {
      console.error("Projection calculation error:", error);
      res.status(500).json({ error: "Failed to calculate projection" });
    }
  });

  app.get("/api/indicators/historical", async (_req, res) => {
    try {
      const data = getAllHistoricalIndicatorsWithNowcast();
      res.json(data);
    } catch (error) {
      console.error("Historical indicators error:", error);
      res.status(500).json({ error: "Failed to fetch historical indicators" });
    }
  });

  app.get("/api/projection/categories", async (_req, res) => {
    try {
      if (categoryCacheResult && validRouteCache("categories", res)) {
        return res.json(categoryCacheResult);
      }
      const result = calculateAllCategoryProjections();
      categoryCacheResult = result;
      tagRouteCache("categories", res);
      res.json(result);
    } catch (error) {
      console.error("Category projections error:", error);
      res.status(500).json({ error: "Failed to calculate category projections" });
    }
  });

  app.get("/api/projection/regions", async (_req, res) => {
    try {
      if (regionalCacheResult && validRouteCache("regions", res) && Date.now() - regionalCacheFetchedAt < REGIONAL_CACHE_TTL_MS) {
        return res.json(regionalCacheResult);
      }
      const result = await calculateRegionalProjections();
      regionalCacheResult = result;
      regionalCacheFetchedAt = Date.now();
      tagRouteCache("regions", res);
      res.json(result);
    } catch (error) {
      console.error("Regional projections error:", error);
      res.status(500).json({ error: "Failed to calculate regional projections" });
    }
  });

  app.get("/api/projection/sensitivity", async (_req, res) => {
    try {
      if (sensitivityCacheResult && validRouteCache("sensitivity", res)) {
        return res.json(sensitivityCacheResult);
      }
      const allNowcast = getAllHistoricalIndicatorsWithNowcast();
      const latestData = allNowcast[allNowcast.length - 1];
      const indicators = latestData ? getCurrentIndicatorsFromHistorical(latestData) : getCurrentIndicators();
      const startYear = latestData?.year || new Date().getFullYear();
      const result = calculateSensitivityAnalysis(indicators, startYear);
      sensitivityCacheResult = result;
      tagRouteCache("sensitivity", res);
      res.json(result);
    } catch (error) {
      console.error("Sensitivity analysis error:", error);
      res.status(500).json({ error: "Failed to calculate sensitivity analysis" });
    }
  });

  app.get("/api/projection/historical-trend", async (_req, res) => {
    try {
      if (historicalTrendCacheResult && validRouteCache("history", res)) {
        return res.json(historicalTrendCacheResult);
      }
      const result = getRecalculatedHistoricalTrend();
      historicalTrendCacheResult = result;
      tagRouteCache("history", res);
      res.json(result);
    } catch (error) {
      console.error("Historical trend error:", error);
      res.status(500).json({ error: "Failed to calculate historical trend" });
    }
  });

  app.get("/api/projection/categories/historical-trend", async (_req, res) => {
    try {
      if (categoryHistoricalTrendCache && validRouteCache("category-history", res)) {
        return res.json(categoryHistoricalTrendCache);
      }
      const result = getCategoryHistoricalTrend();
      categoryHistoricalTrendCache = result;
      tagRouteCache("category-history", res);
      res.json(result);
    } catch (error) {
      console.error("Category historical trend error:", error);
      res.status(500).json({ error: "Failed to calculate category historical trend" });
    }
  });

  app.post("/api/cv/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filename = req.file.originalname;
      if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
        return res.status(400).json({ error: "Please upload an Excel file (.xlsx or .xls)" });
      }

      const [uploadRecord] = await db.insert(cvDataUploads).values({
        filename,
        status: "processing",
      }).returning();

      const uploadId = uploadRecord.id;
      res.json({ uploadId, status: "processing" });

      const filePath = req.file.path;

      (async () => {
        try {
          const startTime = Date.now();
          console.log(`[CV Upload ${uploadId}] Step 1/3: Parsing Excel file (multi-pass)...`);
          const sheetMap = validateRequiredSheets(filePath);
          const ctx = await parseAndPrepare(filePath, sheetMap);

          console.log(`[CV Upload ${uploadId}] Found ${ctx.companyData.stats.totalCompanies} companies. Parsed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

          console.log(`[CV Upload ${uploadId}] Step 2/3: Inserting companies...`);
          const COMPANY_BATCH = 100;
          for (let i = 0; i < ctx.companyData.companies.length; i += COMPANY_BATCH) {
            const batch = ctx.companyData.companies.slice(i, i + COMPANY_BATCH);
            for (const company of batch) {
              await db.insert(cvCompanies).values(company).onConflictDoUpdate({
                target: cvCompanies.isin,
                set: {
                  name: company.name,
                  geography: company.geography,
                  sector: company.sector,
                  industry: company.industry,
                  sdgAlignmentScore: company.sdgAlignmentScore,
                  emissionTarget2050: company.emissionTarget2050,
                },
              });
            }
            if (i % 500 === 0) console.log(`[CV Upload ${uploadId}]   Companies: ${Math.min(i + COMPANY_BATCH, ctx.companyData.companies.length)}/${ctx.companyData.companies.length}`);
          }
          console.log(`[CV Upload ${uploadId}] Companies inserted in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

          const companies = await db.select().from(cvCompanies);
          const isinToDbId = new Map(companies.map(c => [c.isin, c.id]));

          console.log(`[CV Upload ${uploadId}] Step 3/3: Clearing old time series and inserting new data...`);
          await db.delete(cvTimeSeries);
          await db.delete(cvCarbonPriceCache);
          console.log(`[CV Upload ${uploadId}] Old time series and cache cleared`);

          let totalInserted = 0;
          let batchCount = 0;
          let failedBatches = 0;
          const BATCH_SIZE = 500;
          const tsStartTime = Date.now();

          totalInserted = await generateTimeSeriesStreaming(ctx, filePath, isinToDbId, BATCH_SIZE, async (batch) => {
            try {
              await db.insert(cvTimeSeries).values(batch).onConflictDoNothing();
              batchCount++;
              if (batchCount % 20 === 0) {
                const elapsed = ((Date.now() - tsStartTime) / 1000).toFixed(1);
                console.log(`[CV Upload ${uploadId}]   Time series: ${batchCount * BATCH_SIZE} inserted (${elapsed}s elapsed)`);
              }
            } catch (batchError) {
              failedBatches++;
              console.error(`[CV Upload ${uploadId}] Batch ${batchCount + failedBatches} failed:`, batchError instanceof Error ? batchError.message : batchError);
              let chunkSuccesses = 0;
              for (let i = 0; i < batch.length; i += 50) {
                try {
                  await db.insert(cvTimeSeries).values(batch.slice(i, i + 50)).onConflictDoNothing();
                  chunkSuccesses++;
                } catch (chunkErr) {
                  console.error(`[CV Upload ${uploadId}] Chunk ${i}-${i+50} failed:`, chunkErr instanceof Error ? chunkErr.message : chunkErr);
                }
              }
              console.log(`[CV Upload ${uploadId}] Fallback: ${chunkSuccesses}/${Math.ceil(batch.length / 50)} chunks succeeded`);
            }
          });
          if (failedBatches > 0) {
            console.log(`[CV Upload ${uploadId}] Warning: ${failedBatches} batches had errors (retried with smaller chunks)`);
          }
          console.log(`[CV Upload ${uploadId}] Time series: ${totalInserted} total in ${((Date.now() - tsStartTime) / 1000).toFixed(1)}s`);

          try { fs.unlinkSync(filePath); } catch (_e) {}
          console.log(`[CV Upload ${uploadId}] File deleted from disk`);

          ctx.releaseMemory();

          await db.update(cvDataUploads).set({
            status: "completed",
            companiesCount: ctx.companyData.stats.totalCompanies,
            timePeriodsCount: ctx.companyData.stats.totalTimePeriods,
            completedAt: new Date(),
          }).where(eq(cvDataUploads.id, uploadId));

          const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`[CV Upload ${uploadId}] Processing completed in ${totalTime}s. ${totalInserted} time series records.`);
        } catch (error) {
          console.error(`[CV Upload ${uploadId}] Error:`, error);
          try { fs.unlinkSync(filePath); } catch (_e) {}
          await db.update(cvDataUploads).set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          }).where(eq(cvDataUploads.id, uploadId));
        }
      })();
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  app.get("/api/cv/uploads", async (_req, res) => {
    try {
      await db.update(cvDataUploads)
        .set({ status: "failed", errorMessage: "Upload timed out (no progress for 15 minutes)", completedAt: new Date() })
        .where(and(
          eq(cvDataUploads.status, "processing"),
          sql`${cvDataUploads.createdAt} < NOW() - INTERVAL '15 minutes'`
        ));

      const uploads = await db.select().from(cvDataUploads).orderBy(desc(cvDataUploads.id));
      res.json(uploads);
    } catch (error) {
      console.error("Get uploads error:", error);
      res.status(500).json({ error: "Failed to fetch uploads" });
    }
  });

  app.post("/api/cv/upload/:id/reset", async (req, res) => {
    try {
      const uploadId = parseInt(req.params.id);
      const [upload] = await db.select().from(cvDataUploads).where(eq(cvDataUploads.id, uploadId)).limit(1);
      if (!upload) return res.status(404).json({ error: "Upload not found" });
      if (upload.status !== "processing" && upload.status !== "failed") {
        return res.status(400).json({ error: "Upload is not in a stuck or failed state" });
      }

      const [tsCount] = await db.select({ count: sql<number>`count(*)` }).from(cvTimeSeries);
      const [compCount] = await db.select({ count: sql<number>`count(*)` }).from(cvCompanies);

      if (tsCount.count > 0 && compCount.count > 0) {
        await db.update(cvDataUploads).set({
          status: "completed",
          companiesCount: compCount.count,
          completedAt: new Date(),
        }).where(eq(cvDataUploads.id, uploadId));
        res.json({ message: "Upload recovered", companiesCount: compCount.count, timeSeriesCount: tsCount.count });
      } else {
        await db.update(cvDataUploads).set({
          status: "failed",
          errorMessage: "Reset: no data found in database",
          completedAt: new Date(),
        }).where(eq(cvDataUploads.id, uploadId));
        res.json({ message: "Upload marked as failed - no data found. Please re-upload." });
      }
    } catch (error) {
      console.error("Reset upload error:", error);
      res.status(500).json({ error: "Failed to reset upload" });
    }
  });

  app.get("/api/cv/upload/:id/status", async (req, res) => {
    try {
      const uploadId = parseInt(req.params.id);
      const [result] = await db.select().from(cvDataUploads).where(eq(cvDataUploads.id, uploadId)).limit(1);
      if (!result) return res.status(404).json({ error: "Upload not found" });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch upload status" });
    }
  });

  app.get("/api/cv/dimensions", async (_req, res) => {
    try {
      const companies = await db.select().from(cvCompanies);
      const sectors = Array.from(new Set(companies.map(c => c.sector).filter(Boolean))).sort() as string[];
      const geographies = Array.from(new Set(companies.map(c => c.geography).filter(Boolean))).sort() as string[];
      res.json({ sectors, geographies });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dimensions" });
    }
  });

  app.get("/api/cv/carbon-price", async (req, res) => {
    try {
      const uploadId = Number(req.query.uploadId);
      if (isNaN(uploadId)) return res.status(400).json({ error: "uploadId is required and must be a number" });
      const [dataset] = await db.select().from(cvDataUploads).where(eq(cvDataUploads.id, uploadId));
      if (!dataset) return res.status(404).json({ error: "Upload not found" });
      if (dataset.status !== "completed") return res.status(409).json({ error: "Upload is not completed" });
      const method = req.query.method as string;
      if (method !== "absolute" && method !== "sector_relative") return res.status(400).json({ error: "method must be 'absolute' or 'sector_relative'" });
      const includeScope3 = req.query.includeScope3 === "true";
      const winsorize = req.query.winsorize !== "false";
      const winsorizePercentile = req.query.winsorizePercentile === undefined ? 5 : Number(req.query.winsorizePercentile);
      const inferenceMethod = (req.query.inferenceMethod as InferenceMethod) || "carbon_intensity";
      const validMethods: InferenceMethod[] = ["carbon_intensity", "climate_revenue", "decarbonization_ambition"];
      if (!validMethods.includes(inferenceMethod)) {
        return res.status(400).json({ error: "inferenceMethod must be 'carbon_intensity', 'climate_revenue', or 'decarbonization_ambition'" });
      }

      const geography = req.query.geography as string | undefined;
      const results = await calculateTotalBasedCarbonPrice(uploadId, method, includeScope3, winsorize, winsorizePercentile, inferenceMethod, geography);

      const sorted = results.sort((a, b) => a.date.getTime() - b.date.getTime());
      res.json(sorted);
    } catch (error) {
      console.error("Carbon price calculation error:", error);
      res.status(500).json({ error: "Failed to calculate carbon prices" });
    }
  });

  app.get("/api/cv/pe-comparison", async (req, res) => {
    try {
      const method = req.query.method as string;
      if (method !== "absolute" && method !== "sector_relative") return res.status(400).json({ error: "method must be 'absolute' or 'sector_relative'" });
      const includeScope3 = req.query.includeScope3 === "true";

      const results = await computeTercilesOnTheFly(method, includeScope3);
      res.json(results);
    } catch (error) {
      console.error("PE comparison error:", error);
      res.status(500).json({ error: "Failed to calculate PE comparison" });
    }
  });

  app.get("/api/cv/sdg-growth", async (req, res) => {
    try {
      const costOfEquity = parseFloat(req.query.costOfEquity as string) || 0.08;
      if (costOfEquity <= 0 || costOfEquity > 1) {
        return res.status(400).json({ error: "costOfEquity must be between 0 and 1 (e.g., 0.08 for 8%)" });
      }
      const geography = req.query.geography as string | undefined;
      const results = await calculateSDGGrowthDifferential(costOfEquity, geography);
      res.json(results);
    } catch (error) {
      console.error("SDG growth calculation error:", error);
      res.status(500).json({ error: "Failed to calculate SDG growth differential" });
    }
  });

  app.get("/api/cv/decarb-bands", async (_req, res) => {
    try {
      const results = await calculateDecarbBands();
      res.json(results);
    } catch (error) {
      console.error("Decarb bands calculation error:", error);
      res.status(500).json({ error: "Failed to calculate decarbonization bands" });
    }
  });

  app.get("/api/cv/decarb-terciles", async (req, res) => {
    try {
      const validMethods = ["absolute", "sector_relative", "sub_sector_relative", "industry_relative"] as const;
      const rawMethod = req.query.method as string;
      const method = validMethods.includes(rawMethod as any) ? rawMethod as typeof validMethods[number] : "sector_relative";
      const costOfEquity = req.query.costOfEquity ? parseFloat(req.query.costOfEquity as string) : 0.08;
      const geography = req.query.geography as string | undefined;
      const results = await calculateDecarbTerciles(method, costOfEquity, geography);
      res.json(results);
    } catch (error) {
      console.error("Decarb terciles calculation error:", error);
      res.status(500).json({ error: "Failed to calculate decarbonization terciles" });
    }
  });

  app.get("/api/cv/summary", async (_req, res) => {
    try {
      const companies = await db.select().from(cvCompanies);
      const uploads = await db.select().from(cvDataUploads).orderBy(desc(cvDataUploads.id)).limit(1);

      const dateRange = await db.select({
        minDate: sql<string>`MIN(${cvTimeSeries.date})`,
        maxDate: sql<string>`MAX(${cvTimeSeries.date})`,
        recordCount: sql<number>`COUNT(*)`,
      }).from(cvTimeSeries);

      const rawTimeSeries = await db.select().from(cvTimeSeries);
      const imputation = computeImputationStats(carryForwardEmissions(rawTimeSeries));

      res.json({
        companiesCount: companies.length,
        latestUpload: uploads[0] || null,
        dateRange: dateRange[0] || null,
        sectors: Array.from(new Set(companies.map(c => c.sector).filter(Boolean))).length,
        geographies: Array.from(new Set(companies.map(c => c.geography).filter(Boolean))).length,
        imputation,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch summary" });
    }
  });

  async function getProjectedRate(): Promise<number> {
    const revision = currentProjectionRevision();
    const cacheKey = calculationKey("projection", revision, { category: "all", runs: 10000 });
    if (projectionResultCache?.metrics?.reductionRate != null && routeCacheRevisions.get("projection") === revision) {
      return projectionResultCache.metrics.reductionRate;
    }
    const cached = await storage.getProjectionCache(cacheKey);
    const cachedData = cached?.resultData as any;
    if (cachedData?.metrics?.reductionRate != null) {
      projectionResultCache = cachedData;
      routeCacheRevisions.set("projection", revision);
      return cachedData.metrics.reductionRate;
    }
    const rateOnly = await storage.getProjectionCache(calculationKey("finance-projected-rate", revision, { runs: 10000 }));
    const rateOnlyData = rateOnly?.resultData as any;
    if (rateOnlyData?.metrics?.reductionRate != null) return rateOnlyData.metrics.reductionRate;
    const allNowcast = getAllHistoricalIndicatorsWithNowcast();
    const latestData = allNowcast[allNowcast.length - 1];
    const indicators = latestData ? getCurrentIndicatorsFromHistorical(latestData) : getCurrentIndicators();
    const startYear = latestData?.year || new Date().getFullYear();
    const trajectory = calculateEmissionsTrajectory(indicators, startYear, 2100, 10000);
    const temperatureDistribution = calculateTemperatureDistribution(trajectory, 10000);
    const tempStats = getTemperatureStats(temperatureDistribution, trajectory);
    const emissionsStart = trajectory[0]?.emissions || 60;
    const emissionsDecadeLater = trajectory[10]?.emissions || 55;
    const emissions2100 = trajectory[trajectory.length - 1]?.emissions || 20;
    const reductionRate = -((Math.pow(emissionsDecadeLater / emissionsStart, 1 / 10) - 1) * 100);

    let netZeroYear: number | null = null;
    const netZeroPoint = trajectory.find(p => p.p50 <= 5.0);
    if (netZeroPoint) {
      netZeroYear = netZeroPoint.year;
    }

    const result = {
      emissionsTrajectory: trajectory,
      temperatureDistribution: {
        median: tempStats.median,
        mean: tempStats.mean,
        p10: tempStats.p10,
        p90: tempStats.p90,
        pdf: temperatureDistribution,
      },
      indicators,
      metrics: {
        reductionRate,
        temperatureRise: tempStats.median,
        netZeroYear,
        emissionsStart,
        emissionsDecadeLater,
        emissions2100,
      },
    };

    // This reduced finance calculation is NOT the full headline response.
    // Do not poison the headline cache with its different threshold semantics.
    await storage.setProjectionCache({
      cacheKey: calculationKey("finance-projected-rate", revision, { runs: 10000 }),
      projectionYear: startYear,
      resultData: result,
    });

    return reductionRate;
  }

  app.get("/api/cv/decarb-gap/summary", async (req, res) => {
    try {
      const method = (req.query.method as GapScoringMethod) || "sector_relative";
      const geography = req.query.geography as string | undefined;
      const costOfEquity = parseFloat(req.query.costOfEquity as string) || 0.08;
      const projectedRate = await getProjectedRate();

      const result = await calculateDecarbGapSummary(projectedRate, method, costOfEquity, geography);
      res.json(result);
    } catch (error) {
      console.error("Decarb gap summary error:", error);
      res.status(500).json({ error: "Failed to calculate decarb gap summary" });
    }
  });

  app.get("/api/cv/decarb-gap/timeseries", async (req, res) => {
    try {
      const method = (req.query.method as GapScoringMethod) || "sector_relative";
      const geography = req.query.geography as string | undefined;
      const costOfEquity = parseFloat(req.query.costOfEquity as string) || 0.08;
      const projectedRate = await getProjectedRate();

      const result = await calculateDecarbGapTimeSeries(projectedRate, method, costOfEquity, geography);
      res.json(result);
    } catch (error) {
      console.error("Decarb gap timeseries error:", error);
      res.status(500).json({ error: "Failed to calculate decarb gap timeseries" });
    }
  });

  app.get("/api/cv/backtest", async (req, res) => {
    try {
      const validSignals: SignalType[] = ["carbon_intensity", "sdg_exposure", "decarb_ambition", "decarb_gap"];
      const signal = (req.query.signal as SignalType) || "carbon_intensity";
      if (!validSignals.includes(signal)) {
        return res.status(400).json({ error: "signal must be 'carbon_intensity', 'sdg_exposure', 'decarb_ambition', or 'decarb_gap'" });
      }
      const trackingErrorLimit = req.query.trackingError === undefined ? 2 : Number(req.query.trackingError);
      if (trackingErrorLimit <= 0 || trackingErrorLimit > 20) {
        return res.status(400).json({ error: "trackingError must be greater than 0 and at most 20 percentage points (2 means 2%)" });
      }
      const scoringMethod = (req.query.method as string) || (signal === "decarb_gap" ? "sector_relative" : "absolute");
      const geography = req.query.geography as string | undefined;

      let projectedRate: number | undefined;
      let projectedRatesByYear: Map<number, number> | undefined;
      if (signal === "decarb_gap") {
        projectedRate = await getProjectedRate();
        const historicalTrend = getRecalculatedHistoricalTrend();
        projectedRatesByYear = new Map<number, number>();
        for (const point of historicalTrend) {
          projectedRatesByYear.set(point.year, point.reductionRate);
        }
      }

      const results = await calculateBacktest(signal, trackingErrorLimit, scoringMethod, geography, projectedRate, projectedRatesByYear);
      res.json(req.query.format === "series" ? results.series : results);
    } catch (error) {
      console.error("Backtest calculation error:", error);
      res.status(500).json({ error: "Failed to calculate backtest" });
    }
  });

  app.get("/api/news/climate", async (_req, res) => {
    try {
      const months = parseInt(String(_req.query.months) || "12", 10);
      const validMonths = Math.min(Math.max(months, 1), 24);
      const result = await getClimateNewsAnalysis(validMonths);
      res.json(result);
    } catch (error: any) {
      console.error("[NewsAPI] Error:", error.message);
      if (error.message.includes("NEWSAPI_KEY")) {
        res.status(503).json({ error: "News API key not configured" });
      } else {
        res.status(500).json({ error: "Failed to fetch climate news analysis" });
      }
    }
  });

  // ===== Live indicator data pipeline endpoints =====

  async function invalidateAfterApproval() {
    await loadApprovedOverrides();
    clearProjectionCaches();
    await storage.clearProjectionCaches();
    try {
      await db.execute(sql`DELETE FROM projection_cache`);
    } catch (_e) {}
  }

  app.get("/api/data/indicators", async (_req, res) => {
    try {
      // Report the value the MODEL actually consumes: the last row of the
      // nowcast series (same path as /api/projection), so the page never shows a
      // different "applied" value than the projection input.
      const resolved = getAllHistoricalIndicatorsWithNowcast();
      const latestRow = resolved[resolved.length - 1];
      const pending = await getPendingValues();
      const pendingByKey: Record<string, number> = {};
      for (const p of pending) {
        pendingByKey[p.indicatorKey] = (pendingByKey[p.indicatorKey] ?? 0) + 1;
      }

      const indicators = INDICATORS.map((def) => {
        const appliedYear = latestRow.year;
        const appliedValue = (latestRow as any)[def.key] as number;
        const meta = getOverrideMeta(def.key, appliedYear);
        // The applied row is a nowcast unless an approved override pins this cell.
        const provenance = meta ? meta.method : latestRow.isNowcast ? "nowcast" : "curated";
        return {
          key: def.key,
          label: def.label,
          unit: def.unit,
          category: def.category,
          source: def.source,
          tier: def.tier,
          fetchMethod: def.fetchMethod,
          decimals: def.decimals,
          appliedYear,
          appliedValue,
          appliedIsNowcast: meta ? false : latestRow.isNowcast,
          provenance,
          provenanceSource: meta ? meta.source : def.source,
          provenanceAsOf: meta ? meta.asOfDate ?? null : null,
          curatedLatest: getCuratedValue(def.key),
          pendingCount: pendingByKey[def.key] ?? 0,
        };
      });

      res.json({ indicators, baselineYear: 2024, latestYear: latestRow.year });
    } catch (error) {
      console.error("[data] indicators error:", error);
      res.status(500).json({ error: "Failed to load indicators" });
    }
  });

  app.get("/api/data/indicator/:key", async (req, res) => {
    try {
      const key = req.params.key;
      const def = getIndicatorDef(key);
      if (!def) return res.status(404).json({ error: "Unknown indicator" });

      // Use the same nowcast path the model consumes so the detail chart matches
      // the projection input, including any approved future-year override cells.
      const resolved = getAllHistoricalIndicatorsWithNowcast();
      const series = resolved.map((row) => {
        const meta = getOverrideMeta(key, row.year);
        const method = meta ? meta.method : row.isNowcast ? "nowcast" : "curated";
        const source = meta
          ? meta.source
          : row.isNowcast
            ? "Nowcast (estimated)"
            : "Curated baseline";
        return {
          year: row.year,
          value: (row as any)[key] as number,
          source,
          method,
          asOfDate: meta ? meta.asOfDate ?? null : null,
          sourceUrl: meta ? meta.sourceUrl ?? null : null,
          overridden: !!meta,
          isNowcast: meta ? false : row.isNowcast,
        };
      });
      const proposals = await getValuesForKey(key);
      res.json({ def, series, proposals });
    } catch (error) {
      console.error("[data] indicator detail error:", error);
      res.status(500).json({ error: "Failed to load indicator" });
    }
  });

  app.post("/api/data/refresh", async (_req, res) => {
    try {
      const summary = await runFetch("manual");
      res.json(summary);
    } catch (error) {
      console.error("[data] refresh error:", error);
      res.status(500).json({ error: "Failed to run data refresh" });
    }
  });

  app.get("/api/data/runs", async (_req, res) => {
    try {
      const runs = await getRecentRuns(10);
      res.json({ runs });
    } catch (error) {
      console.error("[data] runs error:", error);
      res.status(500).json({ error: "Failed to load runs" });
    }
  });

  app.post("/api/data/proposals/:id/approve", async (req, res) => {
    try {
      const updated = await approveProposal(req.params.id);
      if (!updated) return res.status(404).json({ error: "Proposal not found" });
      await invalidateAfterApproval();
      res.json(updated);
    } catch (error) {
      console.error("[data] approve error:", error);
      res.status(500).json({ error: "Failed to approve proposal" });
    }
  });

  app.post("/api/data/proposals/:id/reject", async (req, res) => {
    try {
      const updated = await rejectProposal(req.params.id);
      if (!updated) return res.status(404).json({ error: "Proposal not found" });
      res.json(updated);
    } catch (error) {
      console.error("[data] reject error:", error);
      res.status(500).json({ error: "Failed to reject proposal" });
    }
  });

  app.post("/api/data/indicator/:key/manual", async (req, res) => {
    try {
      const key = req.params.key;
      const def = getIndicatorDef(key);
      if (!def) return res.status(404).json({ error: "Unknown indicator" });

      const schema = z.object({
        year: z.number().int().min(2000).max(2100),
        value: z.number().finite(),
        note: z.string().max(500).optional(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      }

      const created = await createManualApproved({
        indicatorKey: key,
        year: parsed.data.year,
        value: parsed.data.value,
        note: parsed.data.note,
      });
      await invalidateAfterApproval();
      res.json(created);
    } catch (error) {
      console.error("[data] manual entry error:", error);
      res.status(500).json({ error: "Failed to save manual value" });
    }
  });

  return httpServer;
}

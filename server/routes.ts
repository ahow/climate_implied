import type { Express } from "express";
import { nativeCandidateHandler } from "./nativeCandidateApi";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { candidateInventory, constantScenario, illustrativeScenario, projectNativeEmissions } from "./calculation/emissionsCandidate";
import { resolveEmissionsInputs } from "./calculation/emissionsInputs";
import catReferences from "./calculation/data/catReferences.json";
import { newsMonthWindow } from "./newsApi/requestOptions";
import { fcfeFromOperatingCashFlow, fcfeFromEarnings, pairedGrowthGap,
  summarizeNetZeroYears, valuationScenarioEligibility } from "./calculation/researchCorrections";
import { equityValue, reverseEquityGrowth } from "./calculation/reverseValuation";
import { publicValuationResult } from "./calculation/publicValuationContract";
import { resolveSnapshot, snapshotContext, loadSnapshot } from "./snapshots/store";
import { applyOverlays } from "./snapshots/overlayContract";
import { loadOverlay, overlayContext } from "./snapshots/overlays";
import { overlaySelection } from "./snapshots/requestContract";
import { summarizeMemberMetrics } from "./calculation/memberMetrics";
import { exactMemberAttribution } from "./calculation/memberAttribution";
import { projectCompanyMembers } from "./calculation/companyProjection";
import { getCompanyCoverage } from "./snapshots/companyCoverage";
import {listCompanyOperatingReviews,projectReviewedCompany} from "./snapshots/companyOperatingReview";
import {projectionResponseSchema,PROJECTION_RESPONSE_VERSION,type ProjectionResponse} from "../shared/projectionResponse";
import { detachProjectionCacheResponse } from "./calculation/projectionCacheResponse";
import { loadIndicatorSnapshot } from "./snapshots/indicators";
import { loadRegionalInputs } from "./snapshots/regional";
import { calculateRegionalFromInputs } from "./calculation/regionalProjections";
import { loadAnalysisResult, saveAnalysisResult } from "./snapshots/results";
import { cvAnalysisSnapshots } from "@shared/schema";
import { snapshotsAvailable } from "./snapshots/store";
import { snapshotSelection, snapshotInventoryQuery, storedReplayRequest, historicalRequestPolicy } from "./snapshots/requestContract";
import { loadCompaniesAndTimeSeries } from "./climateValuation/sharedUtils";
import { createManifest } from "./calculation/analysisManifest";
import { driverEvidenceRegistry } from "./calculation/driverEvidence";
import { longShortResearch } from "./climateValuation/longShortResearch";
import { cashFlowValue, reverseCashFlowGrowth } from "./calculation/cashFlowValuation";
import { requestOverrides, runWithOverrideRows } from "./dataIngestion/requestOverrides";
import {
  getCurrentIndicators,
  getCurrentIndicatorsFromHistorical,
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getTemperatureStats,
  calculateSensitivityAnalysis,
} from "./calculation/forwardProjection";
import { getAllHistoricalIndicators, getAllHistoricalIndicatorsWithNowcast } from "./calculation/historicalIndicators";
import { calculateAllCategoryProjections, applyCategoryModifications, type Category } from "./calculation/categoryProjections";
import { calculateRegionalProjections } from "./calculation/regionalProjections";
import { getRecalculatedHistoricalTrend } from "./calculation/historicalRecalculation";
import { historicalTrajectoryMetrics } from "./calculation/historicalMetrics";
import { selectedTrajectoryThresholdContext } from "./calculation/thresholdDiagnostic";
import { nativeCandidateResidualDiagnostics, regionalNativeResidualDiagnostics } from "./calculation/nativeThresholdDiagnostics";
import { projectRegionalMember } from "./calculation/regionalEngine";
import { nativeResidualDiagnosticsSchema, regionalNativeResidualRequestSchema } from "@shared/nativeThresholdSchema";
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
import { eq, and, asc, gt, desc, sql } from "drizzle-orm";
import { getClimateNewsAnalysis } from "./newsApi/newsService";
import { originalNominalAssessmentHandler } from "./calculation/originalNominalAssessmentHandler";
import type { SignalType } from "./climateValuation/backtestCalculator";
import { calculateBacktest } from "./climateValuation/walkForwardBacktest";
import { validateCvRequest } from "./climateValuation/queryValidation";
import { calculateDecarbGapSummary, calculateDecarbGapTimeSeries, type ScoringMethod as GapScoringMethod } from "./climateValuation/decarbGapCalculator";
import { z } from "zod";
import { runFetch } from "./dataIngestion/orchestrator";
import { startScheduler } from "./dataIngestion/scheduler";
import { loadApprovedOverrides, getOverrideMeta } from "./dataIngestion/overrideStore";
import {
  getPendingValues,
  getApprovedValues,
  getValuesForKey,
  approveProposal,
  rejectProposal,
  createManualApproved,
  getRecentRuns,
} from "./dataIngestion/dataStore";
import { INDICATORS, getCuratedValue, getIndicatorDef } from "./dataIngestion/indicatorRegistry";
import { calculationKey } from "./calculation/identity";
import { CALCULATION_VERSION, legacyContext } from "../shared/calculationContract";
import { checkFinancialProvider, financialProviderStatus } from "./financialData/status";
import { listFinancialReviews } from "./financialData/reviewStore";
import { captureMaterialInputs } from "./snapshots/materialInputs";
import { fieldSemantics } from "../shared/fieldSemantics";
import { outputFieldSemantics,bindOutputFields,bindNestedOutput } from "../shared/outputFieldSemantics";
import { calculationReadiness } from "./calculation/readiness";
import { historicalValidation } from "./calculation/historicalValidation";
import { auditVintages } from "./calculation/vintageAudit";
import { validateNativePair } from "./calculation/nativePathwayContract";
import { remainingApiBindings } from "../shared/remainingFieldSemantics";
import { bindKnownPersistedSummary, bindFetchSummaryEvidence } from "./dataIngestion/summaryContract";
import { loadFetchSummaryEvidence } from "./dataIngestion/summaryArchive";
import { summarizeEnsemble } from "./calculation/ensemble";
import { evaluateHoldout } from "./calculation/evaluation";
import { evaluateSignal } from "./calculation/signalResearch";
import { registerCompanyConditionalRoutes } from "./companyConditionalApi";
import { registerFairArtifactRoutes } from "./calculation/fairArtifactRoutes";
import { legacyExportProducerMiddleware } from "./snapshots/legacyExportProducer";
import { captureNewsExportInputs, retainNewsExport } from "./snapshots/newsExportProducer";
import { bindProducerIdentity } from "./producerDownload";
import { bindReportRelease } from "./snapshots/reportExportProducer";
import { rememberReportRelease } from "./snapshots/reportMaterialContext";

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, file, cb) => cb(null, `cv_upload_${Date.now()}_${file.originalname}`),
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
});

let projectionResultCache: ProjectionResponse | null = null;
let categoryCacheResult: ReturnType<typeof calculateAllCategoryProjections> | null = null;
let regionalCacheResult: any = null;
let regionalCacheFetchedAt = 0;
const REGIONAL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let historicalTrendCacheResult: ReturnType<typeof getRecalculatedHistoricalTrend> | null = null;
let sensitivityCacheResult: any = null;
let categoryHistoricalTrendCache: ReturnType<typeof getCategoryHistoricalTrend> | null = null;
let projectionInputRevision = "";
const routeCacheRevisions = new Map<string, string>();

function currentProjectionRevision() {
  return calculationKey("climate-inputs", getAllHistoricalIndicatorsWithNowcast());
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  registerCompanyConditionalRoutes(app);
  registerFairArtifactRoutes(app);
  // Exact route-qualified metadata for remaining original response slots.
  // No authorization, mutation or run-summary wire-value changes.
  app.use((req, res, next) => {
    const match=remainingApiBindings.find(([surface])=>{
      const [method,...parts]=surface.replace(/^API /,"").split(" ");
      const pattern=parts.join(" ").slice(1,-1).split("/").map(p=>p.startsWith(":")?"[^/]+":p).join("/");
      return req.method===method && new RegExp(`^${pattern}$`).test(req.path);
    });
    if(!match) return next();
    const send=res.json.bind(res);
    res.json=((body:unknown)=>{
      if(res.statusCode<400 || (match[1]==="health" && body && typeof body==="object" && "status" in body)) {
        const prefix=match[1],ids=new Set<string>();
        const summaryEvidence=prefix==="fetchRuns" && body && typeof body==="object" && "summaryEvidence" in body
          ? body.summaryEvidence as Awaited<ReturnType<typeof loadFetchSummaryEvidence>> : {};
        const visit=(value:unknown,path:string,owningRunId?:string):void => {
           if(prefix==="fetchRuns"&&path==="summaryEvidence") {
             // Supplemental run-ID map: source paths are identifiers, not new
             // semantic leaves. Never traverse arbitrary historical raw JSON.
             for(const evidence of Object.values(summaryEvidence))
               for(const field of bindFetchSummaryEvidence(evidence)) ids.add(field.id);
             return;
           }
           if(prefix==="fetchRuns"&&path==="runs[].summary") {
             // Container documentation does NOT certify arbitrary historical leaves.
             ids.add("fetchRuns.runs[].summary");
             for(const claim of bindKnownPersistedSummary(value,owningRunId ? summaryEvidence[owningRunId] : undefined))
               ids.add(claim.id);
             return;
           }
          if(Array.isArray(value)) { for(const row of value) visit(row,`${path}[]`,owningRunId); return; }
          if(value!==null && typeof value==="object" && !(value instanceof Date)) {
            const runId=prefix==="fetchRuns" && path==="runs[]" && "id" in value && typeof value.id==="string"
              ? value.id : owningRunId;
            for(const [key,child] of Object.entries(value)) visit(child,path?`${path}.${key}`:key,runId);
            return;
          }
          // Root response arrays use row-relative IDs, matching the census.
          const id=`${prefix}.${path.replace(/^\[\]\./,"")}`;
          if(!outputFieldSemantics.some(f=>f.id===id)) throw new Error(`Unmapped response semantic: ${id}`);
          ids.add(id);
        };
        visit(body,"");
        res.set("X-Field-Semantics",Array.from(ids).sort().join(","));
      }
      return send(body);
    }) as typeof res.json;
    next();
  });
  app.get("/api/calculation/field-semantics",(_req,res)=>{
    const response = {
      version:"core-fields-1",coverage:"Core fields only; additional output fields remain unreconciled",
      fields:fieldSemantics,qualifiedFields:outputFieldSemantics,
    };
    res.set("X-Field-Semantics",bindNestedOutput("semanticRegistry",response).map(f=>f.id).join(","));
    res.json(response);
  });
  app.get("/api/build-info", (_req, res) => {
    const candidate = process.env.RAILWAY_GIT_COMMIT_SHA;
    res.set("Cache-Control", "no-store").json({
      sourceCommit: candidate && /^[a-f0-9]{40}$/i.test(candidate) ? candidate : null,
      calculationVersion: CALCULATION_VERSION,
      sourceCommitMeaning: "hosting-supplied Git revision; null means not recorded",
    });
  });
  app.get("/api/calculation/company-coverage",async(req,res)=>{
    const parsed=z.object({
      observationDate:z.string().date().optional(),
      informationCutoff:z.string().datetime({offset:true}).optional(),
      snapshotId:z.string().regex(/^[a-f0-9]{64}$/).optional(),
    }).strict().safeParse(req.query);
    res.set("Cache-Control","no-store");
    if(!parsed.success)return res.status(422).json({error:"Only scalar observationDate, informationCutoff and snapshotId are supported"});
    const informationCutoff=parsed.data.informationCutoff??new Date().toISOString();
    if(Date.parse(informationCutoff)>Date.now())return res.status(422).json({error:"Future information cutoff refused"});
    if(parsed.data.observationDate&&parsed.data.observationDate>new Date(informationCutoff).toISOString().slice(0,10))
      return res.status(422).json({error:"Observation after information cutoff refused"});
    try {
      const result=await getCompanyCoverage({...parsed.data,informationCutoff});
      const proof = await bindReportRelease(res, result, result, parsed.data);
      if (proof) bindProducerIdentity(res, proof);
      res.set("X-Field-Semantics",bindNestedOutput("companyCoverage",result).map(f=>f.id).join(","));
      return res.json(result);
    }catch(error){
      return res.status(503).json({error:"Coverage unavailable: selected workbook/review evidence could not be verified"});
    }
  });
  app.use("/api", async (req, res, next) => {
    if (req.method !== "GET") return next();
    let policy: ReturnType<typeof historicalRequestPolicy>;
    try { policy = historicalRequestPolicy(req.path, req.query); }
    catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "Invalid historical selection" });
    }
    try {
      const selected = policy.indicators;
      if (storedReplayRequest(req.path)) {
        if (selected !== undefined || req.query.snapshotId !== undefined)
          return res.status(422).json({ error: "Stored-output replay cannot apply input overrides" });
        res.set("X-Indicator-Data-State", "not-read-stored-output-replay");
        return next();
      }
      if (!policy.readsIndicators) {
        res.set("X-Indicator-Data-State", "not-read-by-endpoint");
        return next();
      }
      const rows = selected ? await loadIndicatorSnapshot(selected) : await getApprovedValues();
      runWithOverrideRows(rows, () => {
        res.set("X-Indicator-Snapshot", requestOverrides.getStore()!.hash);
        res.set("X-Indicator-Data-State", selected ? "archived-approved-indicators" : "current-approved-indicators-not-archived-by-request");
        next();
      });
    } catch {
      res.status(req.query.indicatorSnapshotId === undefined ? 503 : 422)
        .json({ error: "Approved indicator inputs unavailable or inconsistent" });
    }
  });
  void checkFinancialProvider();
  app.get("/api/financial-data/status", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    const response = financialProviderStatus();
    res.set("X-Field-Semantics",bindNestedOutput("financialProvider",response).map(f=>f.id).join(","));
    res.json(response);
  });
  app.get("/api/valuation/original-nominal-assessment", originalNominalAssessmentHandler);
  app.use("/api/cv", validateCvRequest);
  app.use("/api/cv", async (req, res, next) => {
    if (req.method !== "GET") return next();
    if (!historicalRequestPolicy(`/cv${req.path}`, req.query).readsWorkbook) return next();
    try {
      const header = await resolveSnapshot(snapshotSelection(req.query.snapshotId));
      if (!header) {
        res.set("X-Analysis-Data-State", "legacy-mutable-source-snapshot-not-provisioned");
        return next();
      }
      const overlayIds = overlaySelection(req.query);
      const overlays = await Promise.all(overlayIds.map(id => loadOverlay(id)));
      const cutoff = String(req.query.asOf ?? "");
      if (overlays.some(o => o.entries.some(e => e.availableAt > cutoff)))
        throw new Error("Overlay exceeds information cutoff");
      if (overlays.length) applyOverlays(await loadSnapshot(header), overlays, cutoff);
      const material = await captureMaterialInputs({ workbook: header.id, overlays: overlayIds,
        cutoff: cutoff || null, readsIndicators: historicalRequestPolicy(`/cv${req.path}`,req.query).readsIndicators });
      const manifest = createManifest({
        codeVersion: material.sourceId,
        modelVersion: CALCULATION_VERSION,
        snapshotHashes: [header.id, ...overlayIds, ...(requestOverrides.getStore() ? [requestOverrides.getStore()!.hash] : [])],
        scenario: `descriptive-valuation:${req.path}`, settings: { ...req.query, materialInputsId:material.id },
      });
      res.set("X-Analysis-Data-State", "immutable-workbook-snapshot");
      res.set("X-Analysis-Snapshot", header.id);
      if (overlayIds.length) res.set("X-Analysis-Overlays", overlayIds.join(","));
      res.set("X-Analysis-Manifest", manifest.id);
      res.set("X-Analysis-Material-Inputs",material.id);
      res.set("Cache-Control", "no-store");
      const archivedPaths = new Set(["/summary", "/carbon-price", "/pe-comparison",
        "/sdg-growth", "/decarb-bands", "/decarb-terciles", "/decarb-gap/summary",
        "/decarb-gap/timeseries", "/backtest"]);
      if (archivedPaths.has(req.path)) {
        const sendJson = res.json.bind(res);
        let sent = false;
        res.json = (body: unknown) => {
          if (res.statusCode >= 400) return sendJson(body);
          if (sent) return res;
          sent = true;
          // Store exactly the JSON response (Dates/optional fields use the
          // same JSON encoding as Express), before reporting archive success.
          void Promise.resolve().then(() => saveAnalysisResult(manifest,
            JSON.parse(JSON.stringify(body)))).then(id => {
            res.set("X-Analysis-Result", id);
            res.set("X-Analysis-Result-State", "archived-completed-response");
            sendJson(body);
          }).catch(() => {
            res.status(503);
            sendJson({ error: "Analysis completed but immutable result recording failed; no archived result was returned" });
          });
          return res;
        };
      }
      snapshotContext.run(header, () => overlayIds.length
        ? overlayContext.run({ ids: overlayIds, cutoff, overlays }, next) : next());
    } catch {
      res.status(422).json({ error: "Requested analysis snapshot unavailable or invalid" });
    }
  });
  app.get("/api/analysis/results/:id", async (req, res) => {
    try { res.set("Cache-Control", "no-store").json(await loadAnalysisResult(req.params.id)); }
    catch { res.status(422).json({ error: "Archived analysis result unavailable or invalid" }); }
  });
  app.get("/api/analysis/snapshot-status", async (_req, res) => {
    try {
      const header = await resolveSnapshot();
      res.set("Cache-Control", "no-store").json(header ? {
        status: "immutable-workbook-snapshot", snapshotId: header.id, companyCount: header.companyCount,
        observationCount: header.observationCount, createdAt: header.createdAt, sourceNote: header.sourceNote,
        currentFinancialOverlaysApplied: false,
      } : { status: "not-provisioned", snapshotId: null, currentFinancialOverlaysApplied: false });
    } catch { res.status(503).json({ error: "Snapshot status unavailable" }); }
  });
  app.get("/api/analysis/snapshots", async (req, res) => {
    let filter: ReturnType<typeof snapshotInventoryQuery>;
    try { filter = snapshotInventoryQuery(req.query); }
    catch { res.status(422).json({ error: "Invalid snapshot inventory filter or cursor" }); return; }
    try {
      if (!await snapshotsAvailable()) return res.json({ status: "not-provisioned", items: [], nextCursor: null });
      const rows = await db.select({
        id: cvAnalysisSnapshots.id, kind: cvAnalysisSnapshots.kind,
        companyCount: cvAnalysisSnapshots.companyCount, observationCount: cvAnalysisSnapshots.observationCount,
        createdAt: cvAnalysisSnapshots.createdAt,
      }).from(cvAnalysisSnapshots).where(and(
        filter.kind ? eq(cvAnalysisSnapshots.kind, filter.kind) : undefined,
        filter.after ? gt(cvAnalysisSnapshots.id, filter.after) : undefined,
      )).orderBy(asc(cvAnalysisSnapshots.id)).limit(101);
      const items = rows.slice(0, 100);
      res.set("Cache-Control", "no-store").json({ status: "available", items,
        nextCursor: rows.length > 100 ? items[items.length - 1].id : null });
    } catch { res.status(503).json({ error: "Snapshot listing unavailable" }); }
  });
  app.use("/api/cv", (req, res, next) => {
    res.set("X-Analytical-Status", "descriptive-valuation-not-physical-inference");
    const send = res.json.bind(res);
    res.json = ((body: unknown) => {
      const filtered=publicValuationResult(body,req.originalUrl.split("?")[0].startsWith("/api/cv/decarb-gap"));
      if(req.originalUrl.split("?")[0]==="/api/cv/sdg-growth" && res.statusCode<400 && Array.isArray(filtered))
        res.set("X-Field-Semantics",bindOutputFields("sdg",filtered).map(f=>f.id).join(","));
      if(req.originalUrl.split("?")[0]==="/api/cv/pe-comparison" && res.statusCode<400 && Array.isArray(filtered))
        res.set("X-Field-Semantics",bindOutputFields("pe",filtered).map(f=>f.id).join(","));
      if(req.originalUrl.split("?")[0]==="/api/cv/decarb-gap/summary" && res.statusCode<400)
        res.set("X-Field-Semantics",bindNestedOutput("peerValuation",filtered).map(f=>f.id).join(","));
      if(req.originalUrl.split("?")[0]==="/api/cv/decarb-gap/timeseries" && res.statusCode<400 && Array.isArray(filtered))
        res.set("X-Field-Semantics",bindOutputFields("peerValuationHistory",filtered).map(f=>f.id).join(","));
      return send(filtered);
    }) as typeof res.json;
    next();
  });

  // Booting a server must not repair, delete or reclassify source records.
  // Managed schema changes and authorized operator commands own those actions.

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
      // CLI decisions must be visible on the next request in every process.
      // The per-route revision below prevents reuse of an old input cache.
      await loadApprovedOverrides();
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
    const response = {
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
    };
    res.set("X-Field-Semantics",bindNestedOutput("calculationContract",response).map(f=>f.id).join(","));
    res.json(response);
  });

  app.get("/api/financial-data/reviews", async (_req, res) => {
    try { res.set("Cache-Control", "no-store").json(await listFinancialReviews()); }
    catch { res.status(503).json({ error: "Financial review storage unavailable" }); }
  });
  app.get("/api/calculation/readiness", (_req, res) => {
    res.set("Cache-Control", "no-store").json(calculationReadiness());
  });
  app.get("/api/research/driver-registry", (_req, res) => {
    const response = { status: "evidence-gaps-explicit", indicators: driverEvidenceRegistry() };
    res.set("X-Field-Semantics", bindNestedOutput("driverRegistry", response).map(f => f.id).join(","));
    res.json(response);
  });
  app.get("/api/calculation/company-operating/reviews",async(_req,res)=>{
    try{
      const rows=await listCompanyOperatingReviews();
      res.set("Cache-Control","no-store");
      res.set("X-Field-Semantics",bindNestedOutput("companyReview",rows).map(f=>f.id).join(","));
      res.json(rows);
    }catch{res.status(503).json({error:"Operating review storage unavailable or inconsistent"});}
  });
  app.post("/api/calculation/research-contracts", async (req, res) => {
    try {
      const x = req.body;
      let result: unknown;
      switch (x?.operation) {
        case "member-metrics": result = summarizeMemberMetrics(x.input); break;
        case "member-attribution": result = exactMemberAttribution(x.input); break;
        case "company-projection": result = projectCompanyMembers(x.input); break;
        case "reviewed-company-projection": result = await projectReviewedCompany(x.decisionId,x.cutoff); break;
        case "cash-flow-value": result = cashFlowValue(x.input); break;
        case "reverse-cash-flow-growth": result = reverseCashFlowGrowth(x.input); break;
        case "long-short-research": result = longShortResearch(x.input); break;
        case "equity-value": result = equityValue(x.input); break;
        case "reverse-equity-growth": result = reverseEquityGrowth(x.input); break;
        case "fcfe-ocf": result = fcfeFromOperatingCashFlow(x.input); break;
        case "fcfe-earnings": result = fcfeFromEarnings(x.input); break;
        case "net-zero-summary": result = summarizeNetZeroYears(x.years, x.horizon); break;
        case "paired-growth-gap": result = pairedGrowthGap(x.projected, x.implied, x.projectedDefinition, x.impliedDefinition); break;
        case "scenario-eligibility": result = valuationScenarioEligibility(x.input); break;
        default: return res.status(422).json({ error: "Unknown research operation" });
      }
      res.set("Cache-Control", "no-store").json({ result, status: "submitted-input-diagnostic",
        modelPromoted: false, investmentEvidence: false });
    } catch {
      res.status(422).json({ error: "Invalid or incompatible research inputs" });
    }
  });
  app.post("/api/emissions/validate-native-pathways", (req, res) => {
    try {
      const response=validateNativePair(req.body);
      const fields=bindNestedOutput("nativePathway",response);
      // Full species-qualified IDs exceed common proxy header limits; the
      // family/count identifies the exact dictionary used by this binder.
      res.set("X-Field-Semantics-Family","nativePathway");
      res.set("X-Field-Semantics-Count",String(fields.length));
      res.json(response);
    }
    catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid pathways" }); }
  });
  app.post("/api/calculation/ensemble-summary", (req, res) => {
    try {
      const response=summarizeEnsemble(req.body);
      res.set("X-Field-Semantics",bindNestedOutput("ensembleSummary",response).map(f=>f.id).join(","));
      res.json(response);
    }
    catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid ensemble" }); }
  });
  app.post("/api/calculation/evaluate-holdout", (req, res) => {
    try {
      const response=evaluateHoldout(req.body?.protocol, req.body?.rows);
      res.set("X-Field-Semantics",bindNestedOutput("holdoutEvaluation",response).map(f=>f.id).join(","));
      res.json(response);
    }
    catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid holdout" }); }
  });
  app.post("/api/calculation/evaluate-signal", (req, res) => {
    try {
      const response=evaluateSignal(req.body);
      res.set("X-Field-Semantics",bindNestedOutput("signalEvaluation",response).map(f=>f.id).join(","));
      res.json(response);
    }
    catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid research evidence" }); }
  });
  app.post("/api/calculation/validate-history", (req, res) => {
    try {
      const response=historicalValidation(req.body);
      res.set("X-Field-Semantics",bindNestedOutput("historyValidation",response).map(f=>f.id).join(","));
      res.json(response);
    }
    catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid historical evidence" }); }
  });
  app.post("/api/calculation/audit-vintages", (req, res) => {
    try {
      const response=auditVintages(req.body);
      res.set("X-Field-Semantics",bindNestedOutput("vintageAudit",response).map(f=>f.id).join(","));
      res.json(response);
    }
    catch (e) { res.status(422).json({ error: e instanceof Error ? e.message : "Invalid vintage evidence" }); }
  });
  app.use("/api/projection", (req, res, next) => {
    if (req.query.engine !== undefined && req.query.engine !== "legacy") {
      return res.status(req.query.engine === "fair" ? 409 : 400).json({
        error: "Requested engine is not an approved production engine; no silent legacy fallback.",
        readiness: calculationReadiness(),
      });
    }
    next();
  });

  app.use(legacyExportProducerMiddleware());
  app.get("/api/emissions/candidate", nativeCandidateHandler());

  // Submitted-input arithmetic only; no stored inventory/approval mutation or source collection.
  app.post("/api/emissions/regional-residual-diagnostics", (req, res) => {
    try {
      const capture = regionalNativeResidualRequestSchema.parse(req.body);
      const member = projectRegionalMember(capture.input);
      const response = {
        residualDiagnostics: nativeResidualDiagnosticsSchema.parse(regionalNativeResidualDiagnostics(member, capture.baselineYear)),
      };
      const fields = bindNestedOutput("native", response);
      res.set("Cache-Control", "no-store");
      res.set("X-Field-Semantics-Family", "native");
      res.set("X-Field-Semantics-Count", String(fields.length));
      res.json(response);
    } catch (error) {
      res.status(422).json({ error: error instanceof Error ? error.message : "Invalid captured regional native inputs" });
    }
  });

  // Published reference information only: never feeds the projection engine.
  app.get("/api/reference-scenarios", (_req, res) => {
    res.set("X-Field-Semantics", bindNestedOutput("publishedReference", catReferences).map(f => f.id).join(","));
    res.json(catReferences);
  });

  // Deployment readiness: checks DB connectivity and the approved-input table,
  // without exposing credentials, records or connection error details.
  app.get("/api/health", async (_req, res) => {
    res.set("Cache-Control", "no-store");
    try {
      await db.execute(sql`SELECT 1 FROM indicator_values LIMIT 1`);
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ status: "unavailable" });
    }
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
      const cacheKey = calculationKey("projection", res.locals.calculationRevision, {
        category, runs: 10000, responseVersion: PROJECTION_RESPONSE_VERSION,
      });

      if (category === "all" && projectionResultCache && validRouteCache(`projection:${PROJECTION_RESPONSE_VERSION}`, res)) {
        res.set("X-Field-Semantics",bindNestedOutput("projection",projectionResultCache).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(projectionResultCache));
      }

      const cached = await storage.getProjectionCache(cacheKey);
      if (cached) {
        const validatedCache=projectionResponseSchema.parse(cached.resultData);
        res.set("X-Field-Semantics",bindNestedOutput("projection",validatedCache).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(validatedCache));
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

      const selected2024InputsPresent = getAllHistoricalIndicators().some(row => row.year === 2024);
      const selectedContext = selectedTrajectoryThresholdContext(selected2024InputsPresent ? trajectory : [],
        String(res.locals.calculationRevision),
        calculationKey("effective-projection", indicators, { startYear, endYear: 2100, runs: 10000, category }));
      const { reductionRate, netZeroYear, legacyFixed5Gt, thresholdDiagnostic } = historicalTrajectoryMetrics(trajectory, selectedContext);
      const emissionsStart = trajectory[0].p50;
      const emissionsDecadeLater = trajectory[10].p50;
      const emissions2100 = trajectory[trajectory.length - 1].p50;

      const result:ProjectionResponse = {
        calculation: {
          ...legacyContext(startYear, category),
          inputHash: calculationKey("effective-projection", indicators, { startYear, endYear: 2100, runs: 10000, category }),
          inputRevision: projectionResponseSchema.shape.calculation.shape.inputRevision.parse(res.locals.calculationRevision),
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
          legacyFixed5Gt,
          thresholdDiagnostic,
          emissionsStart,
          emissionsDecadeLater,
          emissions2100,
        },
      };

      projectionResponseSchema.parse(result);
      res.set("X-Field-Semantics",bindNestedOutput("projection",result).map(f=>f.id).join(","));
      if (category === "all") {
        projectionResultCache = result;
        tagRouteCache(`projection:${PROJECTION_RESPONSE_VERSION}`, res);
      }

      await storage.setProjectionCache({
        cacheKey,
        projectionYear: startYear,
        category: category === "all" ? null : String(category),
        region: null,
        resultData: result,
      });

      res.json(detachProjectionCacheResponse(result));
    } catch (error) {
      console.error("Projection calculation error:", error);
      res.status(500).json({ error: "Failed to calculate projection" });
    }
  });

  app.get("/api/indicators/historical", async (_req, res) => {
    try {
      const data = getAllHistoricalIndicatorsWithNowcast();
      res.set("X-Field-Semantics",bindOutputFields("indicator",data).map(f=>f.id).join(","));
      res.json(data);
    } catch (error) {
      console.error("Historical indicators error:", error);
      res.status(500).json({ error: "Failed to fetch historical indicators" });
    }
  });

  app.get("/api/projection/categories", async (_req, res) => {
    try {
      if (categoryCacheResult && validRouteCache(`categories:${PROJECTION_RESPONSE_VERSION}`, res)) {
        res.set("X-Field-Semantics",bindNestedOutput("category",categoryCacheResult).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(categoryCacheResult));
      }
      const result = calculateAllCategoryProjections();
      categoryCacheResult = result;
      tagRouteCache(`categories:${PROJECTION_RESPONSE_VERSION}`, res);
      res.set("X-Field-Semantics",bindNestedOutput("category",result).map(f=>f.id).join(","));
      res.json(detachProjectionCacheResponse(result));
    } catch (error) {
      console.error("Category projections error:", error);
      res.status(500).json({ error: "Failed to calculate category projections" });
    }
  });

  app.get("/api/projection/regions", async (req, res) => {
    try {
      const respond=(rows:Awaited<ReturnType<typeof calculateRegionalProjections>>)=>{
        res.set("X-Field-Semantics",bindNestedOutput("regional",rows).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(rows));
      };
      const regionalId = snapshotSelection(req.query.regionalSnapshotId);
      if (regionalId) {
        const captured = await loadRegionalInputs(regionalId);
        res.set("X-Regional-Snapshot", regionalId);
        res.set("Cache-Control", "no-store");
        const baselineInputAvailable = getAllHistoricalIndicators().some(row => row.year === 2024);
        return respond(calculateRegionalFromInputs(getCurrentIndicators(), captured,
          baselineInputAvailable ? undefined : region => selectedTrajectoryThresholdContext([],
            String(res.locals.calculationRevision), calculationKey("selected-regional-trajectory", captured, { region }))));
      }
      if (regionalCacheResult && validRouteCache(`regions:${PROJECTION_RESPONSE_VERSION}`, res) && Date.now() - regionalCacheFetchedAt < REGIONAL_CACHE_TTL_MS) {
        return respond(regionalCacheResult);
      }
      const result = await calculateRegionalProjections();
      regionalCacheResult = result;
      regionalCacheFetchedAt = Date.now();
      tagRouteCache(`regions:${PROJECTION_RESPONSE_VERSION}`, res);
      respond(result);
    } catch (error) {
      console.error("Regional projections error:", error);
      res.status(req.query.regionalSnapshotId ? 422 : 500).json({ error: "Failed to calculate regional projections; requested inputs may be unavailable" });
    }
  });

  app.get("/api/projection/sensitivity", async (_req, res) => {
    try {
      const respond=(rows:ReturnType<typeof calculateSensitivityAnalysis>)=>{
        res.set("X-Field-Semantics",bindOutputFields("sensitivity",rows).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(rows));
      };
      if (sensitivityCacheResult && validRouteCache("sensitivity", res)) {
        return respond(sensitivityCacheResult);
      }
      const allNowcast = getAllHistoricalIndicatorsWithNowcast();
      const latestData = allNowcast[allNowcast.length - 1];
      const indicators = latestData ? getCurrentIndicatorsFromHistorical(latestData) : getCurrentIndicators();
      const startYear = latestData?.year || new Date().getFullYear();
      const result = calculateSensitivityAnalysis(indicators, startYear);
      sensitivityCacheResult = result;
      tagRouteCache("sensitivity", res);
      respond(result);
    } catch (error) {
      console.error("Sensitivity analysis error:", error);
      res.status(500).json({ error: "Failed to calculate sensitivity analysis" });
    }
  });

  app.get("/api/projection/historical-trend", async (_req, res) => {
    try {
      if (historicalTrendCacheResult && validRouteCache(`history:${PROJECTION_RESPONSE_VERSION}`, res)) {
        res.set("X-Field-Semantics",bindNestedOutput("historical",historicalTrendCacheResult).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(historicalTrendCacheResult));
      }
      const result = getRecalculatedHistoricalTrend();
      historicalTrendCacheResult = result;
      tagRouteCache(`history:${PROJECTION_RESPONSE_VERSION}`, res);
      res.set("X-Field-Semantics",bindNestedOutput("historical",result).map(f=>f.id).join(","));
      res.json(detachProjectionCacheResponse(result));
    } catch (error) {
      console.error("Historical trend error:", error);
      res.status(500).json({ error: "Failed to calculate historical trend" });
    }
  });

  app.get("/api/projection/categories/historical-trend", async (_req, res) => {
    try {
      if (categoryHistoricalTrendCache && validRouteCache(`category-history:${PROJECTION_RESPONSE_VERSION}`, res)) {
        res.set("X-Field-Semantics",bindNestedOutput("categoryHistory",categoryHistoricalTrendCache).map(f=>f.id).join(","));
        return res.json(detachProjectionCacheResponse(categoryHistoricalTrendCache));
      }
      const result = getCategoryHistoricalTrend();
      categoryHistoricalTrendCache = result;
      tagRouteCache(`category-history:${PROJECTION_RESPONSE_VERSION}`, res);
      res.set("X-Field-Semantics",bindNestedOutput("categoryHistory",result).map(f=>f.id).join(","));
      res.json(detachProjectionCacheResponse(result));
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
      const uploads = await db.select().from(cvDataUploads).orderBy(desc(cvDataUploads.id));
      res.set("X-Field-Semantics", Array.from(new Set(uploads.flatMap(upload => bindNestedOutput("upload", upload).map(f => f.id)))).join(","));
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
      res.set("X-Field-Semantics", bindNestedOutput("upload", result).map(f => f.id).join(","));
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch upload status" });
    }
  });

  app.get("/api/cv/dimensions", async (_req, res) => {
    try {
      const { companies } = await loadCompaniesAndTimeSeries(false);
      const sectors = Array.from(new Set(companies.map(c => c.sector).filter(Boolean))).sort() as string[];
      const geographies = Array.from(new Set(companies.map(c => c.geography).filter(Boolean))).sort() as string[];
      res.set("X-Field-Semantics", bindNestedOutput("companyDimensions", { sectors, geographies }).map(f => f.id).join(","));
      res.json({ sectors, geographies });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dimensions" });
    }
  });

  app.get("/api/cv/carbon-price", async (req, res) => {
    try {
      const archived = snapshotContext.getStore();
      const uploadId = archived ? 0 : Number(req.query.uploadId);
      if (!archived) {
        if (isNaN(uploadId)) return res.status(400).json({ error: "uploadId is required and must be a number" });
        const [dataset] = await db.select().from(cvDataUploads).where(eq(cvDataUploads.id, uploadId));
        if (!dataset) return res.status(404).json({ error: "Upload not found" });
        if (dataset.status !== "completed") return res.status(409).json({ error: "Upload is not completed" });
      }
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
      const { companies, timeSeries: rawTimeSeries } = await loadCompaniesAndTimeSeries(false);
      const uploads = snapshotContext.getStore() ? [] :
        await db.select().from(cvDataUploads).orderBy(desc(cvDataUploads.id)).limit(1);
      let minDate: Date | null = null, maxDate: Date | null = null;
      for (const row of rawTimeSeries) {
        if (!minDate || row.date < minDate) minDate = row.date;
        if (!maxDate || row.date > maxDate) maxDate = row.date;
      }
      const imputation = computeImputationStats(carryForwardEmissions(rawTimeSeries));

      const response = {
        companiesCount: companies.length,
        latestUpload: snapshotContext.getStore() ? null : uploads[0] || null,
        snapshotId: snapshotContext.getStore()?.id ?? null,
        dateRange: { minDate, maxDate, recordCount: rawTimeSeries.length },
        sectors: Array.from(new Set(companies.map(c => c.sector).filter(Boolean))).length,
        geographies: Array.from(new Set(companies.map(c => c.geography).filter(Boolean))).length,
        imputation,
      };
      res.set("X-Field-Semantics", bindNestedOutput("companySummary", response).map(f => f.id).join(","));
      res.json(response);
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
    const { reductionRate, netZeroYear } = historicalTrajectoryMetrics(trajectory);
    const emissionsStart = trajectory[0].p50;
    const emissionsDecadeLater = trajectory[10].p50;
    const emissions2100 = trajectory[trajectory.length - 1].p50;

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
      // A common offset does not change peer ranks. Descriptive valuation
      // outputs must not depend on an unsupported physical climate forecast.
      const projectedRate = 0;

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
      const projectedRate = 0;

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

      // Common physical projections cancel from peer ranks. Do not feed today's
      // reconstructed physical forecasts into historical portfolio selection.
      const results = await calculateBacktest(signal, trackingErrorLimit, scoringMethod, geography,
        req.query.costBps === undefined ? 10 : Number(req.query.costBps));
      res.set("X-Field-Semantics", bindNestedOutput("backtest", req.query.format === "series" ? results.series : results).map(f => f.id).join(","));
      res.json(req.query.format === "series" ? results.series : results);
    } catch (error) {
      console.error("Backtest calculation error:", error);
      res.status(500).json({ error: "Failed to calculate backtest" });
    }
  });

  app.get("/api/news/climate", async (_req, res) => {
    try {
      const validMonths = newsMonthWindow(_req.query.months);
      const result = await getClimateNewsAnalysis(validMonths);
      try {
        bindProducerIdentity(res, await retainNewsExport(captureNewsExportInputs(result, validMonths), result));
        res.set("X-Producer-Binding-Status", "retained-whole-producer-verified");
      } catch (error) {
        res.set("X-Producer-Binding-Status", "unavailable-no-producer-attestation");
        res.set("X-Producer-Binding-Error", error instanceof Error ? error.message : "News release retention unavailable");
      }
      res.set("X-Field-Semantics", bindNestedOutput("news", result).map(f => f.id).join(","));
      res.json(result);
    } catch (error: any) {
      console.error("[NewsAPI] Error:", error.message);
      if (error.message === "operator-news-refresh-required") {
        res.status(503).json({error:"operator-news-refresh-required",
          message:"No current cached news for this window. An authorized operator must refresh it; public reads do not call the provider."});
      } else if (error.message.includes("NEWSAPI_KEY")) {
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

      res.set("X-Field-Semantics", bindNestedOutput("indicatorInventory", { indicators, baselineYear: 2024, latestYear: latestRow.year }).map(f => f.id).join(","));
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
      const report = rememberReportRelease({ def, series, proposals }, "indicator-detail", {
        version: "indicator-detail-consumed-source-1", key, def, history: resolved, proposals,
        approved: Array.from(requestOverrides.getStore()?.values.values() ?? []),
        indicatorHash: requestOverrides.getStore()?.hash ?? null,
        meaning: "Whole actual effective series and source/proposal DB release at query time; proposal status is not approval evidence or original publication vintage",
      });
      const proof = await bindReportRelease(res, report, report, { key, ...req.query });
      if (proof) bindProducerIdentity(res, proof);
      res.set("X-Field-Semantics", bindNestedOutput("indicatorDetail", { def, series, proposals }).map(f => f.id).join(","));
      res.json(report);
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
      // Preserve every original summary JSON value, including unknown historical shapes.
      const runs = await getRecentRuns(10);
      const summaryEvidence = await loadFetchSummaryEvidence(runs);
      res.json({ runs, summaryEvidence });
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

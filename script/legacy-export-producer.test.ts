import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as XLSX from "xlsx";
import { captureLegacyInputs, replayLegacyProducer, retainLegacyProducer, verifyLegacyExportMaterial, legacyExportProducerMiddleware } from "../server/snapshots/legacyExportProducer";
import { contentHash, createManifest } from "../server/calculation/analysisManifest";
import { readCalculationSourceArtifact } from "../server/snapshots/materialInputs";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";
import { retainProducerDownload, bindProducerLegacyConsumer, captureDerivedConsumer, derivedConsumerIdentity } from "../client/src/lib/producer-download";
import { deriveLegacyExport, type LegacyConsumerKey, type LegacyProducerPath, type LegacyMetric } from "../shared/legacyExportConsumer";
import { exportNotes, prepareQualifiedJsonExport } from "../client/src/lib/export-contract";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { captureDownloadSelection, requireUnchangedDownloadSelection } from "../client/src/lib/download-selection";
import { appendDerivedConsumerWorkbookLineage, verifyDerivedConsumerWorkbook } from "../client/src/lib/derived-consumer-workbook";
import { semanticRows, requireOutputSemantic } from "../shared/fieldSemantics";
import { bindExportColumns } from "../shared/outputFieldSemantics";
import { certifySupplementalSheetRows } from "../shared/supplementalSheetBindings";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { requireHistoricalType } from "../shared/historicalTypes";
import { FIXED_5GT_DESCRIPTOR } from "../shared/quantityDescriptors";
import { THRESHOLD_DIAGNOSTIC_LABEL } from "../shared/thresholdDiagnostic";
import * as finite from "../shared/finiteExportSchemas";
import { indicatorFieldSpecs } from "../shared/indicatorFieldSemantics";
import { verifyNewsExportMaterial, retainNewsExport, replayNewsExport } from "../server/snapshots/newsExportProducer";
import { replayReportRelease, bindReportRelease, verifyReportReleaseMaterial, responseReportRelease } from "../server/snapshots/reportExportProducer";
import { rememberReportRelease } from "../server/snapshots/reportMaterialContext";
import { getIndicatorDef } from "../server/dataIngestion/indicatorRegistry";
import { producerThresholdExportRows } from "../client/src/lib/producer-download";
import { thresholdExportRow } from "../client/src/lib/threshold-export";
import express from "express";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { registerCompanyConditionalRoutes } from "../server/companyConditionalApi";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
import { verifyStaticReferenceIdentity } from "../server/staticReferenceLineage";
import { registerStage10CoverageRoutes } from "../server/stage10CoverageApi";
import { registerTrackBAdmissionRoutes } from "../server/trackBAdmissionApi";
import { registerWorkbookMoneyAuditExportApi as registerWorkbookMoneyAuditApi } from "../server/workbookMoneyAuditExportApi";
import { readWorkbookMoneyExportRelease as readWorkbookMoneyAudit } from "../server/financialData/workbookMoneyExportRelease";
import { readStage10RetainedFiles, replayStage10FromSources } from "../server/financialData/stage10Source";
import { packDataset } from "../server/snapshots/contract";
import { consumedReportRelease } from "../server/snapshots/reportMaterialContext";
import { assessTrackBAdmission } from "../server/calculation/trackBAdmission";
import { trackBPeriodDomainHash } from "../server/trackBDisclosureStore";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { prepareQualifiedJsonExport as prepareJson } from "../client/src/lib/export-contract";
import { registerProducerDownloadRoutes } from "../server/producerDownload";
import { captureTrackBExportMaterial } from "../server/calculation/trackBExportMaterial";

function fixture() {
  const source = readCalculationSourceArtifact(), materials = new Map<string, any>([[source.id, source.payload]]), results = new Map<string, any>();
  const load = async (id: string) => {
    const value = materials.get(id);
    if (!value || contentHash(value) !== id) throw new Error("Missing/corrupt archive");
    return structuredClone(value);
  };
  const loadResult = async (id: string) => {
    const value = results.get(id);
    if (!value) throw new Error("Missing completed result");
    const payload = unpackAnalysisResult(id, value);
    const verify = payload.manifest.scenario === "source-release:news-allocation-1" ? verifyNewsExportMaterial :
      payload.manifest.scenario.startsWith("safe-report-release:") ? verifyReportReleaseMaterial : verifyLegacyExportMaterial;
    await verify(payload.manifest.settings.materialInputsId as string, payload.manifest, payload.result, load, source.id);
    return { ...payload, id, materialReplayState: "referenced-material-archives-verified" };
  };
  return { source, materials, results, load, store: {
    captureSource: async () => source.id,
    saveMaterial: async (payload: unknown) => { const id = contentHash(payload); materials.set(id, structuredClone(payload)); return id; },
    saveResult: async (manifest: ReturnType<typeof createManifest>, result: unknown) => {
      const packed = packAnalysisResult(manifest, result); results.set(packed.id, packed.payload); return packed.id;
    }, loadResult,
  } };
}
function initializer(path: string, variable: string) {
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = "";
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.name.getText(source) === variable) expression = n.initializer!.getText(source);
    if (ts.isFunctionDeclaration(n) && n.name?.text === variable) expression = n.getText(source).replace(/^export\s+/, "");
    n.forEachChild(visit);
  }
  visit(source); assert.ok(expression, variable); return expression;
}
function evaluate(expression: string, context: Record<string, unknown>) {
  const js = ts.transpileModule(`const result=(${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  return new Function(...Object.keys(context), `${js};return result;`)(...Object.values(context));
}
function handler(name: string, rows: Record<string, any>[]) {
  const workbooks: Buffer[] = [], json: Blob[] = [], errors: string[] = [], blobs: Blob[] = [];
  const context = {
    captureDownloadSelection, requireUnchangedDownloadSelection, captureDerivedConsumer, derivedConsumerIdentity,
    exportNotes, prepareQualifiedJsonExport, exportDataIdentity, appendDerivedConsumerWorkbookLineage, semanticRows, requireOutputSemantic,
    bindExportColumns, certifySupplementalSheetRows, createDownloadManifest, downloadManifestRows,
    rows, kind: "legacy", filename: "engineering-legacy-export", sheetName: "Exact data", interpretationNotes: [], fieldBindings: undefined,
    testId: "engineering", requireDerivedParent: true, setBusy() {}, setError(e: string | null) { if (e) errors.push(e); },
    loadExportWorkbook: async () => ({ ...XLSX, writeFile(book: XLSX.WorkBook) { workbooks.push(XLSX.write(book, { type: "buffer", bookType: "xlsx" })); } }),
    Blob, console: { error() {} }, URL: { createObjectURL(b: Blob) { blobs.push(b); return `blob:${blobs.length - 1}`; }, revokeObjectURL() {} },
    document: { createElement() { return { href: "", download: "", click() { json.push(blobs[Number(this.href.slice(5))]); } }; } },
  };
  return { run: evaluate(initializer("client/src/components/download-data-button.tsx", name), context), workbooks, json, errors };
}
const consumers: { key: LegacyConsumerKey; path: LegacyProducerPath; component: string; metrics?: LegacyMetric[] }[] = [
  { key: "emissions", path: "/api/projection", component: "emissions-chart" },
  { key: "temperature", path: "/api/projection", component: "temperature-histogram" },
  { key: "category-scenarios", path: "/api/projection/categories", component: "category-comparison" },
  { key: "sensitivity", path: "/api/projection/sensitivity", component: "sensitivity-chart" },
  { key: "historical-trend", path: "/api/projection/historical-trend", component: "historical-trend-chart", metrics: ["temperature", "reductionRate", "netZero"] },
  { key: "category-trends", path: "/api/projection/categories/historical-trend", component: "category-trend-chart", metrics: ["temperature", "reductionRate", "netZero"] },
  { key: "indicator-cards", path: "/api/indicators/historical", component: "indicator-cards" },
  { key: "regional", path: "/api/projection/regions", component: "regional-comparison" },
];
// Finite UI metrics consume the SAME whole response, not separate model runs.
// Share that engineering archive across variants, but reload and fully verify
// every variant's parent; all actual row/JSON/XLSX readbacks still execute.
const producerCases = new Map<LegacyProducerPath, Promise<any>>();
async function producerCase(consumer: typeof consumers[number]) {
  if (!producerCases.has(consumer.path)) producerCases.set(consumer.path, (async () => {
    const f = fixture();
    const staticRegional = evaluate(initializer("server/calculation/regionalProjections.ts", "REGIONAL_CARBON_INTENSITIES"), {});
    const regional = consumer.key === "regional" ? Object.fromEntries(Object.entries(staticRegional).map(([key, value]: any) =>
      [key, { value: value.carbonIntensity, source: "static" as const }])) : null;
    const input = runWithOverrideRows([], () => captureLegacyInputs(consumer.path, {}, "engineering-captured-effective-history", regional));
    const result = replayLegacyProducer(input), proof = await retainLegacyProducer(input, result, f.store);
    return { f, input, result, proof };
  })());
  const captured = await producerCases.get(consumer.path)!;
  await captured.f.store.loadResult(captured.proof.resultId);
  return captured;
}
for (const consumer of consumers) for (const metric of consumer.metrics ?? ["temperature"] as LegacyMetric[]) {
  test(`${consumer.key}/${metric}: actual checked-in producer, full material archive, actual row builder and JSON/XLSX literal-cell readback`, async () => {
    const { f, result, proof } = await producerCase(consumer);
    const response = new Response(JSON.stringify(result), { headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") } });
    const data = await retainProducerDownload(response, null).json();
    const context = {
      ...finite, bindProducerLegacyConsumer, requireHistoricalType, FIXED_5GT_DESCRIPTOR, THRESHOLD_DIAGNOSTIC_LABEL,
      trajectory: data.emissionsTrajectory, pdf: data.temperatureDistribution?.pdf, categories: data, data,
      regions: data,
      historicalData: data, baseline: Array.isArray(data) ? data[0]?.baselineTemperature : undefined, metricView: metric,
      config: { metricKey: metric === "temperature" ? "median" : metric === "reductionRate" ? "reductionRate" : "netZeroYear" },
      CATEGORY_KEYS: finite.categoryExportKeys, CATEGORY_NAMES: finite.categoryExportNames,
      INDICATORS: indicatorFieldSpecs.map(([key]) => ({ key })),
    };
    const rows = evaluate(initializer(`client/src/components/${consumer.component}.tsx`, "downloadRows"), context);
    const consumed = consumer.key === "emissions" ? data.emissionsTrajectory : consumer.key === "temperature" ? data.temperatureDistribution.pdf : data;
    bindProducerLegacyConsumer(consumed, consumer.key, rows, metric);
    assert.deepEqual(JSON.parse(JSON.stringify(rows)), JSON.parse(JSON.stringify(deriveLegacyExport(data, consumer.key, metric).rows)));
    const capture = captureDerivedConsumer(rows)!; assert.equal(capture.parent.resultId, proof.resultId);
    assert.equal(capture.parent.codeArchiveId, f.source.id);
    for (const name of ["handleClick", "handleJsonClick"]) {
      const h = handler(name, rows); await h.run(); assert.deepEqual(h.errors, []);
      if (name === "handleJsonClick") {
        const output = JSON.parse(await h.json[0].text()); assert.deepEqual(output.data, JSON.parse(JSON.stringify(rows)));
        assert.equal(output.manifest.derivedConsumerIdentity.parent.resultId, proof.resultId);
        assert.equal(output.manifest.producerIdentity, null);
      } else {
        assert.equal(h.workbooks.length, 1);
        const book = XLSX.read(h.workbooks[0], { type: "buffer" });
        const expected = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"]).map(r => [r.Field, JSON.parse(r.Value)]));
        await verifyDerivedConsumerWorkbook(XLSX, h.workbooks[0], expected as any);
        const firstCell = Object.keys(book.Sheets[book.SheetNames[0]]).find(key => /^[A-Z]+2$/.test(key))!;
        assert.ok(firstCell, "Actual workbook must contain an observation row");
        book.Sheets[book.SheetNames[0]][firstCell].f = "1+1";
        await assert.rejects(() => verifyDerivedConsumerWorkbook(XLSX, XLSX.write(book, { type: "buffer", bookType: "xlsx" }), expected as any), /formulas/);
      }
    }
    rows[0][Object.keys(rows[0])[0]] = "mutated";
    assert.throws(() => captureDerivedConsumer(rows), /changed/);
  });
}
test("legacy producer missing/corrupt input, material, code and whole result refuse; no replay from current inputs", async () => {
  for (const fault of ["input", "material", "code", "result"]) {
    const f = fixture(), input = runWithOverrideRows([], () => captureLegacyInputs("/api/indicators/historical", {}, "frozen"));
    const proof = await retainLegacyProducer(input, replayLegacyProducer(input), f.store);
    const material = f.materials.get(proof.materialInputsId);
    if (fault === "input") f.materials.delete(material.inputId);
    if (fault === "material") material.path = "/api/projection";
    if (fault === "code") f.materials.delete(proof.codeArchiveId);
    if (fault === "result") f.results.get(proof.resultId).result[0].year++;
    await assert.rejects(() => f.store.loadResult(proof.resultId));
  }
});
test("all four news handlers replay exact pooled allocations, denominator, topic extrapolation and captured local Sunday timezone; JSON/XLSX readback", async () => {
  const f = fixture();
  const input = { version: "news-export-inputs-1", release: { cacheKey: "climate_news_3m",
    fetchedAt: "2026-11-01T00:00:00Z", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    meaning: "Isolated engineering source release, never a provider observation or production cache activation" },
    months: 3, queryTime: "2026-11-02T00:00:00Z",
    volume: [{ date: "2026-09-01", count: 0 }, { date: "2026-09-06", count: 11 }, { date: "2026-10-03", count: 3 }],
    sample: [{ title: "solar power and climate policy", url: "https://example.invalid/engineering", source: "ENGINEERING ONLY",
      date: "2026-09-01", sentiment: 0.5 }, { title: "other engineering", url: "https://example.invalid/engineering2",
      source: "ENGINEERING ONLY", date: "2026-10-01", sentiment: null }],
    dateRange: { start: "2026-09-01", end: "2026-11-01" }, model: "news-allocation-extrapolation-1-not-a-climate-model",
    seed: null, seedMeaning: "Deterministic allocation", sourceMeaning: "Isolated engineering material, not provider or publication evidence" };
  const result = replayNewsExport(input), proof = await retainNewsExport(input, result, f.store);
  const data = await retainProducerDownload(new Response(JSON.stringify(result), { headers: {
    "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") } }), null).json();
  const path = "client/src/pages/news-sentiment.tsx";
  const weeklyVolume = evaluate(initializer(path, "aggregateVolumeWeekly"), {})(data.volume);
  const sentimentTrend = evaluate(initializer(path, "sentimentTrend"), { useMemo: (fn: Function) => fn(), data });
  for (const [key, variable] of [["news-volume", "volumeRows"], ["news-sentiment-trend", "sentimentTrendRows"],
    ["news-sentiment-breakdown", "sentimentBreakdownRows"], ["news-topic", "topicRows"]] as const) {
    const rows = evaluate(initializer(path, variable), { data, weeklyVolume, sentimentTrend });
    bindProducerLegacyConsumer(data, key, rows);
    const capture = captureDerivedConsumer(rows)!;
    assert.match(capture.derivation.units as string, /allocated|extrapolated/);
    for (const name of ["handleClick", "handleJsonClick"]) {
      const h = handler(name, rows); await h.run(); assert.deepEqual(h.errors, []);
      if (name === "handleJsonClick") assert.deepEqual(JSON.parse(await h.json[0].text()).data, rows);
      else {
        const book = XLSX.read(h.workbooks[0], { type: "buffer" });
        const lineage = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"]).map(r => [r.Field, JSON.parse(r.Value)]));
        await verifyDerivedConsumerWorkbook(XLSX, h.workbooks[0], lineage as any);
      }
    }
  }
  const material = f.materials.get(proof.materialInputsId), source = f.materials.get(material.inputId);
  source.release.timezone = "NOT-A-TIMEZONE";
  await assert.rejects(() => f.store.loadResult(proof.resultId));
});
test("every registered indicator-detail key binds full effective history/proposal source and actual finite row builder", async () => {
  const f = fixture(), history = runWithOverrideRows([], () => captureLegacyInputs("/api/indicators/historical", {}, "effective")).history;
  for (const [key] of indicatorFieldSpecs) {
    const source = { version: "indicator-detail-consumed-source-1", key, def: getIndicatorDef(key),
      history, proposals: [], approved: [], meaning: "Engineering retained query over actual checked-in history; no live DB/proposal claim" };
    const report = await replayReportRelease("indicator-detail", source);
    rememberReportRelease(report, "indicator-detail", source);
    const res: any = { set() {} };
    const proof = await bindReportRelease(res, report, report, { key }, f.store); assert.ok(proof);
    const data = await retainProducerDownload(new Response(JSON.stringify(report), { headers: {
      "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") } }), null).json();
    const rows = evaluate(initializer("client/src/pages/data-management.tsx", "downloadRows"),
      { ...finite, hasDefinition: true, def: data.def, series: data.series });
    bindProducerLegacyConsumer(data, "indicator-detail", rows);
    assert.equal(captureDerivedConsumer(rows)!.parent.resultId, proof.resultId);
    const h = handler("handleJsonClick", rows); await h.run(); assert.deepEqual(h.errors, []);
    assert.deepEqual(JSON.parse(await h.json[0].text()).data, rows);
    const x = handler("handleClick", rows); await x.run(); assert.deepEqual(x.errors, []);
    const book = XLSX.read(x.workbooks[0], { type: "buffer" });
    const lineage = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"]).map(r => [r.Field, JSON.parse(r.Value)]));
    await verifyDerivedConsumerWorkbook(XLSX, x.workbooks[0], lineage as any);
  }
});
test("threshold original objects bind exact retained whole response paths, UI labels remain metadata, mutations refuse", async () => {
  const f = fixture(), input = runWithOverrideRows([], () => captureLegacyInputs("/api/projection/categories", {}, "effective"));
  const result: any = replayLegacyProducer(input), proof = await retainLegacyProducer(input, result, f.store);
  const data = await retainProducerDownload(new Response(JSON.stringify(result), { headers: {
    "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") } }), null).json();
  const diagnostics = data.map((d: any) => d.thresholdDiagnostic), labels = data.map((d: any) => d.categoryName);
  const rows = producerThresholdExportRows(diagnostics, labels);
  assert.deepEqual(rows, diagnostics.map((d: any, i: number) => thresholdExportRow(d, labels[i])));
  const capture = captureDerivedConsumer(rows)!;
  assert.equal(capture.parent.resultId, proof.resultId);
  assert.ok(capture.derivation.recordPaths.length > 0);
  for (const name of ["handleClick", "handleJsonClick"]) { const h = handler(name, rows); await h.run(); assert.deepEqual(h.errors, []); }
  diagnostics[0].reason = "changed original record";
  assert.throws(() => captureDerivedConsumer(rows), /changed/);
});
async function mounted(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
}
test("conditional issuer JSON/XLSX: all four actual allowlisted selections, exact source/code artifact and literal custom cells", async () => {
  const app = express(); app.use(downloadManifestMiddleware()); registerCompanyConditionalRoutes(app);
  await mounted(app, async base => {
    for (const issuer of [undefined, "NEE", "FSLR", "XOM"] as const) for (const format of ["json", "xlsx"]) {
      const response = await fetch(`${base}/api/cv/company-conditional-summaries/export.${format}?downloadMetadata=manifest-v1${issuer ? `&issuer=${issuer}` : ""}`);
      assert.equal(response.status, 200);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const manifest = JSON.parse(Buffer.from(response.headers.get("X-Download-Manifest")!, "base64url").toString("utf8"));
      assert.equal(manifest.producerIdentity, null);
      await verifyStaticReferenceIdentity(manifest.referenceArtifactIdentity, getConditionalCompanySummary(issuer));
      if (format === "json") assert.deepEqual(JSON.parse(Buffer.from(bytes).toString()).data, getConditionalCompanySummary(issuer));
      else {
        const book = XLSX.read(bytes, { type: "array" }); assert.deepEqual(book.SheetNames, ["Public allowlist", "Download manifest"]);
        for (const cell of Object.values(book.Sheets["Public allowlist"])) assert.ok(!cell || typeof cell !== "object" || (!cell.f && !cell.l));
      }
    }
  });
});
test("all five custom retained report paths execute actual HTTP and custom JSON/XLSX projections; no private material in manifest", async () => {
  const f = fixture(), previous = process.env.NODE_ENV; process.env.NODE_ENV = "development";
  try {
    const files = await readStage10RetainedFiles();
    // Actual authenticated retained file release; only the workbook/storage
    // transport is an isolated two-issuer engineering cohort. Never persisted
    // as an approved or historical production workbook.
    const companies = files.audit.results.slice(0, 2).map((r: any) => ({ id: r.companyId, isin: r.isin }));
    const packed = packDataset(companies as any, []);
    const stage = replayStage10FromSources(files, { id: packed.id, company_count: companies.length,
      observation_count: 0, chunk_count: packed.chunks.length }, packed.chunks.map((payload, ordinal) => ({ ordinal, payload })), [], [], {});
    const money = await readWorkbookMoneyAudit();
    // Expose fixture locals only in this test VM; the immutable original
    // guarded test source itself is not edited or relaxed.
    const fixtureExpression = initializer("script/track-b-admission.test.ts", "disclosureFixture")
      .replace("return { report, disclosure, pin };", "return { report, disclosure, pin, protocol, corpus };");
    const track = evaluate(fixtureExpression, { assessTrackBAdmission, contentHash, trackBPeriodDomainHash })();
    rememberReportRelease(track.report, "track-b-publication", { version: "track-b-consumed-publication-1",
      pin: track.pin, disclosure: track.disclosure, report: track.report, allowEngineeringFixtures: true,
      assessment: captureTrackBExportMaterial(track.protocol, track.corpus, track.report) });
    const app = express(); app.use(downloadManifestMiddleware());
    const bind: typeof bindReportRelease = (res, raw, report, query) => bindReportRelease(res, raw, report, query, f.store);
    registerStage10CoverageRoutes(app, async () => stage, bind);
    registerTrackBAdmissionRoutes(app, () => ({ report: track.report, identity: track.pin }), [], bind);
    registerWorkbookMoneyAuditApi(app, async () => money, bind);
    await mounted(app, async base => {
      const paths = ["/api/research/stage10-coverage/export.json", "/api/research/stage10-coverage/export.xlsx",
        `/api/research/track-b-admission/export.json?protocolHash=${track.pin.protocolHash}`,
        `/api/research/track-b-admission/export.xlsx?protocolHash=${track.pin.protocolHash}`,
        "/api/financial-data/workbook-money-audit.xlsx"];
      const resultIds: string[] = [];
      for (const path of paths) {
        const response = await fetch(`${base}${path}${path.includes("?") ? "&" : "?"}downloadMetadata=manifest-v1`);
        assert.equal(response.status, 200, path);
        const bytes = Buffer.from(await response.arrayBuffer());
        const manifest = JSON.parse(Buffer.from(response.headers.get("X-Download-Manifest")!, "base64url").toString("utf8"));
        assert.equal(manifest.producerIdentity, null, "Custom transformed reports are not native response bytes");
        assert.ok(manifest.safeReportExportIdentity, response.headers.get("X-Producer-Binding-Error") ?? path);
        assert.equal(manifest.safeReportExportIdentity.scientificAcceptance, false);
        const id = manifest.safeReportExportIdentity.parent.resultId;
        await f.store.loadResult(id); resultIds.push(id);
        const rawManifest = JSON.stringify(manifest);
        assert.doesNotMatch(rawManifest, /privateAudit|reconciliation":|sourceCells|profiles|statements/);
        if (path.includes(".xlsx")) {
          const book = XLSX.read(bytes, { type: "buffer" });
          const lineage = manifest.safeReportExportIdentity;
          assert.deepEqual(book.SheetNames, [...lineage.sheets.map((s: any) => s.name), "Download manifest"]);
          for (const sheet of lineage.sheets) {
            const cells = XLSX.utils.sheet_to_json(book.Sheets[sheet.name], { header: 1, raw: true, defval: null });
            assert.equal(contentHash(cells), sheet.literalCellsHash);
            for (const [address, cell] of Object.entries(book.Sheets[sheet.name])) if (!address.startsWith("!"))
              assert.ok(cell.f === undefined && cell.F === undefined && cell.l === undefined);
          }
        } else assert.ok(JSON.parse(bytes.toString()).data);
      }
      for (const id of resultIds) {
        const loaded = await f.store.loadResult(id), material = f.materials.get(loaded.manifest.settings.materialInputsId);
        const backup = f.materials.get(material.inputId); f.materials.delete(material.inputId);
        await assert.rejects(() => f.store.loadResult(id)); f.materials.set(material.inputId, backup);
      }
    });
  } finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
});
test("company coverage lossless JSON binds full actual source/review material and rejects parent mutation, not ordinary unbound availability", async () => {
  const f = fixture(), source = { version: "company-coverage-consumed-source-1",
    options: { informationCutoff: "2025-01-02T00:00:00Z" }, sourceId: "current-workbook-unversioned", observationDate: "2025-01-01",
    workbook: { companies: [{ id: 1, isin: "ENGINEERING-COVERAGE-NOT-APPROVED" }], timeSeries: [
      { companyId: 1, date: "2025-01-01", scope1Emissions: 0, scope2Emissions: null }] }, financialRows: [], archiveRows: [] };
  const report = await replayReportRelease("company-coverage", source); rememberReportRelease(report, "company-coverage", source);
  const res: any = { set() {} }, proof = await bindReportRelease(res, report, report, {}, f.store); assert.ok(proof);
  const data = await retainProducerDownload(new Response(JSON.stringify(report), { headers: {
    "X-Producer-Identity": Buffer.from(JSON.stringify(proof)).toString("base64url") } }), null).json();
  const file = await prepareJson(data, "coverage", "engineering-coverage.json", "2026-11-01T00:00:00Z", () => {});
  const parsed = JSON.parse(file.text); assert.deepEqual(parsed.data, data); assert.equal(parsed.manifest.producerIdentity.resultId, proof.resultId);
  data.eligibilityConflicts++;
  await assert.rejects(() => prepareJson(data, "coverage", "engineering-coverage.json", "2026-11-01T00:00:00Z", () => {}), /changed/);
});
test("concurrent current/archive effective inputs stay object-bound and exact retained HTTP readbacks never reload current sources", async () => {
  const f = fixture();
  const a = runWithOverrideRows([], () => captureLegacyInputs("/api/indicators/historical", {}, "current-A"));
  const b = runWithOverrideRows([{ indicatorKey: "policyImplementationRate", year: 2024, value: 0.21,
    source: "ISOLATED ENGINEERING OVERRIDE NOT APPROVED", method: "engineering-test", sourceUrl: null, asOfDate: null }],
    () => captureLegacyInputs("/api/indicators/historical", {}, "archive-B"));
  b.query = { indicatorSnapshotId: b.indicatorHash };
  const dataA = replayLegacyProducer(a), dataB = replayLegacyProducer(b);
  const [proofA, proofB] = await Promise.all([retainLegacyProducer(a, dataA, f.store), retainLegacyProducer(b, dataB, f.store)]);
  assert.notEqual(proofA.resultId, proofB.resultId);
  assert.notEqual(proofA.materialInputsId, proofB.materialInputsId);
  const app = express(); app.use(downloadManifestMiddleware()); registerProducerDownloadRoutes(app, f.store.loadResult);
  await mounted(app, async base => {
    const consumed = await Promise.all([proofA, proofB].map(async proof => {
      const response = await fetch(`${base}/api/analysis/results/${proof.resultId}/export.json?downloadMetadata=manifest-v1`);
      assert.equal(response.status, 200);
      const envelope = await response.json();
      assert.equal(envelope.manifest.producerIdentity.resultId, proof.resultId);
      return envelope.data;
    }));
    assert.deepEqual(consumed, [dataA, dataB]);
  });
  const consumedA = await retainProducerDownload(new Response(JSON.stringify(dataA), { headers: {
    "X-Producer-Identity": Buffer.from(JSON.stringify(proofA)).toString("base64url") } }), null).json();
  const rows = deriveLegacyExport(consumedA, "indicator-cards").rows;
  bindProducerLegacyConsumer(consumedA, "indicator-cards", rows);
  assert.equal(captureDerivedConsumer(rows)!.parent.resultId, proofA.resultId);
  assert.equal((await f.store.loadResult(proofA.resultId)).manifest.scenario, "legacy-export:/api/indicators/historical");
});
test("legacy response writer preserves ordinary nonempty result under archive outage", async () => {
  const headers: Record<string, string> = {}, sent: any[] = [];
  const res: any = { locals: {}, statusCode: 200, set(k: string, v: string) { headers[k] = v; }, json(b: unknown) { sent.push(b); return this; } };
  const store = { ...fixture().store, captureSource: async () => { throw new Error("Isolated archive unavailable"); } };
  await runWithOverrideRows([], () => new Promise<void>(resolve => {
    legacyExportProducerMiddleware(store)({ method: "GET", path: "/api/indicators/historical", query: {} } as any, res, () => {
      const input = captureLegacyInputs("/api/indicators/historical", {}, "effective-indicator-history");
      res.json(replayLegacyProducer(input));
      setTimeout(resolve, 100);
    });
  }));
  assert.ok(sent[0].length > 0); assert.equal(headers["X-Producer-Identity"], undefined);
  assert.equal(headers["X-Producer-Binding-Status"], "unavailable-no-producer-attestation");
});

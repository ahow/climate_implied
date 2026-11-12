import type { Response } from "express";
import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import { contentHash, createManifest } from "../calculation/analysisManifest";
import { captureCalculationSource, currentSourceArchiveId, saveLegacyExportMaterial, loadMaterialArchive } from "./materialInputs";
import { saveAnalysisResult, loadAnalysisResult } from "./results";
import { buildStage10Coverage } from "../financialData/stage10Coverage";
import { workbookMoneyAuditSchema } from "../../shared/workbookMoneyAudit";
import { validateTrackBPublication } from "../trackBDisclosureStore";
import { verifiedProducer } from "../producerDownload";
import { stage10ExportDocument, buildStage10Workbook } from "../financialData/stage10Export";
import { trackBAdmissionExportDocument } from "../../shared/trackBAdmissionContract";
import { buildTrackBAdmissionWorkbook } from "../calculation/trackBAdmissionWorkbook";
import { buildWorkbookMoneyAuditWorkbook, workbookMoneyAuditHash } from "../financialData/workbookMoneyExport";
import type { LegacyProducerStore } from "./legacyExportProducer";
import { coverageReviews } from "./companyCoverage";
import { companyCoverage } from "../calculation/companyCoverage";
import { getIndicatorDef } from "../dataIngestion/indicatorRegistry";
import { runWithOverrideRows } from "../dataIngestion/requestOverrides";
import { getOverrideMeta } from "../dataIngestion/overrideStore";
import { replayStage10FromSources } from "../financialData/stage10Source";
import { consumedReportRelease, reportReleaseFailure, type ReportReleaseKind } from "./reportMaterialContext";
import { bindNestedOutput } from "../../shared/outputFieldSemantics";
import { replayTrackBExportMaterial } from "../calculation/trackBExportMaterial";

type Material = { version: "safe-report-release-material-1"; kind: ReportReleaseKind; sourceArchive: string;
  inputId: string; query: Record<string, unknown>; queryTime: string };
const bindings = new WeakMap<Response, { parent: ReturnType<typeof verifiedProducer>; kind: ReportReleaseKind; result: any }>();
const production: LegacyProducerStore = { captureSource: captureCalculationSource, saveMaterial: saveLegacyExportMaterial,
  saveResult: saveAnalysisResult, loadResult: loadAnalysisResult };
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
/** Called only at actual authenticated source-reader completion. No HTTP/UI
 * caller supplies these private source materials or grants publication rights. */
export async function replayReportRelease(kind: ReportReleaseKind, source: any) {
  if (kind === "company-coverage") {
    if (source.version !== "company-coverage-consumed-source-1") throw new Error("Coverage whole material absent");
    const reviews = await coverageReviews(source.workbook.companies, source.financialRows, source.archiveRows, source.options.informationCutoff);
    return companyCoverage({ companies: source.workbook.companies, observations: source.workbook.timeSeries, reviews,
      observationDate: source.observationDate, informationCutoff: source.options.informationCutoff, sourceId: source.sourceId });
  }
  if (kind === "indicator-detail") {
    if (source.version !== "indicator-detail-consumed-source-1") throw new Error("Indicator detail whole material absent");
    const def = getIndicatorDef(source.key);
    if (!def || contentHash(def) !== contentHash(source.def)) throw new Error("Indicator definition/source release conflicts");
    const series = runWithOverrideRows(source.approved, () => source.history.map((row: any) => {
      const meta = getOverrideMeta(source.key, row.year);
      return { year: row.year, value: row[source.key], source: meta ? meta.source : row.isNowcast ? "Nowcast (estimated)" : "Curated baseline",
        method: meta ? meta.method : row.isNowcast ? "nowcast" : "curated", asOfDate: meta ? meta.asOfDate ?? null : null,
        sourceUrl: meta ? meta.sourceUrl ?? null : null, overridden: !!meta, isNowcast: meta ? false : row.isNowcast };
    }));
    return { def, series, proposals: source.proposals };
  }
  if (kind === "stage10-coverage") {
    if (source.version !== "stage10-consumed-source-1" || !source.files || !source.workbook || !source.journals)
      throw new Error("Stage10 whole consumed source release absent");
    // These are the exact authenticated reader's full workbook, immutable
    // provider versions, root-cause audit, journal rows and aggregation inputs,
    // retained privately, not the safe inputHash alone.
    if (source.input.sourceIdentity.audit !== contentHash(source.files.audit) ||
      source.input.sourceIdentity.rootCause !== contentHash(source.files.rootCause))
      throw new Error("Stage10 consumed file/source release conflicts");
    return replayStage10FromSources(source.files, source.workbook.header, source.workbook.chunks,
      source.journals.reviews, source.journals.archives, source.options);
  }
  if (kind === "workbook-money-audit") {
    const report = workbookMoneyAuditSchema.parse(source.summary);
    const digest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
    if (source.version !== "money-audit-consumed-source-1" || digest(source.privateAudit) !== report.sourceMetadataHash ||
      digest(source.reconciliation) !== report.denominationReconciliationHash)
      throw new Error("Monetary private source/reconciliation release conflicts");
    return report;
  }
  if (kind === "track-b-publication") {
    if (source.version !== "track-b-consumed-publication-1") throw new Error("TrackB publication source absent");
    const report = validateTrackBPublication(source.pin, source.disclosure, source.report, source.allowEngineeringFixtures).report;
    if (!source.assessment) throw new Error("Full retained TrackB assessment inputs unavailable; ordinary rights-qualified report remains unbound");
    replayTrackBExportMaterial(source.assessment, report);
    return report;
  }
  throw new Error("Unknown safe report release contract");
}
function verifyReportQuery(kind: ReportReleaseKind, input: any, query: Record<string, unknown>, report: any) {
  const allowed: Record<ReportReleaseKind, string[]> = {
    "stage10-coverage": ["workbookHash", "cutoff", "firstYear", "lastYear", "expectedInputHash"],
    "track-b-publication": ["protocolHash", "reportHash", "disclosureHash"],
    "workbook-money-audit": ["expectedAuditHash"],
    "company-coverage": ["snapshotId", "observationDate", "informationCutoff"],
    "indicator-detail": ["key", "indicatorSnapshotId"],
  };
  if (Object.keys(query).some(key => !allowed[kind].includes(key))) throw new Error("Unsupported retained report query");
  if (kind === "stage10-coverage") {
    const { expectedInputHash, ...options } = query;
    if (contentHash(options) !== contentHash(input.options) || (expectedInputHash && expectedInputHash !== report.inputHash))
      throw new Error("Stage10 source/query/expected input selection conflicts");
  }
  if (kind === "track-b-publication" && (query.protocolHash !== input.pin.protocolHash ||
    query.reportHash && query.reportHash !== input.pin.reportHash || query.disclosureHash && query.disclosureHash !== input.pin.disclosureHash))
    throw new Error("TrackB exact public report/disclosure query conflicts");
  if (kind === "workbook-money-audit" && query.expectedAuditHash && query.expectedAuditHash !== workbookMoneyAuditHash(report))
    throw new Error("Monetary expected audit selection conflicts");
  if (kind === "company-coverage" && (query.snapshotId && query.snapshotId !== report.sourceId ||
    query.observationDate && query.observationDate !== report.observationDate ||
    query.informationCutoff && Date.parse(String(query.informationCutoff)) !== Date.parse(report.informationCutoff)))
    throw new Error("Company coverage exact source/date/cutoff selection conflicts");
  if (kind === "indicator-detail" && (query.key !== input.key ||
    query.indicatorSnapshotId && query.indicatorSnapshotId !== input.indicatorHash))
    throw new Error("Indicator key/approved source selection conflicts");
}
export async function bindReportRelease(res: Response, raw: object, report: unknown, query: Record<string, unknown>,
  store = production) {
  const source = consumedReportRelease(raw);
  if (!source) {
    res.set("X-Producer-Binding-Status", "unavailable-no-authenticated-source-release");
    res.set("X-Producer-Binding-Error", reportReleaseFailure(raw) ?? "Actual authenticated source release was not captured; ordinary result/export remains unbound");
    return null;
  }
  try {
    const expected = await replayReportRelease(source.kind, source.source);
    if (contentHash(expected) !== contentHash(report)) throw new Error("Safe report conflicts with consumed whole release");
    verifyReportQuery(source.kind, source.source, query, report);
    const sourceArchive = await store.captureSource(), inputId = await store.saveMaterial(source.source);
    const material: Material = { version: "safe-report-release-material-1", kind: source.kind,
      sourceArchive, inputId, query: json(query), queryTime: new Date().toISOString() };
    const materialInputsId = await store.saveMaterial(material);
    if (inputId !== contentHash(source.source) || materialInputsId !== contentHash(material))
      throw new Error("Safe report material archive identity conflicts");
    const manifest = createManifest({ codeVersion: sourceArchive, modelVersion: `safe-report-release:${source.kind}:1`,
      snapshotHashes: [inputId], scenario: `safe-report-release:${source.kind}`, settings: { materialInputsId,
        query: material.query, queryTime: material.queryTime, modelMeaning: "Source-qualified safe report aggregation/publication, not climate/issuer model execution" } });
    const id = await store.saveResult(manifest, report), proof = verifiedProducer(id, await store.loadResult(id), report);
    bindings.set(res, { parent: proof, kind: source.kind, result: json(report) });
    res.set("X-Producer-Binding-Status", "retained-safe-report-source-release-verified");
    return proof;
  } catch (error) {
    res.set("X-Producer-Binding-Status", "unavailable-no-producer-attestation");
    res.set("X-Producer-Binding-Error", error instanceof Error ? error.message : "Safe report retention unavailable");
    return null;
  }
}
export async function verifyReportReleaseMaterial(id: string, manifest: any, result: unknown,
  load: (id: string, kind: "material-inputs" | "calculation-source") => Promise<any> = loadMaterialArchive,
  sourceId = currentSourceArchiveId()) {
  const material: Material = await load(id, "material-inputs");
  const source = await load(material.sourceArchive, "calculation-source"), input = await load(material.inputId, "material-inputs");
  verifyReportQuery(material.kind, input, material.query, result);
  if (contentHash(material) !== id || material.version !== "safe-report-release-material-1" ||
    contentHash(source) !== material.sourceArchive || manifest.codeVersion !== material.sourceArchive || manifest.codeVersion !== sourceId ||
    contentHash(input) !== material.inputId || manifest.scenario !== `safe-report-release:${material.kind}` ||
    manifest.modelVersion !== `safe-report-release:${material.kind}:1` ||
    contentHash(manifest.snapshotHashes) !== contentHash([material.inputId]) ||
    contentHash(manifest.settings.query) !== contentHash(material.query) || manifest.settings.queryTime !== material.queryTime ||
    contentHash(await replayReportRelease(material.kind, input)) !== contentHash(result))
    throw new Error("Safe report whole material/code/query/result archive conflicts");
}
function workbookCells(book: XLSX.WorkBook) {
  for (const name of book.SheetNames) {
    const sheet = book.Sheets[name], range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
    for (const [address, cell] of Object.entries(sheet)) {
      if (address.startsWith("!")) continue;
      if (!/^[A-Z]+[1-9]\d*$/.test(address)) throw new Error("Unexpected safe report cell address");
      const point = XLSX.utils.decode_cell(address);
      if (!range || point.r < range.s.r || point.r > range.e.r || point.c < range.s.c || point.c > range.e.c)
        throw new Error("Safe report cell outside declared literal range");
      if (cell.f !== undefined || cell.F !== undefined || cell.l !== undefined) throw new Error("Safe report export permits literal cells only");
    }
  }
  return book.SheetNames.map((name, index) => ({ name, index,
    cells: XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: null, raw: true }) }));
}
/** Exact custom sheets/documents are replayed from the bound safe report,
 * never self-attested by a request or by the downloaded workbook's own hash. */
export function responseReportRelease(res: Response, document: unknown, book?: XLSX.WorkBook) {
  const binding = bindings.get(res);
  if (!binding) return null;
  const report = binding.result;
  const expectedDocument = binding.kind === "stage10-coverage" ? stage10ExportDocument(report) :
    binding.kind === "track-b-publication" ? trackBAdmissionExportDocument(report) : report;
  const expectedBytes = binding.kind === "stage10-coverage" ? buildStage10Workbook(report) :
    binding.kind === "track-b-publication" ? buildTrackBAdmissionWorkbook(report) : buildWorkbookMoneyAuditWorkbook(report);
  const expectedCells = workbookCells(XLSX.read(expectedBytes, { type: "buffer" }));
  if (book ? contentHash(workbookCells(book)) !== contentHash(expectedCells) : contentHash(document) !== contentHash(expectedDocument))
    throw new Error("Safe report custom attachment differs from exact retained report projection");
  const identity = { version: "safe-report-export-lineage-1", parent: binding.parent, kind: binding.kind,
    derivation: { version: "safe-report-custom-projection-1",
      order: "Exact existing writer worksheet/header/cell order; no reordering, deduplication, inference or private publication",
      units: "Exact literal original custom headings and field definitions; unknown/null is not zero; no monetary totals/FX inferred",
      claim: "New retained safe report release/projection; not original upstream bytes, source approval, study execution, scientific acceptance or qualified issuer economics" },
    dataHash: contentHash(book ? workbookCells(book) : expectedDocument),
    sheets: book ? expectedCells.map(({ name, index, cells }) => ({ name, index, literalCellsHash: contentHash(cells) })) : [],
    scientificAcceptance: false, originalHistoricalExport: false };
  bindNestedOutput("safeReportExport", identity);
  return identity;
}

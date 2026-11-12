import type { Express } from "express";
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { ProducerReserveReport } from "../shared/producerReserveSchema";
import { buildPublicProducerReserveReport, producerReserveHash } from "./calculation/producerReserveModel";
import { producerReserveDomain } from "./calculation/producerReserveDomain";
import { producerReserveFacts, producerReserveSource } from "./calculation/producerReserveEvidence";
import { producerReserveFreezeEvidence } from "./calculation/producerReserveFreeze";
import { producerPrimaryAuthentication } from "./calculation/producerPrimaryAuthentication";
import { buildRetirementAssociationPublic } from "../shared/retirementAssociationPublic";
import {buildCleanCoveredReport} from "./calculation/cleanCoveredReport";
import { buildPublicLocationElectricityReport } from "./calculation/locationElectricityPublicReport";
import type { LocationElectricityPublicReport } from "../shared/locationElectricityPublicTypes";
import { economicBridgeCells, economicBridgeContracts, producerReserveCalculationSemantics, type EconomicBridgeKey } from "../shared/economicBridgeSchema";
import {
  bindEconomicBridgeResponse, captureEconomicBridgeClosure, executeEconomicBridge,
  verifyEconomicBridgeDocument, type EconomicBridgeAdapter, type EconomicBridgeArchiveReader,
} from "./economicBridgeIdentity";

function verifiedProducerFreeze() {
  const evidence = producerReserveFreezeEvidence;
  if (!Number.isFinite(Date.parse(evidence.frozenAt)) || evidence.domainHash !== producerReserveHash(producerReserveDomain))
    throw new Error("Missing, corrupt or stale producer pre-solve freeze receipt");
  const originalSourceFiles = {
    "server/calculation/producerReserveDomain.ts": "473d296ca682eb382646636085e9ac07564b4f141c74dc3fcba6f1e5b282911e",
    "server/calculation/producerReserveEvidence.ts": "51f07343fb01af51f74dc7d1599d019b1faad10d357570618c5330535c80bf1f",
    "server/calculation/producerReserveModel.ts": evidence.modelSourceSha256AtFreeze,
    "shared/producerReserveSchema.ts": "f333c256ec96392c214d55639507a8bbe42dba471c158e257cc40d90bc999d5d",
  };
  // Reconstruct the exact original public allowlist receipt bytes, not a new
  // freeze; no private/generated path is read by the API.
  const originalReceipt = {
    createdAt: evidence.frozenAt, meaning: "Present-run conditional domain freeze, not historical availability or independent approval",
    domain: producerReserveDomain, domainHash: evidence.domainHash, sourceFiles: originalSourceFiles,
  };
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  if (sha(JSON.stringify(originalReceipt, null, 2)) !== evidence.freezeSha256)
    throw new Error("Public declaration does not reproduce the actual original pre-solve receipt");
  for (const [source, frozenHash] of Object.entries(originalSourceFiles)) {
    const text = readFileSync(source, "utf8"), actual = sha(text);
    if (source === "server/calculation/producerReserveModel.ts") {
      const reverseMechanicalRepair = text.replace("Array.from(new Set(roots))", "[...new Set(roots)]");
      if (actual !== evidence.modelSourceSha256Current || sha(reverseMechanicalRepair) !== frozenHash)
        throw new Error("Producer mechanical compatibility repair is not the exact frozen-model transition");
    } else if (actual !== frozenHash) throw new Error(`Producer source differs from pre-solve freeze: ${source}`);
  }
  return { declaration: evidence, originalReceipt,
    boundary: "Public allowlisted present-run pre-solve domain/source receipt with exact mechanical repair trace; no private/generated runtime dependency. Private authenticity/authorization validation remains separately required, not original historical availability, immutable retained execution or independent owner approval" };
}
const producerExecutionReceipts = new WeakMap<object, ReturnType<typeof verifiedProducerFreeze>>();
export const producerReserveAdapter: EconomicBridgeAdapter = {
  key: "producerReserve",
  entryFiles: ["server/calculation/producerReserveModel.ts", "shared/producerReserveSchema.ts"],
  execute() {
    const freeze = verifiedProducerFreeze(); // Gate before any root/path calculation.
    const report = buildPublicProducerReserveReport();
    producerExecutionReceipts.set(report, freeze);
    return report;
  },
  parts(value) {
    const report = value as ProducerReserveReport;
    const freeze = producerExecutionReceipts.get(report);
    if (!freeze) throw new Error("Producer report was not executed behind the pre-solve freeze gate");
    if (report.schemaVersion !== "producer-reserve-v1" ||
      report.hashes.parent !== producerReserveSource.pdfSha256 ||
      report.hashes.source !== producerReserveSource.textSha256 ||
      report.hashes.material !== producerReserveHash(producerReserveFacts) ||
      report.hashes.domain !== producerReserveHash(producerReserveDomain) ||
      report.hashes.model !== producerReserveFreezeEvidence.modelSemanticHash)
      throw new Error("Producer source/material/domain parent identity conflicts");
    return {
      source: { register: report.sourceRegister, declaredParentPdfHash: report.hashes.parent,
        declaredTextHash: report.hashes.source,
        primaryAuthentication: producerPrimaryAuthentication,
        assessmentBoundary: "Frozen report declarations retain the earlier unknown-at-freeze source gap. This separate current SEC table/registrant/acceptance assessment resolves only its stated primary-source comparisons; no frozen report, numerical model, domain or approval state is rewritten.",
        boundary: "Exact public worker transcription, frozen source declarations and subsequent allowlisted SEC primary-table assessment; not complete mirror PDF authentication, private bytes or source approval" },
      material: { facts: producerReserveFacts, target: report.target, workerMaterialHash: report.hashes.material },
      assumptions: { frozenDomain: producerReserveDomain, register: report.assumptionRegister,
        workerDomainHash: report.hashes.domain, preSolveFreeze: freeze },
      model: { schemaVersion: report.schemaVersion, calculationBasis: report.calculationBasis,
        moneyUnit: report.moneyUnit, physicalUnit: report.physicalUnit,
        workerSemanticModelHash: report.hashes.model, cashAndStockDefinitions: report.reconciliation,
        quantities: producerReserveCalculationSemantics },
      derivation: { workerParentHashes: report.hashes, baseResult: report.baseResult,
        sensitivityRows: report.sensitivityRows, refusalRows: report.refusalRows,
        missingness: report.sourceGaps },
    };
  },
};
export const locationElectricityAdapter: EconomicBridgeAdapter = {
  key: "locationElectricity",
  entryFiles: ["server/calculation/locationElectricityPublicReport.ts", "shared/locationElectricityPublicTypes.ts"],
  execute: buildPublicLocationElectricityReport,
  parts(value) {
    const report = value as LocationElectricityPublicReport;
    if (report.version !== "location-electricity-public-source-report-1" ||
      report.actualIssuerResult !== null || report.sourceQualifiedIssuerExecution !== false ||
      report.assumptionValuesAssignedToIssuers !== 0 ||
      report.counts.sourceQualifiedIssuerCashBridgeExecutions !== 0 ||
      report.sourceFacts.contextualElectricityPrices.some(price => price.issuerTariff ||
        price.applicableToNamedIssuerSite || price.nominalMajorCurrencyPerMWh !== price.reportedValue * 10))
      throw new Error("Location/electricity source, conversion or missing-issuer-result contract conflicts");
    return {
      source: { sourceFacts: report.sourceFacts, freezeDeclaration: report.freeze,
        boundary: "Exact public source transcriptions and declared hashes; no private raw reads, new source authentication or historical-origin assertion. Regional averages are not issuer tariffs." },
      material: { cutoff: report.cutoff, sourceFacts: report.sourceFacts, missingIssuerInputs: report.missingIssuerInputs },
      assumptions: { assignedToIssuers: report.assumptionValuesAssignedToIssuers,
        actualIssuerResult: report.actualIssuerResult, sourceQualifiedIssuerExecution: report.sourceQualifiedIssuerExecution,
        missingIssuerInputs: report.missingIssuerInputs },
      model: { version: report.version, executedOperation: "Contextual electricity-price unit conversion and public property/count projection only",
        issuerCashBridgeExecuted: false, companyProjectionExecuted: false,
        quantities: [
          { field: "sourceFacts.contextualElectricityPrices[].reportedValue", unit: "US cents/kWh", formula: "Exact reported EIA industrial sector observation for stated year; regional context only" },
          { field: "sourceFacts.contextualElectricityPrices[].nominalMajorCurrencyPerMWh", unit: "USD/MWh", formula: "reportedValue * 0.01 USD/cent * 1000 kWh/MWh = reportedValue * 10" },
          { field: "sourceFacts.operatingLocations[].purchasedElectricityMWh", unit: "MWh/year", formula: "Explicit null: unavailable; never infer from capacity, output GW or Scope2 tonnes" },
          { field: "sourceFacts.operatingLocations[].customerRecoveryFraction,supplierPaymentFraction,customerCollectionFraction", unit: "fraction", formula: "Explicit null: no issuer assumption assigned" },
          { field: "counts", unit: "records/executions as named", formula: "Exact public worker source inventory; six property rows, five operating and one construction; five contextual regional prices; zero qualified issuer executions" },
          { field: "actualIssuerResult", unit: "not identified", formula: "Explicit null; no admissible complete issuer/site/tariff/quantity/recovery/cash-timing inputs" },
        ] },
      derivation: { freezeDeclaration: report.freeze, counts: report.counts,
        conversions: report.sourceFacts.contextualElectricityPrices,
        actualIssuerResult: report.actualIssuerResult, missingness: report.missingIssuerInputs,
        boundary: report.boundary },
    };
  },
};
export const retirementAssociationAdapter: EconomicBridgeAdapter = {
  key:"retirementAssociation",
  entryFiles:["shared/retirementAssociationPublic.ts","server/calculation/utilityRetirement.ts"],
  execute:buildRetirementAssociationPublic,
  parts(value) {
    const report=value as ReturnType<typeof buildRetirementAssociationPublic>;
    if(report.version!=="retirement-association-public-1" || report.retirementResult!==null ||
      report.association.actualStudyExecuted || report.association.actualEstimate!==null ||
      report.calculated.ownedBookValueUsdMillion!==report.source.ownedPlantInServiceUsdMillion-report.source.ownedAccumulatedDepreciationUsdMillion)
      throw new Error("Inconsistent public retirement source/claim");
    return {source:report.source,material:{source:report.source,missing:report.missingRetirementInputs},
      assumptions:report.assumptions,
      model:{version:report.version,formulas:report.formulas,operation:"Book arithmetic only; retirement engine and offline association estimator not executed by HTTP"},
      derivation:{calculated:report.calculated,associationMethod:report.association,claim:report.claim}};
  },
};
export const cleanCoveredAdapter:EconomicBridgeAdapter={
  key:"cleanCovered",
  entryFiles:["server/calculation/cleanCoveredReport.ts","server/calculation/cleanManufacturingMap.ts",
    "server/calculation/operatingCohorts.ts","server/calculation/cohortGrowthInverse.ts"],
  execute:buildCleanCoveredReport,
  parts(value){
    const r=value as ReturnType<typeof buildCleanCoveredReport>;
    if(r.version!=="clean-covered-public-1"||r.manufacturing.actualResult!==null||r.covered.scientificAcceptance||
      r.covered.scenarios.some(s=>s.status!=="conditional"))
      throw Error("Inconsistent public physical source/claim");
    return {source:r.source,material:{source:r.source,population:r.covered.population,years:r.covered.years},
      assumptions:r.covered.scenarios.map(s=>({id:s.id,assumptions:s.assumptions,hash:s.assumptionHash})),
      model:{version:r.version,coveredVersion:r.covered.version,
        operation:"Observed2023 netMWh/nativeCO2 reconstruction only; no manufacturing inverse or Stage7 ensemble executed"},
      derivation:{observed:r.observed,calculated:r.calculated,covered:r.covered,claims:r.claims,limitations:r.limitations}};
  },
};
export const publicEconomicBridgeAdapters: EconomicBridgeAdapter[] = [producerReserveAdapter, locationElectricityAdapter, retirementAssociationAdapter,cleanCoveredAdapter];
// Bytes captured with imported modules, never refreshed by a request, a test
// archive reader or later on-disk edits. This performs no model calculation.
const publicEconomicBridgeRelease = captureEconomicBridgeClosure(publicEconomicBridgeAdapters);
export function registerProducerReserveRoutes(app: Express, archive?: EconomicBridgeArchiveReader) {
  return registerEconomicBridgeRoutes(app, publicEconomicBridgeAdapters, archive);
}

/** Model-specific adapters are closed over imported worker functions; callers
 * cannot select code, input data, an archive, a parent or an assumption. */
export function createEconomicBridgeService(adapters: EconomicBridgeAdapter[]) {
  if (new Set(adapters.map(adapter => adapter.key)).size !== adapters.length)
    throw new Error("Duplicate economic calculation adapter");
  const release = adapters === publicEconomicBridgeAdapters ? publicEconomicBridgeRelease : captureEconomicBridgeClosure(adapters);
  function adapterFor(key: EconomicBridgeKey) {
    const adapter = adapters.find(item => item.key === key);
    if (!adapter) throw new Error("Unknown public economic calculation");
    return adapter;
  }
  return {
    execute: (key: EconomicBridgeKey, archive?: EconomicBridgeArchiveReader) =>
      executeEconomicBridge(adapterFor(key), release, archive),
    verify: (document: Parameters<typeof verifyEconomicBridgeDocument>[0], archive?: EconomicBridgeArchiveReader) =>
      verifyEconomicBridgeDocument(document, adapterFor(document.key), release, archive),
  };
}
export function registerEconomicBridgeRoutes(app: Express, adapters: EconomicBridgeAdapter[],
  archive?: EconomicBridgeArchiveReader) {
  const service = createEconomicBridgeService(adapters);
  for (const adapter of adapters) {
    const { route } = economicBridgeContracts[adapter.key];
    for (const suffix of ["", "/export.json", "/export.xlsx"]) {
      app.get(`${route}${suffix}`, async (req, res) => {
        if (Object.keys(req.query).length) {
          res.status(400).json({ error: "This prospective public calculation accepts no queries, overrides, archive or parent selections." });
          return;
        }
        try {
          const body = await service.execute(adapter.key, archive);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          if (!suffix) { res.json(body); return; }
          bindEconomicBridgeResponse(res, body);
          const filename = `supplemental-${adapter.key}-prospective-not-qualified`;
          if (suffix === "/export.json") { res.attachment(`${filename}.json`).json(body); return; }
          const workbook = new ExcelJS.Workbook();
          workbook.creator = "Climate Dashboard — public derived aggregates";
          workbook.title = "Supplemental prospective conditional calculation";
          workbook.subject = body.identity.claim;
          const sheet = workbook.addWorksheet("Public calculation");
          sheet.columns = [
            { header: "JSON pointer", key: "pointer", width: 70 },
            { header: "Literal JSON value", key: "jsonValue", width: 115 },
          ];
          sheet.addRows(economicBridgeCells(body));
          sheet.getRow(1).font = { bold: true };
          sheet.views = [{ state: "frozen", ySplit: 1 }];
          res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
          res.attachment(`${filename}.xlsx`);
          res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
        } catch (error) {
          for (const header of ["Content-Disposition", "X-Download-Manifest", "X-Producer-Identity"])
            res.removeHeader(header);
          res.status(503).type("application/json").json({
            error: `Prospective calculation refused: ${error instanceof Error ? error.message : "source/model/code verification failed"}`,
          });
        }
      });
    }
  }
}

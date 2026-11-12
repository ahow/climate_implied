import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { contentHash } from "../server/calculation/analysisManifest";
import { readCalculationSourceArtifact } from "../server/snapshots/materialInputs";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { registerCompanyConditionalRoutes } from "../server/companyConditionalApi";
import { createEconomicBridgeService, publicEconomicBridgeAdapters, registerEconomicBridgeRoutes } from "../server/producerReserveApi";
import { economicBridgeManifestIdentity, verifyEconomicBridgeWorkbook, type EconomicBridgeArchiveReader } from "../server/economicBridgeIdentity";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { economicBridgeCells, economicBridgeContracts, economicBridgeSupplementalCensus, readEconomicBridgeCells, type EconomicBridgeDocument } from "../shared/economicBridgeSchema";
import { serverDownloadRegistry } from "../shared/serverDownloadRegistry";
import { producerPrimaryAuthentication, isExactProducerPrimaryAuthentication } from "../server/calculation/producerPrimaryAuthentication";

async function mounted(run: (base: string) => Promise<void>, archive?: EconomicBridgeArchiveReader) {
  const app = express();
  app.use((req, _res, next) => {
    const value = req.header("x-isolated-override-fixture");
    if (!value) { next(); return; }
    runWithOverrideRows([{ indicatorKey: "oil_price", year: 2024, value: Number(value),
      source: "Isolated engineering fixture, never a production source", method: "request-local test only" }], next);
  });
  app.use(downloadManifestMiddleware());
  if (archive) registerEconomicBridgeRoutes(app, publicEconomicBridgeAdapters, archive);
  else registerCompanyConditionalRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
const file = (path: string) => readFileSync(path, "utf8");
const service = createEconomicBridgeService(publicEconomicBridgeAdapters);

test("new route/schema/census inventory is explicitly additive and registered outside pinned routes", () => {
  assert.equal(economicBridgeSupplementalCensus.original1001Delta, 0);
  assert.equal(economicBridgeSupplementalCensus.fixedPriorMatrixDelta, 0);
  assert.equal(economicBridgeSupplementalCensus.old124Delta, 0);
  assert.equal(economicBridgeSupplementalCensus.fairPinDelta, 0);
  assert.equal(economicBridgeSupplementalCensus.routes.length, 9);
  assert.equal(economicBridgeSupplementalCensus.jsonSuccessSurfaces.length, 6);
  assert.equal(economicBridgeSupplementalCensus.binarySuccessSurfaces.length, 3);
  assert.match(file("server/companyConditionalApi.ts"), /registerProducerReserveRoutes\(app\)/);
  assert.doesNotMatch(file("server/routes.ts"), /producerReserveApi|economicBridgeIdentity|locationElectricity/);
  for (const contract of Object.values(economicBridgeContracts)) {
    for (const suffix of ["/export.json", "/export.xlsx"])
      assert.ok(serverDownloadRegistry.some(entry => (entry.paths as readonly string[]).includes(contract.route + suffix)));
  }
  assert.deepEqual(readEconomicBridgeCells(economicBridgeCells({ a: [], b: {}, c: [null, 1, "=not-a-formula"], "a/b~c": true })),
    { a: [], b: {}, c: [null, 1, "=not-a-formula"], "a/b~c": true });
});
test("producer uses safe original freeze declaration and exact mechanical repair, never a private runtime receipt or equity inference", async () => {
  const body = await service.execute("producerReserve");
  const report = body.report as { marketEquityTarget: unknown; marketImpliedDecline: unknown; fcfe: unknown;
    baseResult: { status: string }; ownerApproved: boolean };
  assert.equal(report.marketEquityTarget, null);
  assert.equal(report.marketImpliedDecline, null);
  assert.equal(report.fcfe, null);
  assert.equal(report.ownerApproved, false);
  assert.equal(report.baseResult.status, "unique-conditional-root");
  assert.equal(body.identity.resultHash, "a86ada9f4b0cc6abebdb7ab24006945d6dff1da5d7da228e6631b6f82d8e73d3",
    "Supplementary primary assessment must not rewrite the earlier exact frozen-model public report");
  const source = body.identity.sourceArtifact.value as { primaryAuthentication: unknown; assessmentBoundary: string };
  assert.ok(isExactProducerPrimaryAuthentication(source.primaryAuthentication));
  assert.deepEqual(source.primaryAuthentication, producerPrimaryAuthentication);
  assert.equal(producerPrimaryAuthentication.publishedAt, "2025-02-19T21:39:37Z");
  assert.equal(producerPrimaryAuthentication.comparedRows, 38);
  assert.equal(producerPrimaryAuthentication.comparedNumericCells, 261);
  assert.equal(producerPrimaryAuthentication.producerNumericFactsMatched, 39);
  assert.match(source.assessmentBoundary, /unknown-at-freeze/);
  assert.ok(body.identity.codeArtifact.files.some(file => file.path === "server/calculation/producerPrimaryAuthentication.ts"));
  assert.doesNotMatch(JSON.stringify(body), /generated-artifacts\//);
  const assumptions = body.identity.assumptions.value as {
    preSolveFreeze: { declaration: { frozenAt: string; freezeSha256: string; modelSourceSha256AtFreeze: string; modelSourceSha256Current: string } };
  };
  assert.equal(assumptions.preSolveFreeze.declaration.frozenAt, "2026-11-12T14:30:39.281Z");
  assert.equal(assumptions.preSolveFreeze.declaration.freezeSha256, "03c88f118156484be83d9695088d31ab035cf25bf7f79cd83b841b2c1c07bb45");
  assert.notEqual(assumptions.preSolveFreeze.declaration.modelSourceSha256Current,
    assumptions.preSolveFreeze.declaration.modelSourceSha256AtFreeze);
  assert.doesNotMatch(file("server/producerReserveApi.ts"), /readFileSync\([^)]*generated-artifacts/);
});
test("location publishes actual public facts/conversions and explicit missingness, not a synthetic issuer bridge", async () => {
  const body = await service.execute("locationElectricity");
  const report = body.report as {
    actualIssuerResult: unknown; assumptionValuesAssignedToIssuers: number;
    sourceQualifiedIssuerExecution: boolean;
    counts: { evidencedPropertyRows: number; operatingPropertyRows: number; constructionPropertyRows: number; regionalPriceRecords: number };
    sourceFacts: { contextualElectricityPrices: { reportedValue: number; nominalMajorCurrencyPerMWh: number; issuerTariff: boolean }[] };
  };
  assert.equal(report.actualIssuerResult, null);
  assert.equal(report.assumptionValuesAssignedToIssuers, 0);
  assert.equal(report.sourceQualifiedIssuerExecution, false);
  assert.equal(report.counts.evidencedPropertyRows, 6);
  assert.equal(report.counts.operatingPropertyRows, 5);
  assert.equal(report.counts.constructionPropertyRows, 1);
  assert.equal(report.counts.regionalPriceRecords, 5);
  for (const price of report.sourceFacts.contextualElectricityPrices) {
    assert.equal(price.nominalMajorCurrencyPerMWh, price.reportedValue * 10);
    assert.equal(price.issuerTariff, false);
  }
  assert.doesNotMatch(JSON.stringify(body), /generated-artifacts\//);
});

for (const adapter of publicEconomicBridgeAdapters) {
  const route = economicBridgeContracts[adapter.key].route;
  test(`${adapter.key}: real registered GET/JSON/XLSX read back one exact executed prospective body`, async () => {
    await mounted(async base => {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
      const body = await response.json() as EconomicBridgeDocument;
      assert.deepEqual(body, await service.execute(adapter.key));
      assert.equal(body.identity.retainedExecution, false);
      assert.equal(body.identity.parent.retainedResultId, null);
      assert.equal(body.identity.resultHash, contentHash(body.report));
      assert.equal(body.identity.codeArtifact.id, readCalculationSourceArtifact().id);
      assert.ok(body.identity.codeArtifact.files.some(item => adapter.entryFiles.includes(item.path)));
      assert.equal(body.identity.sourceApproval, false);
      assert.equal(body.identity.scientificAcceptance, false);
      await service.verify(body);
      const plainJson = await fetch(`${base}${route}/export.json`);
      assert.equal(plainJson.status, 200);
      assert.deepEqual(await plainJson.json(), body);
      const plainManifest = JSON.parse(Buffer.from(plainJson.headers.get("X-Download-Manifest")!, "base64url").toString("utf8"));
      assert.deepEqual(plainManifest.prospectiveCalculationIdentity, economicBridgeManifestIdentity(body.identity));
      const json = await fetch(`${base}${route}/export.json?downloadMetadata=manifest-v1`);
      assert.equal(json.status, 200);
      const embedded = await json.json();
      assert.deepEqual(embedded.data, body);
      assert.deepEqual(embedded.manifest.prospectiveCalculationIdentity, economicBridgeManifestIdentity(body.identity));
      assert.equal(embedded.manifest.producerIdentity, null);
      assert.equal(embedded.manifest.referenceArtifactIdentity, undefined);
      const xlsx = await fetch(`${base}${route}/export.xlsx`);
      assert.equal(xlsx.status, 200);
      const workbook = XLSX.read(Buffer.from(await xlsx.arrayBuffer()), { type: "buffer" });
      assert.ok(verifyEconomicBridgeWorkbook(workbook, body));
      const cells = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets["Public calculation"], { header: 1, raw: true }).slice(1);
      assert.deepEqual(readEconomicBridgeCells(cells.map(row => ({ pointer: row[0], jsonValue: row[1] }))), body);
      const manifest = JSON.parse(Buffer.from(xlsx.headers.get("X-Download-Manifest")!, "base64url").toString("utf8"));
      assert.deepEqual(manifest.prospectiveCalculationIdentity, economicBridgeManifestIdentity(body.identity));
      assert.equal(manifest.producerIdentity, null);
      const cell = workbook.Sheets["Public calculation"].B2;
      cell.f = "1+1";
      assert.throws(() => verifyEconomicBridgeWorkbook(workbook, body), /literal/);
    });
  });
  test(`${adapter.key}: real handlers reject unknown query/archive/parent/override selections`, async () => {
    await mounted(async base => {
      for (const suffix of ["", "/export.json", "/export.xlsx"]) {
        for (const query of ["unknown=1", "archive=" + "a".repeat(64), "parent=" + "b".repeat(64), "decline=0.01", "issuer=XOM"]) {
          const response = await fetch(`${base}${route}${suffix}?${query}`);
          assert.equal(response.status, 400);
          assert.equal(response.headers.get("Content-Disposition"), null);
          assert.equal(response.headers.get("X-Download-Manifest"), null);
          assert.match((await response.json()).error, /no queries/);
        }
        for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
          const response = await fetch(`${base}${route}${suffix}`, { method });
          assert.equal(response.status, 404, method);
          assert.equal(response.headers.get("Content-Disposition"), null);
        }
      }
    });
  });
  test(`${adapter.key}: nooverride/current and concurrent request-local override contexts are identical`, async () => {
    await mounted(async base => {
      const expected = await (await fetch(base + route)).json();
      const bodies = await Promise.all(Array.from({ length: 12 }, async (_, index) => {
        const response = await fetch(base + route, { headers: { "x-isolated-override-fixture": String(1000 + index) } });
        assert.equal(response.status, 200);
        return response.json();
      }));
      for (const body of bodies) assert.deepEqual(body, expected);
      assert.deepEqual(await (await fetch(base + route)).json(), expected);
    });
  });
  test(`${adapter.key}: source/archive/code identities fail closed in actual handlers`, async () => {
    for (const fault of ["missing", "corrupt", "unknown-archive", "missing-code", "stale-code"] as const) {
      const archive: EconomicBridgeArchiveReader = {
        source() {
          if (fault === "missing") throw new Error("Isolated missing-source fixture");
          const source = readCalculationSourceArtifact();
          if (fault === "corrupt") source.id = "0".repeat(64);
          if (fault === "unknown-archive" || fault === "missing-code") {
            const payload = source.payload as { files: Record<string, string>; meaning: string };
            if (fault === "missing-code") delete payload.files[adapter.entryFiles[0]];
            else payload.meaning += " isolated unknown archive fixture";
            source.id = contentHash(payload);
          }
          return source;
        },
        file: path => file(path) + (fault === "stale-code" && path === adapter.entryFiles[0] ? "\n// isolated stale-code fixture" : ""),
      };
      await mounted(async base => {
        for (const suffix of ["", "/export.json", "/export.xlsx"]) {
          const response = await fetch(base + route + suffix);
          assert.equal(response.status, 503, fault);
          assert.equal(response.headers.get("Content-Disposition"), null, fault);
          assert.equal(response.headers.get("X-Download-Manifest"), null, fault);
          assert.match((await response.json()).error, /refused/);
        }
      }, archive);
    }
  });
  test(`${adapter.key}: stale parent/material/model/derivation/result identity and corrupt workbook refuse readback`, async () => {
    const document = await service.execute(adapter.key);
    for (const field of ["parent", "sourceArtifact", "materialInputs", "assumptions", "model", "derivation"] as const) {
      const corrupt = structuredClone(document);
      corrupt.identity[field].id = "f".repeat(64);
      await assert.rejects(service.verify(corrupt), /Unknown or stale/);
    }
    const corrupt = structuredClone(document);
    corrupt.identity.resultHash = "e".repeat(64);
    await assert.rejects(service.verify(corrupt), /Unknown or stale/);
    if (adapter.key === "producerReserve") {
      const staleAuthentication = structuredClone(document);
      (staleAuthentication.identity.sourceArtifact.value as { primaryAuthentication: { publishedAt: string } })
        .primaryAuthentication.publishedAt = "2025-02-20T00:00:00Z";
      await assert.rejects(service.verify(staleAuthentication), /Unknown or stale/);
    }
    assert.throws(() => service.verify({ ...document, key: "unknown" } as unknown as EconomicBridgeDocument),
      /Unknown public economic/);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["JSON pointer", "Literal JSON value"],
      ...economicBridgeCells(document).map(row => [row.pointer, row.jsonValue]),
    ]), "Public calculation");
    assert.ok(verifyEconomicBridgeWorkbook(workbook, document));
    workbook.Sheets["Public calculation"].B3.v = '"corrupt"';
    assert.throws(() => verifyEconomicBridgeWorkbook(workbook, document), /readback conflicts/);
  });
}

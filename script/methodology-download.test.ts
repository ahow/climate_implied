import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import express from "express";
import * as XLSX from "xlsx";
import { methodologyDownloadCensus } from "./methodology-download-census";
import { methodologyRegistry } from "../shared/methodologyRegistry";
import { outputFieldSemantics } from "../shared/outputFieldSemantics";
import { HISTORICAL_TYPES } from "../shared/historicalTypes";
import { scientificEvidenceStatuses } from "../shared/scientificEvidence";
import { createDownloadManifest, downloadManifestRows, downloadHistoricalTypes } from "../shared/downloadManifest";
import { serverDownloadRegistry, withDownloadManifest } from "../shared/serverDownloadRegistry";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { registerMethodologyApi } from "../server/methodologyApi";
import { registerWarmingValidationReferenceRoutes } from "../server/warmingValidationReferenceApi";
import { registerCarbonPassThroughRoutes } from "../server/carbonPassThroughApi";
import { registerCompanyConditionalRoutes } from "../server/companyConditionalApi";
import { registerQualifiedMissingnessApi } from "../server/qualifiedMissingnessApi";
import { warmingReferenceExportDocument } from "../shared/warmingValidationReferenceSemantics";
import { prepareQualifiedJsonExport } from "../client/src/lib/export-contract";
import { semanticRows } from "../shared/fieldSemantics";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RegistryMethodology } from "../client/src/components/registry-methodology";

test("S16-007 public portable AST census includes chart, JSON, direct-link, attachment and custom-sheet paths", () => {
  const census = methodologyDownloadCensus();
  assert.equal(census.centralSites.length, 26);
  assert.equal(census.downloadLinks.length, 13, "Eleven retained links plus selected-headline JSON/XLSX links");
  assert.equal(census.serverDownloads.flatMap(entry => entry.paths).length, 15, "Eleven retained routes plus2 drilldown modes×2 formats");
  assert.equal(census.attachmentSites.length, 12, "Eleven retained attachment writers plus the mode/format-bound drilldown writer");
  assert.deepEqual(census.downloadLinks.filter(site => site.path.endsWith("headline-drilldown.tsx")).map(site => site.href),
    ['{withDownloadManifest(headlineDrilldownUrl(mode, selection, "json"))}',
      '{withDownloadManifest(headlineDrilldownUrl(mode, selection, "xlsx"))}']);
  assert.deepEqual(census.serverDownloads.find(entry => entry.source === "server/headlineDrilldownApi.ts")?.paths,
    ["/api/headline-drilldown/contributions/export.json", "/api/headline-drilldown/contributions/export.xlsx",
      "/api/headline-drilldown/sensitivities/export.json", "/api/headline-drilldown/sensitivities/export.xlsx"]);
  assert.ok(census.attachmentSites.every(site => site.registered));
  assert.ok(census.downloadLinks.every(site => site.embeddedManifest), JSON.stringify(census.downloadLinks));
  assert.equal(census.centralSites.filter(site => /chart|histogram|comparison/.test(site.path)).length, 7);
  assert.ok(census.workbookSheets.length >= 20, "Custom server sheets, not only central Data sheet");
  assert.ok(census.writers.every(site => site.path === "client/src/components/download-data-button.tsx"));
  assert.deepEqual(census.inlineDataDownloads, [], "Data-URI downloads must not bypass manifest-bound writers/API attachments");
  for (const site of census.centralSites) {
    assert.ok(Object.hasOwn(methodologyRegistry().downloadClaims, JSON.parse(site.attributes.kind)), site.path);
    assert.ok(site.attributes.filename, site.path);
  }
  for (const path of ["client/src/components/historical-trend-chart.tsx", "client/src/components/category-trend-chart.tsx"]) {
    const text = readFileSync(path, "utf8");
    assert.match(text, /requireHistoricalType/);
    assert.match(text, /Historical type (?:code|label)|finiteExportBindings/);
  }
  assert.match(readFileSync("server/index.ts", "utf8"), /app\.use\(downloadManifestMiddleware\(\)\)/);
  assert.match(readFileSync("server/index.ts", "utf8"), /registerMethodologyApi\(app\)/);
});

test("S16-007 methodology is exactly registry-derived and historical labels fail closed", () => {
  const registry = methodologyRegistry();
  assert.strictEqual(registry.outputFields, outputFieldSemantics);
  assert.deepEqual(registry.historicalTypes, HISTORICAL_TYPES);
  assert.equal(new Set(registry.outputFields.map(field => field.id)).size, registry.outputFields.length);
  for (const field of registry.outputFields) {
    for (const key of ["formula", "unit", "source", "period", "geography", "status", "missingness", "uncertainty", "scope", "asOfRule"] as const)
      assert.equal(typeof field[key], "string", `${field.id}.${key}`);
  }
  assert.deepEqual(downloadHistoricalTypes(), []);
  assert.throws(() => downloadHistoricalTypes([{ "Historical type code": "ACTUAL_ARCHIVED_FORECAST" }]), /missing or inconsistent/);
  assert.throws(() => downloadHistoricalTypes([{ historicalTypeCode: "FAKE", historicalTypeLabel: "Forecast" }]), /missing or inconsistent/);
});

test("S16-007 actual methodology UI renders registry formulas, claims, historical types and separate statuses", () => {
  const html = renderToStaticMarkup(React.createElement(RegistryMethodology));
  assert.match(html, /data-testid="registry-methodology"/);
  assert.match(html, /\/api\/methodology\/registry/);
  for (const field of methodologyRegistry().outputFields) assert.ok(html.includes(field.id), field.id);
  for (const type of Object.keys(HISTORICAL_TYPES)) assert.ok(html.includes(type), type);
  for (const status of ["verification-incomplete", "not-established", "conditional-only"]) assert.ok(html.includes(status), status);
});

test("S16-007 actual JSON writer retains exact data and attaches manifest plus three independent statuses", async () => {
  const data = [{ value: null, zero: 0, historicalTypeCode: "REVISED_HISTORY_RECONSTRUCTION",
    historicalTypeLabel: HISTORICAL_TYPES.REVISED_HISTORY_RECONSTRUCTION }];
  const prepared = await prepareQualifiedJsonExport(data, "backtest", "research.json", "2026-11-12T00:00:00Z", value => value);
  const envelope = JSON.parse(prepared.text);
  assert.deepEqual(envelope.data, data);
  assert.equal(envelope.manifest.dataIdentity.hash, createHash("sha256").update(JSON.stringify(data, null, 2)).digest("hex"));
  assert.deepEqual(envelope.manifest.scientificEvidence, scientificEvidenceStatuses());
  assert.equal(envelope.manifest.historicalTypes[0]["Historical type code"], "REVISED_HISTORY_RECONSTRUCTION");
  for (const key of ["physicalResponse", "stage9Skill", "scenarioInterpretation"])
    assert.ok(envelope.interpretation.some((note: { Field: string }) => note.Field === `Scientific evidence: ${key}`));
});

test("S16-007 manifest/custom supplemental sheets read back without changing legacy data cells", () => {
  const book = XLSX.utils.book_new(), rows = [{ row: 1, value: 0 }, { row: 2, value: null }];
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Custom chart data");
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(semanticRows()), "Field semantics");
  const manifest = createDownloadManifest({ filename: "custom.xlsx", kind: "legacy", exportedAt: "2026-11-12T00:00:00Z",
    dataHash: "a".repeat(64), hashMethod: "engineering readback fixture", selection: null,
    rows, sheets: [...book.SheetNames, "Download manifest"] });
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(downloadManifestRows(manifest)), "Download manifest");
  const restored = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets["Custom chart data"], { defval: null }), rows);
  const readback = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(restored.Sheets["Download manifest"]).map(row =>
    [row.Field, JSON.parse(row.Value)]));
  assert.deepEqual(readback, manifest);
  assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets["Field semantics"]), XLSX.utils.sheet_to_json(book.Sheets["Field semantics"]));
});

test("S16-007 mounted public APIs preserve legacy default bodies; opt-in JSON/XLSX embed exact manifest; private HTTP stays403", async () => {
  const app = express();
  app.use(downloadManifestMiddleware());
  registerMethodologyApi(app);
  registerWarmingValidationReferenceRoutes(app);
  registerCarbonPassThroughRoutes(app);
  registerCompanyConditionalRoutes(app);
  registerQualifiedMissingnessApi(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const registry = await (await fetch(`${base}/api/methodology/registry`)).json();
    assert.deepEqual(registry, { ...methodologyRegistry(), serverDownloads: serverDownloadRegistry });
    assert.equal((await fetch(`${base}/api/methodology/registry?override=1`)).status, 400);
    const path = "/api/reference/warming-validation/export.json";
    const plain = await fetch(base + path), bytes = Buffer.from(await plain.arrayBuffer());
    assert.deepEqual(JSON.parse(bytes.toString()), warmingReferenceExportDocument());
    const header = JSON.parse(Buffer.from(plain.headers.get("X-Download-Manifest")!, "base64url").toString());
    assert.equal(header.dataIdentity.hash, createHash("sha256").update(bytes).digest("hex"));
    assert.deepEqual(header.scientificEvidence, scientificEvidenceStatuses());
    const enriched = await (await fetch(base + withDownloadManifest(path))).json();
    assert.deepEqual(enriched.data, warmingReferenceExportDocument());
    assert.equal(enriched.manifest.transport, "embedded-and-header");
    assert.equal(enriched.manifest.dataIdentity.hash, header.dataIdentity.hash);
    const conditionalPath = "/api/cv/company-conditional-summaries/export.xlsx?issuer=FSLR";
    const legacy = Buffer.from(await (await fetch(base + conditionalPath)).arrayBuffer());
    const enhanced = await fetch(base + withDownloadManifest(conditionalPath));
    assert.equal(enhanced.status, 200);
    const book = XLSX.read(Buffer.from(await enhanced.arrayBuffer()), { type: "buffer" });
    const original = XLSX.read(legacy, { type: "buffer" });
    assert.deepEqual(book.SheetNames, [...original.SheetNames, "Download manifest"]);
    for (const sheet of original.SheetNames)
      assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, defval: null }),
        XLSX.utils.sheet_to_json(original.Sheets[sheet], { header: 1, defval: null }));
    const rows = XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Download manifest"]);
    const metadata = Object.fromEntries(rows.map(row => [row.Field, JSON.parse(row.Value)]));
    assert.deepEqual(metadata.scientificEvidence, scientificEvidenceStatuses());
    assert.equal((await fetch(base + withDownloadManifest("/api/development/qualified-missingness/export"))).status, 403);
    assert.equal((await fetch(base + path + "?downloadMetadata=bad")).status, 400);
    assert.equal((await fetch(base + withDownloadManifest(path) + "&override=1")).status, 400);
    const review = await (await fetch(base + withDownloadManifest("/api/cv/carbon-pass-through-evidence/export.json"))).json();
    assert.match(review.manifest.transportClaim, /not issuer validation/);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

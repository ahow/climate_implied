import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import express from "express";
import * as XLSX from "xlsx";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WARMING_VALIDATION_REFERENCE as reference } from "../shared/warmingValidationReference";
import { warmingReferenceFieldSpecs, warmingValidationReferenceSemantics, requireWarmingReferenceSemantic,
  warmingReferenceExportRows, warmingReferenceExportBindings, warmingReferenceExportDocument,
  warmingReferenceExportLeafBindings } from "../shared/warmingValidationReferenceSemantics";
import { registerWarmingValidationReferenceRoutes } from "../server/warmingValidationReferenceApi";
import { WarmingValidationReference } from "../client/src/components/warming-validation-reference";
import { LEGACY_CLIMATE, LEGACY_FINANCE } from "../shared/calculationContract";
import { outputFieldSemantics, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { releaseSafety } from "../server/releaseSafety";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
function leaves(value: unknown, path = ""): string[] {
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key));
  return [path];
}

test("source-reviewed 2025 SR1.5 headline, decadal mean and inventory year remain distinct", () => {
  const source = read("docs/next-physical-evidence.json").actual2025HumanWarmingReference;
  const temporal = read("docs/physical-attribution-evidence.json").temporalDefinitionEvidence;
  const inventory = read("server/calculation/data/inventory2024.json");
  assert.equal(reference.headline2025.valueC, 1.37);
  assert.equal(reference.headline2025.valueC, source.SR15DefinitionP50);
  assert.equal(reference.headline2025.year, source.dataYear);
  assert.deepEqual([reference.decade.p05C, reference.decade.meanC, reference.decade.p95C], source.decadeP05P50P95);
  assert.deepEqual([reference.decade.firstYear, reference.decade.lastYear], source.decadeYearsInclusive);
  assert.deepEqual([reference.headline2025.trendStartYear, reference.headline2025.trendEndYear], [2011, 2025]);
  assert.notEqual(source.annualDefinitionP50, reference.headline2025.valueC, "Ordinary Annual1.38 is not a replacement");
  assert.match(reference.headline2025.definition, /not the ordinary 2025 annual mean/);
  assert.equal(reference.inventory.year, inventory.year);
  assert.equal(reference.inventory.version, inventory.version);
  assert.equal(reference.inventory.status, inventory.status);
  assert.equal(reference.inventory.year, 2024);
  assert.equal(reference.source.revision, source.revision);
  assert.equal(reference.source.sha256, source.baseSha256);
  assert.equal(reference.source.metadataDateCreated, source.metadataDateCreated);
  assert.equal(reference.source.retrievedAtUTC, source.retrievedAtUTC);
  assert.equal(reference.source.licence, source.license.split(",")[0]);
  assert.equal(reference.source.temporalDefinitionUrl, temporal.normativeSource.url);
  assert.equal(reference.source.temporalDefinitionSha256, temporal.normativeSource.sha256);
  assert.equal(reference.source.publicationDate, null);
  assert.ok(reference.source.url.includes(`${reference.source.revision}/${reference.source.path}`));
  assert.equal(reference.observable, "human-induced GMST");
  assert.equal(reference.temperatureBaseline, "1850-1900 inclusive");
  assert.equal(reference.calculationInput, false);
  assert.equal(reference.modelAcceptance, false);
  assert.ok(Object.isFrozen(reference) && Object.isFrozen(reference.headline2025) && Object.isFrozen(reference.source));
  assert.throws(() => Object.assign(reference.headline2025, { valueC: 1.38 }));
});

test("every actual reference leaf and export cell has a precise qualified equation/unit", () => {
  const paths = leaves(reference).sort();
  assert.equal(paths.length, 38);
  assert.equal(warmingReferenceFieldSpecs.length, 38);
  assert.deepEqual(warmingValidationReferenceSemantics.map(s => s.id).sort(), paths.map(p => `warmingReference.${p}`));
  for (const semantic of warmingValidationReferenceSemantics) {
    for (const field of ["meaning", "formula", "unit", "source", "period", "geography", "status", "missingness", "uncertainty", "scope", "asOfRule"] as const)
      assert.ok(semantic[field].trim(), `${semantic.id}.${field}`);
  }
  assert.throws(() => requireWarmingReferenceSemantic("warmingReference.invented"), /Unmapped/);
  const document = warmingReferenceExportDocument();
  assert.equal(document.reference, reference);
  assert.equal(document.rows.length, 2);
  assert.equal(Object.keys(warmingReferenceExportBindings).length, 11);
  assert.deepEqual(document.rowValueBindings, ["warmingReference.headline2025.valueC", "warmingReference.decade.meanC"]);
  document.rows.forEach((row, i) => {
    assert.deepEqual(Object.keys(row).sort(), Object.keys(document.rowColumnBindings[i]).sort());
    for (const binding of Object.values(document.rowColumnBindings[i])) {
      assert.ok(requireWarmingReferenceSemantic(binding.id));
      assert.ok(binding.transform.trim());
    }
  });
  assert.equal(document.rowColumnBindings[1]["Value (degC anomaly)"].id, "warmingReference.decade.meanC");
  assert.equal(document.rowColumnBindings[1].Statistic.id, "warmingReference.decade.rangeDefinition");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(warmingReferenceExportRows()), "Validation reference");
  const restored = XLSX.read(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets["Validation reference"], { defval: null }), document.rows);
  assert.equal(document.rows[0]["Decadal lower p05 (degC)"], null, "Decade-only column must not become headline uncertainty");
  assert.equal(document.rows[1]["Value (degC anomaly)"], 1.24);
  const serializationBindings = warmingReferenceExportLeafBindings();
  assert.deepEqual(Object.keys(serializationBindings).sort(), leaves(document).sort());
  assert.equal(Object.keys(serializationBindings).length, 660);
  for (const binding of Object.values(serializationBindings))
    assert.ok(requireOutputSemantic(binding.id) && binding.transform.trim());
  assert.equal(serializationBindings["rows.1.Value (degC anomaly)"].id, "warmingReference.decade.meanC");
  assert.equal(serializationBindings["rows.0.Value (degC anomaly)"].id, "warmingReference.headline2025.valueC");
});

test("standalone UI places precise period/observable/unit/source metadata beside changed values", () => {
  const html = renderToStaticMarkup(React.createElement(WarmingValidationReference));
  const text = html.replace(/<[^>]*>/g, "");
  assert.match(text, /2025 SR1.5 headline: 1.37 °C/);
  assert.match(text, /2016–2025 mean: 1.24 \[1.0–1.5\] °C/);
  assert.match(html, /Separate inventory year: 2024/);
  assert.match(html, /not the ordinary 2025 annual mean/);
  assert.match(html, /human-induced GMST/);
  assert.match(html, /1850-1900 inclusive/);
  assert.match(html, /publication day unknown, not inferred/);
  for (const id of ["headline2025.valueC", "decade.meanC", "decade.p05C", "decade.p95C", "inventory.year"])
    assert.ok(html.includes(`data-field-id="warmingReference.${id}"`) &&
      html.includes(`data-warming-reference-field="warmingReference.${id}"`));
  assert.match(html, /href="\/api\/reference\/warming-validation\/export\.json\?downloadMetadata=manifest-v1"/);
});

test("GET-only integration handler returns the same immutable reference/export and rejects overrides", async () => {
  const app = express();
  registerWarmingValidationReferenceRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/reference/warming-validation`;
  try {
    assert.deepEqual(await (await fetch(base)).json(), reference);
    const exported = await fetch(`${base}/export.json`);
    assert.match(exported.headers.get("content-disposition")!, /not-model-acceptance\.json/);
    assert.deepEqual(await exported.json(), warmingReferenceExportDocument());
    for (const suffix of ["", "/export.json"]) {
      for (const query of ["?valueC=1.38", "?inventoryYear=2025", "?accept=true"])
        assert.equal((await fetch(`${base}${suffix}${query}`)).status, 400);
      for (const method of ["POST", "PUT", "PATCH", "DELETE"])
        assert.equal((await fetch(`${base}${suffix}`, { method })).status, 404);
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("production wiring registers after release safety, outside archived methodology, with exactly38 global definitions", async () => {
  const index = readFileSync("server/index.ts", "utf8");
  const safetyPosition = index.indexOf("app.use(releaseSafety())");
  const referencePosition = index.indexOf("registerWarmingValidationReferenceRoutes(app)");
  assert.ok(safetyPosition >= 0 && referencePosition > safetyPosition);
  assert.ok(referencePosition < index.indexOf("await registerRoutes(httpServer, app)"));
  const methodology = readFileSync("client/src/pages/methodology.tsx", "utf8");
  assert.match(methodology, /import \{ WarmingValidationReference \} from "@\/components\/warming-validation-reference"/);
  assert.ok(methodology.indexOf("<WarmingValidationReference />") < methodology.indexOf("<details"));
  const registered = outputFieldSemantics.filter(s => s.id.startsWith("warmingReference."));
  assert.equal(registered.length, 38);
  assert.deepEqual(registered, warmingValidationReferenceSemantics);
  for (const semantic of registered) assert.equal(requireOutputSemantic(semantic.id), semantic);
  const app = express();
  app.use(releaseSafety());
  registerWarmingValidationReferenceRoutes(app);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/reference/warming-validation`;
  try {
    assert.deepEqual(await (await fetch(base)).json(), reference);
    assert.deepEqual(await (await fetch(`${base}/export.json`)).json(), warmingReferenceExportDocument());
    for (const suffix of ["", "/export.json"]) {
      assert.equal((await fetch(`${base}${suffix}?valueC=1.38`)).status, 400);
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const refusal = await fetch(`${base}${suffix}`, { method });
        assert.equal(refusal.status, 403);
        assert.equal((await refusal.json()).error, "operator-cli-required");
      }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("reference work neither changes protected calculations nor closes unknown original summary", () => {
  assert.equal(LEGACY_CLIMATE.warmingOffsetC, 1.1);
  assert.equal(LEGACY_FINANCE.warmingOffsetC, 1.1);
  assert.equal(sha("shared/calculationContract.ts"), "7700217420661611987a9443dedb94a9fb4b3603fd106a9aca55e70bae34a2c9");
  assert.equal(sha("script/compare_retained_igcc_physics.py"), "27c527b753990fbd5dccf13b91284a683ecd3f147d4105662c7a089b9f80dd9d");
  assert.equal(sha("server/calculation/data/inventory2024.json"), "fa5dbe5e8b7c6ab31e8b75805534ad249d5d5056df86f011db34d4038e0a27ea");
  for (const path of ["forwardProjection.ts", "emissionsCandidate.ts", "emissionsInputs.ts"])
    assert.doesNotMatch(readFileSync(`server/calculation/${path}`, "utf8"), /warmingValidationReference|WARMING_VALIDATION_REFERENCE/);
  const census = read("docs/field_semantics_census.json");
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields, 1000);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots, 1);
  assert.deepEqual(census.supplementalSlotAccounting.removedOriginalSlots, []);
});

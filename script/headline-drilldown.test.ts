import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { captureNativeInputs, replayNativeCandidate, retainNativeCandidate, verifyNativeCandidateMaterial } from "../server/snapshots/nativeCandidateProducer";
import { readCalculationSourceArtifact } from "../server/snapshots/materialInputs";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";
import { contentHash } from "../server/calculation/analysisManifest";
import { deriveHeadlineDrilldown } from "../server/calculation/headlineDrilldown";
import { headlineDrilldownHandler, registerHeadlineDrilldownApi } from "../server/headlineDrilldownApi";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { headlineDrilldownUrl, requireMatchingHeadlineDrilldown, headlineDrilldownIdentityText, verifyHeadlineDrilldownIdentity } from "../shared/headlineDrilldown";
import { createHash } from "node:crypto";
import { aggregateRegionalInventory } from "../server/calculation/regionalInventory";
import type { NativeScenario } from "../shared/nativeConsumer";

/** Actual producer, public inventory, dated inputs, code archive and engine.
 * Only immutable storage is replaced; no database, application server or writes. */
async function fixture(scenario: NativeScenario = "transition") {
  const source = readCalculationSourceArtifact();
  const archives = new Map<string, { kind: string; payload: any }>();
  const results = new Map<string, any>();
  const loadMaterial = async (id: string, kind: string) => {
    const entry = archives.get(id);
    if (!entry || entry.kind !== kind || contentHash(entry.payload) !== id) throw new Error("Missing/corrupt retained parent");
    return structuredClone(entry.payload);
  };
  const store = {
    captureSource: async () => {
      archives.set(source.id, { kind: "calculation-source", payload: source.payload });
      return source.id;
    },
    saveArchive: async (kind: "native-candidate-inputs" | "native-candidate-material", payload: unknown) => {
      const id = contentHash(payload); archives.set(id, { kind, payload: structuredClone(payload) }); return id;
    },
    saveResult: async (manifest: any, result: unknown) => {
      const packed = packAnalysisResult(manifest, result); results.set(packed.id, packed.payload); return packed.id;
    },
    loadResult: async (id: string) => {
      const result = unpackAnalysisResult(id, results.get(id));
      await verifyNativeCandidateMaterial(result.manifest.settings.materialInputsId as string,
        result.manifest, result.result, loadMaterial);
      return { ...result, id, recordedAt: "2026-01-01T00:00:00.000Z",
        materialReplayState: "referenced-material-archives-verified" };
    },
  };
  const input = captureNativeInputs();
  const response = replayNativeCandidate(input, scenario);
  const proof = await retainNativeCandidate(input, scenario, response, store);
  const loaded = await store.loadResult(proof.resultId);
  return { archives, results, store, loadMaterial, input, response, proof, loaded };
}
for (const scenario of ["constant", "transition", "dashboard"] as const) {
  test(`${scenario}: actual selected headline reconciles per-cell Shapley and immutable parent/material/code/member/seed`, async t => {
    const f = await fixture(scenario), selection = { parent: f.proof.resultId, year: 2050 };
    const data = await deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial);
    assert.deepEqual(data.parent, f.proof);
    assert.equal(data.parent.materialInputsId, f.loaded.manifest.settings.materialInputsId);
    assert.equal(data.parent.codeArchiveId, f.loaded.manifest.codeVersion);
    assert.equal(data.memberId, "deterministic-native-scenario-not-an-ensemble-member");
    assert.deepEqual(data.seed, { applicability: "not-applicable-deterministic-no-random-sampling", value: null });
    assert.equal(data.scientificAcceptance, false);
    assert.equal(createHash("sha256").update(headlineDrilldownIdentityText(data)).digest("hex"), data.derivation.id);
    assert.match(data.label, /Within-model/);
    assert.equal(data.derivation.parentReportingGtCO2e, f.response.result.trajectory.find(row => row.year === 2050)!.reportingGtCO2e);
    assert.ok(data.derivation.reconciliationNativeMt < 1e-8);
    const cells = new Map<string, typeof data.rows>();
    for (const row of data.rows) {
      const key = `${row.sectorCode}/${row.gas}`;
      cells.set(key, [...cells.get(key) ?? [], row]);
      assert.equal(row.region, "Global");
      assert.equal(row.valueGtCO2e, row.valueNativeMt * row.gwp100 / 1000);
    }
    assert.equal(cells.size, f.input.inventory.cells.length);
    for (const rows of cells.values())
      assert.ok(Math.abs(rows.reduce((sum, row) => sum + row.valueNativeMt, 0) -
        (rows[0].targetNativeMt - rows[0].baselineNativeMt)) < 1e-8);
    assert.deepEqual(requireMatchingHeadlineDrilldown(data, f.proof, "contributions", selection), data);
    assert.deepEqual(data, await deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial));
    t.diagnostic(JSON.stringify({ scenario, inventoryCells: f.input.inventory.cells.length,
      groups: Object.keys(data.derivation.groups), rows: data.rows.length,
      parentResultId: data.parent.resultId, parentManifestId: data.parent.manifestId,
      derivationId: data.derivation.id, reconciliationNativeMt: data.derivation.reconciliationNativeMt,
      parentReportingGtCO2e: data.derivation.parentReportingGtCO2e }));
  });
}
test("sensitivity endpoint/label and nonadditive values are distinct from within-model contributions", async () => {
  const f = await fixture(), selection = { parent: f.proof.resultId, year: 2050 };
  const contributions = await deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial);
  const sensitivities = await deriveHeadlineDrilldown(f.loaded, selection, "sensitivities", f.loadMaterial);
  assert.match(sensitivities.label, /One-at-a-time sensitivities.*not contributions/);
  assert.notEqual(contributions.derivation.id, sensitivities.derivation.id);
  assert.ok(contributions.rows.some((row, index) => Math.abs(row.valueNativeMt - sensitivities.rows[index].valueNativeMt) > 1e-6));
  assert.notEqual(headlineDrilldownUrl("contributions", selection), headlineDrilldownUrl("sensitivities", selection));
});
test("exact filters preserve signed cells and derive separate identities; no silently empty unknown dimensions", async () => {
  const f = await fixture(), selection = { parent: f.proof.resultId, year: 2100 };
  const full = await deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial);
  const filtered = await deriveHeadlineDrilldown(f.loaded, { ...selection, sector: "land", gas: "CO2" }, "contributions", f.loadMaterial);
  assert.deepEqual(filtered.rows, full.rows.filter(row => row.sector === "land" && row.gas === "CO2"));
  assert.notEqual(full.derivation.id, filtered.derivation.id);
  for (const dimension of [{ region: "International transport" }, { region: "EU27" },
    { gas: "imaginary" }, { sector: "not-a-sector" }, { driver: "invented" }, { unknown: "ignored" }])
    await assert.rejects(deriveHeadlineDrilldown(f.loaded, { ...selection, ...dimension }, "contributions", f.loadMaterial));
});
test("wrong headline, corrupt material, missing code, altered result and scientific lookalike all fail closed", async () => {
  const f = await fixture(), selection = { parent: f.proof.resultId, year: 2050 };
  await assert.rejects(deriveHeadlineDrilldown(f.loaded, { ...selection, parent: "0".repeat(64) }, "contributions", f.loadMaterial));
  for (const mutate of [
    (loaded: any) => { loaded.materialReplayState = "legacy-result-without-material-bundle"; },
    (loaded: any) => { loaded.manifest.scenario = "accepted-regional-ensemble"; },
    (loaded: any) => { loaded.result.result.trajectory[26].reportingGtCO2e += 1; },
    (loaded: any) => { loaded.manifest.settings.memberId = "borrowed-member"; },
  ]) {
    const loaded = structuredClone(f.loaded); mutate(loaded);
    await assert.rejects(deriveHeadlineDrilldown(loaded, selection, "contributions", f.loadMaterial));
  }
  f.archives.delete(f.proof.codeArchiveId);
  await assert.rejects(deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial));
  const code = readCalculationSourceArtifact();
  f.archives.set(code.id, { kind: "calculation-source", payload: code.payload });
  const material = f.archives.get(f.proof.materialInputsId)!;
  material.payload.memberId = "different";
  await assert.rejects(deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial));
});
test("consumer refuses same-looking data with other parent, changed filters, wrong mode and changed code identity", async () => {
  const f = await fixture(), selection = { parent: f.proof.resultId, year: 2050 };
  const data = await deriveHeadlineDrilldown(f.loaded, selection, "contributions", f.loadMaterial);
  await verifyHeadlineDrilldownIdentity(data);
  for (const mutate of [
    (changed: typeof data) => { changed.rows[0].valueNativeMt += 1; },
    (changed: typeof data) => { changed.seed = { value: 123 }; },
    (changed: typeof data) => { changed.memberId = "borrowed"; },
    (changed: typeof data) => { changed.derivation.groups = {}; },
  ]) {
    const changed = structuredClone(data); mutate(changed);
    await assert.rejects(verifyHeadlineDrilldownIdentity(changed));
  }
  assert.throws(() => requireMatchingHeadlineDrilldown(data, { ...f.proof, codeArchiveId: "0".repeat(64) }, "contributions", selection));
  assert.throws(() => requireMatchingHeadlineDrilldown(data, f.proof, "sensitivities", selection));
  assert.throws(() => requireMatchingHeadlineDrilldown(data, f.proof, "contributions", { ...selection, year: 2100 }));
  assert.throws(() => requireMatchingHeadlineDrilldown({ ...data, derivation: { ...data.derivation, codeHash: "" } }, f.proof, "contributions", selection));
});

/** Exercise actual handlers plus closed download middleware without listening
 * on a port or starting/restarting the application. */
async function attachment(f: Awaited<ReturnType<typeof fixture>>, mode: "contributions" | "sensitivities", format: "json" | "xlsx", embed = false) {
  const path = `/api/headline-drilldown/${mode}/export.${format}`;
  const query = { parent: f.proof.resultId, year: "2050", sector: "land" };
  const req: any = { method: "GET", path, url: `${path}?${new URLSearchParams(query)}${embed ? "&downloadMetadata=manifest-v1" : ""}`, query };
  const headers = new Map<string, any>();
  let body: any;
  const res: any = {
    statusCode: 200,
    set(name: string, value: string) { headers.set(name.toLowerCase(), value); return this; },
    setHeader(name: string, value: string) { return this.set(name, value); },
    getHeader(name: string) { return headers.get(name.toLowerCase()); },
    getHeaders() { return Object.fromEntries(headers); },
    removeHeader(name: string) { headers.delete(name.toLowerCase()); },
    status(code: number) { this.statusCode = code; return this; },
    type(value: string) { return this.set("Content-Type", value); },
    append(name: string, value: string) { return this.set(name, value); },
    send(value: any) { body = value; return this; },
    json(value: any) { this.type("application/json"); return this.send(JSON.stringify(value)); },
  };
  downloadManifestMiddleware()(req, res, () => {});
  await headlineDrilldownHandler(mode, format, f.store.loadResult, f.loadMaterial)(req, res, () => {});
  return { headers, body, status: res.statusCode };
}
test("closed transport opt-in embeds metadata without granting parent native producer identity", async () => {
  const f = await fixture();
  const json = await attachment(f, "contributions", "json", true);
  const payload = JSON.parse(json.body);
  assert.equal(payload.data.parent.resultId, f.proof.resultId);
  assert.equal(payload.manifest.producerIdentity, null);
  const xlsx = await attachment(f, "sensitivities", "xlsx", true);
  const book = XLSX.read(xlsx.body, { type: "buffer" });
  assert.ok(book.SheetNames.includes("Download manifest"));
  assert.ok(book.SheetNames.includes("Headline contract"));
});
for (const mode of ["contributions", "sensitivities"] as const) {
  test(`${mode}: actual JSON/XLSX handlers preserve exact selected parent/derivation and closed download manifest`, async () => {
    const f = await fixture();
    const json = await attachment(f, mode, "json"), xlsx = await attachment(f, mode, "xlsx");
    assert.equal(json.status, 200); assert.equal(xlsx.status, 200);
    const data = JSON.parse(json.body);
    const book = XLSX.read(xlsx.body, { type: "buffer" });
    assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets.Drilldown, { defval: null }), data.rows);
    const contract = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(
      book.Sheets["Headline contract"]).map(row => [row.Field, JSON.parse(row.Value)]));
    assert.deepEqual(contract.parent, data.parent);
    assert.deepEqual(contract.derivation, data.derivation);
    assert.deepEqual(contract.seed, data.seed);
    for (const response of [json, xlsx]) {
      const manifest = JSON.parse(Buffer.from(response.headers.get("x-download-manifest"), "base64url").toString());
      assert.equal(manifest.producerIdentity, null);
      assert.equal(response.headers.has("x-producer-identity"), false);
      assert.equal(response.headers.get("x-headline-parent"), f.proof.resultId);
      assert.equal(response.headers.get("x-headline-derivation"), data.derivation.id);
      assert.match(manifest.transportClaim, /Derived selected retained native/);
    }
  });
}
test("regional signed-account negative controls retain land removals and AIR/SEA separately; do not authorize native-parent allocation", () => {
  // Explicit synthetic accounting negative controls, never production inputs.
  const rows = aggregateRegionalInventory([
    { country: "USA", sector: "LULUCF", gas: "CO2", nativeMt: -4 },
    { country: "USA", sector: "LULUCF", gas: "CO2", nativeMt: 1 },
    { country: "AIR", sector: "1.A.3.a", gas: "CO2", nativeMt: 2 },
    { country: "SEA", sector: "1.A.3.d", gas: "CO2", nativeMt: 3 },
  ]);
  assert.equal(rows.find(row => row.region === "US")!.nativeMt, -3);
  assert.equal(rows.filter(row => row.region === "International transport").reduce((sum, row) => sum + row.nativeMt, 0), 5);
  assert.deepEqual(rows, aggregateRegionalInventory([
    { country: "SEA", sector: "1.A.3.d", gas: "CO2", nativeMt: 3 },
    { country: "AIR", sector: "1.A.3.a", gas: "CO2", nativeMt: 2 },
    { country: "USA", sector: "LULUCF", gas: "CO2", nativeMt: 1 },
    { country: "USA", sector: "LULUCF", gas: "CO2", nativeMt: -4 },
  ]));
});
test("six real routes registered separately and native review consumes selected retained parent rather than global headline", () => {
  const routes: string[] = [];
  registerHeadlineDrilldownApi({ get: (path: string) => routes.push(path) } as any);
  assert.equal(routes.length, 6);
  assert.ok(routes.includes("/api/headline-drilldown/contributions"));
  assert.ok(routes.includes("/api/headline-drilldown/sensitivities/export.xlsx"));
  assert.match(readFileSync("server/index.ts", "utf8"), /registerHeadlineDrilldownApi\(app\)/);
  assert.match(readFileSync("client/src/components/emissions-candidate-review.tsx", "utf8"), /HeadlineDrilldownReview headline=\{data\}/);
  const consumer = readFileSync("client/src/components/headline-drilldown.tsx", "utf8");
  assert.match(consumer, /captureExactProducerIdentity\(headline\)/);
  assert.match(consumer, /requireMatchingHeadlineDrilldown/);
});

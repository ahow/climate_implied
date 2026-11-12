import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createManifest, contentHash } from "../server/calculation/analysisManifest";
import { packAnalysisResult } from "../server/snapshots/resultContract";
import { producerDownloadMiddleware, registerProducerDownloadRoutes, verifiedProducer } from "../server/producerDownload";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { createDownloadManifest } from "../shared/downloadManifest";
import { retainProducerDownload, exactProducerDownload } from "../client/src/lib/producer-download";
import { releaseSafety } from "../server/releaseSafety";
import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { producerDownloadFieldBindings } from "../shared/producerDownloadSemantics";
import { requireOutputSemantic } from "../shared/fieldSemantics";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProducerDownloadLink } from "../client/src/components/download-data-button";

/** Pure public engineering fixtures, never production fallback archives. */
function retained(seed: number) {
  const manifest = createManifest({
    codeVersion: "a".repeat(64), modelVersion: "engineering-producer-1",
    snapshotHashes: [String(seed).repeat(64), "b".repeat(64), "c".repeat(64)],
    scenario: "descriptive-valuation:/carbon-price",
    settings: { materialInputsId: "d".repeat(64), seed },
  });
  const result = [{ date: "2024-12-31T00:00:00.000Z", value: seed, missing: null }];
  const packed = packAnalysisResult(manifest, result);
  return { ...packed.payload, id: packed.id,
    materialReplayState: "referenced-material-archives-verified", result };
}
const a = retained(1), b = retained(2);
const emptyPacked = packAnalysisResult({ ...a.manifest, createdAt: "2026-11-12T00:00:00Z" }, []);
const empty = { ...emptyPacked.payload, id: emptyPacked.id, materialReplayState: a.materialReplayState };
const oldManifest = createManifest({ codeVersion: "legacy", modelVersion: "old-model",
  snapshotHashes: ["e".repeat(64)], scenario: "descriptive-valuation:/summary", settings: {} });
const oldPacked = packAnalysisResult(oldManifest, { count: 3 });
const old = { ...oldPacked.payload, id: oldPacked.id, materialReplayState: "legacy-result-without-material-bundle" };
function decode(response: globalThis.Response, header: string) {
  return JSON.parse(Buffer.from(response.headers.get(header)!, "base64url").toString("utf8"));
}
async function mounted(run: (origin: string) => Promise<void>) {
  const app = express();
  app.use(releaseSafety());
  app.use(downloadManifestMiddleware());
  const load = async (id: string) => {
    // Reverse completion order exercises per-response isolation.
    if (id === a.id) await new Promise(resolve => setTimeout(resolve, 15));
    if (id === a.id) return structuredClone(a);
    if (id === b.id) return structuredClone(b);
    if (id === old.id) return structuredClone(old);
    if (id === empty.id) return structuredClone(empty);
    throw new Error("Missing retained archive");
  };
  app.use(producerDownloadMiddleware(load));
  registerProducerDownloadRoutes(app, load);
  app.get("/api/cv/carbon-price", (req, res) => {
    const selected = req.query.snapshotId === "selected" ? b : a;
    res.set("X-Analysis-Snapshot", req.query.mode === "wrong-resolved-selection" ? "f".repeat(64) : selected.manifest.snapshotHashes[0]);
    res.set("X-Analysis-Overlays", selected.manifest.snapshotHashes[1]);
    res.set("X-Indicator-Snapshot", selected.manifest.snapshotHashes[2]);
    res.set("X-Analysis-Manifest", selected.manifest.id);
    res.set("X-Analysis-Material-Inputs", String(selected.manifest.settings.materialInputsId));
    if (req.query.mode !== "unretained") res.set("X-Analysis-Result", selected.id);
    res.json(req.query.mode === "date-object-response"
      ? selected.result.map(row => ({ ...row, date: new Date(row.date), optional: undefined }))
      : selected.result);
  });
  app.get("/api/cv/summary", (_req, res) => {
    // Same empty data can be returned by distinct calculators. Even coherent
    // server input headers cannot bind another calculator's retained manifest.
    res.set("X-Analysis-Result", empty.id);
    res.set("X-Analysis-Snapshot", empty.manifest.snapshotHashes[0]);
    res.set("X-Analysis-Overlays", empty.manifest.snapshotHashes[1]);
    res.set("X-Indicator-Snapshot", empty.manifest.snapshotHashes[2]);
    res.set("X-Analysis-Manifest", empty.manifest.id);
    res.set("X-Analysis-Material-Inputs", String(empty.manifest.settings.materialInputsId));
    res.json([]);
  });
  app.get("/api/analysis/results/:id", async (req, res) => {
    try { res.json(await load(String(req.params.id))); }
    catch { res.status(422).json({ error: "Missing stored result" }); }
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number };
  try { await run(`http://127.0.0.1:${address.port}`); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test("producer verification requires exact completed result, allowlisted scenario and verified material, never caller attestation", () => {
  assert.equal(verifiedProducer(a.id, a, a.result).resultHash, contentHash(a.result));
  assert.throws(() => verifiedProducer(a.id, a, b.result));
  // Identical outputs (including empty arrays) are not interchangeable producers.
  assert.throws(() => verifiedProducer(a.id, a, a.result, "/api/cv/summary"));
  assert.equal(verifiedProducer(a.id, a, a.result, "/api/cv/carbon-price").resultId, a.id);
  assert.throws(() => verifiedProducer(a.id, { ...a, materialReplayState: "legacy-result-without-material-bundle" }, a.result));
  assert.throws(() => verifiedProducer(a.id, { ...a, manifest: { ...a.manifest, scenario: "submitted" } }, a.result));
  const ordinary = createDownloadManifest({ kind: "valuation", filename: "view.json",
    exportedAt: "2026-11-12T00:00:00Z", dataHash: contentHash(a.result),
    hashMethod: "engineering", selection: { producerIdentity: verifiedProducer(a.id, a, a.result) } });
  assert.equal(ordinary.producerIdentity, null);
  const proof = verifiedProducer(a.id, a, a.result);
  assert.deepEqual(Object.keys(proof).sort(), Object.keys(producerDownloadFieldBindings)
    .map(path => path.replace(/\[\]$/, "")).sort());
  for (const binding of Object.values(producerDownloadFieldBindings)) requireOutputSemantic(binding.id);
});
test("current and selected completed responses bind independently while immutable legacy response bytes are unchanged", async () => {
  await mounted(async origin => {
    const current = await fetch(`${origin}/api/cv/carbon-price`);
    assert.equal(await current.text(), JSON.stringify(a.result));
    const selected = await fetch(`${origin}/api/cv/carbon-price?snapshotId=selected`);
    assert.equal(await selected.text(), JSON.stringify(b.result));
    assert.equal(decode(current, "X-Producer-Identity").resultId, a.id);
    assert.deepEqual(decode(selected, "X-Producer-Identity").orderedSnapshotHashes, b.manifest.snapshotHashes);
    const serialized = await fetch(`${origin}/api/cv/carbon-price?mode=date-object-response`);
    assert.equal(serialized.status, 200);
    assert.deepEqual(await serialized.json(), a.result);
    assert.equal(decode(serialized, "X-Producer-Identity").resultId, a.id);
  });
});
test("unretained current inputs and forged request headers stay unbound without a current-source fallback", async () => {
  await mounted(async origin => {
    const response = await fetch(`${origin}/api/cv/carbon-price?mode=unretained`, {
      headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(verifiedProducer(a.id, a, a.result))).toString("base64url") },
    });
    assert.equal(response.headers.get("X-Producer-Identity"), null);
    assert.deepEqual(await response.json(), a.result);
    assert.equal((await fetch(`${origin}/api/analysis/results/${"f".repeat(64)}/export.json`)).status, 422);
    assert.equal((await fetch(`${origin}/api/analysis/results/${a.id}/export.json?snapshotId=current`)).status, 422);
    assert.equal((await fetch(`${origin}/api/analysis/results/${a.id}/export.json`, { method: "POST" })).status, 403);
    for (const id of [a.id, "f".repeat(64)]) {
      const unrecordedWorkbook = await fetch(`${origin}/api/analysis/results/${id}/export.xlsx`, {
        headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(verifiedProducer(a.id, a, a.result))).toString("base64url") },
      });
      assert.equal(unrecordedWorkbook.status, 404, "No recorded original XLSX reader or regeneration fallback exists");
      assert.equal(unrecordedWorkbook.headers.get("X-Producer-Identity"), null);
      assert.equal(unrecordedWorkbook.headers.get("Content-Disposition"), null);
    }
    const mismatch = await fetch(`${origin}/api/cv/carbon-price?mode=wrong-resolved-selection`);
    assert.equal(mismatch.status, 503);
    assert.equal(mismatch.headers.get("X-Producer-Identity"), null);
    const wrongProducer = await fetch(`${origin}/api/cv/summary`);
    assert.equal(wrongProducer.status, 503);
    assert.equal(wrongProducer.headers.get("X-Producer-Identity"), null);
  });
});
test("concurrent responses cannot swap producer provenance or overwrite a global current proof", async () => {
  await mounted(async origin => {
    const responses = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      fetch(`${origin}/api/cv/carbon-price${index % 2 ? "?snapshotId=selected" : ""}`)));
    for (const [index, response] of responses.entries()) {
      const expected = index % 2 ? b : a;
      assert.equal(decode(response, "X-Producer-Identity").resultId, expected.id);
      assert.deepEqual(await response.json(), expected.result);
    }
  });
});
test("stored replay and exact export readback use the retained result, metadata opt-in preserves default bytes and hashes", async () => {
  await mounted(async origin => {
    const legacy = await fetch(`${origin}/api/analysis/results/${old.id}`);
    assert.equal(legacy.status, 200);
    assert.equal(legacy.headers.get("X-Producer-Identity"), null);
    assert.deepEqual(await legacy.json(), old);
    assert.equal((await fetch(`${origin}/api/analysis/results/${old.id}/export.json`)).status, 422);
    const stored = await fetch(`${origin}/api/analysis/results/${a.id}`);
    assert.equal(decode(stored, "X-Producer-Identity").resultId, a.id);
    assert.deepEqual((await stored.json()).result, a.result);
    const plain = await fetch(`${origin}/api/analysis/results/${a.id}/export.json`);
    const bytes = await plain.text();
    assert.equal(bytes, JSON.stringify(a.result));
    const manifest = decode(plain, "X-Download-Manifest");
    const { createHash } = await import("node:crypto");
    assert.equal(manifest.dataIdentity.hash, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(manifest.producerIdentity.resultId, a.id);
    const embedded = await fetch(`${origin}/api/analysis/results/${a.id}/export.json?downloadMetadata=manifest-v1`);
    const readback = await embedded.json();
    assert.deepEqual(readback.data, a.result);
    assert.deepEqual(readback.manifest, decode(embedded, "X-Download-Manifest"));
    assert.equal(readback.manifest.producerIdentity.resultHash, contentHash(readback.data));
    assert.equal(readback.manifest.dataIdentity.hash, manifest.dataIdentity.hash);
  });
});
test("client exact download belongs only to the consumed server response object, not clones, UI selection or derived chart rows", async () => {
  const make = (stored: typeof a) => retainProducerDownload(new Response(JSON.stringify(stored.result), {
    headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(verifiedProducer(stored.id, stored, stored.result))).toString("base64url") },
  }));
  const [one, two] = await Promise.all([make(a).json(), make(b).json()]);
  assert.match(exactProducerDownload(one)!, new RegExp(a.id));
  assert.match(renderToStaticMarkup(React.createElement(ProducerDownloadLink, { payload: one })), new RegExp(a.id));
  assert.equal(renderToStaticMarkup(React.createElement(ProducerDownloadLink, { payload: null })), "");
  assert.equal(renderToStaticMarkup(React.createElement(ProducerDownloadLink, { payload: structuredClone(one) })), "");
  assert.match(exactProducerDownload(two)!, new RegExp(b.id));
  assert.equal(exactProducerDownload(structuredClone(one)), null);
  assert.equal(exactProducerDownload(one.map((row: any) => ({ value: row.value }))), null);
  assert.equal(exactProducerDownload({ resultId: a.id }), null);
  const ordinary = await retainProducerDownload(new Response(JSON.stringify(a.result))).json();
  assert.equal(exactProducerDownload(ordinary), null);
});
test("deep-equal output refreshes cannot retain an earlier producer through query structural sharing", async () => {
  assert.match(readFileSync("client/src/lib/queryClient.ts", "utf8"), /structuralSharing:\s*false/);
  const cache = new QueryClient({ defaultOptions: { queries: { structuralSharing: false } } });
  const response = () => retainProducerDownload(new Response(JSON.stringify(a.result), {
    headers: { "X-Producer-Identity": Buffer.from(JSON.stringify(verifiedProducer(a.id, a, a.result))).toString("base64url") },
  })).json();
  const first = await response();
  cache.setQueryData(["producer"], first);
  // A subsequent unretained result may have identical values. It must lose proof.
  const refreshed = structuredClone(first);
  cache.setQueryData(["producer"], refreshed);
  assert.strictEqual(cache.getQueryData(["producer"]), refreshed);
  assert.equal(exactProducerDownload(cache.getQueryData(["producer"])), null);
  assert.ok(exactProducerDownload(first));
  cache.clear();
});

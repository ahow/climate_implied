import test from "node:test";
import assert from "node:assert/strict";
import { createManifest } from "../server/calculation/analysisManifest";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";

const manifest = createManifest({ codeVersion: "fixture", modelVersion: "fixture",
  snapshotHashes: ["a".repeat(64)], scenario: "/summary", settings: {} });
test("completed result archive preserves the exact JSON result and manifest", () => {
  const result = { zero: 0, missing: null, rows: [{ value: -3 }] };
  const packed = packAnalysisResult(manifest, result);
  assert.deepEqual(unpackAnalysisResult(packed.id, packed.payload).result, result);
  assert.equal(unpackAnalysisResult(packed.id, packed.payload).manifest.id, manifest.id);
  assert.equal(packAnalysisResult({ ...manifest, createdAt: "2020-01-01T00:00:00.000Z" }, result).id, packed.id);
  assert.notEqual(packAnalysisResult(manifest, { ...result, zero: 1 }).id, packed.id);
});
test("result archive rejects result or manifest tampering and invalid numbers", () => {
  const packed = packAnalysisResult(manifest, { x: 2 });
  assert.throws(() => unpackAnalysisResult(packed.id, { ...packed.payload, result: { x: 3 } }));
  assert.throws(() => packAnalysisResult({ ...manifest, id: "b".repeat(64) }, {}));
  assert.throws(() => packAnalysisResult(manifest, { x: NaN }));
});

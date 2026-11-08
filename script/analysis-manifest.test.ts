import test from "node:test";
import assert from "node:assert/strict";
import { canonicalJson, contentHash, createManifest } from "../server/calculation/analysisManifest";

test("canonical input hashes preserve native values and ignore object key order", () => {
  assert.equal(contentHash({ b: null, a: "1.000" }), contentHash({ a: "1.000", b: null }));
  assert.notEqual(contentHash({ a: "1.000" }), contentHash({ a: 1 }));
  assert.notEqual(contentHash({ a: null }), contentHash({ a: 0 }));
  assert.throws(() => canonicalJson({ a: undefined }));
  assert.throws(() => canonicalJson({ a: Infinity }));
});
test("manifests separate administrative time from analytical identity", () => {
  const x = { codeVersion: "abc", modelVersion: "model-1", snapshotHashes: ["a".repeat(64)],
    scenario: "diagnostic", settings: { seed: 42, runs: 10 } };
  const a = createManifest(x, "2026-11-08T00:00:00Z");
  const b = createManifest(x, "2026-11-09T00:00:00Z");
  assert.equal(a.id, b.id);
  assert.notEqual(a.createdAt, b.createdAt);
  assert.notEqual(a.id, createManifest({ ...x, settings: { seed: 43, runs: 10 } }).id);
  assert.throws(() => createManifest({ ...x, snapshotHashes: [] }));
});

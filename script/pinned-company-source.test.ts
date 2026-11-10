import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pinnedSourceSha256, verifyPinnedSourceBytes, retainVerifiedPinnedSource, loadPinnedFslrCode } from "./pinned-company-source";

test("Pinned byte verification refuses changed/current bytes and invalid digests", () => {
  const old = Buffer.from("engineering pinned source fixture\n"), current = Buffer.from("engineering changed fixture\n");
  const expected = pinnedSourceSha256(old);
  assert.equal(verifyPinnedSourceBytes("fixture.ts", expected, old), old);
  assert.throws(() => verifyPinnedSourceBytes("fixture.ts", expected, current), /hash mismatch/);
  assert.throws(() => verifyPinnedSourceBytes("fixture.ts", "invalid", old), /hash mismatch/);
});
test("Private recovery retains byte-exact sources and will not overwrite corrupt archived bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-company-source-test-"));
  try {
    const path = join(dir, "private", "fixture.ts"), bytes = Buffer.from("engineering pinned source fixture\n");
    const expected = pinnedSourceSha256(bytes);
    retainVerifiedPinnedSource(path, expected, bytes);
    assert.deepEqual(readFileSync(path), bytes);
    retainVerifiedPinnedSource(path, expected, bytes);
    writeFileSync(path, "engineering corrupt archive fixture");
    assert.throws(() => retainVerifiedPinnedSource(path, expected, bytes), /hash mismatch/);
    assert.equal(readFileSync(path, "utf8"), "engineering corrupt archive fixture");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("Unverified recovery bytes are never written; archived fallback cannot mask an unavailable/mismatched source", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinned-company-source-test-"));
  try {
    const path = join(dir, "fixture.ts"), old = Buffer.from("engineering old bytes");
    const expected = pinnedSourceSha256(old);
    retainVerifiedPinnedSource(path, expected, old);
    assert.throws(() => retainVerifiedPinnedSource(path, expected, Buffer.from("changed bytes")), /hash mismatch/);
    assert.deepEqual(readFileSync(path), old);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("Historical loader refuses arbitrary, missing and duplicate source paths before recovery/execution", async () => {
  await assert.rejects(loadPinnedFslrCode([]), /exactly the three/);
  await assert.rejects(loadPinnedFslrCode(Array.from({ length: 3 }, () => ({
    path: "server/calculation/companyFullCashflowCase.ts", sha256: "a".repeat(64),
  }))), /exactly the three/);
  await assert.rejects(loadPinnedFslrCode([
    { path: "../../outside.ts", sha256: "a".repeat(64) },
    { path: "server/calculation/fslrFullCashflowCase.ts", sha256: "a".repeat(64) },
    { path: "server/calculation/issuerConditionalFiveYear.ts", sha256: "a".repeat(64) },
  ]), /exactly the three/);
});
test("Known recovery revision mismatching frozen hashes fails closed, with no current-code fallback", async () => {
  await assert.rejects(loadPinnedFslrCode([
    { path: "server/calculation/companyFullCashflowCase.ts", sha256: "a".repeat(64) },
    { path: "server/calculation/fslrFullCashflowCase.ts", sha256: "a".repeat(64) },
    { path: "server/calculation/issuerConditionalFiveYear.ts", sha256: "a".repeat(64) },
  ]), /Pinned source hash mismatch/);
});

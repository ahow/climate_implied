import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
if (process.env.NODE_ENV === "production") throw new Error("Mandatory private development evidence only");
const root = "generated-artifacts/return-quality/1cff730fd30647e4bc10de0371353ab7f6a265a51d72f66436a008a7b37d6052-271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac";
const load = (suffix: string) => JSON.parse(readFileSync(root + suffix + ".json", "utf8"));
const freeze = load("-freeze"), sample = load("-sample"), attempt = load("-identity-attempt");
assert.equal(contentHash(freeze.protocol), freeze.protocolHash);
assert.equal(freeze.protocolHash, sample.protocolHash);
assert.equal(sample.protocolHash, attempt.protocolHash);
assert.equal(attempt.sampleHash, contentHash(sample));
assert.equal(sample.sample.length, 50);
assert.equal(sample.populationCount, 411339);
assert.equal(attempt.attempted, 50);
assert.equal(attempt.exactIsinCandidates, 50);
assert.equal(attempt.computedReturns, 0);
assert.equal(attempt.unavailableReturns, 50);
assert.equal(attempt.materialBreakRate, null);
assert.equal(attempt.numericalBreakRate, null);
assert.equal(attempt.approvals, 0);
assert.ok(Date.parse(freeze.frozenAt) <= Date.parse(sample.preparedAt));
for (const r of attempt.results) {
  assert.equal(r.status, "candidate-only-not-identity-approval");
  assert.ok(sample.sample.some((s: { isin: string }) => s.isin === r.isin));
  assert.ok(Date.parse(r.capturedAt) >= Date.parse(freeze.frozenAt));
  assert.match(r.normalizedResponseHash, /^[a-f0-9]{64}$/);
  assert.equal(r.historicalIdentityVerified, false);
  assert.ok(r.candidates.length > 0);
  assert.ok(r.candidates.every((c: { isin: string }) => c.isin === r.isin));
}
console.log(JSON.stringify({ passed: true, sampled: 50, exactIsinCandidates: 50,
  computedReturns: 0, unavailable: 50, approvals: 0, sampleHash: contentHash(sample), resultHash: contentHash(attempt) }));

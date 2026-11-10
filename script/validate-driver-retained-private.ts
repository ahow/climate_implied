/**
 * MANDATORY private retained-source validation, deliberately not *.test.ts.
 * Run: npx tsx --test script/validate-driver-retained-private.ts
 * Missing private files or hash mismatches FAIL; never skip or substitute.
 * Code-only public tests use explicit synthetic native engineering registries.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdirSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import {
  consumeRetainedAdoption, retainedAdoptionParameterRegistry,
} from "../server/calculation/driverParameterRegistry";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";

function cli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "script/run-regional-ensemble.ts", ...args],
    { encoding: "utf8", timeout: 30000, maxBuffer: 2_000_000 });
}
function cliDirectory() {
  mkdirSync("generated-artifacts/driver-consumption-private-validation", { recursive: true });
  return mkdtempSync("generated-artifacts/driver-consumption-private-validation/run-");
}

test("MANDATORY real retained distributions preserve all ten source-linked outcomes and paired draws", async () => {
  const r = await retainedAdoptionParameterRegistry();
  assert.equal(r.entries.length, 10);
  assert.equal(r.entries.filter(e => e.evidence.evaluation!.candidateMAE <
    Math.min(e.evidence.evaluation!.persistenceMAE, e.evidence.evaluation!.linearMAE)).length, 1);
  assert.ok(r.entries.every(e => e.evidence.status === "sensitivity-only" && e.pairedDraws.length === 1000));
  assert.equal(r.registryHash, (await retainedAdoptionParameterRegistry()).registryHash);
});
test("MANDATORY actual wind consumer is deterministic, paired, prefix stable and centrally blocked", async () => {
  const x = { driverId: "World:wind_share_elec", seed: 20261110, members: 16, years: [2024, 2030],
    use: "sensitivity" as const };
  const a = await consumeRetainedAdoption(x), b = await consumeRetainedAdoption(x);
  assert.deepEqual(a, b);
  assert.deepEqual(a.members, (await consumeRetainedAdoption({ ...x, members: 32 })).members.slice(0, 16));
  const entry = (await retainedAdoptionParameterRegistry()).entries.find(e => e.evidence.id === x.driverId)!;
  for (const m of a.members) {
    const [aa, bb] = entry.pairedDraws[m.drawIndex];
    assert.equal(m.shares[1], 1 / (1 + Math.exp(-(aa + bb * 20))));
  }
  await assert.rejects(consumeRetainedAdoption({ ...x, use: "central" }), /Central consumption blocked/);
  await assert.rejects(consumeRetainedAdoption({ ...x, driverId: "Rest of World:wind_share_elec" }), /No retained compatible/);
  await assert.rejects(consumeRetainedAdoption({ ...x, years: [2030, 2024] }), /Ordered/);
});
test("MANDATORY existing Stage5 CLI produces real registered sensitivity members with pinned provenance", async () => {
  const root = cliDirectory(), out = join(root, "real");
  const run = cli(["--mode", "sensitivity", "--registry", "retained-adoption-paired-1",
    "--driver", "World:wind_share_elec", "--members", "16", "--seed", "20261110", "--output", out]);
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(readFileSync(join(out, "result.json"), "utf8"));
  const lines = gunzipSync(readFileSync(join(out, "members.jsonl.gz"))).toString("utf8");
  const members = lines.trim().split("\n").map(line => JSON.parse(line));
  assert.equal(members.length, 16);
  assert.equal(result.registryHash, result.pinnedRegistryHash);
  assert.equal(createHash("sha256").update(lines).digest("hex"), result.membersSha256);
  const expected = await consumeRetainedAdoption({ driverId: "World:wind_share_elec", seed: 20261110,
    members: 16, years: [2024, 2030, 2050, 2100], use: "sensitivity" });
  assert.equal(result.distributions[0].outputHash, expected.outputHash);
  assert.deepEqual(members.map(({ id, drawIndex, shares }) => ({ id, drawIndex, shares })), expected.members);
});
test("MANDATORY retained CLI central controls preserve original assertions and reject every real/curated driver", async () => {
  const root = cliDirectory();
  const registry = await retainedAdoptionParameterRegistry();
  const drivers = [
    ...registry.entries.map(e => ({ id: e.evidence.id, reason: "Central consumption blocked" })),
    ...driverEvidenceRegistry().map(e => ({ id: e.id, reason: "No registered Stage5 distribution" })),
  ];
  assert.equal(drivers.length, 32);
  for (const driver of drivers) {
    const out = join(root, driver.id.replaceAll(":", "-"));
    const run = cli(["--mode", "central", "--registry", "retained-adoption-paired-1",
      "--driver", driver.id, "--output", out]);
    assert.equal(run.status, 1);
    assert.ok(run.stderr.includes(driver.reason), run.stderr);
    assert.equal(existsSync(out), false);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import {
  assertParameterUse, consumeRegionalParameterRegistry,
  scenarioParameterLeaves, verifyParameterSources,
  type ParameterEvidence,
} from "../server/calculation/driverParameterRegistry";
import { candidateInventory, constantScenario } from "../server/calculation/emissionsCandidate";
import { REGIONS } from "../server/calculation/regionalEngine";
import { contentHash } from "../server/calculation/analysisManifest";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";

const testSource = { path: "script/driver-consumption.test.ts",
  sha256: createHash("sha256").update(readFileSync("script/driver-consumption.test.ts")).digest("hex") };
function failedEvidence(): ParameterEvidence {
  return { id: "fixture-only", version: "test-1", role: "mechanism-input", status: "sensitivity-only", definition: "test-only failed fit",
    geography: "US", unit: "test unit", sources: [testSource],
    evaluation: { candidateMAE: 3, persistenceMAE: 2, linearMAE: 1, metricUnit: "test",
      trainingYears: [2010, 2018], evaluationYears: [2019, 2024], protocol: testSource } };
}
function fixture() {
  const scenarios = REGIONS.map(region => ({ region, scenario: { ...constantScenario, nuclearGenerationTWh: 0 } }));
  const evidence = REGIONS.map(region => ({ ...failedEvidence(), id: region, geography: region,
    consumerPaths: scenarioParameterLeaves(scenarios[0].scenario) }));
  return {
    inventoryId: "explicit-test-fixture", seed: 71, members: 2, use: "sensitivity" as const, endYear: 2026,
    cells: REGIONS.flatMap(region => candidateInventory().cells.map(c => ({
      region, gas: c.gas, sector: c.sector, nativeMt: c.nativeMt / 6,
    }))),
    registry: { version: "test-joint-1", evidence, rows: [{ id: "constant", scenarios }],
      bindings: scenarios.flatMap(s => scenarioParameterLeaves(s.scenario).map(path =>
        ({ region: s.region, path, evidenceId: s.region }))) },
  };
}
test("failed baseline cannot enter central or be relabelled as calibrated/prior", () => {
  const p = failedEvidence();
  assert.equal(assertParameterUse(p, "sensitivity").status, "sensitivity-only");
  assert.throws(() => assertParameterUse(p, "central"), /Central consumption blocked/);
  assert.throws(() => assertParameterUse({ ...p, status: "prior" }, "central"), /relabelled/);
  assert.throws(() => assertParameterUse({ ...p, status: "calibrated", calibrationAcceptance: testSource }, "central"), /both baselines/);
  assert.throws(() => assertParameterUse({ ...p, independentCentralBasis: { explanation: "physical" } }, "central"));
});
test("independent physical exception requires documented applicability/review and verified bytes", async () => {
  const p = { ...failedEvidence(), independentCentralBasis: {
    kind: "physical" as const, independentOfFailedFit: true as const,
    explanation: "Test-only exception checks required documented physical evidence; not real scientific acceptance.",
    applicability: "Explicit synthetic unit-test regional scope only.",
    evidence: [testSource], review: testSource,
  } };
  assert.equal(assertParameterUse(p, "central").status, "sensitivity-only");
  await verifyParameterSources(p);
  await assert.rejects(verifyParameterSources({ ...p, sources: [{ ...testSource, sha256: "0".repeat(64) }] }), /hash mismatch/);
});
test("point winner requires acceptance, no holdout overlap or prior-as-calibrated shortcut", () => {
  const p = failedEvidence();
  const winner = { ...p, evaluation: { ...p.evaluation!, candidateMAE: .1 }, status: "calibrated" };
  assert.throws(() => assertParameterUse(winner, "central"), /independent acceptance/);
  assert.throws(() => assertParameterUse({ ...p, evaluation: { ...p.evaluation!, evaluationYears: [2018, 2024] } }, "sensitivity"), /frozen windows/);
  assert.throws(() => assertParameterUse({ ...p, evaluation: undefined, status: "prior" }, "central"), /Central consumption blocked/);
});
test("roles, rejected evidence and invalid uses cannot be promoted by status or a physical exception", () => {
  const p = { ...failedEvidence(), status: "calibrated" as const,
    evaluation: { ...failedEvidence().evaluation!, candidateMAE: .1 }, calibrationAcceptance: testSource };
  for (const role of ["context", "validation-target", "level-anchor", "candidate-leading-indicator"]) {
    for (const use of ["central", "sensitivity"] as const)
      assert.throws(() => assertParameterUse({ ...p, role }, use), /mechanism-input role/);
  }
  for (const role of [undefined, "candidate-mechanism-input", "validation"])
    assert.throws(() => assertParameterUse({ ...p, role }, "central"));
  for (const use of ["central", "sensitivity"] as const)
    assert.throws(() => assertParameterUse({ ...p, status: "rejected" }, use), /Rejected parameter/);
  assert.throws(() => assertParameterUse(p, "unknown" as "central"));
});
test("every bound native parameter is role/use gated, including constants and nested measure scope", async () => {
  const initial = fixture();
  // Fail every top-level actual dependency, not just a representative coefficient.
  for (const path of scenarioParameterLeaves(initial.registry.rows[0].scenarios[0].scenario)) {
    const x = fixture();
    const id = `not-mechanism:${path}`;
    x.registry.evidence.push({ ...x.registry.evidence[0], id, role: "context", consumerPaths: [path] });
    x.registry.bindings.find(b => b.region === REGIONS[0] && b.path === path)!.evidenceId = id;
    await assert.rejects(consumeRegionalParameterRegistry(x), /mechanism-input role/);
  }
  for (const role of ["context", "validation-target", "rejected"] as const) {
    const x = fixture();
    const s = x.registry.rows[0].scenarios[0].scenario as Record<string, unknown>;
    s.sectorPathways = { industry: { annualActivityGrowth: .02, residualIntensityImprovement: .01, trendEndYear: 2050 } };
    s.measures = [{ id: "synthetic-only", mechanism: "process", sectorCodes: ["2.A.1"], gases: ["CO2"],
      coverage: .2, implementation: .5, maximumReduction: .1, startYear: 2030, deliveryYears: 10,
      evidence: "Synthetic engineering fixture; not scientific evidence" }];
    const existing = new Set(x.registry.evidence[0].consumerPaths);
    const paths = scenarioParameterLeaves(s).filter(p => !existing.has(p));
    x.registry.evidence[0].consumerPaths.push(...paths);
    x.registry.bindings.push(...paths.map(path => ({ region: REGIONS[0], path, evidenceId: REGIONS[0] })));
    if (role === "rejected") x.registry.evidence[0].status = role;
    else x.registry.evidence[0].role = role;
    await assert.rejects(consumeRegionalParameterRegistry(x), /mechanism-input role|Rejected parameter/);
  }
});
test("eligible individual parameters cannot sign off an unsigned native distribution or inventory", async () => {
  const x = fixture();
  for (const e of x.registry.evidence) {
    e.status = "calibrated";
    e.evaluation!.candidateMAE = .1;
    e.calibrationAcceptance = testSource;
    assert.equal(assertParameterUse(e, "central").role, "mechanism-input");
  }
  // This is solely an engineering fixture. Even valid retained source bytes
  // and passing individual gates do not admit its actual joint draws.
  await assert.rejects(consumeRegionalParameterRegistry({ ...x, use: "central" }), /unsigned\/unaccepted joint distribution or native inventory/);
  x.registry.rows[0].scenarios[0].scenario.annualActivityGrowth = .9;
  await assert.rejects(consumeRegionalParameterRegistry({ ...x, use: "central" }), /unsigned\/unaccepted/);
  x.cells[0].nativeMt += 1;
  await assert.rejects(consumeRegionalParameterRegistry({ ...x, use: "central" }), /unsigned\/unaccepted/);
});
test("synthetic engineering joint distributions replay deterministically with prefix-stable paired draws", async () => {
  const x = fixture();
  const second = structuredClone(x.registry.rows[0]);
  second.id = "synthetic-paired-high";
  second.scenarios.forEach(s => {
    s.scenario.annualActivityGrowth = .02;
    s.scenario.residualIntensityImprovement = .01;
  });
  x.registry.rows.push(second);
  const a = await consumeRegionalParameterRegistry({ ...x, members: 16 });
  assert.deepEqual(a, await consumeRegionalParameterRegistry({ ...x, members: 16 }));
  const extended = await consumeRegionalParameterRegistry({ ...x, members: 32 });
  assert.deepEqual(a.members, extended.members.slice(0, 16));
  for (const member of a.members) {
    const row = x.registry.rows.find(r => r.id === member.parameterRowId)!;
    assert.equal(member.consumedScenarioHash, contentHash(row.scenarios));
    const high = row.id === "synthetic-paired-high";
    assert.ok(row.scenarios.every(s => s.scenario.annualActivityGrowth === (high ? .02 : 0) &&
      s.scenario.residualIntensityImprovement === (high ? .01 : 0)));
  }
  await assert.rejects(consumeRegionalParameterRegistry({ ...x, use: "central" }), /Central consumption blocked/);
});
test("actual native engine consumes complete registered joint rows with trace receipts", async () => {
  const x = fixture(), a = await consumeRegionalParameterRegistry(x);
  assert.equal(a.members.length, 2);
  assert.equal(a.consumption.length, x.registry.bindings.length);
  assert.ok(a.consumption.every(c => c.consumer.includes("projectInventoryEmissions")));
  assert.ok(a.consumption.every(c => c.role === "mechanism-input"));
  assert.equal(a.distributionAdmission, "sensitivity-only");
  assert.equal(a.members[0].consumedScenarioHash, contentHash(x.registry.rows[0].scenarios));
  assert.equal(a.consumedRows[0].parameters.length, x.registry.bindings.length);
  assert.equal(a.consumedRows[0].parameters.find(p => p.path === "annualActivityGrowth")!.consumedValueHash, contentHash(0));
  const reversed = fixture();
  reversed.registry.rows[0].scenarios.reverse();
  reversed.registry.evidence.reverse();
  reversed.registry.bindings.reverse();
  assert.deepEqual(await consumeRegionalParameterRegistry(reversed), a);
  const changed = fixture();
  changed.registry.rows[0].scenarios[0].scenario.annualActivityGrowth = .03;
  const b = await consumeRegionalParameterRegistry(changed);
  assert.notDeepEqual(a.members[0].result.global, b.members[0].result.global);
  assert.deepEqual(a.members[0].result.regions.filter(r => r.region !== REGIONS[0]),
    b.members[0].result.regions.filter(r => r.region !== REGIONS[0]));
  await assert.rejects(consumeRegionalParameterRegistry({ ...x, use: "central" }), /Central consumption blocked/);
});
test("actual engine rejects unbound/unused/nested omitted drivers, incompatible scope and tampered sources", async () => {
  const missing = fixture(); missing.registry.bindings.pop();
  await assert.rejects(consumeRegionalParameterRegistry(missing), /exact consumer binding/);
  const scope = fixture(); scope.registry.evidence[0].geography = "global";
  await assert.rejects(consumeRegionalParameterRegistry(scope), /geography/);
  const source = fixture(); source.registry.evidence[0].sources[0] = { ...testSource, sha256: "0".repeat(64) };
  await assert.rejects(consumeRegionalParameterRegistry(source), /hash mismatch/);
  const path = fixture(); path.registry.evidence[0].consumerPaths = ["wrong"];
  await assert.rejects(consumeRegionalParameterRegistry(path), /Unapproved consumer parameter path/);
  const nested = fixture();
  nested.registry.rows.push({ id: "omission", scenarios: structuredClone(nested.registry.rows[0].scenarios) });
  (nested.registry.rows[1].scenarios[0].scenario as Record<string, unknown>).measures = [{ coverage: .2 }];
  await assert.rejects(consumeRegionalParameterRegistry(nested), /nested driver coverage/);
  const unknown = fixture();
  (unknown.registry.rows[0].scenarios[0].scenario as Record<string, unknown>).unknownUnusedCoefficient = .9;
  unknown.registry.evidence[0].consumerPaths.push("unknownUnusedCoefficient");
  unknown.registry.bindings.push({ region: REGIONS[0], path: "unknownUnusedCoefficient", evidenceId: REGIONS[0] });
  await assert.rejects(consumeRegionalParameterRegistry(unknown), /no actual engine consumer/);
  const implicit = fixture();
  delete (implicit.registry.rows[0].scenarios[0].scenario as Record<string, unknown>).nuclearGenerationTWh;
  implicit.registry.bindings = implicit.registry.bindings.filter(b => b.region !== REGIONS[0] || b.path !== "nuclearGenerationTWh");
  await assert.rejects(consumeRegionalParameterRegistry(implicit), /explicit nuclearGenerationTWh/);
});
test("all 22 curated drivers distinguish actual legacy equations from native registry consumption", () => {
  const rows = driverEvidenceRegistry();
  assert.equal(rows.length, 22);
  assert.ok(rows.every(r => r.actualConsumers.legacy.mechanism && !r.actualConsumers.legacy.registryGateEnforced &&
    !r.actualConsumers.stage5.implicitCuratedIndicatorConsumption));
  assert.match(rows.find(r => r.id === "policyCoveragePct")!.actualConsumers.legacy.mechanism, /heuristic/);
  assert.match(rows.find(r => r.id === "atmosphericCO2ppm")!.actualConsumers.legacy.mechanism, /unused|no trajectory/);
});

function cli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", "script/run-regional-ensemble.ts", ...args],
    { encoding: "utf8", timeout: 30000, maxBuffer: 2_000_000 });
}
function cliDirectory() {
  mkdirSync("generated-artifacts/driver-consumption-tests", { recursive: true });
  return mkdtempSync("generated-artifacts/driver-consumption-tests/run-");
}
test("existing Stage5 CLI invokes native engine from pinned complete joint registry and verifies the pin", () => {
  const root = cliDirectory(), x = fixture();
  const registryFile = join(root, "registry.json"), inventoryFile = join(root, "inventory.json");
  writeFileSync(registryFile, JSON.stringify(x.registry));
  writeFileSync(inventoryFile, JSON.stringify({ cells: x.cells }));
  const pin = createHash("sha256").update(readFileSync(registryFile)).digest("hex");
  const args = ["--mode", "sensitivity", "--registry", "native-regional", "--registry-file", registryFile,
    "--registry-sha256", pin, "--inventory", inventoryFile, "--members", "2", "--seed", "71"];
  const out = join(root, "native"), run = cli([...args, "--output", out]);
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(readFileSync(join(out, "result.json"), "utf8"));
  assert.equal(result.acceptedMembers, 2);
  assert.equal(result.pinnedRegistryFileSha256, pin);
  assert.equal(result.consumption.length, x.registry.bindings.length);
  const members = gunzipSync(readFileSync(join(out, "members.jsonl.gz"))).toString("utf8").trim().split("\n").map(line => JSON.parse(line));
  assert.equal(members[0].result.global.length, 77);
  assert.equal(members[0].result.memberId, "m00000");
  const wrong = [...args]; wrong[wrong.indexOf(pin)] = "0".repeat(64);
  const rejected = cli([...wrong, "--output", join(root, "wrong-pin")]);
  assert.equal(rejected.status, 1);
  assert.match(rejected.stderr, /Pinned native registry file hash mismatch/);
  assert.equal(existsSync(join(root, "wrong-pin")), false);
});
test("existing CLI cannot promote legacy or missing native registry into a central ensemble", () => {
  const root = cliDirectory();
  for (const [registry, driver, reason] of [
    ["native-regional", "all", "no accepted pinned real six-region joint registry"],
  ]) {
    const out = join(root, driver.replaceAll(":", "-"));
    const run = cli(["--mode", "central", "--registry", registry, "--driver", driver, "--output", out]);
    assert.equal(run.status, 1);
    assert.ok(run.stderr.includes(reason), run.stderr);
    assert.equal(existsSync(out), false);
  }
  assert.equal(cli(["legacy-diagnostic", "unused", "unused", "unused", "--mode", "central"]).status, 1);
  assert.match(cli(["--mode", "legacy-diagnostic", "--registry", "retained-adoption-paired-1", "--output", join(root, "bad")]).stderr, /Invalid enum value/);
  const x = fixture(), inventoryFile = join(root, "legacy-inventory.json"), parametersFile = join(root, "legacy-parameters.json");
  writeFileSync(inventoryFile, JSON.stringify({ cells: x.cells }));
  writeFileSync(parametersFile, JSON.stringify({ seed: 71, members: 2, parameterVersion: "test-legacy",
    evidence: ["explicit-unit-test-only"], rows: x.registry.rows }));
  const out = join(root, "legacy-only"), legacy = cli(["legacy-diagnostic", inventoryFile, parametersFile, out]);
  assert.equal(legacy.status, 0, legacy.stderr);
  const result = JSON.parse(readFileSync(join(out, "result.json"), "utf8"));
  assert.equal(result.use, "legacy-diagnostic");
  assert.equal(result.centralConsumptionAllowed, false);
  assert.equal(result.acceptedMembers, 2);
});

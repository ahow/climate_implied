/**
 * Two fresh processes, identical fixed inputs and seeds, no HTTP cache.
 * Characterization only: fixture values do not establish scientific validity.
 */
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
import { calculateEmissionsTrajectory, calculateTemperatureDistribution, getTemperatureStats } from "../server/calculation/forwardProjection";
import { applyCategoryModifications } from "../server/calculation/categoryProjections";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";
import { inputs } from "./fixtures/calculationInputs";

const categories = ["technology", "policy", "corporate", "socioeconomic", "financial", "emissions"] as const;
if (process.argv.includes("--worker")) {
  function compute(indicators: typeof inputs) {
    const trajectory = calculateEmissionsTrajectory(indicators, 2024, 2100, 1000, 123);
    return { trajectory,
      temperature: getTemperatureStats(calculateTemperatureDistribution(trajectory, 1000), trajectory),
      metrics: historicalTrajectoryMetrics(trajectory) };
  }
  const payload = { fixtureHash: contentHash(inputs), seed: 123, runs: 1000,
    baseline: compute(inputs),
    categories: Object.fromEntries(categories.map(category => [category, compute(applyCategoryModifications(inputs, category))])) };
  console.log(JSON.stringify({ hash: contentHash(payload), payload }));
} else {
  const run = () => JSON.parse(execFileSync(process.execPath,
    ["--import", "tsx", "script/verify-process-baseline.ts", "--worker"],
    { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }));
  const first = run(), second = run();
  assert.equal(first.hash, second.hash);
  assert.deepEqual(first.payload, second.payload);
  const evidence = { claim: "Fixed-input legacy software characterization; not physical or empirical validation",
    processes: 2, exactHashMatch: true, hash: first.hash, payload: first.payload,
    exclusions: ["Regional external inputs", "Company valuation and full walk-forward result fixtures"] };
  await mkdir("generated-artifacts/workplan-completion", { recursive: true });
  const path = `generated-artifacts/workplan-completion/baseline-${first.hash}.json`;
  await writeFile(path, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ path, hash: first.hash, processes: 2,
    exactHashMatch: true, categoryCases: categories.length, claim: evidence.claim,
    exclusions: evidence.exclusions }));
}

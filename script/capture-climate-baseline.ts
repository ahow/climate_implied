/**
 * Capture the current development model before scientific remediation.
 * Usage: npx tsx script/capture-climate-baseline.ts https://<development-origin>
 * Does not refresh inputs, edit overrides or change model settings.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";

const origin = process.argv[2];
if (!origin || !/^https?:\/\//.test(origin)) throw new Error("Provide the development application origin");
const capturedAt = new Date().toISOString();
const directory = path.join("exports", "climate-baselines", capturedAt.replaceAll(":", "-"));
await mkdir(directory, { recursive: true });

const sources = [
  "server/calculation/forwardProjection.ts",
  "server/calculation/historicalIndicators.ts",
  "server/calculation/historicalRecalculation.ts",
  "server/calculation/categoryProjections.ts",
  "server/calculation/categoryHistoricalTrend.ts",
  "server/calculation/regionalProjections.ts",
  "server/climateValuation/decarbConversion.ts",
  "server/routes.ts",
];
const sourceContents = Object.fromEntries(await Promise.all(sources.map(async file => [file, await readFile(file, "utf8")])));
await writeFile(path.join(directory, "model-source.json"), JSON.stringify(sourceContents, null, 2));

const endpoints = [
  ["/api/projection", "projection"],
  ["/api/projection/sensitivity", "sensitivity"],
  ["/api/projection/categories", "categories"],
  ["/api/projection/historical-trend", "historical-trend"],
  ["/api/indicators/historical", "historical-inputs"],
];
const manifest: Record<string, unknown> = {
  capturedAt,
  environment: "development",
  purpose: "Before-remediation evidence, not a scientifically validated or published release",
  codeCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceSha256: createHash("sha256").update(JSON.stringify(sourceContents)).digest("hex"),
  limitations: [
    "Existing cache responses are captured without forcing refresh.",
    "Endpoints are captured sequentially, not in a database transaction.",
    "Source archive covers calculation code and routes, not the entire runtime or database.",
    "This is the current development state, not the reviewer's October 4 production snapshot.",
  ],
  responses: [],
};
for (const [endpoint, name] of endpoints) {
  const response = await fetch(new URL(endpoint, origin), { signal: AbortSignal.timeout(240_000) });
  if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}; partial capture at ${directory}`);
  const body = await response.json();
  const text = JSON.stringify(body, null, 2);
  await writeFile(path.join(directory, `${name}.json`), text);
  (manifest.responses as unknown[]).push({
    endpoint, file: `${name}.json`, capturedAt: new Date().toISOString(),
    sha256: createHash("sha256").update(text).digest("hex"),
  });
  if (name === "projection") {
    console.log(JSON.stringify({
      metrics: body.metrics,
      temperature: { median: body.temperatureDistribution?.median, p10: body.temperatureDistribution?.p10, p90: body.temperatureDistribution?.p90 },
      milestones: body.emissionsTrajectory?.filter((row: { year: number }) => [2026, 2030, 2050, 2100].includes(row.year)),
    }, null, 2));
  }
  console.log(`Captured ${endpoint}`);
}
await writeFile(path.join(directory, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Baseline saved: ${directory}`);

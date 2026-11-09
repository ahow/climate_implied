/**
 * Actual retained workbook + resolved external regional inputs in fresh processes.
 * Characterization only, not physical validation. Restricted aggregates stay local.
 */
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
import { getCurrentIndicators } from "../server/calculation/forwardProjection";
import { getRegionalCarbonIntensities } from "../server/calculation/regionalProjections";
import { resolveSnapshot } from "../server/snapshots/store";
import { loadApprovedOverrides } from "../server/dataIngestion/overrideStore";
import { captureApprovedIndicators } from "../server/snapshots/indicators";
import { captureRegionalInputs } from "../server/snapshots/regional";
import express from "express";
import { createServer } from "node:http";
import { registerRoutes } from "../server/routes";
import { releaseSafety } from "../server/releaseSafety";

if (process.env.NODE_ENV !== "development") throw new Error("Development-only baseline");
const directory = "generated-artifacts/workplan-completion";
const selected = process.argv[3];
try {
  if (process.argv[2] === "--worker") {
    if (!selected?.startsWith(directory + "/")) throw new Error("Captured baseline file required");
    const capture = JSON.parse(await readFile(selected, "utf8"));
    assert.equal(contentHash(capture.inputs), capture.hash);
    const header = await resolveSnapshot(capture.inputs.workbookId);
    assert.ok(header);
    const app = express(), server = createServer(app);
    app.use(releaseSafety()); app.use(express.json({ limit: "256kb" }));
    await registerRoutes(server, app);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const pair = `snapshotId=${header.id}&indicatorSnapshotId=${capture.inputs.indicatorId}`;
    const company: Record<string, unknown> = {};
    for (const [name, route] of [
      ["valuationGroups", "/api/cv/carbon-price?method=absolute&geography=all"],
      ["sdg", "/api/cv/sdg-growth?costOfEquity=0.08"],
      ["terciles", "/api/cv/pe-comparison?method=absolute"],
    ]) {
      const response = await fetch(base + route + "&" + pair);
      assert.equal(response.status, 200, route);
      assert.equal(response.headers.get("X-Analysis-Snapshot"), header.id);
      assert.equal(response.headers.get("X-Indicator-Data-State"), "archived-approved-indicators");
      company[name] = await response.json();
    }
    const regionalResponse = await fetch(base + `/api/projection/regions?regionalSnapshotId=${capture.inputs.regionalId}&indicatorSnapshotId=${capture.inputs.indicatorId}`);
    assert.equal(regionalResponse.status, 200);
    assert.equal(regionalResponse.headers.get("X-Regional-Snapshot"), capture.inputs.regionalId);
    const payload = { regions: await regionalResponse.json(), company };
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    const result = { hash: contentHash(payload), payload };
    const resultPath = process.argv[4];
    if (!resultPath?.startsWith(directory + "/")) throw new Error("Private result path required");
    await writeFile(resultPath, JSON.stringify(result));
    console.log("BASELINE_RESULT=" + JSON.stringify({ resultPath, hash: result.hash }));
  } else {
    await mkdir(directory, { recursive: true });
    const header = await resolveSnapshot();
    assert.ok(header, "Retained workbook archive required");
    await loadApprovedOverrides();
    const inputs = { workbookId: header.id, indicators: getCurrentIndicators(),
      intensities: await getRegionalCarbonIntensities(),
      externalSource: "https://nyc3.digitaloceanspaces.com/owid-public/data/co2/owid-co2-data.json",
      scope: "Resolved latest regional inputs; PPP OWID or explicitly tagged nominal static assumptions. Not publication-vintage evidence." };
    const frozenInputs = { ...inputs, indicatorId: (await captureApprovedIndicators()).id,
      regionalId: (await captureRegionalInputs(inputs.intensities)).id };
    const capture = { inputs: frozenInputs, hash: contentHash(frozenInputs), capturedAt: new Date().toISOString() };
    const path = `${directory}/remaining-inputs-${capture.hash}.json`;
    await writeFile(path, JSON.stringify(capture, null, 2));
    let worker = 0;
    const run = async () => {
      const resultPath = `${directory}/remaining-worker-${capture.hash}-${++worker}.json`;
      const stdout = execFileSync(process.execPath,
        ["--import", "tsx", "script/verify-remaining-baselines.ts", "--worker", path, resultPath],
        { encoding: "utf8", maxBuffer: 15 * 1024 * 1024, timeout: 240000,
          env: { ...process.env, DATA_SCHEDULER_ENABLED: "false", FMP_API_KEY: "" } });
      const line = stdout.split("\n").find(line => line.startsWith("BASELINE_RESULT="));
      if (!line) throw new Error("Worker did not produce a result");
      return JSON.parse(await readFile(resultPath, "utf8"));
    };
    const first = await run(), second = await run();
    assert.equal(first.hash, second.hash);
    assert.deepEqual(first.payload, second.payload);
    const output = `${directory}/remaining-baseline-${first.hash}.json`;
    await writeFile(output, JSON.stringify({ capture, ...first,
      claim: "Actual retained-input software characterization; not empirical efficacy",
      processCount: 2, exactHashMatch: true }, null, 2));
    console.log(JSON.stringify({ output, inputHash: capture.hash, outputHash: first.hash, exactHashMatch: true,
      regions: first.payload.regions.length,
      sources: Object.fromEntries(Object.entries(inputs.intensities).map(([k,v]) => [k,v.source])),
      groups: Object.fromEntries(Object.entries(first.payload.company).map(([k,v]) => [k,(v as unknown[]).length])) }));
  }
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Baseline failed");
  process.exit(1);
}

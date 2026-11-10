/** Actual retained development workbook + private synthetic overlays.
 * No approvals, public-table writes or immutable synthetic DB archives. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { contentHash, createManifest } from "../server/calculation/analysisManifest";
import { applyOverlays, packOverlay, unpackOverlay } from "../server/snapshots/overlayContract";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";
import { packDataset, unpackDataset } from "../server/snapshots/contract";

const dir = "generated-artifacts/overlay-replay";
async function main() {
  if (process.argv[2] === "--worker") {
    const captured = JSON.parse(readFileSync(process.argv[3], "utf8"));
    const baseline = unpackDataset(captured.workbook.id, captured.workbook.chunks);
    const overlays = captured.overlays.map((o: any) => unpackOverlay(o.id, o.payload));
    const effective = applyOverlays(baseline, overlays, captured.cutoff);
    const packed = packDataset(effective.companies, effective.timeSeries);
    const manifest = createManifest({
      codeVersion: captured.codeVersion, modelVersion: "overlay-replay-1",
      snapshotHashes: [captured.workbook.id, ...captured.overlays.map((o: any) => o.id)],
      scenario: "development-revised-history-fixture", settings: { cutoff: captured.cutoff },
    });
    const result = { companyCount: packed.companyCount, rowCount: packed.observationCount,
      effectiveInputHash: packed.id,
      selectedCompany: effective.companies.find(c => c.id === captured.companyId),
      selectedObservation: JSON.parse(JSON.stringify(effective.timeSeries.find(r => r.companyId === captured.companyId))),
    };
    const archived = packAnalysisResult(manifest, result);
    assert.deepEqual(unpackAnalysisResult(archived.id, archived.payload).result, result);
    assert.equal(packDataset(baseline.companies, baseline.timeSeries).id, captured.workbook.id);
    assert.throws(() => applyOverlays(baseline, overlays, "1900-01-01"), /cutoff/);
    assert.throws(() => unpackOverlay("0".repeat(64), captured.overlays[0].payload), /hash/);
    writeFileSync(process.argv[4], JSON.stringify({ resultHash: archived.id, result }));
    return;
  }
  const { resolveSnapshot, loadSnapshot } = await import("../server/snapshots/store");
  const header = await resolveSnapshot();
  assert.ok(header, "Development workbook archive required");
  const data = await loadSnapshot(header);
  const row = data.timeSeries.find(r => r.marketCap !== null);
  assert.ok(row);
  const date = row.date.toISOString().slice(0, 10);
  const common = { companyId: row.companyId, observationDate: date, availableAt: date,
    source: "synthetic perturbation on retained development baseline",
    approvalEvidence: "TEST ONLY; not an approval", historyBasis: "revised-history" };
  const overlays = [
    packOverlay([{ ...common, field: "marketCap", value: row.marketCap! + 1, kind: "financial", unit: "USD million" }]),
    packOverlay([{ ...common, field: "scope1Emissions", value: 0, kind: "carbon", unit: "tCO2e" }]),
    packOverlay([{ ...common, field: "sdgAlignmentScore", value: 3, kind: "sdg", unit: "score" }]),
  ];
  mkdirSync(dir, { recursive: true });
  const captured = { workbook: packDataset(data.companies, data.timeSeries), overlays,
    cutoff: date, companyId: row.companyId,
    codeVersion: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
  const file = `${dir}/inputs-${contentHash(captured)}.json`;
  writeFileSync(file, JSON.stringify(captured));
  const results = [1, 2].map(n => {
    const out = `${dir}/worker-${n}.json`;
    execFileSync(process.execPath, ["--import", "tsx", "script/verify-overlay-replay.ts", "--worker", file, out],
      { env: { ...process.env, DATA_SCHEDULER_ENABLED: "false" }, timeout: 120000 });
    return JSON.parse(readFileSync(out, "utf8"));
  });
  assert.deepEqual(results[0], results[1]);
  assert.notEqual(results[0].result.effectiveInputHash, header.id);
  console.log(JSON.stringify({ file, resultHash: results[0].resultHash,
    companyCount: results[0].result.companyCount, rowCount: results[0].result.rowCount,
    unchangedBaseline: true, overlays: 3, freshProcesses: 2,
    caveat: "Private synthetic file fixture; not reviewed source overlays or complete application result replay" }));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });

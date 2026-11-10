import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { contentHash } from "../server/calculation/analysisManifest";
import { materialLeaves } from "../server/calculation/companyProjectionAsOf";
import { packCompanySource } from "../server/calculation/companySourceArchive";
import {
  pinCompanyProjection, replayCompanyProjection, exportCompanyProjectionReplay,
  type CompanyReplayBundle, type CompanyReplaySettings,
} from "../server/calculation/companyProjectionReplay";

function fixture(companyId = "isolated-engineering-A", baseRevenue = 1000) {
  const input = {
    companyId, manifestId: `engineering-input-${companyId}`, currency: "GBP",
    businessType: "non-financial", baseYear: 2024, baseRevenue, baseFcfe: 80,
    marginBounds: { minimum: -.2, maximum: .3, evidence: ["synthetic-not-source-review"] },
    baseEmissionsTonnes: { scope1: 100, scope2: 50, scope3: 1000 },
    mapping: { basis: "operating-geography", evidence: ["synthetic-not-empirical"],
      shares: [{ region: "EU27", sector: "power", weight: .6 }, { region: "US", sector: "power", weight: .4 }] },
    members: Array.from({ length: 8 }, (_, i) => ({
      id: `engineering-m${i}`, years: Array.from({ length: 5 }, (_, y) => ({
        year: 2025 + y, exposures: [
          { region: "EU27", sector: "power", activityGrowth: .01 + i / 1000 },
          { region: "US", sector: "power", activityGrowth: .02 },
        ], marketShareMultiplier: 1, operatingMargin: i === 0 ? -.1 : .2,
        taxRate: .2, interest: 1, depreciation: 10, capex: 8,
        increaseWorkingCapital: -1, netBorrowing: 0,
        nonOperatingIncome: 2, incomeAttributionAdjustment: 0, otherCashAdjustments: 0,
        scope1IntensityMultiplier: .9, scope2IntensityMultiplier: .8, scope3IntensityMultiplier: .7,
        scope1LiableFraction: 1, scope2LiableFraction: .1, effectiveCarbonPrice: 1, passThrough: .5,
      })),
    })),
  };
  const settings: CompanyReplaySettings = {
    companyId, isin: "US0000000001", informationCutoff: "2024-03-01T00:00:00Z",
    model: "companyProjection/conditional-operating-ledger-1", exportContract: "company-projection-full-ledger-xlsx-1",
  };
  const claims = Object.entries(materialLeaves(input)).map(([path, value]) => ({
    path, value, valueHash: contentHash(value), locator: `synthetic fixture ${path}`,
    unit: "explicit-engine-schema-unit", period: "2024-2029", geography: "engineering-only",
    basis: "assumption", availableAt: "2024-01-01T00:00:00Z", method: "Engineering control, not calibrated",
    dependencies: [],
  }));
  const source = packCompanySource({
    version: "company-operating-source-1", companyId, isin: settings.isin,
    url: "https://example.org/isolated-engineering-not-real-company-evidence",
    publisher: "Isolated synthetic engineering fixture; not empirical evidence",
    publishedAt: "2024-01-01T00:00:00Z", retrievedAt: "2024-02-01T00:00:00Z",
    content: "Synthetic engineering fixture only", contentHash: contentHash("Synthetic engineering fixture only"),
    licence: "Synthetic test fixture", claims,
  });
  const evidence = claims.map(c => ({
    path: c.path, valueHash: c.valueHash, sourceArchiveId: source.id, availableAt: c.availableAt, basis: c.basis,
  }));
  return { input, evidence, settings, sources: { [source.id]: source.payload } };
}
async function pin(f = fixture()) {
  return pinCompanyProjection(f.input, f.evidence, f.settings, f.sources);
}
function reseal(bundle: CompanyReplayBundle) { bundle.manifestId = contentHash(bundle.manifest); return bundle; }
function child(input: string, output: string): Promise<string> {
  return new Promise((done, fail) => {
    const process = spawn(resolve("node_modules/.bin/tsx"), ["script/replay-company-projection.ts", input, output],
      { stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    process.stdout.on("data", data => { log += data; });
    process.stderr.on("data", data => { log += data; });
    process.on("error", fail);
    process.on("close", code => code === 0 ? done(log) : fail(new Error(`Fresh process exit ${code}: ${log}`)));
  });
}

test("isolated company full-engine, material and XLSX replay controls (not scientific acceptance)", async t => {
  const directory = "generated-artifacts/company-projection-replay";
  mkdirSync(directory, { recursive: true });
  const bundle = await pin(), baseline = await replayCompanyProjection(bundle);
  const exported = exportCompanyProjectionReplay(baseline);
  const counts = { members: 8, annualLedgerRows: 40, materialEvidenceLeaves: (bundle.evidence as unknown[]).length,
    pinnedSources: Object.keys(bundle.sources).length, pinnedCodeFiles: Object.keys(bundle.code.files).length };
  await t.test("all material pins and original full result/ledger reconcile", () => {
    assert.equal(baseline.result.status, "conditional-projection");
    if (baseline.result.status !== "conditional-projection") throw new Error("Projection required");
    assert.equal(baseline.result.members.length, 8);
    assert.equal(baseline.result.members[0].growth, null);
    assert.equal(baseline.result.members[0].years[0].cashTax, 0);
    assert.equal(exported.ledgerRows, 40);
    assert.equal(baseline.result.scientificAcceptance, false);
    assert.equal(baseline.result.productionEligible, false);
    assert.equal(contentHash(bundle.input), bundle.manifest.inputHash);
    assert.equal(contentHash((bundle.input as any).mapping), bundle.manifest.mappingHash);
  });
  await t.test("missing/corrupt/conflicting/future source and material selections reject", async () => {
    const missing = structuredClone(bundle); missing.sources = {};
    await assert.rejects(() => replayCompanyProjection(missing), /Missing/);
    const corrupt = structuredClone(bundle);
    (Object.values(corrupt.sources)[0] as any).content = "corrupt";
    await assert.rejects(() => replayCompanyProjection(corrupt), /hash/);
    const wrongInput = structuredClone(bundle); (wrongInput.input as any).baseRevenue = 999;
    await assert.rejects(() => replayCompanyProjection(wrongInput), /settings\/input\/mapping/);
    const wrongMapping = structuredClone(bundle); (wrongMapping.input as any).mapping.shares[0].weight = .5;
    await assert.rejects(() => replayCompanyProjection(wrongMapping), /settings\/input\/mapping/);
    const wrongSettings = structuredClone(bundle); wrongSettings.manifest.settings.isin = "US0000000002";
    await assert.rejects(() => replayCompanyProjection(reseal(wrongSettings)), /settings\/input\/mapping/);
    const conflicting = fixture();
    conflicting.evidence[0].valueHash = "a".repeat(64);
    await assert.rejects(() => pin(conflicting), /Conflicting/);
    const conflictingClaim = fixture(), oldId = Object.keys(conflictingClaim.sources)[0];
    const conflictingSource = structuredClone(conflictingClaim.sources[oldId]);
    conflictingSource.claims[0].valueHash = contentHash("wrong-archived-value");
    delete (conflictingSource.claims[0] as any).value;
    const repacked = packCompanySource(conflictingSource);
    conflictingClaim.sources = { [repacked.id]: repacked.payload };
    conflictingClaim.evidence.forEach(row => { row.sourceArchiveId = repacked.id; });
    await assert.rejects(() => pin(conflictingClaim), /conflicting archived claim/);
    const future = fixture(); future.settings.informationCutoff = "2023-12-31T00:00:00Z";
    await assert.rejects(() => pin(future), /Future/);
    const wrongIdentity = fixture(); wrongIdentity.settings.isin = "US0000000002";
    await assert.rejects(() => pin(wrongIdentity), /identity/);
    const missingEvidence = fixture(); missingEvidence.evidence.pop();
    await assert.rejects(() => pin(missingEvidence), /Missing/);
    const missingArchive = fixture(); missingArchive.sources = {};
    await assert.rejects(() => pin(missingArchive), /Missing pinned/);
    const missingBridge = fixture(); delete (missingBridge.input.members[0].years[0] as any).otherCashAdjustments;
    await assert.rejects(() => pin(missingBridge));
  });
  await t.test("well-rehashed archived code substitution still rejects current executable mismatch", async () => {
    const mismatch = structuredClone(bundle);
    mismatch.code.files["server/calculation/companyProjection.ts"] += "\n// mismatched historical engine";
    mismatch.code.filesHash = contentHash(mismatch.code.files);
    mismatch.manifest.codeId = contentHash(mismatch.code);
    await assert.rejects(() => replayCompanyProjection(reseal(mismatch)), /model code\/runtime mismatch/);
    const wrongModel = structuredClone(bundle);
    (wrongModel.manifest as any).model = "unimplemented-engine";
    await assert.rejects(() => replayCompanyProjection(reseal(wrongModel)));
  });
  await t.test("current input/source mutation cannot contaminate a pending pin or saved replay", async () => {
    const current = fixture();
    const pending = pin(current);
    current.input.baseRevenue = 987654321;
    current.input.mapping.shares[0].weight = 0;
    current.settings.companyId = "mutated-current-selection";
    current.settings.informationCutoff = "2099-01-01T00:00:00Z";
    Object.values(current.sources)[0].content = "current collector changed";
    current.evidence.length = 0;
    assert.deepEqual(await pending, bundle);
    assert.deepEqual(await replayCompanyProjection(bundle), baseline);
  });
  let concurrentIds: string[] = [];
  await t.test("interleaved concurrent distinct company/settings/source selections stay isolated", async () => {
    const b = await pin(fixture("isolated-engineering-B", 2000));
    const expectedB = await replayCompanyProjection(b);
    assert.notEqual(expectedB.resultHash, baseline.resultHash);
    const runs = await Promise.all(Array.from({ length: 20 }, async (_, i) => {
      await new Promise(done => setTimeout(done, (i % 3) * 2));
      return replayCompanyProjection(i % 2 ? b : bundle);
    }));
    runs.forEach((run, i) => assert.deepEqual(run, i % 2 ? expectedB : baseline));
    concurrentIds = [baseline.manifestId, expectedB.manifestId];
  });
  let logs: string[] = [];
  await t.test("two actual fresh subprocesses recalculate entire result and byte-identical XLSX", async () => {
    const input = `${directory}/bundle.json`;
    writeFileSync(input, JSON.stringify(bundle));
    logs = await Promise.all([child(input, `${directory}/fresh-1`), child(input, `${directory}/fresh-2`)]);
    for (const n of [1, 2]) {
      const fresh = JSON.parse(readFileSync(`${directory}/fresh-${n}.json`, "utf8"));
      assert.deepEqual(fresh.result, baseline.result);
      assert.equal(fresh.resultHash, baseline.resultHash);
      assert.equal(fresh.export.cellsHash, exported.cellsHash);
      assert.equal(fresh.export.binaryHash, exported.binaryHash);
      assert.ok(readFileSync(`${directory}/fresh-${n}.xlsx`).equals(exported.bytes));
    }
  });
  const report = {
    scope: "Isolated synthetic engineering fixtures only; NOT scientific acceptance or real company evidence",
    command: "node --import tsx --test script/company-projection-replay.test.ts",
    controls: 6, freshSubprocesses: 2, concurrentReplays: 20, ...counts,
    manifestId: baseline.manifestId, inputHash: bundle.manifest.inputHash,
    mappingHash: bundle.manifest.mappingHash, evidenceHash: bundle.manifest.evidenceHash,
    codeId: bundle.manifest.codeId, codeFilesHash: bundle.code.filesHash,
    settingsHash: bundle.manifest.settingsHash, sourceArchiveIds: bundle.manifest.sourceArchiveIds,
    resultHash: baseline.resultHash, xlsxBinaryHash: exported.binaryHash, xlsxCellsHash: exported.cellsHash,
    xlsxBytes: exported.bytes.length, sheets: exported.sheets, concurrentManifestIds: concurrentIds,
    scientificAcceptance: false, productionEligible: false,
    sideEffects: "Only local generated-artifacts writes; no DB, DDL, approvals, collectors, purchases or credentials",
    remainingGaps: [
      "No publisher authentication, original-vintage proof, empirical calibration or scientific acceptance.",
      "Pins source, package lock and Node version; not a hermetic installed dependency or operating-system image.",
      "Archived code is not dynamically executed: replay requires exact current source/runtime match and rejects mismatch.",
      "Offline replay/export helper only; no route, database archive integration or production deployment.",
      "No full valuation pairing, terminal reinvestment model or financial-institution residual-income model.",
    ], subprocessLogs: logs,
  };
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`${directory}/subprocess.log`, logs.join("\n"));
  console.log("REPLAY_REPORT", JSON.stringify(report));
});

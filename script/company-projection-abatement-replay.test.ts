import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { contentHash } from "../server/calculation/analysisManifest";
import { materialLeaves } from "../server/calculation/companyProjectionAsOf";
import { packCompanySource } from "../server/calculation/companySourceArchive";
import { pinCompanyProjection, replayCompanyProjection, exportCompanyProjectionReplay,
  type CompanyReplaySettings } from "../server/calculation/companyProjectionReplay";
import { companyAbatementSemantics, companyAbatementColumns } from "../shared/companyAbatementSemantics";

const scopes = ["scope1", "scope2", "scope3"] as const;
const directory = "generated-artifacts/company-projection-abatement-replay";
function fixture(optIn = true) {
  const input = {
    companyId: "synthetic-abatement-replay", manifestId: "synthetic-only", currency: "GBP",
    businessType: "non-financial", baseYear: 2024, baseRevenue: 1000, baseFcfe: 80,
    baseEmissionsTonnes: { scope1: 100, scope2: 50, scope3: 1000 },
    marginBounds: { minimum: 0, maximum: .3, evidence: ["synthetic-margin"] },
    mapping: { basis: "operating-geography", evidence: ["synthetic-geography"],
      shares: [{ region: "EU27", sector: "power", weight: 1 }] },
    members: Array.from({ length: 2 }, (_, m) => ({
      id: `synthetic-member-${m}`,
      years: Array.from({ length: 5 }, (_, y) => ({
        year: 2025 + y, exposures: [{ region: "EU27", sector: "power", activityGrowth: .02 + m * .01 }],
        marketShareMultiplier: 1, operatingMargin: .2, taxRate: .2,
        interest: 1, depreciation: 10, capex: 8, increaseWorkingCapital: 2, netBorrowing: 0,
        nonOperatingIncome: 0, incomeAttributionAdjustment: 0, otherCashAdjustments: 0,
        scope1IntensityMultiplier: .9, scope2IntensityMultiplier: .8, scope3IntensityMultiplier: .7,
        scope1LiableFraction: .8, scope2LiableFraction: .3, effectiveCarbonPrice: 2, passThrough: .25,
        ...(optIn ? { abatementAccounting: Object.fromEntries(scopes.map((scope, s) => [scope, {
          intensityEvidence: [`synthetic-pathway-${scope}`],
          measures: [
            { measureId: `embedded-${scope}`, treatment: "embedded-in-intensity", evidence: ["synthetic-embedded"] },
            { measureId: `separate-${scope}`, treatment: "separate-abatement", evidence: ["synthetic-separate"],
              remainingEmissionsMultiplier: .9 - .1 * s - .01 * m - .01 * y,
              deliveryEvidence: ["synthetic-delivery"], disjointnessEvidence: ["synthetic-disjointness"] },
          ],
        }])) } : {}),
      })),
    })),
  };
  const settings: CompanyReplaySettings = {
    companyId: input.companyId, isin: "US0000000001", informationCutoff: "2024-03-01T00:00:00Z",
    model: "companyProjection/conditional-operating-ledger-1", exportContract: "company-projection-full-ledger-xlsx-1",
  };
  const claims = Object.entries(materialLeaves(input)).map(([path, value]) => ({
    path, value, valueHash: contentHash(value), locator: `Synthetic engineering fixture ${path}`,
    unit: "explicit-schema-unit", period: "2024-2029", geography: "synthetic-only",
    basis: "assumption", availableAt: "2024-01-01T00:00:00Z",
    method: "Synthetic control; not physical proof or issuer qualification", dependencies: [],
  }));
  const source = packCompanySource({
    version: "company-operating-source-1", companyId: input.companyId, isin: settings.isin,
    url: "https://example.org/synthetic-abatement-control", publisher: "Synthetic engineering only",
    publishedAt: "2024-01-01T00:00:00Z", retrievedAt: "2024-02-01T00:00:00Z",
    content: "Synthetic abatement replay source", contentHash: contentHash("Synthetic abatement replay source"),
    licence: "Synthetic test fixture", claims,
  });
  const evidence = claims.map(c => ({
    path: c.path, valueHash: c.valueHash, sourceArchiveId: source.id, availableAt: c.availableAt, basis: c.basis,
  }));
  return { input, evidence, settings, sources: { [source.id]: source.payload } };
}
async function pin(f = fixture()) { return pinCompanyProjection(f.input, f.evidence, f.settings, f.sources); }
function cells(bytes: Buffer) {
  const book = XLSX.read(Buffer.from(bytes), { type: "buffer" });
  return Object.fromEntries(book.SheetNames.map(name => [name,
    XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, defval: null, raw: true }) as any[][]]));
}
function child(input: string, output: string): Promise<string> {
  return new Promise((done, fail) => {
    const process = spawn(resolve("node_modules/.bin/tsx"), ["script/replay-company-projection.ts", input, output],
      { stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    process.stdout.on("data", data => { log += data; });
    process.stderr.on("data", data => { log += data; });
    process.on("error", fail);
    process.on("close", code => code === 0 ? done(log) : fail(new Error(`Fresh subprocess exit ${code}: ${log}`)));
  });
}

test("S12-014 legacy XLSX golden is unchanged by opt-in adapter integration", async () => {
  const replay = await replayCompanyProjection(await pin(fixture(false)));
  // Normalize only the executable-code-dependent replay manifest identifier.
  // Source claims, engine result, evidence and every worksheet value remain real
  // synthetic fixture outputs. This tests adapter identity, not old-code execution.
  const manifestId = contentHash("synthetic-legacy-adapter-golden");
  const result = { ...replay.result, replayManifestId: manifestId };
  const stable = { ...replay, manifestId, result, resultHash: contentHash(result) };
  const exported = exportCompanyProjectionReplay(stable);
  // Captured before changing the adapter or adding declarations to opt-in results.
  assert.equal(stable.resultHash, "387dcba5ea84eb17aae6a39c55e6b21054c9cb8e023541fd430c871786026ebb");
  assert.equal(exported.binaryHash, "e3435be2c86e8494595dfa4087014e678c5efd7d80a196dd74c463c2d1b0bcd2");
  assert.equal(exported.cellsHash, "1f9fa2a8c084e47ffd332ec13b9948b7d768f5f122cc42780fac7ac17d413a74");
  assert.deepEqual(exported.sheets, ["Semantics", "Identity", "Ledger", "FullResult"]);
});

test("S12-014 every new opt-in material leaf is pinned and resolved by the existing manifest", async () => {
  const f = fixture(), bundle = await pin(f);
  const leaves = materialLeaves(f.input);
  const newPaths = Object.keys(leaves).filter(path => path.includes("/abatementAccounting/"));
  assert.equal(newPaths.length, 300); // 2 members × 5 years × 3 scopes × 10 leaves.
  assert.equal(bundle.manifest.inputHash, contentHash(f.input));
  for (const path of newPaths) {
    const row = f.evidence.find(e => e.path === path)!;
    assert.equal(row.valueHash, contentHash(leaves[path]));
    const archive = f.sources[row.sourceArchiveId];
    const claim = archive.claims.find(c => c.path === path)!;
    assert.equal(claim.valueHash, row.valueHash);
    assert.deepEqual(claim.value, leaves[path]);
  }
  for (const suffix of ["/intensityEvidence/0", "/measures/0/measureId", "/measures/0/treatment",
    "/measures/0/evidence/0", "/measures/1/remainingEmissionsMultiplier",
    "/measures/1/deliveryEvidence/0", "/measures/1/disjointnessEvidence/0"]) {
    const missing = fixture();
    missing.evidence = missing.evidence.filter(e => e.path !== newPaths.find(p => p.endsWith(suffix)));
    await assert.rejects(() => pin(missing), /Missing or duplicate material-input evidence/);
  }
  const changed = structuredClone(bundle);
  (changed.input as any).members[0].years[0].abatementAccounting.scope1.measures[1].remainingEmissionsMultiplier = .1;
  changed.manifest.inputHash = contentHash(changed.input);
  changed.manifestId = contentHash(changed.manifest);
  await assert.rejects(() => replayCompanyProjection(changed), /Conflicting material-input evidence/);
  const missingNewCode = structuredClone(bundle);
  assert.ok(missingNewCode.code.files["shared/companyAbatementSemantics.ts"]);
  delete missingNewCode.code.files["shared/companyAbatementSemantics.ts"];
  missingNewCode.code.filesHash = contentHash(missingNewCode.code.files);
  missingNewCode.manifest.codeId = contentHash(missingNewCode.code);
  missingNewCode.manifestId = contentHash(missingNewCode.manifest);
  await assert.rejects(() => replayCompanyProjection(missingNewCode), /model code\/runtime mismatch/);
  const legacy = await pin(fixture(false));
  assert.equal(Object.hasOwn(legacy.code.files, "shared/companyAbatementSemantics.ts"), false);
});

test("S12-014 opt-in fresh subprocess reproduces complete result, numerical reconciliation and byte-identical XLSX readback", async () => {
  mkdirSync(directory, { recursive: true });
  const f = fixture();
  // Force declaration chunking beyond one Excel-safe JSON chunk.
  f.input.members[0].years[0].abatementAccounting!.scope1.intensityEvidence[0] = "synthetic-long-evidence-" + "x".repeat(17000);
  // Rebuild the archive/evidence from the changed input through the same manifest contract.
  const claims = Object.entries(materialLeaves(f.input)).map(([path, value]) => ({
    ...Object.values(f.sources)[0].claims[0], path, value, valueHash: contentHash(value),
    locator: `Synthetic large declaration ${path}`,
  }));
  const repacked = packCompanySource({ ...Object.values(f.sources)[0], claims });
  f.sources = { [repacked.id]: repacked.payload };
  f.evidence = claims.map(c => ({ path: c.path, valueHash: c.valueHash, sourceArchiveId: repacked.id,
    availableAt: c.availableAt, basis: c.basis }));
  const bundle = await pin(f), baseline = await replayCompanyProjection(bundle);
  const exported = exportCompanyProjectionReplay(baseline), decoded = cells(exported.bytes);
  assert.deepEqual(exported.sheets, ["Semantics", "Identity", "Ledger", "FullResult", "Abatement", "AbatementInputs"]);
  assert.deepEqual(decoded.Abatement[0], [...companyAbatementColumns]);
  assert.equal(decoded.Abatement.length - 1, 30);
  assert.equal(new Set(companyAbatementSemantics.map(s => s.id)).size, companyAbatementSemantics.length);
  for (const semantic of companyAbatementSemantics) {
    const row = decoded.Semantics.find(r => r[0] === semantic.id)!;
    assert.equal(row[1], semantic.meaning);
    assert.equal(row[3], semantic.formula);
    for (const field of ["unit", "source", "period", "geography", "status", "missingness", "uncertainty", "scope", "asOfRule"] as const)
      assert.ok(semantic[field].length > 0);
  }
  assert.equal(baseline.result.status, "conditional-projection");
  if (baseline.result.status !== "conditional-projection") throw new Error("Projection required");
  for (const member of baseline.result.members) for (const year of member.years) {
    const check = year.abatementReconciliation!;
    const chunks = decoded.AbatementInputs.slice(1).filter(r => r[0] === member.id && r[1] === year.year);
    assert.deepEqual(chunks.map(r => r[2]), chunks.map((_, i) => i));
    const declarations = JSON.parse(chunks.map(r => r[3]).join(""));
    assert.deepEqual(declarations, check.declaredAccounting);
    const source = f.input.members.find(m => m.id === member.id)!.years.find(y => y.year === year.year)!;
    assert.deepEqual(declarations, source.abatementAccounting);
    for (const scope of scopes) {
      const row = decoded.Abatement.find(r => r[0] === member.id && r[1] === year.year && r[2] === scope)!;
      assert.equal(row[8], year.emissionsTonnes[scope]);
      assert.ok(Math.abs(row[8] - row[3] * row[4] * row[5] * row[7]) < 1e-9);
      assert.equal(row[9], "passed-declared-disjoint-measure-ids");
      const ledgerScope = decoded.Semantics.find(r => r[0] === `companyReplay.ledger.${scope}Tonnes`)!;
      assert.match(ledgerScope[3], /explicit separate residual factors/);
    }
  }
  assert.equal(decoded.AbatementInputs.filter(r => r[0] === "synthetic-member-0" && r[1] === 2025).length, 2);
  assert.deepEqual(JSON.parse(decoded.FullResult.slice(1).map(r => r[1]).join("")), baseline.result);
  assert.equal(exported.cellsHash, contentHash(decoded));
  const inputPath = `${directory}/bundle.json`, output = `${directory}/fresh`;
  writeFileSync(inputPath, JSON.stringify(bundle));
  const subprocessLog = await child(inputPath, output);
  const fresh = JSON.parse(readFileSync(`${output}.json`, "utf8"));
  assert.deepEqual(fresh.result, baseline.result);
  assert.equal(fresh.resultHash, baseline.resultHash);
  assert.equal(fresh.manifestId, baseline.manifestId);
  assert.equal(fresh.export.binaryHash, exported.binaryHash);
  assert.equal(fresh.export.cellsHash, exported.cellsHash);
  assert.ok(readFileSync(`${output}.xlsx`).equals(exported.bytes));
  assert.deepEqual(cells(readFileSync(`${output}.xlsx`)), decoded);
  const report = {
    scope: "Synthetic opt-in engineering replay/export; not actual issuer qualification or physical-proof approval",
    freshSubprocesses: 1, members: 2, yearsPerMember: 5, physicalScopeRows: 30,
    newMaterialEvidenceLeaves: Object.keys(materialLeaves(f.input)).filter(p => p.includes("/abatementAccounting/")).length,
    manifestId: baseline.manifestId, resultHash: baseline.resultHash, inputHash: bundle.manifest.inputHash,
    evidenceHash: bundle.manifest.evidenceHash, codeId: bundle.manifest.codeId,
    binaryHash: exported.binaryHash, cellsHash: exported.cellsHash, sheets: exported.sheets,
    abatementSemanticFields: companyAbatementSemantics.length, sourceArchiveIds: bundle.manifest.sourceArchiveIds,
    scientificAcceptance: false, productionEligible: false, subprocessLog,
  };
  writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log("S12_014_OPT_IN_REPLAY_REPORT", JSON.stringify(report));
});

test("S12-014 mixed-contract years export only actual opt-in rows without inventing missing declarations", async () => {
  const f = fixture();
  for (const member of f.input.members) for (const [i, year] of member.years.entries())
    if (i > 0) delete year.abatementAccounting;
  const claims = Object.entries(materialLeaves(f.input)).map(([path, value]) => ({
    ...Object.values(f.sources)[0].claims[0], path, value, valueHash: contentHash(value),
  }));
  const source = packCompanySource({ ...Object.values(f.sources)[0], claims });
  f.sources = { [source.id]: source.payload };
  f.evidence = claims.map(c => ({ path: c.path, valueHash: c.valueHash, sourceArchiveId: source.id,
    availableAt: c.availableAt, basis: c.basis }));
  const replay = await replayCompanyProjection(await pin(f));
  const decoded = cells(exportCompanyProjectionReplay(replay).bytes);
  assert.equal(decoded.Ledger.length - 1, 10);
  assert.equal(decoded.Abatement.length - 1, 6);
  assert.ok(decoded.Abatement.slice(1).every(r => r[1] === 2025));
  assert.ok(decoded.AbatementInputs.slice(1).every(r => r[1] === 2025));
});

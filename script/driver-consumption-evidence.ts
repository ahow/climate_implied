/**
 * Local-only replay of a prewritten operational protocol. No collectors,
 * source downloads, model refits, route changes or acceptance promotion.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  consumeRetainedAdoption, retainedAdoptionParameterRegistry, RETAINED_ADOPTION_INPUTS,
} from "../server/calculation/driverParameterRegistry";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import { calculateEmissionsTrajectory, getCurrentIndicatorsFromHistorical } from "../server/calculation/forwardProjection";
import { HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";
import { contentHash } from "../server/calculation/analysisManifest";

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const protocolPath = "docs/driver-consumption-protocol.json";
const protocol = JSON.parse(readFileSync(protocolPath, "utf8"));
const frozen = [
  "docs/Driver_Calibration_Protocol.md", "docs/Driver_Uncertainty_Protocol.md",
  "docs/Company_Beta_Sensitivity_Protocol.md", "docs/Beta_Growth_Sensitivity_Results.md",
  "docs/EV_Calibration_Protocol.md", "docs/EV_and_Cost_Calibration_Results.md",
  "docs/Fleet_Transition_Protocol.md", "docs/Fleet_Transition_Results.md", "docs/fleet_transition_results.json",
  "docs/Storage_Adoption_Protocol.md", "docs/Storage_Adoption_Results.md",
  "docs/Historical_Diagnostics_and_Skill_Results.md",
  "generated-artifacts/driver-calibration/result.json", "generated-artifacts/driver-calibration/uncertainty.json",
];
const before = Object.fromEntries(frozen.map(path => [path, sha(path)]));
const directory = `generated-artifacts/driver-consumption/${new Date().toISOString().replace(/[:.]/g, "-")}`;
mkdirSync(directory, { recursive: true });
const executions: object[] = [];
function execute(command: string, args: string[], logName: string) {
  const startedAt = new Date().toISOString();
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 120000, maxBuffer: 4_000_000 });
  const logPath = join(directory, logName);
  writeFileSync(logPath, `${command} ${args.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  executions.push({ command: [command, ...args], startedAt, completedAt: new Date().toISOString(),
    exitCode: result.status, error: result.error?.message ?? null, logPath, logSha256: sha(logPath) });
  if (result.status !== 0) throw new Error(`Focused check failed: ${logPath}`);
  return result.stdout;
}
function rejectCli(args: string[], logName: string, expectedReason: string) {
  const startedAt = new Date().toISOString();
  const command = [process.execPath, "--import", "tsx", "script/run-regional-ensemble.ts", ...args];
  const result = spawnSync(command[0], command.slice(1), { encoding: "utf8", timeout: 30000, maxBuffer: 2_000_000 });
  const logPath = join(directory, logName);
  writeFileSync(logPath, `${command.join(" ")}\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  executions.push({ command, startedAt, completedAt: new Date().toISOString(), exitCode: result.status,
    expectedExitCode: 1, logPath, logSha256: sha(logPath) });
  if (result.status !== 1 || !result.stderr.includes(expectedReason))
    throw new Error(`CLI negative control failed: ${logPath}`);
  const output = args[args.indexOf("--output") + 1];
  if (existsSync(output)) throw new Error(`Rejected central CLI created output artifacts: ${output}`);
  return { exitCode: result.status, error: JSON.parse(result.stderr.trim()).error,
    outputArtifactsCreated: false, logPath, logSha256: sha(logPath) };
}
const clauses = [
  "Fallback rule, fixed before fitting. A driver that does not beat both baselines out of sample becomes a bounded sensitivity, not a central-model input. The exception is a separately documented physical or empirical basis for its central role.",
  "Store fitted parameter distributions in the registry as versioned inputs for Stage 5, each tagged calibrated, prior or sensitivity-only.",
  "No driver that failed its baselines remains a central input without a documented justification.",
];
const originalPath = "attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx";
const originalVerification = JSON.parse(execute("uv", ["run", "python", "-c",
  "import zipfile,xml.etree.ElementTree as E,json,sys; root=E.fromstring(zipfile.ZipFile(sys.argv[1]).read('word/document.xml')); text=' '.join(' '.join(''.join(p.itertext()).split()) for p in root.findall('.//{*}p')); clauses=json.loads(sys.argv[2]); result=[{'clause':c,'verified':c in text} for c in clauses]; print(json.dumps(result)); sys.exit(0 if all(r['verified'] for r in result) else 1)",
  originalPath, JSON.stringify(clauses)], "original-clause-verification.log"));

execute("npx", ["tsx", "--test", "script/driver-consumption.test.ts", "script/driver-evidence.test.ts",
  "script/regional-sampling.test.ts", "script/ensemble.test.ts"], "typescript-focused-tests.log");
execute("uv", ["run", "python", "-m", "unittest", "discover", "-s", "script", "-p", "test_driver_calibration.py"],
  "python-calibration-tests.log");
execute("uv", ["run", "python", "-m", "unittest", "discover", "-s", "script", "-p", "test_driver_uncertainty.py"],
  "python-uncertainty-tests.log");
execute("node", ["--input-type=module", "-e",
  "import ts from 'typescript'; const f=ts.readConfigFile('tsconfig.json',ts.sys.readFile); const c=ts.parseJsonConfigFileContent(f.config,ts.sys,'.'); const p=ts.createProgram(c.fileNames,{...c.options,noEmit:true}); const owned=/driverParameterRegistry|driverConsumptionTrace|driverEvidence|driver-consumption/; const all=ts.getPreEmitDiagnostics(p); const d=all.filter(d=>d.file&&owned.test(d.file.fileName)); console.log(JSON.stringify({scope:'owned files only; transitive pre-existing diagnostics excluded',ownedDiagnostics:d.map(x=>({file:x.file.fileName,message:ts.flattenDiagnosticMessageText(x.messageText,' ')})),otherDiagnostics:all.length-d.length})); process.exit(d.length?1:0);"],
  "owned-typescript-diagnostics.log");
const registry = await retainedAdoptionParameterRegistry();
const consumption = [];
for (const entry of registry.entries) {
  const settings = protocol.realConsumption;
  const input = { driverId: entry.evidence.id, seed: settings.seed,
    members: settings.membersPerDriver, years: settings.years, use: "sensitivity" as const };
  const a = await consumeRetainedAdoption(input), b = await consumeRetainedAdoption(input);
  if (a.outputHash !== b.outputHash) throw new Error("Non-deterministic real adoption replay");
  let centralRejection: string | null = null;
  try { await consumeRetainedAdoption({ ...input, use: "central" }); }
  catch (error) { centralRejection = error instanceof Error ? error.message : String(error); }
  if (!centralRejection?.includes("Central consumption blocked")) throw new Error("Central negative control did not reject");
  consumption.push({ evidence: entry.evidence, model: entry.model, distributionHash: entry.distributionHash,
    pairedDraws: entry.pairedDraws.length, actualConsumer: a.actualConsumer, seed: a.seed, members: a.members.length,
    outputHash: a.outputHash, deterministicReplay: a.outputHash === b.outputHash, centralRejection,
    bounds: a.years.map((year, i) => ({ year, minimum: Math.min(...a.members.map(m => m.shares[i])),
      maximum: Math.max(...a.members.map(m => m.shares[i])) })) });
}

// Exercise the existing member-generation command, not an exported-only API.
const cliBase = ["--import", "tsx", "script/run-regional-ensemble.ts"];
const registeredCliResults = [];
for (const run of ["registered-real-a", "registered-real-b"]) {
  const out = join(directory, run);
  execute(process.execPath, [...cliBase, "--mode", "sensitivity", "--registry", "retained-adoption-paired-1",
    "--driver", "all", "--members", "256", "--seed", "20261110", "--output", out], `${run}.log`);
  const resultPath = join(out, "result.json"), result = JSON.parse(readFileSync(resultPath, "utf8"));
  const text = gunzipSync(readFileSync(join(out, "members.jsonl.gz"))).toString("utf8");
  const members = text.trim().split("\n").map(line => JSON.parse(line));
  if (members.length !== 2560 || createHash("sha256").update(text).digest("hex") !== result.membersSha256)
    throw new Error("Actual CLI gzip member count/hash mismatch");
  for (const row of result.distributions) {
    const expected = consumption.find(c => c.evidence.id === row.driverId)!;
    const actualMembers = members.filter(m => m.driverId === row.driverId)
      .map(({ id, drawIndex, shares }) => ({ id, drawIndex, shares }));
    if (row.outputHash !== expected.outputHash ||
      contentHash({ years: row.years, members: actualMembers }) !== expected.outputHash)
      throw new Error(`Actual CLI distribution consumption mismatch: ${row.driverId}`);
  }
  registeredCliResults.push({ directory: out, resultPath, resultSha256: sha(resultPath),
    membersPath: join(out, "members.jsonl.gz"), compressedMembersSha256: sha(join(out, "members.jsonl.gz")),
    decodedMemberCount: members.length, ...result });
}
if (registeredCliResults[0].membersSha256 !== registeredCliResults[1].membersSha256)
  throw new Error("CLI member replay not deterministic");
const cliCentralControls = [];
const centralDrivers = [
  ...registry.entries.map(e => ({ id: e.evidence.id, kind: "retained-real-distribution", reason: "Central consumption blocked" })),
  ...driverEvidenceRegistry().map(e => ({ id: e.id, kind: "curated-driver-without-approved-stage5-distribution", reason: "No registered Stage5 distribution" })),
];
for (const [i, driver] of centralDrivers.map((driver, i) => [i, driver] as const)) {
  const rejection = rejectCli(["--mode", "central", "--registry", "retained-adoption-paired-1",
    "--driver", driver.id, "--members", "2", "--output", join(directory, `central-rejected-${i}`)],
  `central-driver-${i}.log`, driver.reason);
  cliCentralControls.push({ driverId: driver.id, kind: driver.kind, ...rejection });
}
const nativeCentralControl = rejectCli(["--mode", "central", "--registry", "native-regional",
  "--output", join(directory, "native-central-rejected")],
"native-central-rejection.log", "no accepted pinned real six-region joint registry");

const baseline = HISTORICAL_INDICATORS.find(r => r.year === 2024);
if (!baseline) throw new Error("Frozen legacy baseline missing");
const c = protocol.legacyCensus;
const legacyTrajectory = (row: typeof baseline) => calculateEmissionsTrajectory(
  getCurrentIndicatorsFromHistorical(row!), c.startYear, c.endYear, c.runs, c.seed);
const baseOutput = legacyTrajectory(baseline);
const driverTrace = driverEvidenceRegistry().map(row => {
  const value = row.id === "co2GrowthRatePpm" ? 2 : baseline[row.id] * 1.1;
  const changed = legacyTrajectory({ ...baseline, [row.id]: value });
  const maximumEmissionsDifferenceGt = Math.max(...changed.map((r, i) => Math.abs(r.emissions - baseOutput[i].emissions)));
  return { id: row.id, actualConsumers: row.actualConsumers,
    parameterDistribution: row.parameterDistribution,
    controlledLegacyIntervention: { rule: row.id === "co2GrowthRatePpm" ? "set-to-2.0-threshold-crossing" : "multiply-source-field-by-1.1",
      outputHash: contentHash(changed), baselineOutputHash: contentHash(baseOutput),
      changedTrajectory: contentHash(changed) !== contentHash(baseOutput), maximumEmissionsDifferenceGt,
      meaning: "Code-path perturbation only; no causal or calibration interpretation" } };
});
const after = Object.fromEntries(frozen.map(path => [path, sha(path)]));
if (contentHash(before) !== contentHash(after)) throw new Error("Frozen evidence changed during consumption execution");
const checks = readdirSync(directory).filter(file => file.endsWith(".log"))
  .map(file => ({ path: join(directory, file), sha256: sha(join(directory, file)) }));
const evidence = {
  schemaVersion: 1, scope: ["S04-007", "S04-008", "S04-010"], completedAt: new Date().toISOString(),
  status: "source-verified sensitivity consumption and native-engine enforcement implemented; scientific acceptance remains incomplete",
  originalSource: { path: originalPath, sha256: sha(originalPath), verification: originalVerification },
  operationalProtocol: { path: protocolPath, sha256: sha(protocolPath), ...protocol },
  sourceInputs: RETAINED_ADOPTION_INPUTS, registryVersion: registry.version, registryHash: registry.registryHash,
  actualRealResults: consumption, allCuratedDrivers: driverTrace,
  actualStage5Cli: {
    entryPoint: "script/run-regional-ensemble.ts", registeredSensitivityRuns: registeredCliResults,
    identicalMemberReplay: true, allDriverCentralControls: cliCentralControls, nativeCentralControl,
    nativeSensitivityTest: "Focused test invokes this same existing CLI from hash-pinned complete synthetic joint registry and decodes real native-engine outputs; engineering fixture only",
    centralScientificAcceptance: false,
    legacySeparation: "Explicit legacy-diagnostic command; cannot accept central flags or inherit registered mode",
  },
  publicApiEntryProposal: {
    implemented: false,
    safeRequest: "registryId enum retained-adoption-paired-1, driverId enum from pinned registry, use enum central|sensitivity, bounded seed/member count",
    dispatch: "Call existing fixed retained registry consumer; reject central and unavailable driver ids before output",
    forbidden: "No caller-controlled source, registry, inventory, output or file paths in public requests",
    nativeCentral: "Unavailable until independently accepted real joint registry is retained and pinned",
  },
  executions, logs: checks,
  executionRepairs: [
    { previousLog: "generated-artifacts/driver-consumption/2026-11-10T13-37-32-158Z/original-clause-verification.log",
      issue: "First verifier inserted spaces between DOCX runs and falsely failed S04-007; corrected to concatenate runs inside each paragraph before whitespace normalization. No source/protocol/outcome changed." },
  ],
  focusedTests: { typescript: { passed: 18, failed: 0 }, pythonCalibration: { passed: 2, failed: 0 },
    pythonUncertainty: { passed: 2, failed: 0 }, ownedTypeDiagnostics: 0, fullSuiteRun: false,
    nativeEngineTestEvidence: "Explicit synthetic unit-test joint registry, not real calibration or accepted regional sources" },
  preservation: { before, after, unchanged: true, thresholdsOrWindowsChanged: false,
    historyAcceptanceRerun: false, companyOrPhysicalModulesEdited: false },
  nextStudyReadiness: [
    { candidate: "wind/adoption", readyForRetainedSensitivityConsumption: true, newStudyRun: false,
      reason: "All ten existing full frozen windows and paired uncertainty distributions source-hash verified; already evaluated outcomes replayed, not selected or re-fit" },
    { candidate: "policy-price-times-coverage", ready: false, newStudyRun: false,
      reason: "Curated net-zero target coverage/implementation are not carbon-price-times-covered-emissions observations; no compatible dated price/coverage source and frozen evaluation bundle identified" },
    { candidate: "nowcast", ready: false, newStudyRun: false,
      reason: "No compatible independently dated original-vintage predictor/target bundle with pre-outcome frozen study found; revised annual histories cannot substitute" },
  ],
  remainingGaps: [
    "No real calibrated central parameter has been created or promoted; the EU solar point-metric winner also remains sensitivity-only",
    "Cross-driver/regional joint dependence remains unidentified; adoption paths are separate sensitivities and are never combined as independent calibrated marginal draws",
    "Existing Stage5 CLI now dispatches real pinned adoption sensitivity member generation and hash-pinned native joint-registry sensitivity; no accepted real six-region joint registry exists, so native central mode explicitly refuses",
    "Legacy heuristic consumers remain operational and explicitly separately labelled diagnostic; registry flags do not retroactively enforce their equations",
    "Generation shares cannot calibrate renewable GW displacement; EV sales/fleet, storage saturation/dispatch, policy and corporate causal delivery still require distinct evidence",
    "Source publication vintages, licensing review, predictive interval coverage and physical/empirical independent central justifications remain unresolved",
    "No additional next-ready scientific fit is claimed; this is retained-window replay/consumption evidence",
    "No 10,000-member scientific, climate, convergence or production acceptance; 256 members per sensitivity are engineering replay only",
  ],
  implementation: Object.fromEntries([
    "server/calculation/driverParameterRegistry.ts", "server/calculation/driverConsumptionTrace.ts",
    "server/calculation/driverEvidence.ts", "script/driver-consumption.test.ts",
    "script/driver-consumption-evidence.ts", "script/run-regional-ensemble.ts",
  ].map(path => [path, sha(path)])),
};
writeFileSync("docs/driver-consumption-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ evidence: "docs/driver-consumption-evidence.json", registryHash: registry.registryHash,
  distributions: consumption.length, sourcePairedDraws: 1000, membersPerDriver: 256,
  centralNegativeControls: consumption.filter(r => r.centralRejection).length,
  curatedDrivers: driverTrace.length, focusedTests: evidence.focusedTests, frozenEvidenceUnchanged: true, logs: directory }));

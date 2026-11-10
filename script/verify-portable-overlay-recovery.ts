/** Private, local-ABI executable recovery. Never writes DB rows or installs packages. */
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync, chmodSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

if (process.env.NODE_ENV !== "development") throw new Error("Requires explicit NODE_ENV=development");
const root = resolve("generated-artifacts/portable-overlay-recovery");
mkdirSync(root, { recursive: true, mode: 0o700 });
const resumed = process.argv[2] === "--resume" ? resolve(process.argv[3] || "") : undefined;
if (resumed && !resumed.startsWith(root + "/recovery-")) throw new Error("Invalid private recovery directory");
const stage = resumed ?? mkdtempSync(join(root, "recovery-"));
const files: Record<string, string> = {};
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
function copy(file: string) {
  const target = join(stage, file);
  mkdirSync(join(target, ".."), { recursive: true, mode: 0o700 });
  copyFileSync(file, target);
  chmodSync(target, 0o600);
  files[file] = hash(target);
}
// Match the material source archive allowlist; no env, uploads or private source fixtures.
function walk(directory: string) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(ts|json|csv)$/.test(file)) copy(file);
  }
}
const env = { PATH: "/usr/bin:/bin", HOME: stage, NODE_ENV: "development",
  DATABASE_URL: "", DATA_SCHEDULER_ENABLED: "false" };
// The original harness supplies the actual nine calculators and XLSX readback assertions.
const capture = resumed ? readFileSync(join(stage, "capture.log"), "utf8") : execFileSync(process.execPath, ["--import", "tsx", "script/verify-overlay-replay.ts"],
  { env: process.env, timeout: 300000, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
writeFileSync(join(root, "capture.log"), capture, { mode: 0o600 });
const report = capture.trim().split("\n").map(line => {
  try { return JSON.parse(line); } catch { return null; }
}).find(value => value?.file);
assert.ok(report?.file, "Capture report absent");
if (!resumed) {
writeFileSync(join(stage, "capture.log"), capture, { mode: 0o600 });
for (const directory of ["server", "shared", "client/src"]) walk(directory);
for (const file of ["package.json", "package-lock.json", "tsconfig.json"]) copy(file);
copyFileSync(report.file, join(stage, "inputs.json"));
files["inputs.json"] = hash(join(stage, "inputs.json"));
copyFileSync(process.execPath, join(stage, "node"));
chmodSync(join(stage, "node"), 0o700);
files.node = hash(join(stage, "node"));
await build({ entryPoints: ["script/verify-overlay-replay.ts"], outfile: join(stage, "worker.cjs"),
  bundle: true, platform: "node", format: "cjs", target: `node${process.versions.node.split(".")[0]}`,
  external: ["pg-native"], logLevel: "silent" });
files["worker.cjs"] = hash(join(stage, "worker.cjs"));
// Standalone verifier uses only bundled Node builtins, not checkout imports or node_modules.
const verifier = `
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const m=JSON.parse(readFileSync('manifest.json','utf8'));
if(m.version!==1||m.node!==process.version||m.platform!==process.platform||m.arch!==process.arch)
 throw Error('Recovery version/runtime mismatch');
for(const required of ['node','worker.cjs','inputs.json','package-lock.json'])
 if(!m.files[required]) throw Error('Missing required recovery dependency');
for(const [file,expected] of Object.entries(m.files)) {
 if(file.startsWith('/')||file.split('/').includes('..')||!lstatSync(file).isFile())
  throw Error('Invalid recovery file');
 if(createHash('sha256').update(readFileSync(file)).digest('hex')!==expected)
  throw Error('Corrupt recovery dependency: '+file);
}
if(process.argv.includes('--verify-only')) process.exit(0);
const r=spawnSync('./node',['worker.cjs','--worker','inputs.json','result.json'],
 {env:process.env,stdio:'inherit'});
if(r.error) throw r.error;
process.exit(r.status??1);
`;
writeFileSync(join(stage, "recover.mjs"), verifier, { mode: 0o600 });
const manifest = { version: 1, node: process.version, platform: process.platform, arch: process.arch, files };
writeFileSync(join(stage, "manifest.json"), JSON.stringify(manifest), { mode: 0o600 });
}
const manifest = JSON.parse(readFileSync(join(stage, "manifest.json"), "utf8"));
Object.assign(files, manifest.files);
function run(args: string[] = ["recover.mjs"]) {
  return spawnSync(join(stage, "node"), args, { cwd: stage, env, encoding: "utf8", timeout: 300000,
    maxBuffer: 16 * 1024 * 1024 });
}
const restored = run();
writeFileSync(join(root, "recovery.log"), restored.stdout + restored.stderr, { mode: 0o600 });
assert.equal(restored.status, 0, restored.stderr);
const actual = JSON.parse(readFileSync(join(stage, "result.json"), "utf8"));
assert.equal(actual.resultHash, report.resultHash);
assert.equal(actual.xlsxRoundtrip, true);
const originalManifest = JSON.stringify(manifest);
writeFileSync(join(stage, "manifest.json"), JSON.stringify({ ...manifest, version: 999 }));
assert.notEqual(run(["recover.mjs", "--verify-only"]).status, 0);
writeFileSync(join(stage, "manifest.json"), originalManifest);
const input = readFileSync(join(stage, "inputs.json"));
writeFileSync(join(stage, "inputs.json"), "corrupt");
assert.notEqual(run(["recover.mjs", "--verify-only"]).status, 0);
writeFileSync(join(stage, "inputs.json"), input);
writeFileSync(join(stage, "manifest.json"), JSON.stringify({ ...manifest, files: { ...files, "missing.json": "0".repeat(64) } }));
assert.notEqual(run(["recover.mjs", "--verify-only"]).status, 0);
writeFileSync(join(stage, "manifest.json"), originalManifest);
// Namespace creation requires host permission; an unavailable primitive is not evidence of denial.
const network = spawnSync("unshare", ["--user", "--map-root-user", "--net", join(stage, "node"), "recover.mjs"],
  { cwd: stage, env, encoding: "utf8", timeout: 300000, maxBuffer: 16 * 1024 * 1024 });
writeFileSync(join(root, "network-denial.log"), String(network.stdout ?? "") + String(network.stderr ?? "") +
  String(network.error ?? ""), { mode: 0o600 });
const probe = spawnSync("unshare", ["--user", "--map-root-user", "--net", join(stage, "node"), "-e",
  "const s=require('node:net').connect(443,'1.1.1.1');s.on('connect',()=>process.exit(1));s.on('error',e=>{console.log(e.code);process.exit(e.code==='ENETUNREACH'?0:2)});setTimeout(()=>process.exit(3),5000)"],
  { cwd: stage, env, encoding: "utf8", timeout: 10000 });
writeFileSync(join(root, "network-probe.log"), String(probe.stdout ?? "") + String(probe.stderr ?? "") +
  String(probe.error ?? ""), { mode: 0o600 });
const networkDenied = network.status === 0 && probe.status === 0;
if (networkDenied) assert.deepEqual(JSON.parse(readFileSync(join(stage, "result.json"), "utf8")), actual);
const summary = { stage, allNineAndXlsxMatch: true, missingRejected: true, corruptRejected: true,
  sourceArchive: report.sourceArchive, workbookId: report.workbookId,
  inputSha256: files["inputs.json"], resultHash: actual.resultHash, exportHash: actual.exportHash,
  companyCount: report.companyCount, rowCount: report.rowCount, overlays: report.overlays,
  actualPaths: report.actualPaths, freshWorkerElapsedMs: report.workerElapsedMs,
  nonemptyTargets: !report.emptyTargetPaths?.includes("/decarb-bands") &&
    !report.emptyTargetPaths?.includes("/decarb-terciles"),
  versionRejected: true, noCheckoutOrNodeModulesResolution: true, networkDenied,
  limits: ["Private synthetic engineering inputs; not scientific acceptance.",
    "Bundled dependencies and copied exact Node executable; requires compatible host OS/ABI/shared libraries.",
    "Manifest integrity checks are not a signed provenance/authenticity guarantee.",
    ...(networkDenied ? [] : ["Enforced network-denial guarantee UNPROVEN: host unshare unavailable or denied."])] };
writeFileSync(join(root, "report.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
console.log(JSON.stringify(summary));

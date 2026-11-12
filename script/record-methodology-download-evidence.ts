import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { methodologyDownloadCensus } from "./methodology-download-census";
import { methodologyRegistry } from "../shared/methodologyRegistry";

const tests = [
  "script/methodology-download.test.ts", "script/methodology-download-portable.test.ts",
  "script/methodology-track-b-download.test.ts", "script/methodology-workbook-money-download.test.ts",
  "script/export-contract.test.ts", "script/export-identity.test.ts",
  "script/supplemental-sheet-bindings.test.ts", "script/finite-export-schemas.test.ts",
  "script/warming-validation-reference.test.ts", "script/component-state-census.test.ts",
  "script/company-conditional-api.test.ts", "script/stage10-retained-coverage.test.ts",
  "script/workbook-money-api.test.ts", "script/track-b-admission.test.ts",
  "script/scientific-strands-warning.test.ts", "script/quantity-label-contracts.test.ts",
  "script/ui-claims.test.ts",
];
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function execute(command: string, args: string[]) {
  const startedAt = new Date().toISOString();
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 180_000, maxBuffer: 8_000_000, env });
  const output = result.stdout + result.stderr;
  const count = (name: string) => {
    const matches = [...output.matchAll(new RegExp(`^# ${name} (\\d+)`, "gm"))];
    return matches.length ? Number(matches.at(-1)![1]) : null;
  };
  if (result.status !== 0) console.error(output);
  return { command: [command, ...args], startedAt, finishedAt: new Date().toISOString(),
    exitCode: result.status, outputSha256: hash(output),
    counts: { tests: count("tests"), pass: count("pass"), fail: count("fail"), skipped: count("skipped") },
    tests: [...output.matchAll(/^ok \d+ - (.+)$/gm)].map(match => match[1]) };
}
const typecheck = execute("npm", ["run", "check"]);
const focused = execute("npx", ["tsx", "--test", "--test-reporter=tap", ...tests]);
const census = methodologyDownloadCensus(), registry = methodologyRegistry();
const sharedHashes = Object.fromEntries(readdirSync("shared").filter(path => path.endsWith(".ts")).sort()
  .map(path => [`shared/${path}`, hash(readFileSync(`shared/${path}`))]));
const testHashes = Object.fromEntries([...tests, "script/methodology-download-census.ts",
  "script/component-state-contracts.ts", "script/residual-label-scan.ts", "script/record-methodology-download-evidence.ts"]
  .map(path => [path, hash(readFileSync(path))]));
const report = {
  version: "methodology-download-increment-evidence-v1",
  originalRequirement: { id: "S16-007", text: "Generate methodology pages from the registries; attach the manifest and claim label to every download.",
    source: "docs/workplan_completion_ledger.json", sourceReadOnly: true },
  generatedAt: new Date().toISOString(),
  boundary: "Engineering increment only; no scientific/owner acceptance, deployment, commits, callbacks, approvals or production mutation. All census input is public checked-in TypeScript/TSX; no private evidence bytes or Git object/history reads.",
  implementation: [
    { path: "shared/methodologyRegistry.ts", functions: ["methodologyRegistry"], behavior: "Returns actual core/qualified registries, exact seven claim contracts, historical classes, supplemental column bindings and three separate scientific evidence strands." },
    { path: "client/src/components/registry-methodology.tsx", functions: ["RegistryMethodology"], behavior: "Mounted in methodology.tsx outside closed legacy archive; displays exact formulas, dependencies, units, source, period, geography, status, missingness, uncertainty, scope and as-of rules from those registries." },
    { path: "server/methodologyApi.ts", functions: ["registerMethodologyApi"], behavior: "GET /api/methodology/registry, no query overrides, mounted from index.ts." },
    { path: "shared/downloadManifest.ts", functions: ["createDownloadManifest", "downloadHistoricalTypes", "downloadManifestRows"], behavior: "Exact claim, selected IDs or explicit unversioned state, data SHA256, hash method, declared historical classes, column bindings, sheet inventory and three independent scientific statuses. Historical partial/mismatched classes refuse; absent class is never promoted." },
    { path: "client/src/components/download-data-button.tsx", functions: ["DownloadDataButton", "DownloadJsonButton"], behavior: "All26 central chart/data/JSON call sites use manifest-bound writers; spreadsheet manifest is additive, underlying normalized rows/legacy column-binding logic unchanged." },
    { path: "client/src/lib/export-contract.ts", functions: ["exportNotes", "prepareQualifiedJsonExport"], behavior: "Shared claim registry re-export preserves seven exact legacy claim texts; three strand notes added. Lossless JSON envelope includes manifest and original exact data identity." },
    { path: "server/downloadManifestMiddleware.ts", functions: ["downloadManifestMiddleware"], behavior: "All successful registered attachments carry base64url JSON manifest and exact claim headers. Legacy default bodies remain unchanged. Explicit downloadMetadata=manifest-v1 embeds JSON envelope or additive XLSX sheet while retaining strict original query validation, source pins and authorization." },
    { path: "shared/serverDownloadRegistry.ts", functions: ["withDownloadManifest"], behavior: "Ten explicit HTTP attachment routes, including denied private route; all ten actual UI attachment links request embedded metadata. Existing public reference data-URI bypass replaced by qualified API link; legacy export document function unchanged." },
    { path: "script/methodology-download-census.ts", functions: ["methodologyDownloadCensus"], behavior: "Public-source AST census of central buttons, direct links, attachment declarations, custom XLSX/ExcelJS sheets and browser writers; no Git/history dependency." },
  ],
  counts: { centralDownloadSites: census.centralSites.length, directAttachmentLinks: census.downloadLinks.length,
    attachmentDeclarations: census.attachmentSites.length, attachmentRoutes: census.serverDownloads.flatMap(entry => entry.paths).length,
    deniedPrivateRoutes: census.serverDownloads.filter(entry => entry.availability === "http-denied-403").length,
    browserWriters: census.writers.length, worksheetConstructionSites: census.workbookSheets.length,
    coreDefinitions: registry.coreFields.length, qualifiedDefinitions: registry.outputFields.length,
    historicalTypes: Object.keys(registry.historicalTypes).length, claimContracts: Object.keys(registry.downloadClaims).length },
  executions: [typecheck, focused],
  portableEvidence: "methodology-download-portable.test.ts copies complete client/src, server and shared public source plus the focused test/census into a temporary directory with no .git/docs/generated-artifacts/attached_assets/.local/exports; dependency packages only are symlinked. Child executes all6 focused tests with GIT_DIR pointing to a nonexistent path. No Git CLI dependency or shallow-history requirement.",
  inspectedSourceSha256: { ...census.sourceHashes, ...sharedHashes, ...testHashes },
  registryJsonSha256: hash(JSON.stringify(registry)),
  census: { ...census, sourceHashes: undefined },
  priorObservedFailures: [
    "Initial focused implementation caught a Map iteration target mismatch and incorrect census/readback fixture assumptions; repaired without changing application TS target or legacy null serialization.",
    "Public-source child initially inherited NODE_TEST_CONTEXT and returned no test counts; now removed explicitly, and6 passing child tests are required.",
    "Exact native-claim label scanner exception was moved with its unchanged literal from client export-contract to shared/downloadClaims; no broad whitelist added.",
    "Initial broader output-field-semantics regression was blocked by stale canonical docs/field_semantics_census.json under the initial no-regeneration instruction. Parent subsequently authorized final regeneration; finalIntegration records the final census and coherent full-suite outcome without weakening a gate.",
  ],
  residuals: [
    "No canonical ledgers, canonical field census or scientific acceptance status were promoted. The original opaque-summary gap remains unresolved.",
    "Transport readback covers the actual public reference/carbon review/conditional APIs plus isolated engineering-only retained Stage10/TrackB/monetary reader fixtures. Genuine production TrackB catalog/rights and private source availability are not invented.",
    "Ten routes include the private review export that remains HTTP403. It is inventoried, not made publicly downloadable.",
    "Manifests record declared historical classes only; absent class is explicitly undeclared. No original-vintage forecast eligibility is inferred from labels or hashes.",
    "AST census and isolated tests are not a browser click-through of every dataset-dependent chart or an immutable full analysis archive.",
    "Preview screenshot showed the public methodology page and registry section without a manifestly broken layout; one existing preview resource500 was reported. Main agent must verify newly mounted server routes after its own workflow refresh; this unit did not run/restart a workflow.",
  ],
};
writeFileSync("docs/methodology-download-increment-evidence.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ report: "docs/methodology-download-increment-evidence.json", counts: report.counts, executions: report.executions }));
if (typecheck.exitCode !== 0 || focused.exitCode !== 0) process.exitCode = 1;

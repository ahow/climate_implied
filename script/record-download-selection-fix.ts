import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { methodologyDownloadCensus } from "./methodology-download-census";

/** Append public-safe corrective evidence; preserve all earlier execution and
 * failure history. No canonical-ledger, private-source, Git or release writes. */
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const evidencePath = "docs/methodology-download-increment-evidence.json", evidence = read(evidencePath);
const final = read("/tmp/methodology-selection-final-receipt.json");
const failed = read("/tmp/methodology-selection-attempt1-receipt.json");
const census = methodologyDownloadCensus();
const before = read("/tmp/methodology-selection-census-before.json");
const after = read("docs/field_semantics_census.json");
assert.equal(final.exit_code, 0);
assert.deepEqual(final.suite_counts.typescript, { tests: 955, pass: 955, fail: 0, skipped: 0 });
assert.deepEqual(final.suite_counts.python, { tests: 217, pass: 217, fail: 0, skipped: 0 });
assert.equal(sha(final.log), final.log_sha256);
assert.equal(sha("/tmp/methodology-selection-attempt1.log"), failed.log_sha256);
assert.equal(census.centralSites.length, 26);
assert.equal(after.originalGapReconciliation.originalFullyBoundFields, 1000);
assert.equal(after.originalGapReconciliation.originalPublicSlots, 1001);
assert.equal(after.completion, false);
const protectedCanonical = readFileSync("/tmp/methodology-selection-ledgers-before.sha256", "utf8").trim().split("\n").map(line => {
  const [, hash, path] = /^([a-f0-9]{64})\s+(.+)$/.exec(line)!;
  assert.equal(sha(path), hash);
  return { path, sha256: hash, unchanged: true };
});
const paths = [
  "client/src/lib/download-selection.ts", "client/src/lib/export-identity.ts", "client/src/lib/export-contract.ts",
  "client/src/components/download-data-button.tsx", "shared/downloadManifest.ts",
  "server/downloadManifestMiddleware.ts", "client/src/components/registry-methodology.tsx",
  "script/download-selection-race.test.ts", "script/methodology-download-portable.test.ts",
  "script/remaining-component-contracts.test.ts", "script/component-state-contracts.ts",
  "script/record-download-selection-fix.ts", "docs/field_semantics_census.json", "docs/System_Output_Register.md",
];
const previousHashes = new Map<string, string>([
  ...Object.entries(evidence.inspectedSourceSha256) as [string, string][],
  ...evidence.finalIntegration.preciseChangedPaths.filter((file: { sha256: string | null }) => file.sha256)
    .map((file: { path: string; sha256: string }) => [file.path, file.sha256] as [string, string]),
]);
const pathReceipts = paths.map(path => ({ path, beforeSha256: previousHashes.get(path) ?? null,
  afterSha256: sha(path), changed: previousHashes.get(path) !== sha(path) }));
const oldTestNames = readFileSync("/tmp/methodology-selection-focused-final.log", "utf8");
evidence.selectionRaceCorrection = {
  generatedAt: new Date().toISOString(),
  parentReviewFinding: "DownloadDataButton read currentSelection after awaiting SHA256, allowing old rows to be labelled with a newly selected UI state. UI selection was also presented too much like producer provenance.",
  reviewFindingEvidenceBoundary: "Parent source review; no fabricated pre-fix failing test or retrospective red-run receipt claimed.",
  actualFunctions: [
    { path: "client/src/lib/download-selection.ts", functions: ["captureDownloadSelection", "requireUnchangedDownloadSelection"],
      behavior: "Deep-copy parsed requested UI selection before the first click-handler await. Compare current parsed UI selection before delivery; changed, removed, newly selected, reordered or malformed selection refuses instead of substituting current inputs." },
    { path: "client/src/components/download-data-button.tsx", functions: ["DownloadDataButton.handleClick", "DownloadJsonButton.download"],
      behavior: "Capture at click; deep-copy lazy/supplied rows, notes, bindings and JSON payload before asynchronous work. XLSX compares before writeFile; JSON compares before URL allocation and immediately before anchor click, revoking any allocated URL on refusal." },
    { path: "client/src/lib/export-contract.ts", functions: ["exportNotes", "prepareQualifiedJsonExport"],
      behavior: "Snapshot passed explicitly through notes and JSON hashing/envelope preparation; no post-await currentSelection read. Notes say requested UI selection, not producer provenance. JSON hashes and delivers the same deep-copied data." },
    { path: "shared/downloadManifest.ts", functions: ["createDownloadManifest"],
      behavior: "requestedUiSelection explicitly identifies UI request state only. producerIdentity is null, not an inferred input/model/run identity. Missing UI state stays null with no certified-current-input fallback." },
    { path: "server/downloadManifestMiddleware.ts", functions: ["downloadManifestMiddleware"],
      behavior: "Server attachments put query/response pins under requestContext, not requestedUiSelection. No complete authenticated producer input/model/run binding is asserted; producerIdentity remains null. Default API body bytes still unchanged." },
  ],
  actualAsyncTests: {
    path: "script/download-selection-race.test.ts", count: 5,
    method: "Extract and execute checked-in click/preparer bodies, with genuine production capture/compare/hash/manifest/notes/semantics code. Deferred package/digest boundaries and final browser delivery are instrumented; no rewritten handler replica.",
    assertions: [
      "Real XLSX handler deep-copies lazy rows, interpretation notes and bindings before deferred import; readback retains original zero/date/value and exact old binding/note despite mutation of caller objects.",
      "Real XLSX handler refuses five changed-state variants while SHA preparation is pending and never invokes writeFile.",
      "Real JSON handler/preparer deep-copy nested payload before deferred digest; exact payload SHA256 still agrees after caller mutates the original object.",
      "JSON changed UI state during digest prevents URL allocation and anchor delivery.",
      "JSON final pre-click recheck refuses an intervening selection change and revokes its allocated URL.",
      "Actual manifests expose requestedUiSelection and producerIdentity:null; interpretation explicitly rejects certified input/model/run identity.",
    ],
    focusedLog: "/tmp/methodology-selection-focused-final.log",
    focusedLogSha256: sha("/tmp/methodology-selection-focused-final.log"),
    focusedCounts: { tests: Number(/# tests (\d+)/.exec(oldTestNames)![1]), pass: Number(/# pass (\d+)/.exec(oldTestNames)![1]),
      fail: Number(/# fail (\d+)/.exec(oldTestNames)![1]), skipped: Number(/# skipped (\d+)/.exec(oldTestNames)![1]) },
  },
  publicPortableTest: {
    path: "script/methodology-download-portable.test.ts",
    outcome: "Passed in the coherent full TS run; copies full public client/src,server,shared plus methodology and async race tests into a temp directory with no Git/private/docs/generated evidence. All11 child tests required to pass; dependencies only symlinked.",
  },
  execution: final,
  receiptPath: "/tmp/methodology-selection-final-receipt.json", receiptSha256: sha("/tmp/methodology-selection-final-receipt.json"),
  failedChecks: [
    { ...failed, originalReceiptLogPath: failed.log, log: "/tmp/methodology-selection-attempt1.log",
      receiptPath: "/tmp/methodology-selection-attempt1-receipt.json",
      correction: "954/955 passed; frozen next-valuation-evidence source assertion required original additive-note spread. Snapshot now deep-clones [...interpretationNotes] before awaiting and still appends captured notes. Frozen test/protocol/guard files and hashes were not edited or repinned. Final coherent955/955 then passed." },
    { command: "npx tsx script/field-semantics-census.ts --check",
      outcome: "Failed after actual writer source lines changed; subsequent authorized regeneration and full-suite stale-census checks passed. Slot/definition/bound counts did not change.",
      executionTime: null, boundary: "Observed focused command failure; no invented timestamp, log hash or separate runner receipt." },
    { outcome: "Initial legacy handler-extraction checks passed via missing capture helper ReferenceError rather than reaching their intended lazy-row/validation branches.",
      correction: "Injected the genuine new capture/compare dependencies into those existing extracted-handler tests. New actual async tests verify the real branches and delivery outcomes, not generic catch success." },
  ],
  changedPaths: pathReceipts.filter(file => file.changed),
  reviewedUnchangedGeneratedPaths: pathReceipts.filter(file => !file.changed),
  protectedCanonical,
  census: {
    beforeSha256: sha("/tmp/methodology-selection-census-before.json"), afterSha256: sha("docs/field_semantics_census.json"),
    before: { definitions: before.definitions, typedSlots: before.fields.length, bound: before.fullyBoundFields },
    after: { definitions: after.definitions, typedSlots: after.fields.length, bound: after.fullyBoundFields },
    original: { bound: 1000, total: 1001, remaining: 1, completion: false },
    centralDownloadSites: census.centralSites.length, directLinks: census.downloadLinks.length,
    browserWriters: census.writers.length,
    boundary: "Only source-located metadata inventory regenerated. No denominator/gate/old opaque-summary closure changes.",
  },
  exactRemainingProducerBindingGap: [
    "Capture/compare prevents late UI-state substitution, but does NOT establish that supplied rows/payload already belonged to that UI selection at click time.",
    "No producer-asserted, authenticated complete input-revision/model-version/run manifest is attached to these view exports. producerIdentity remains null on every generated download manifest; source/request/response pins are not silently upgraded into that identity.",
    "The data hash identifies captured exported rows or original response bytes, not scientific acceptance, original vintage, approved inputs or a model/run identity.",
    "Comparison checks current requested UI selection at delivery, not a complete selection-transition history. It is not a proof of cache/response provenance or an original-vintage replay.",
    "No certified-current-input fallback is assigned when requestedUiSelection is null. Completing source/producer identity binding remains separate implementation work.",
  ],
  boundaries: "All26 central paths retained; legacy default API bodies/goldens, private source bytes, mandatory monetary/issuer guard hashes, scientific/auth/strict completeness gates preserved. No commit, CI cancellation, deployment or callback performed; parent owns release.",
};
evidence.latestVerifiedExecution = {
  correction: "selectionRaceCorrection", receiptPath: "/tmp/methodology-selection-final-receipt.json",
  log: final.log, logSha256: final.log_sha256, suiteCounts: final.suite_counts, exitCode: final.exit_code,
};
writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify({ evidencePath, sha256: sha(evidencePath), execution: evidence.latestVerifiedExecution }));

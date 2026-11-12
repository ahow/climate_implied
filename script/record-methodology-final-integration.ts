import assert from "node:assert/strict";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

/** Public-safe receipt assembly only. No source/protocol/model/golden mutation,
 * private workbook read, Git/history query or canonical-ledger write. */
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const path = "docs/methodology-download-increment-evidence.json";
const report = read(path), before = read("/tmp/methodology-census-before.json");
const after = read("docs/field_semantics_census.json"), final = read("/tmp/methodology-final-receipt.json");
assert.equal(final.exit_code, 0);
assert.deepEqual(final.suite_counts.typescript, { tests: 950, pass: 950, fail: 0, skipped: 0 });
assert.deepEqual(final.suite_counts.python, { tests: 217, pass: 217, fail: 0, skipped: 0 });
assert.equal(sha(final.log), final.log_sha256);
assert.equal(after.originalGapReconciliation.originalPublicSlots, 1001);
assert.equal(after.originalGapReconciliation.originalFullyBoundFields, 1000);
assert.equal(after.originalGapReconciliation.remainingOriginalUnboundSlots, 1);
assert.equal(after.completion, false);
const protectedFiles = readFileSync("/tmp/methodology-ledgers-before.sha256", "utf8").trim().split("\n")
  .map(line => {
    const [, hash, file] = /^([a-f0-9]{64})\s+(.+)$/.exec(line)!;
    assert.equal(sha(file), hash, `${file} must remain unchanged`);
    return { path: file, sha256: hash, unchanged: true };
  });
const precisePaths = [
  "script/workplan-evidence-run.py", "script/test_workplan_evidence_receipt.py",
  "shared/scientificEvidenceSemantics.ts", "shared/evidenceFieldSemantics.ts",
  "shared/nativeOutputSemantics.ts", "shared/researchFieldSemantics.ts",
  "script/evidence-field-semantics.test.ts", "script/native-semantics.test.ts",
  "script/research-field-semantics.test.ts", "script/next-census-accounting.test.ts",
  "script/valuation-indicator-partial-state.test.ts",
  "script/track-b-admission.test.ts", "script/workbook-money-api.test.ts",
  "script/methodology-track-b-download.test.ts", "script/methodology-workbook-money-download.test.ts",
  "script/record-methodology-download-evidence.ts", "script/record-methodology-final-integration.ts",
  "docs/field_semantics_census.json", "docs/System_Output_Register.md",
];
type Slot = { surface: string; field: string };
const rawKey = (field: Slot) => JSON.stringify([field.surface, field.field]);
const logicalKey = (field: Slot) => JSON.stringify([
  field.surface.startsWith("XLSX ") ? field.surface.replace(/:\d+$/, ":<source-location>") : field.surface,
  field.field,
]);
const priorKeys = new Set(before.fields.map(logicalKey)), nextKeys = new Set(after.fields.map(logicalKey));
const addedFields = after.fields.filter((field: Slot) => !priorKeys.has(logicalKey(field)));
const removedFields = before.fields.filter((field: Slot) => !nextKeys.has(logicalKey(field)));
const priorRaw = new Set(before.fields.map(rawKey)), nextRaw = new Set(after.fields.map(rawKey));
const sourceLocationMoves = after.fields.filter((field: Slot) => !priorRaw.has(rawKey(field)) && priorKeys.has(logicalKey(field)))
  .map((field: Slot) => ({ before: before.fields.find((old: Slot) => logicalKey(old) === logicalKey(field)).surface,
    after: field.surface, field: field.field }));
assert.equal(addedFields.length, 77); assert.equal(removedFields.length, 0);
const frozenMoney = read("generated-artifacts/workbook-money-consumers-v3/frozen-before-private-integration.json");
const oldMonetary = read("generated-artifacts/workbook-money-audit-v1/frozen-before-private-validation.json");
const restored = [
  frozenMoney.code.find((file: { path: string }) => file.path === "script/track-b-admission.test.ts"),
  oldMonetary.code.find((file: { path: string }) => file.path === "script/workbook-money-api.test.ts"),
].map((file: { path: string; sha256: string }) => {
  assert.equal(sha(file.path), file.sha256);
  return { ...file, matchesExistingUnmodifiedFreeze: true };
});
const failedReceipts = ["/tmp/methodology-final-attempt1-receipt.json", "/tmp/methodology-final-attempt2-receipt.json"]
  .filter(existsSync).map(file => {
    const receipt = read(file);
    assert.notEqual(receipt.exit_code, 0);
    const archivedLogPath = file.replace(/-receipt\.json$/, ".log");
    assert.equal(sha(archivedLogPath), receipt.log_sha256);
    return { ...receipt, originalReceiptLogPath: receipt.log, log: archivedLogPath,
      receiptPath: file, receiptSha256: sha(file), logPathBoundary: "Archived failed-run log; original receipt preserved unchanged" };
  });
report.finalIntegration = {
  generatedAt: new Date().toISOString(),
  authorizationBoundary: "Parent authorized final census regeneration after workers finished. No canonical three ledger/matrix documents, protected model pins, private source bytes, scientific acceptance gates, commits, deployments or callbacks changed.",
  finalExecution: final,
  finalReceiptPath: "/tmp/methodology-final-receipt.json",
  finalReceiptSha256: sha("/tmp/methodology-final-receipt.json"),
  mandatoryPrivateChecks: [
    { command: "NODE_ENV=development npx tsx script/validate-workbook-money-integration-private.ts --private-primary",
      outcome: "passed", boundary: "Source money, exact source-day FX and approved identity remain required; original private bytes/fingerprints unchanged. Aggregate validation receipt only, no new private export." },
    { command: "NODE_ENV=development npx tsx script/validate-issuer-cashflow-private.ts",
      outcome: "passed", boundary: "Original primary-source/price/share/stub checks and retained experiments unchanged; complete approved issuer cases remain zero." },
    { command: "NODE_ENV=development npx tsx script/validate-issuer-cashflow-reconciliation-private.ts",
      outcome: "passed", boundary: "Exact retained three-issuer cashflow reconciliations and prior experiments preserved; original issuer/market qualification remains zero." },
  ],
  failedChecks: failedReceipts,
  failureCorrections: [
    { check: "Initial coherent attempt: 935/948 TS passed,13 failed; later stages not executed", correction: "Added exact fourteen-leaf independent scientific-evidence bindings at three actual producer namespaces,35 source-product proposal object leaves and the explicit absent-proposal null binding. Updated source-derived supplemental counts and manifest-bearing UI-link assertions; regenerated output register. No numeric source/formula/threshold or golden changed." },
    { check: "Next coherent attempt: all949 TS and217 Python passed; monetary integration failed its existing original guard-source hash", correction: "Restored script/track-b-admission.test.ts and script/workbook-money-api.test.ts byte-for-byte to their existing frozen guard-source hashes, rather than repinning or exempting them. New metadata assertions moved into separate isolated tests. Mandatory private preflight and final coherent execution then passed." },
    { check: "Intermediate focused census check became stale after a test-file line shift", correction: "Regenerated the source-located workbook-builder inventory after edits settled; strict completeness gates remain required failures for the original opaque summary." },
    { check: "Receipt assembly initially asserted77 raw source-located additions and observed133", correction: "Recorded the56 unchanged native XLSX columns relocated by two import lines separately:133 raw additions/56 removals, net77 genuinely added typed leaves. No census, test or source formula changed to satisfy this receipt assertion." },
  ],
  frozenTestSourcesRestored: restored,
  preciseChangedPaths: [...precisePaths.map(file => ({ path: file, sha256: sha(file) })),
    { path, sha256: null, reason: "This public-safe evidence file contains this receipt; no self-referential hash claimed." }],
  protectedCanonicalDocuments: protectedFiles,
  censusDelta: {
    beforeSha256: sha("/tmp/methodology-census-before.json"), afterSha256: sha("docs/field_semantics_census.json"),
    definitions: { before: before.definitions, after: after.definitions, delta: after.definitions - before.definitions },
    typedSlots: { before: before.fields.length, after: after.fields.length, delta: after.fields.length - before.fields.length },
    publicBound: { before: before.fullyBoundFields, after: after.fullyBoundFields, delta: after.fullyBoundFields - before.fullyBoundFields },
    currentPublic: { before: before.originalGapReconciliation.currentPublicSlots, after: after.originalGapReconciliation.currentPublicSlots },
    originalPublic: 1001, originalBound: 1000, originalRemaining: 1,
    supplementalAddedPublicSlots: after.supplementalSlotAccounting.addedPublicSlots,
    supplementalAddedBoundSlots: after.supplementalSlotAccounting.addedBoundSlots,
    expandedPublicSlots: after.supplementalSlotAccounting.expandedApiAndDownloadPublicSlots,
    expandedBoundSlots: after.supplementalSlotAccounting.expandedApiAndDownloadBoundSlots,
    newlyBoundSlots: addedFields.map((field: { surface: string; field: string }) => ({ surface: field.surface, field: field.field })),
    removedFields,
    rawSourceLocatedSlotsAdded: after.fields.filter((field: Slot) => !priorRaw.has(rawKey(field))).length,
    rawSourceLocatedSlotsRemoved: before.fields.filter((field: Slot) => !nextRaw.has(rawKey(field))).length,
    sourceLocationMoves,
    explanation: "77 new typed leaves =42 independent-status leaves (14×3 actual producers) plus35 source-product proposal leaves. 78 definitions =those77 plus explicit absent-proposal null. In addition56 unchanged native workbook columns move from source lines132/186 to134/188; source-location moves are not new logical columns or old-cohort closure. Raw identity changes are133 added/56 removed, net77.",
    unresolvedOriginal: after.unresolvedTypes, unresolvedDynamicKeys: after.unresolvedDynamicKeys,
    completion: false, strictGateBoundary: "Both --require-original-complete and --require-complete are still required to fail; full TS tests verify exact original1000/1001 and current1437/1438 rather than removing or bypassing strict gates.",
  },
  buildWarnings: [
    "Browserslist data is old; no dependency refresh or lockfile rewrite performed.",
    "Existing PostCSS from-option warning; production build succeeded.",
    "Large client chunks/server bundle warning; no warning threshold relaxed.",
  ],
  remainingBoundaries: [
    "Original opaque runs[].summary remains unknown and unresolved; hashes or new sidecars do not close it.",
    "Engineering transport/status/source-metadata tests are not scientific/owner acceptance, original-vintage skill, real issuer approval or rights grants.",
    "No release, deployed revision, callback or full browser click-through is claimed. Parent owns release and running-server refresh.",
    "Legacy default export documents/bodies and all original numerical model constants remain unchanged; only explicit metadata opt-in changes API download envelopes/sheets.",
  ],
};
writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ report: path, sha256: sha(path), finalExitCode: final.exit_code,
  tests: final.suite_counts, original: "1000/1001", censusDefinitions: after.definitions,
  censusNewTypedSlots: addedFields.length }));

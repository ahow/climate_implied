import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { scientificEvidenceStatuses, scientificEvidenceExportNotes, scientificEvidenceStrandKeys } from "../shared/scientificEvidence";
import { interimWarningSummary } from "../shared/interimWarningEvidence";
import { calculationReadiness } from "../server/calculation/readiness";
import { evaluateHoldout, promotionDecision, PROMOTION_REQUIREMENTS } from "../server/calculation/evaluation";
import { summarizeEnsemble } from "../server/calculation/ensemble";
import { projectNativeEmissions, constantScenario } from "../server/calculation/emissionsCandidate";
import { ScientificEvidenceStrands } from "../client/src/components/scientific-evidence-strands";
import { loadRetainedWarningSource } from "./fixtures/retainedWarningSource";
import warnings from "../docs/S16-013-warning-resolution-register.json";
import { exportNotes } from "../client/src/lib/export-contract";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";

(globalThis as any).React = React;
const read = (path: string) => readFileSync(path, "utf8");
const normalize = (value: string) => value.replace(/\s+/g, " ");

test("actual readiness API producer, candidate and ensemble keep all three statuses separate", () => {
  const expected = scientificEvidenceStatuses();
  const ready = calculationReadiness();
  assert.deepEqual(ready.scientificEvidence, expected);
  assert.deepEqual(projectNativeEmissions(constantScenario, 2025).scientificEvidence, expected);
  const summary = summarizeEnsemble({ baseline: "1850-1900", memberIds: ["a", "b"],
    years: [2100], temperature: [[0, 1]] });
  assert.deepEqual(JSON.parse(JSON.stringify(summary)).scientificEvidence, expected);
  assert.equal(ready.candidateEnabled, false);
  assert.ok(ready.checks.every(check => check.passed === false));
});

test("perfect submitted holdout and all engineering booleans cannot promote scientific strands", () => {
  const protocol = { frozenAt: "2019-01-01", trainingEnd: "2018-12-31", holdoutStart: "2020-01-01",
    baseline: "persistence", maxDeteriorationFraction: .1, nominalCoverage: .8, coverageTolerance: .2 };
  const rows = Array.from({ length: 5 }, (_, i) => ({
    origin: "2020-01-01", inputsAvailableThrough: "2019-12-31", targetYear: 2021 + i,
    actual: 1, candidate: 1, persistence: 2, trend: 2, lower: 0, upper: i === 4 ? .5 : 2,
    revisedHistory: false,
  }));
  const result = evaluateHoldout(protocol, rows);
  assert.equal(result.passed, true);
  assert.deepEqual(result.scientificEvidence, scientificEvidenceStatuses());
  assert.equal(result.scientificEvidence.stage9Skill.status, "not-established");
  assert.equal(promotionDecision(Object.fromEntries(PROMOTION_REQUIREMENTS.map(key => [key, true]))).canPromote, true);
  assert.equal(calculationReadiness().candidateEnabled, false, "existing gates unchanged");
  assert.deepEqual(result.scientificEvidence, scientificEvidenceStatuses(), "promotion helper cannot alter strand evidence");
});

test("actual strand UI and download note producer serialize identical separate statuses", () => {
  const evidence = calculationReadiness().scientificEvidence;
  const html = renderToStaticMarkup(React.createElement(ScientificEvidenceStrands, { evidence }));
  const notes = scientificEvidenceExportNotes();
  const actualNotes = exportNotes("native", "candidate.xlsx", "2026-01-01T00:00:00.000Z");
  const manifest = createDownloadManifest({
    filename: "candidate.xlsx", kind: "native", exportedAt: "2026-01-01T00:00:00.000Z",
    dataHash: "a".repeat(64), hashMethod: "test fixture identity, not acceptance", selection: null,
  });
  assert.deepEqual(manifest.scientificEvidence, evidence);
  const serialized = downloadManifestRows(manifest).find(row => row.Field === "scientificEvidence");
  assert.deepEqual(JSON.parse(serialized!.Value), evidence);
  assert.equal(notes.length, 3);
  for (const key of scientificEvidenceStrandKeys) {
    assert.ok(html.includes(`data-evidence-strand="${key}"`));
    assert.ok(html.includes(`data-evidence-status="${evidence[key].status}"`));
    assert.ok(notes.some(note => note.Field.endsWith(key) && note.Value.startsWith(evidence[key].status)));
    assert.ok(actualNotes.some(note => note.Field.endsWith(key) && note.Value.startsWith(evidence[key].status)));
  }
  for (const path of ["client/src/components/published-scenario-references.tsx",
    "client/src/components/emissions-candidate-review.tsx", "client/src/components/financial-review.tsx"])
    assert.ok(read(path).includes("<ScientificEvidenceStrands"), `${path} consumes the actual shared view`);
});

test("retained authenticated source scan exactly reconciles warning hosts; every removal stays linked", () => {
  const retained = loadRetainedWarningSource();
  const pattern = new RegExp(warnings.scanPattern, "i");
  const scanned = retained.original.files.filter(file => file.text.split("\n").some(line => pattern.test(line)));
  assert.deepEqual(scanned.map(file => file.path).sort(), warnings.originalHosts.map(host => host.path).sort());
  for (const host of warnings.originalHosts) {
    const original = scanned.find(file => file.path === host.path)!;
    assert.ok(normalize(original.text).includes(normalize(host.originalExcerpt)));
    for (const required of host.currentRequired)
      assert.ok(normalize(read(host.path)).includes(required), `${host.path}: ${required}`);
  }
  for (const removal of warnings.removedWarnings) {
    assert.ok(scanned.find(file => file.path === removal.path)!.text.includes(removal.originalText));
    assert.ok(!read(removal.path).includes(removal.originalText));
    assert.ok(warnings.resolutions.some(resolution => resolution.id === removal.resolution &&
      resolution.evidence.every(path => read(path).length > 0)));
  }
  assert.deepEqual(calculationReadiness().interimWarnings, interimWarningSummary());
  assert.equal(interimWarningSummary().acceptance, "existing-resolution-records-only; no-new-acceptance");
  assert.ok(interimWarningSummary().coverageLimit.includes("No original per-run"));
  assert.ok(normalize(read(warnings.additionalHistoricalSelectionWarning.path)).includes(warnings.additionalHistoricalSelectionWarning.originalText));
});

test("public evidence report identifies exact original warning lines and current required bindings", () => {
  const report = JSON.parse(read("docs/scientific-strands-warning-evidence.json"));
  const retained = loadRetainedWarningSource();
  const pattern = new RegExp(warnings.scanPattern, "i");
  for (const host of report.warningInventory) {
    const source = retained.original.files.find(file => file.path === host.path)!;
    assert.equal(host.originalSha256, source.sha256);
    assert.deepEqual(host.exactScanLines, source.text.split("\n").flatMap((text, i) =>
      pattern.test(text) ? [{ line: i + 1, text }] : []));
    assert.equal(host.currentSha256, createHash("sha256").update(read(host.path)).digest("hex"));
  }
  assert.equal(report.warningInventory.length, warnings.originalHosts.length);
  assert.equal(report.removalBindings.length, warnings.removedWarnings.length);
  assert.equal(report.scientificAcceptance, "not-promoted");
});

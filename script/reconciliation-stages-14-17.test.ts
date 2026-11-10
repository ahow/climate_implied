import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ledger = JSON.parse(readFileSync("docs/workplan_completion_ledger.json", "utf8"));
const proposal = JSON.parse(readFileSync("docs/reconciliation-stages-14-17.json", "utf8"));
const originals = ledger.stages.filter((s: { stage: number }) => s.stage >= 14 && s.stage <= 17)
  .flatMap((s: { requirements: Record<string, unknown>[] }) => s.requirements);

test("all 74 Stage14-17 original contracts and original field names survive", () => {
  assert.equal(proposal.records.length, 74);
  assert.equal(new Set(proposal.records.map((r: { id: string }) => r.id)).size, 74);
  for (const original of originals) {
    const record = proposal.records.find((r: { id: string }) => r.id === original.id);
    assert.ok(record, original.id);
    for (const key of ["id", "requirement", "source_section", "origin"])
      assert.deepEqual(record[key], original[key], `${original.id}.${key}`);
    // Parent integration may add provenance after this bounded proposal was
    // produced. Preserve the original canonical schema, not future additions.
    for (const key of ["id","source_section","requirement","status","origin",
      "existing_evidence","evidence_caveat","files_functions_changed",
      "behaviour_delivered_this_run","inputs_versions_assumptions","executions",
      "numerical_results","scientific_acceptance","git_commit","deployment_revision",
      "remaining_gaps","next_action","blockers"])
      assert.ok(key in record, `${original.id}.${key}`);
  }
});

test("every proposed clause has exact check type, real execution array, gaps and ready action", () => {
  for (const record of proposal.records) {
    assert.ok(["exact", "numerical", "operational", "judgement"].includes(record.check_type));
    assert.ok(Array.isArray(record.executions));
    if (record.status === "verified") assert.ok(record.executions.length > 0);
    for (const execution of record.executions) {
      assert.ok(execution.command);
      assert.ok(execution.log);
      assert.ok(readFileSync(execution.log, "utf8").length > 0);
    }
    assert.ok(Array.isArray(record.remaining_gaps));
    assert.ok(record.next_action && record.ready_action.owner && record.ready_action.action);
    assert.equal(record.owner_review.status, "not-performed");
    assert.notEqual(record.scientific_acceptance, "accepted");
    for (const source of record.inspected_source_sha256)
      assert.match(source.sha256, /^[a-f0-9]{64}$/);
  }
});

test("S17-001 contains all 300 unique original criteria with SHA and classification", () => {
  const matrix = proposal.records.find((r: { id: string }) => r.id === "S17-001").acceptance_matrix;
  const all = ledger.stages.flatMap((s: { requirements: Record<string, unknown>[] }) => s.requirements);
  assert.equal(matrix.count, 300);
  assert.equal(matrix.rows.length, 300);
  assert.equal(new Set(matrix.rows.map((r: { id: string }) => r.id)).size, 300);
  for (const original of all) {
    const row = matrix.rows.find((r: { id: string }) => r.id === original.id);
    assert.equal(row.requirement, original.requirement);
    assert.ok(row.status && row.check_type);
    assert.match(row.inspected_git_baseline, /^[a-f0-9]{40}$/);
    assert.ok(row.evidence.length > 0, `Missing evidence pointer/SHA: ${original.id}`);
    assert.ok(row.evidence.every((e: { sha256: string }) => /^[a-f0-9]{64}$/.test(e.sha256)));
  }
  assert.equal(matrix.parent_must_regenerate_after_all_worker_records_merge, true);
});

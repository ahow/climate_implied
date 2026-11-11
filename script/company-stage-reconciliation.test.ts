import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source-only contract test: no private corpus, generator execution or skip.
const ledger = JSON.parse(readFileSync(new URL("../docs/workplan_completion_ledger.json", import.meta.url), "utf8"));
const proposal = JSON.parse(readFileSync(new URL("../docs/reconciliation-stages-10-13.json", import.meta.url), "utf8"));
const protectedFields = ["id", "requirement", "source_section", "origin"];
const original = ledger.stages.flatMap((s: any) => s.requirements);
const canonical = ledger.stages.filter((s: any) => s.stage >= 10 && s.stage <= 13)
  .flatMap((s: any) => s.requirements);
assert.equal(original.length, 300);
assert.equal(canonical.length, 97);
assert.deepEqual(Object.keys(proposal), ["records"]);
assert.equal(proposal.records.length, 97);
const proposals = new Map(proposal.records.map((r: any) => [r.id, r]));
const financialBasisCriteria = new Set(["S11-002", "S11-003", "S12-008", "S12-017"]);
assert.equal(proposals.size, 97, "No duplicate canonical IDs");
assert.deepEqual(proposal.records.map((r: any) => r.id), canonical.map((r: any) => r.id));
for (const clause of canonical) {
  const record: any = proposals.get(clause.id);
  for (const key of protectedFields) assert.deepEqual(record[key], clause[key], `${clause.id}.${key}`);
  assert.ok(["exact", "numerical", "operational", "judgement"].includes(record.check_type));
  assert.ok(record.check_scope);
  assert.notEqual(record.evidence_caveat, "Stage-level report pointer only; this individual requirement is not yet verified.");
  assert.ok(!record.evidence_caveat.startsWith("Stage-level report pointer only"));
  // Keep all prior financial/as-of assertions on the actual cash-basis criteria,
  // and additionally forbid unrelated market/terminal gaps on fixture criteria.
  if (financialBasisCriteria.has(clause.id)) {
    assert.equal(record.financial_basis.selected_original_case.fiscal_year, 2024);
    assert.equal(record.financial_basis.selected_original_case.unchanged, true);
    assert.equal(record.financial_basis.new_distinct_conditional_experiment.historical_anchor_fiscal_year, 2025);
    assert.equal(record.financial_basis.new_distinct_conditional_experiment.source_type, "unaudited-issuer-earnings-release");
    assert.equal(record.financial_basis.new_distinct_conditional_experiment.is_form_10k, false);
    assert.equal(record.financial_basis.original_case_basis_silently_replaced, false);
    assert.equal(record.asof_price_treatment.quote_predating_freeze_is_itself_blocker, false);
    assert.equal(record.asof_price_treatment.last_available_close_can_be_legitimate_asof_information, true);
    assert.equal(record.asof_price_treatment.capture_before_freeze, true);
    assert.equal(record.asof_price_treatment.original_exact_date_pair_gate_and_historical_cutoffs_relaxed, false);
    assert.equal(record.asof_price_treatment.actual_qualified_pairs, 0);
    assert.ok(record.asof_price_treatment.actual_unresolved_pair_requirements.length >= 4);
  } else {
    assert.equal(record.financial_basis, undefined, `${clause.id}: unrelated experiment metadata`);
    assert.equal(record.asof_price_treatment, undefined, `${clause.id}: unrelated market-pair gaps`);
  }
  assert.ok(Array.isArray(record.executions) && record.executions.length > 0);
  assert.ok(record.next_action);
  assert.equal(record.source_sha256, ledger.source_sha256);
  assert.equal(record.amendments_sha256, ledger.amendments_sha256);
  assert.equal(record.global_contract_clauses, 300);
  assert.ok(record.check_scope.startsWith(`${clause.id} ONLY:`), "Every review is criterion-scoped");
  assert.ok(record.behaviour_delivered_this_run && record.numerical_results[0].criterion === clause.id);
  assert.equal(record.status_review.criterion_regression_evidenced, false);
  // This proposal predates the parent's newly implemented criteria. Compare
  // its status to that retained pre-increment state, not future verification.
  const cachePrior=clause.before_cache_track_implementation;
  if(cachePrior){
    assert.equal(clause.id,"S11-040");
    assert.equal(cachePrior.published_ledger_revision,"619a0d8c91644dad51a84b685e2bbc8dec1dd6fd");
    assert.equal(cachePrior.status,"partial");
    assert.equal(record.status_review.prior_canonical_status,cachePrior.status);
    assert.ok(clause.cache_track_increment?.execution,"Later verification needs its own execution receipt");
  }
  const priorStatus=clause.before_ready_implementation_20261110?.status ?? cachePrior?.status ?? clause.status;
  if (priorStatus === "verified") assert.equal(record.status, "verified", "No unproved prior verified downgrade");
  if(priorStatus!=="verified"&&clause.status==="verified"){
    assert.ok(clause.executions.length>0,"New parent verification needs actual executions");
    assert.ok(clause.files_functions_changed.length>0,"New parent verification needs implementation");
  }
  const inspectedCode = record.existing_evidence.filter((p: string) => /^(server|script)\//.test(p));
  assert.ok(inspectedCode.length >= 2 && inspectedCode.some((p: string) => p.endsWith(".test.ts")));
  for (const path of inspectedCode) readFileSync(new URL(`../${path}`, import.meta.url));
  assert.ok(record.pre_existing_files_functions_inspected.length > 0);
  assert.ok(record.source_change_provenance.every((p: any) => /NOT changed/.test(p.classification)));
  assert.ok(record.files_functions_changed.every((p: string) =>
    /reconcile-company-stages-10-13|company-stage-reconciliation\.test|reconciliation-stages-10-13\.json/.test(p)));
  assert.equal(record.focused_verification, undefined, "A blanket suite receipt cannot masquerade as atomic evidence");
  if (record.status === "verified") {
    assert.deepEqual(record.remaining_gaps, []);
    assert.deepEqual(record.gaps, []);
    assert.ok(record.executions.some((e: any) => e.relevant_tests?.length > 0),
      "Verified criterion requires actual named retained passing checks");
  } else {
    assert.equal(record.remaining_gaps.length, 1, "Partial finding must state its own unfinished conjunct");
  }
}
for (const id of ["S11-005", "S12-013", "S12-015"]) {
  const record: any = proposals.get(id);
  assert.equal(record.status, "verified", `${id}: exact permitted branch/fixture was wrongly downgraded`);
  assert.deepEqual(record.remaining_gaps, []);
  assert.ok(!record.evidence_caveat.includes("Not fully verified"));
}
assert.ok((proposals.get("S11-005") as any).functions.includes("server/calculation/cashFlowValuation.ts:cashFlowValue"));
assert.ok((proposals.get("S12-013") as any).functions.includes("server/calculation/pairedCompanyGap.ts:rankPairedCompanyGaps"));
assert.ok((proposals.get("S12-015") as any).functions.includes("server/calculation/companyProjection.ts:projectCompanyMembers"));
assert.ok((proposals.get("S12-012") as any).remaining_gaps[0].includes("peer outputs unchanged"));
assert.ok((proposals.get("S12-014") as any).remaining_gaps[0].includes("all-scope"));
assert.ok((proposals.get("S10-003") as any).numerical_results[0].result.includes("100/100"));
assert.equal((proposals.get("S10-002") as any).check_type, "exact");
assert.equal((proposals.get("S10-005") as any).check_type, "operational");
assert.equal((proposals.get("S11-009") as any).check_type, "numerical");
assert.equal((proposals.get("S12-017") as any).check_type, "judgement");
for (const [stage, count] of [[10, 14], [11, 43], [12, 18], [13, 22]])
  assert.equal(proposal.records.filter((r: any) => r.stage === stage).length, count);
const contract = (rows: any[]) => rows.map(r => Object.fromEntries(protectedFields.map(k => [k, r[k]])));
assert.deepEqual(contract(original.map((r: any) => proposals.get(r.id) ?? r)), contract(original));
console.log("Canonical company reconciliation: all 97 exact clauses (14/43/18/22), all 300 global identities/text/sections/origins and source/amendment hashes preserved; no private inputs or skips.");

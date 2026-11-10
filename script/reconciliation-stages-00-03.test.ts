import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("all48 original stage0–3 clauses retain exact contract and complete proposed evidence records",()=>{
  const ledger=JSON.parse(readFileSync("docs/workplan_completion_ledger.json","utf8"));
  const records=JSON.parse(readFileSync("docs/reconciliation-stages-00-03.json","utf8"));
  const original=ledger.stages.slice(0,4).flatMap((s:{requirements:unknown[]})=>s.requirements);
  assert.equal(ledger.stages.flatMap((s:{requirements:unknown[]})=>s.requirements).length,300);
  assert.equal(ledger.source_sha256,"f11261326be34b7f44129709a447017459de13e813046cd732721b4660df11f2");
  assert.equal(Object.keys(records).length,48);
  assert.deepEqual(Object.keys(records),original.map((r:{id:string})=>r.id));
  for(const source of original) {
    const record=records[source.id];
    for(const field of ["id","requirement","source_section","origin"]) assert.deepEqual(record[field],source[field]);
    assert.ok(["exact","numerical","operational","judgement"].includes(record.check_type));
    assert.ok(record.check_scope&&record.next_action&&record.equations_units_and_behavior);
    assert.ok(record.direct_code_evidence.length);
    assert.ok(record.executions.length);
    assert.ok(record.numerical_results[0].threshold);
    assert.equal(record.live_release_observation.new_check_during_this_task,false);
    assert.equal(record.deployment_revision,null);
    if(record.status==="verified") {
      assert.deepEqual(record.remaining_gaps,[]);
      assert.equal(record.numerical_results[0].decision,"pass");
      assert.ok(record.executions.some((e:{log_inspected:boolean;exit_code:number;log:string})=>
        e.log_inspected&&e.exit_code===0&&typeof e.log==="string"&&e.log.length>0));
    } else assert.ok(record.remaining_gaps.length,source.id);
  }
});

test("stale original clauses explicitly distinguish field coverage, calculator concurrency and CI injection",()=>{
  const records=JSON.parse(readFileSync("docs/reconciliation-stages-00-03.json","utf8"));
  assert.equal(records["S01-001"].status,"partial");
  assert.match(records["S01-001"].behaviour_delivered_this_run,/1000\/1001/);
  assert.match(records["S02-008"].behaviour_delivered_this_run,/already writes\/reviews financial, carbon, SDG and driver/);
  assert.match(records["S02-008"].remaining_gaps.join(" "),/suspended HTTP/);
  assert.equal(records["S00-011"].status,"partial");
  assert.equal(records["S00-011"].numerical_results[0].actual.deliberatelyBrokenSourceCommit,false);
  assert.equal(records["S01-007"].numerical_results[0].actual.actualThreshold,"5 GtCO2e");
  assert.equal(records["S01-015"].status,"verified");
  assert.equal(records["S01-015"].numerical_results[0].actual.mainDerived,22);
  assert.equal(records["S01-012"].status,"partial","Raw unknown summary remains unresolved, not replaced to manufacture completion");
  assert.equal(records["S01-012"].numerical_results[0].actual.remaining,1);
  assert.equal(records["S00-001"].check_type,"operational");
  assert.equal(records["S00-003"].check_type,"numerical");
  assert.equal(records["S01-011"].check_type,"judgement");
  assert.equal(records["S01-012"].check_type,"exact");
  assert.equal(records["S03-007"].numerical_results[0].actual.complete,0);
});

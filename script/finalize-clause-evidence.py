"""Apply the parent's actual merged checks to canonical criteria; preserve history."""
import hashlib
import importlib.util
import json
from pathlib import Path

spec=importlib.util.spec_from_file_location("merge",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
path=Path("docs/workplan_completion_ledger.json")
ledger=json.loads(path.read_text())
if "full_reconciliation_20261110" in ledger["latest_increment"]:
    raise ValueError("Dated reconciliation already applied; do not overwrite later evidence with this historical receipt.")
before=m.contract_digest(ledger)
byid={r["id"]:r for s in ledger["stages"] for r in s["requirements"]}
full={
    "command":"npm run check && npx tsx --test script/*.test.ts && uv run python -m unittest discover -s script -p 'test_*.py' && npx tsx script/validate-company-filing-private.ts && npm run build",
    "executed_at":"2026-11-10T10:53:24.322430Z","exit_code":0,
    "counts":{"typescript":{"tests":344,"pass":344,"fail":0,"skipped":0},
              "python":{"tests":95,"pass":95,"fail":0,"skipped":0}},
    "log":"generated-artifacts/workplan-completion/20261110T105324322430Z.log",
    "scope":"Actual combined regression execution; not full scientific or owner acceptance"}
control=json.loads(Path("docs/CI_Source_Negative_Control.json").read_text())
assert control["fail"]==1 and control["validate"]=="failure" and control["promote"]=="skipped"
assert control["productionBefore"]==control["productionAfter"]==control["liveAfter"]
updates={
 "S00-002":("verified","All TypeScript and Python tests, typecheck, private filing validation and build executed together; counts and earlier integration failures retained.",[full],[]),
 "S00-011":("verified","Actual deliberately broken source commit failed CI solely at the named temporary test; promotion skipped and production branch/live SHA remained unchanged.",[{
     "command":"GitHub Actions: npx tsx --test script/*.test.ts",
     "executed_at":"2026-11-10T11:06:39Z","exit_code":1,
     "time_basis":"CI test-summary timestamp, not an invented start timestamp",
     "counts":{"tests":345,"pass":344,"fail":1,"skipped":0},
     "log":control["log"],"expected_outcome":"One intentional source-test failure; promotion skipped",
     "source_commit":control["source"],"workflow_run":control["run"]}],[]),
 "S17-001":("verified","All300 original criteria assembled with individual status, evidence links, record/source SHA and exact/numerical/operational/judgement check type. Matrix completeness is not criterion passage.",[full],[])
}
for key,(status,behavior,executions,gaps) in updates.items():
    r=byid[key]
    r["parent_reconciliation_prior"]={k:r.get(k) for k in ("status","evidence_caveat","remaining_gaps")}
    r.update(status=status,behaviour_delivered_this_run=behavior,executions=executions,
             remaining_gaps=gaps,evidence_caveat="Verified only at this original criterion's declared engineering scope; no scientific or owner acceptance.")
    r["next_action"]="Preserve the recorded criterion; continue other incomplete original requirements."
    r["scientific_acceptance"]="not-implied-by-engineering-verification"
byid["S00-011"]["existing_evidence"] += ["docs/CI_Source_Negative_Control.json","docs/CI_Source_Negative_Control.md"]
byid["S00-011"]["numerical_results"]=[control]
byid["S17-001"]["existing_evidence"] += ["docs/WORKPLAN_ACCEPTANCE_MATRIX.md","script/test_clause_reconciliation.py"]
byid["S17-001"]["acceptance_matrix"]={"rows":300,"path":"docs/WORKPLAN_ACCEPTANCE_MATRIX.md","status":"merged, not provisional","contractHash":before}
byid["S17-001"]["numerical_results"]=["300 unique unchanged original criteria; 0 unaudited criteria; statuses are not all accepted."]
ledger["latest_increment"]["full_reconciliation_20261110"]={
 "coverage":"1000/1001 original public slots;134/135 checkpoint gaps and571/572 cumulative closed;1141 definitions. Last raw historical summary remains unresolved; both strict gates fail.",
 "clauses":"All300 canonical criteria individually reconciled; original/source/amendment identities preserved. Refer to per-clause records, not top-level assertions.",
 "checks":full,"negative_source_control":control,
 "private_checks":"355 retained receipt assertions and actual filing validator required separately; no private file export or missing-file skip.",
 "replay":"Changed-source9calculator/XLSX/network-isolated bundle recovery-ln5Bv7 passed; result63062fa1305c96c005fd3f78f69f48c79e73f808de403ce7bcff039a50049317, exportd551a24112baa4222f889202367c03c552adf0bff071bd7a4e26a200058d5c40. Unchanged timeout; one-time private validation fixes repeated102MB hashing.",
 "company":"One FSLR conditional50-row FY2025-unaudited-anchor experiment, distinctFY2024case;0/3complete/0qualifiedwhole-equitypairs.",
 "physical":"Actualannualmatricesretained; rawIGCCdecompositionnotacceptedbaseline/observablealignment or2025attribution.",
 "http":"No genuineauthenticatedHTTPoperatorcontract;public403preserved. Current-workbook/source mutation+suspendedHTTP/fullrestore unproven; exactidentity/role/importer authorization needed."
}
ledger["restart"]["instruction"]="Continue all original0–17/amendments. All300 criteria now individually reconciled; do not rebuild generic stage summaries or reindex original IDs.1000/1001originalpublicslots remain: raw historical summary leaf semantics unresolved, both strict gates fail; supplemental675display/14workbook/74chainedresponse inventory not fullacceptance. Preserve changed-source9/XLSX/privateLinuxnetworkrecovery and one-time private snapshot validation; current-source mutated/suspendedHTTP still needs genuineoperatoridentity/role/importer, neverpublicwrites. FSLR actualconditional50rows from explicitlynewunauditedFY2025/2026guidance basis, distinctFY2024case;0/3complete/noqualifiedwholeequitypairs. PrimaryXOMsuccessor/shares reviewpending; complete terminal/reinvestment/stub/share/identity and NEE/XOMeconomics withoutselfapproval. ActualFaIRannualnativeemissions/speciesforcing retained; rawIGCCcomponentdifferences notcompatibleGSAT/GMST/naturalbaseline/2025attribution acceptance. Preserve allfrozennegativebeta/fleet/EV/storage results,Gordonprimary. Actualbroken-sourceCIcontrol passed withonlyexpectedfailure,productionunchanged; do notrepeat. Continue dependency-ready originalcriteria, no proxy research or purchases/DDL/collector/auth/sciencechanges. One newcallback onlytrueend aftersavingevidence."
assert before==m.contract_digest(ledger)
path.write_text(json.dumps(ledger,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(ledger))

"""Parent integration of original clause evidence. No source contract rewriting."""
import importlib.util
import json
from datetime import datetime,timezone
from pathlib import Path

spec=importlib.util.spec_from_file_location("merge",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
before=m.contract_digest(x)
records={r["id"]:r for s in x["stages"] for r in s["requirements"]}
updates={
 "S00-004":("partial","Actual public news cache miss no longer calls the provider; explicit operator refresh CLI. Source-derived TS/Python operation census and known CLI/provider boundaries retained, without treating discovery as authorization.",["server/newsApi/newsService.ts:getClimateNewsAnalysis","server/newsApi/providerAccess.ts:requireNewsRefreshAccess","script/operator-news.ts","script/privileged-operation-inventory.ts:scanOperations","script/privileged_python_census.py:inspect_source"],["docs/Privileged_Operation_Execution_20261110.md"],["Complete caller authorization review of dynamic calls, derived caches and shell paths; genuine privileged HTTP lifecycle still needs legitimate operator identity."]),
 "S00-005":("verified","Existing exact opt-in code retained. Read-only startup evidence: Replit production enabled; Replit development and sole configured Railway service disabled. No flag/cadence change or restart performed for this check.",["server/releaseSafety.ts:schedulerEnabled","server/dataIngestion/scheduler.ts:startScheduler","script/capture-scheduler-host-evidence.py"],["docs/Privileged_Operation_Execution_20261110.md"],[]),
 "S00-010":("verified","Exactly one known configured environment logs enabled. Retained actual startup timestamps/source hashes and Railway project service inventory. Environment ownership is not a claim of one autoscale replica.",["script/capture-scheduler-host-evidence.py"],["docs/Privileged_Operation_Execution_20261110.md"],[]),
 "S01-001":("partial","Prospective producer/kind/version/run/content/source manifests archive transactionally alongside untouched raw summaries. Untagged history gets no verified leaf bindings. Supplemental metadata-sheet bindings added; original opaque slot remains unresolved.",["server/dataIngestion/summaryContract.ts","server/dataIngestion/summaryArchive.ts","server/dataIngestion/dataStore.ts:finishFetchRun","shared/supplementalSheetBindings.ts"],["docs/next-summary-evidence.json"],["Original runs[].summary historical leaf meanings remain unknown.","Broader dynamic/custom/display acceptance and live transaction lifecycle are not established by in-memory fixtures."]),
 "S01-004":("verified","Gordon labels/row metadata/Interpretation export use actual selected r. Eight-percent fixed-rate paths explicitly retain8%; variable r is not falsely labelled8%. Original fixed8 requirement interpreted with the user's explicit actual-r amendment.",["server/climateValuation/sdgGrowthCalculator.ts","server/climateValuation/decarbTercileCalculator.ts","client/src/lib/valuation-claims.ts","client/src/components/download-data-button.tsx","shared/gordonBaselineSemantics.ts"],["docs/next-valuation-evidence.json"],[]),
 "S01-007":("verified","Implemented exact0.05-times evidenced selected2024 baseline diagnostic, selection/gas/member/unit checks, inclusive boundaries/right censoring, UI/export and separate versioned legacy5Gt quantity. Removed timing verdict. Native27-account captured-input diagnostics calculate in native mass; unqualified legacy60.3/default callers correctly withhold as explicitly required. No observational/physical certification implied.",["server/calculation/thresholdDiagnostic.ts","shared/thresholdDiagnostic.ts","shared/thresholdDiagnosticSchema.ts","shared/thresholdDiagnosticSemantics.ts","server/routes.ts"],["docs/next-threshold-evidence.json"],[]),
 "S11-010":("verified","Separate original nominal assessment enforces2.5–4%, years6–15 linear fade and terminal growth strictly below r, with explicit sustainable reinvestment and refusals. Existing1–3% diagnostic and frozen research unchanged.",["server/calculation/reverseValuation.ts:originalNominalEquityAssessment","server/calculation/originalNominalAssessmentHandler.ts","shared/originalNominalAssessmentSemantics.ts"],["docs/next-valuation-evidence.json"],[]),
 "S12-014":("verified","All three scopes reconcile base×activity×intensity×separate residual factors. Embedded measures are not reapplied; declared overlap rejects across scopes. Dedicated liability checks keep Scope3 out of direct tax and Scope2 channel explicit. Replay/XLSX opt-in inputs pinned.",["server/calculation/companyProjection.ts:projectCompanyMembers","server/calculation/companyProjectionReplay.ts","shared/companyAbatementSemantics.ts"],["docs/next-accounting-evidence.json"],[]),
 "S07-008":("partial","Recovered actual2025 human-inducedGMST source and exact SR1.5/Annual distinction; pinned reference rejects caller-labelled GSAT equivalence. Read retained physical matrices, compare raw and separately justified annual1750-change forcing. No tuning or model rerun.",["script/physical_source_alignment.py","script/compare_retained_igcc_physics.py:human_warming_check"],["docs/next-physical-evidence.json"],["Genuine attributed-model GMST provenance/member comparison remains unavailable.","Volcanic baseline ambiguity, native emissions gaps and observable/species compatibility remain unresolved; no invented conversion."]),
 "S12-001":("partial","Actual SEC metadata establishes three selectedFY2024 filing acceptance times; retained row/cashflow evidence extended. Explicit dated FCFE stub forward/reverse and prospective cutoff separation implemented. Three authorized fixed-date non-split FMP requests returned200 and match primary-share dates; currency/class remain unresolved, no automatic identity join or actual valuation pair.",["server/calculation/companyCaseEvidence.ts","server/calculation/companyFullCashflowCase.ts","script/assemble-next-company-evidence.ts","script/attempt-company-fmp-dated-prices.ts","server/financialData/provider.ts"],["docs/next-company-evidence.json"],["Three dated quote/share candidates exist but currency/security-class and full cash/stub/sustainable-terminal inputs remain unqualified.0/3complete cases; owner identity/activation separate."])
}
def receipts(value):
 found=[]
 if isinstance(value,dict):
  if any(k in value for k in ["command","testCommand","commands"]) and any(k in value for k in ["log","result","testLogSha256","actual_log","exitCode","exit_code"]):
   found.append({"command":value.get("command",value.get("testCommand",value.get("commands"))),
     "executed_at":value.get("executed_at",value.get("startedAt",value.get("executedAtUTC"))),
     "exit_code":value.get("exit_code",value.get("exitCode")),
     "counts":value.get("counts",{"tests":value.get("tests"),"pass":value.get("passed",value.get("pass")),"fail":value.get("failed",value.get("fail")),"skipped":value.get("skipped")}),
     "log":value.get("log",value.get("result")),"details":value,
     "receipt_limit":"Unrecorded historical timestamps/exit codes are not invented; final integrated execution is separate."})
  for v in value.values():found.extend(receipts(v))
 elif isinstance(value,list):
  for v in value:found.extend(receipts(v))
 return found
now=datetime.now(timezone.utc).isoformat()
for key,(status,behavior,files,evidence,gaps) in updates.items():
 r=records[key]
 r.setdefault("before_ready_implementation_20261110",{k:r.get(k) for k in ("status","behaviour_delivered_this_run","remaining_gaps")})
 proposals=[json.loads(Path(f).read_text()) for f in evidence if f.endswith(".json")]
 r.update(status=status,files_functions_changed=files,behaviour_delivered_this_run=behavior,
   inputs_versions_assumptions=proposals or ["Existing configuration and retained startup logs; no host configuration writes."],
   numerical_results=proposals or [json.loads(Path("generated-artifacts/scheduler-host-evidence/combined.json").read_text())],
   remaining_gaps=gaps,reviewed_at=now,evidence_report=evidence,
   scientific_acceptance="No scientific, identity, issuer or owner acceptance implied.",
   next_action="Continue the stated remaining gaps and other original partial requirements." if gaps else "Preserve this criterion's scoped evidence; continue other original requirements.")
 r["existing_evidence"]=list(dict.fromkeys(r["existing_evidence"]+evidence))
 new=[e for proposal in proposals for e in receipts(proposal)]
 if new:r["executions"]=new
 if key.startswith("S00-"):
  r["executions"]=[{"command":"python script/capture-scheduler-host-evidence.py; read-only Railway deploy logs/service inventory",
    "executed_at":now,"exit_code":0,"counts":None,"log":"generated-artifacts/scheduler-host-evidence/combined.json",
    "time_basis":"Parent evidence integration time; startup timestamps and capture time are retained inside receipt."}]
 r["revision_boundary"]["pending_this_increment"]="Changed workspace; no new deployment claim until integrated CI/promotion/runtime receipts."
assert before==m.contract_digest(x)
x["latest_increment"]["ready_implementation_20261110"]={"changed_original_ids":list(updates),"source_contract_hash":before,
 "note":"Implementation, not another generic300-clause audit. Individual canonical records updated; scientific gaps remain."}
x["restart"]["instruction"]="Continue alloriginal0–17/amendments. Read current_release and per-clause ready-implementation evidence. Preserve genuine producer-summary sidecars/rawhistory, actual-r Gordon labels, original2.5–4% terminal range, separate5%-of-selected2024diagnostic with missing/default-baseline withholding, allscope abatement/replay, datedFCFE stubs and prospectivecutoffs. Original unknownsummary remains; extra supplemental columns notoriginalclosure. SECpublication metadata and actual2025GMST SR1.5reference now found; do notrepeatblanketunavailable claims. Complete actualsourcecompanyinputs/pairs (0/3), genuineattributedmodelGMST and nativeemission/baselinecompatibility; no synthetic/oldintensityefficacy. Existing privateassertions/frozennegativebeta/fleet/EV/storage/Gordonprimary remain. No callbackuntiltrueend."
x["restart"]["unfinished_requirement_ids"]=[r["id"] for r in records.values() if r["status"]!="verified"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
print("Integrated",len(updates),"original criteria; contract",before)

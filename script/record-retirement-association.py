"""Incremental S13-003/006 evidence; no status promotion or fabricated deployment."""
import argparse
import hashlib
import importlib.util
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
FILES=[
 "server/calculation/utilityRetirement.ts","script/controlled_growth_association.py",
 "docs/retirement-association-protocol.json","docs/controlled-association-protocol-v2.json",
 "docs/utility-retirement-source-evidence.json","shared/retirementAssociationPublic.ts",
 "server/producerReserveApi.ts","shared/economicBridgeSchema.ts","shared/serverDownloadRegistry.ts",
 "client/src/components/retirement-association-panel.tsx","client/src/components/retirement-association-panel.test.ts",
 "client/src/lib/retirement-association-reader.ts","client/src/hooks/use-retirement-association.ts",
 "client/src/pages/climate-valuation.tsx","script/utilityRetirement.test.ts",
 "script/test_controlled_growth_association.py","script/validate-retirement-source-private.ts",
 "script/component-state-contracts.ts","script/economic-bridge-ui.test.ts",
 "script/economic-bridge-api.test.ts","script/workplan-evidence-run.py",
 "script/component-state-census.test.ts","script/methodology-download.test.ts",
 "script/methodology-download-portable.test.ts","script/record-retirement-association.py"]
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
parser=argparse.ArgumentParser()
parser.add_argument("--receipt",action="append",default=[])
args=parser.parse_args()
ledger=json.loads((ROOT/"docs/workplan_completion_ledger.json").read_text())
now=datetime.now(timezone.utc).isoformat()
evidence={"recorded_at":now,"files":{p:sha(p) for p in FILES},
 "new_vs_old":"New S13-003 retirement cash engine and S13-006 unscored association estimator/public source report. Prior producer/electricity models, negative studies, original1001 and closed finite export criteria unchanged.",
 "source":"PacifiCorp FY2023 issuer filing submitted to Utah PSC, cover2024-03-07, printed Note4 p234 and Item2. Exact publication instant unknown. Private PDF/text hashes recorded separately; no raw publication.",
 "numerics":"Wyodak332MW facility net,266MW reported owned,80% ownership; owned491-285=206USDm book arithmetic;0.4MW rounding residual. Not a recoverable regulatory asset or market value.",
 "retirement":"calculateUtilityRetirement / invertUtilityRetirement: explicit unit/legal entity, ownership once, calendar/leap generation, annual cash cost/replacement/tax/WC/recovery/decommissioning, discounting, zero explicit terminal, discrete candidate roots; book balance never cash deduction. No actual unit cash schedule or issuer valuation executed.",
 "association":"estimate: frozen definitions, full sample denominator, complete cases with per-field reasons, cutoff/identity/source/period checks, fixed controls/categories, rank/condition/leverage gates, OLS and original-unit HC3 covariance/Student-t intervals. No actual issuer regression performed.",
 "correction_history":"V1 incorrectly named five-year FCFE Gordon;7 synthetic engineering tests passed before inspection caught mismatch with shared/quantityDescriptors.ts. Retained V1; separately declared V2 steady-state g=r-E/P at2026-11-12T15:52:36Z before V2 tests. No actual data scored, no old study refit.",
 "focused":"62TS pass/0fail/0skip;7Python V2 pass;6mandatory private-source assertions. Logs retained. Full coherent gate only as recorded by subsequent supplied receipt.",
 "later_source_finding":"Primary March31 2023 IRP p19 announces Wyodak2039 planning retirement, not legal commitment. Table6.2 nameplate268MW is distinct from filing net-owned266MW. Separate retained source finding, not fed into an actual issuer valuation; public source report remains explicitly filing/book arithmetic.",
 "intermediate_failures":"First full gate1297TS/1289pass/7fail/1skip, Python not run. Two focused repair logs each43TS/41pass/2fail exposed further stale census assertions. Second full gate1298TS/1296pass/1fail/1skip, Python not run: isolated public suite actually58passed but old outer assertion expected53. Exact new population registered; no original sets or guards removed.",
 "later_engineering":"freezeUtilityRetirement binds cloned full candidates/target/tolerance with present-process timestamp/hash; not independent chronology. Retirement rejects day-only source availability. Offline association binds model bytes/dependency lock/runtime and deep-copied inputs; fresh-process equality fixture remains engineering only.",
 "focused_log_sha256":{p:sha(p) for p in [
  "generated-artifacts/retirement-association/focused.log",
  "generated-artifacts/retirement-association/association-v2-tests.log"]},
 "scientific_decision":"No market-implied retirement/qualified issuer case/actual association/causal claim. Original clauses remain partial.",
 "thresholds":["retirement hand cash reconciliation tolerance1e-12 USDm","discrete matching fixture1e-8USDm, all candidates enumerated",
 "OLS/HC3 independent direct-matrix oracle tolerance1e-12","n>=max(30,3p), full rank, condition<=1e8, leverage<1-1e-10"],
 "release":"Unreleased working increment until separate observed gated promotion receipt; prior live0e2870d5 and implementationb8d98f6 remain distinct.",
 "executions":[]}
previous=ledger.get("retirement_association_increment",{})
evidence["executions"]=previous.get("executions",[])
for path in args.receipt:
 r=json.loads((ROOT/path).read_text())
 entry={"path":path,"sha256":sha(path),"receipt":r}
 if entry not in evidence["executions"]:evidence["executions"].append(entry)
ledger["retirement_association_increment"]=evidence
ledger.setdefault("latest_increment",{})["retirement_association_original_partial"]=evidence
# Current executable/source bindings change; original evidence hashes remain.
warning_path=ROOT/"docs/scientific-strands-warning-evidence.json"
warning=json.loads(warning_path.read_text())
for host in warning["warningInventory"]:
 current=sha(host["path"])
 if host["currentSha256"]!=current:
  host.setdefault("priorCurrentSha256",[]).append(host["currentSha256"])
  host["currentSha256"]=current
  host["currentChange"]="Added retirement/association read-only panel; original warning text and historical source remain preserved"
warning_path.write_text(json.dumps(warning,indent=2)+"\n")
provenance_path=ROOT/"docs/status-choice-width-increment-evidence.json"
provenance_text=provenance_path.read_text()
provenance=json.loads(provenance_text)
runner=next(s for s in provenance["sources"] if s["path"]=="script/workplan-evidence-run.py")
if runner["sha256"]!=sha(runner["path"]):
 old=subprocess.check_output(["git","show","HEAD:"+runner["path"]],cwd=ROOT,text=True)
 current=(ROOT/runner["path"]).read_text()
 added='    "echo \'=== Mandatory private retirement unit source ===\'; npx tsx script/validate-retirement-source-private.ts; "\n'
 if current.replace(added,"",1)!=old:
  raise ValueError("Runner change is not solely the additive mandatory retirement source validator")
 runner.setdefault("retirementPriorSha256",[]).append(runner["sha256"])
 runner["sha256"]=sha(runner["path"])
 runner["retirementChange"]="Only added unconditional retained primary unit-source validator; all original public/private commands preserved verbatim"
 start=provenance_text.index('    {"path": "script/workplan-evidence-run.py"')
 end=provenance_text.index("\n",start)
 provenance_path.write_text(provenance_text[:start]+"    "+json.dumps(runner,ensure_ascii=False)+","+provenance_text[end:])
gaps={
 "S13-003":["Source-qualified unit dispatch/revenue/operating costs, retirement commitments, decommissioning cash and approved recovery still absent; Wyodak owned book206USDm does not identify cash.",
 "Executable full issuer/common-equity bridge and compatible valuation target/inversion not established; conditional discrete asset engine and public bookkeeping are not full original issuer acceptance."],
 "S13-006":["Actual frozen eligible population/cutoff, same-period transition exposure and all declared conventional controls/solver-basis records not assembled.",
 "OLS/HC3 estimator tested on labelled engineering fixtures only; no actual coefficients, selection assessment or scientific acceptance."]}
def walk(value):
 if isinstance(value,dict):
  if value.get("id") in gaps:
   key=value["id"]
   value.setdefault("prior_files_functions_changed",list(value.get("files_functions_changed",[])))
   value["files_functions_changed"]=FILES
   value["behaviour_delivered_this_run"]=evidence["retirement" if key=="S13-003" else "association"]
   value["inputs_versions_assumptions"]=[evidence["source"],evidence["correction_history"]]
   value["remaining_gaps"]=gaps[key];value["gaps"]=gaps[key]
   value["next_action"]=gaps[key][0];value["nextAction"]=gaps[key]
   value["numerical_results"]=[evidence["numerics"] if key=="S13-003" else "Actual issuer coefficients unavailable; synthetic coefficient/oracle controls are engineering only"]
   value["scientific_acceptance"]=evidence["scientific_decision"]
   new_functions=(["calculateUtilityRetirement","freezeUtilityRetirement","invertUtilityRetirement",
                   "buildRetirementAssociationPublic","retirementAssociationAdapter"]
                  if key=="S13-003" else ["estimate","digest","instant","buildRetirementAssociationPublic"])
   value["functions"]=list(dict.fromkeys([*value.get("functions",[]),*new_functions]))
   value["behaviorAndInputs"]=[value["behaviour_delivered_this_run"],evidence["source"],evidence["later_source_finding"]]
   value["formulas"]=(["MWh=full-unit net MW*calendar hours*capacity factor before retirement",
     "owned CF=ownership*(revenue-variable/fixed costs-maintenance/replacement capital-replacement power-cash tax-deltaWC+recovery-decommissioning payments)",
     "asset PV=sum(owned CF/(1+r)^t); book balances are disclosure, not cash deductions",
     "all declared discrete candidate residuals tested; unique/multiple/no-root retained"]
     if key=="S13-003" else ["g=r-positive same-period earnings/market capitalization",
     "exposure=(Scope1+location-based Scope2 tonnes)/same-period USDmillion revenue",
     "OLS fixed conventional controls; HC3 covariance X' diag(e²/(1-h)²) X sandwiched by inverse crossproduct; original-unit coefficients",
     "approximate t(0.975,n-p) intervals; no causality"])
   for execution in evidence["executions"]:
    r=execution["receipt"]
    entry={"command":r["command"],"executed_at":r["executed_at"],"exit_code":r["exit_code"],
      "log":r["log"],"log_sha256":r["log_sha256"],"counts":r["counts"],
      "suite_counts":r.get("suite_counts"),"check_type":"test",
      "check_scope":"Changed original S13-003/006 engineering and coherent regressions; not actual issuer calibration/association or scientific acceptance"}
    if not any(item.get("log")==entry["log"] for item in value["executions"]):value["executions"].append(entry)
   value["commandsAndDates"]=[{"command":e["receipt"]["command"],"executed_at":e["receipt"]["executed_at"]} for e in evidence["executions"]]
   value["countsLogsAndResults"]=[{"counts":e["receipt"].get("suite_counts"),"log":e["receipt"]["log"],"sha256":e["receipt"]["log_sha256"]} for e in evidence["executions"]]
   value["focused_verification"]={"status":"focused-pass; full gate separately recorded","evidence":evidence["focused"],"logs":evidence["focused_log_sha256"]}
   value["thresholds"]=evidence["thresholds"]
   value["current_increment_evidence"]=evidence
  for child in value.values():
   if isinstance(child,(dict,list)):walk(child)
 elif isinstance(value,list):
  for child in value:walk(child)
walk(ledger)
ledger["restart"]["next_requirement"]="S13-003 source actual unit cash/recovery/commitments and compatible target; S13-006 assemble exact frozen qualified issuer controls/exposure and execute only admissible actual association. Preserve new engine/HC3/source206USDm evidence, distinguish engineering from science; continue independent original source/corpus requirements."
(ROOT/"docs/workplan_completion_ledger.json").write_text(json.dumps(ledger,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("ledger",ROOT/"script/completion-ledger.py")
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.render(ledger)
marker="## Retirement and controlled association — original S13-003/S13-006"
body=marker+"\n\n```json\n"+json.dumps(evidence,indent=2)+"\n```\n"
report=ROOT/"docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
text=report.read_text()
if marker in text:text=text[:text.index(marker)]
report.write_text(text.rstrip()+"\n\n"+body)
matrix=ROOT/"docs/WORKPLAN_ACCEPTANCE_MATRIX.md"
matrix_text=matrix.read_text()
matrix_marker="## Latest S13-003/S13-006 retirement and association evidence"
if matrix_marker in matrix_text:matrix_text=matrix_text[:matrix_text.index(matrix_marker)]
matrix.write_text(matrix_text.rstrip()+"\n\n"+matrix_marker+"\n\n"+
 "The older atomic inspection rows remain historical evidence. Their missing-code wording is superseded by these current partial-clause findings:\n\n"+
 "- S13-003: utilityRetirement.ts now implements explicit annual unit cash/ownership/recovery/decommissioning/valuation and declared discrete-domain inversion. Wyodak ownership/book evidence is retained; actual unit cash/recovery/commitments and compatible issuer target remain missing.\n"+
 "- S13-006: controlled_growth_association.py now implements admission, fixed conventional controls, OLS/HC3 and diagnostics under separately corrected prospective Gordon V2. Actual eligible input corpus and estimates remain unavailable. Synthetic fixtures do not establish science.\n"+
 "Original300 IDs,63 verified/235 partial/2 provisioning-blocked remain unchanged. Detailed dated executions/hashes are in the canonical JSON ledger and implementation report.\n")
print("Recorded S13-003/006 evidence; all original IDs and statuses preserved")

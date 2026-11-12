"""Receipt-only checkpoint: does not publish, restart CI or activate data."""
import json,subprocess,hashlib,importlib.util
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
folder=root/"generated-artifacts/cohort-continuation"
run=json.loads((folder/"ci-observation.json").read_text())["workflow_runs"][0]
gate=json.loads((folder/"final-coherent.receipt.json").read_text())
assert gate["exit_code"]==0
runtime=json.loads((folder/"railway-prior-build.json").read_text())["sourceCommit"]
paths=subprocess.check_output(["git","diff","--name-only","92409405581ea8e6bbce45c1b1439ca768f460f1","HEAD"],cwd=root,text=True).splitlines()
receipt={"observed_at":datetime.now(timezone.utc).isoformat(),
 "implementation":"4cb9d34adf3d89d835102af3be201dc0be275413",
 "local_evidence":"a7da3b269e8e8b038e83b59b543650764b1331ef",
 "github":run["head_sha"],"ci":{k:run.get(k) for k in ["id","status","conclusion","html_url"]},
 "runtime_last_observed":runtime,"health":{"status":"ok"},"new_release_verified":False,
 "scope":"Final local gates passed; existing CI observed in progress. No CI counts or new runtime confirmation inferred. Do not restart or supersede active promotion.",
 "gate":gate,"dev_readback":json.loads((folder/"final-dev-readback.log").read_text()),
 "changed_paths":paths,"stopping_reason":"Execution context boundary, not completion or exhausted actionable scope.",
 "science":"No actual issuer inversion or efficacy established;0/3qualified cases; exact finite polynomial engineering only."}
path=folder/"release-observation.json";path.write_text(json.dumps(receipt,indent=2)+"\n")
p=root/"docs/workplan_completion_ledger.json";x=json.loads(p.read_text())
x["pending_release"]=receipt
x["current_release"]["runtime"]=runtime
x["current_release"]["new_cohort_release_verified"]=False
x["latest_increment"]["cohort_continuation"]["release_observation"]=receipt
next_action=("Continue ALL original0–17/amendments. First inspect existing CI43289646254 for f3ef9067; do not restart/supersede it. "
"Verify gated runtime/health/clean-covered JSON+XLSX when complete; current observed runtimeca8c59c is the previous docs sync, not cohort deployment. "
"Preserve final1331TS=1330pass/0fail/1optionalPGskip,264Python and mandatory private checks on implementation4cb9d34. "
"Next complete authenticated retained future-cohort producer/approval/manifest integration (current admission covers EPA observation only), "
"legacy/mid-year stock, energy-loss and sustainable perpetual cash/stock/claim branches; finite proportional-project polynomial is not whole-equity identification. "
"S13-018 finite lineage verified; do not reopen with unrelated owner/science gates. "
"Follow new XPLR Q22026 Note9 named NEER246m payable/average150days without calling it received cash; Nucor FY2025 says XOM pays supplier fee and receives credits, "
"not a fee amount or XOM fee revenue; retain later September2026 operating update. "
"Qualify source economics/current-law/components and full-window calibration/dates, no synthetic efficacy, refits or selfapproval. "
"All original remaining clauses remain actionable; no blanket external halt.")
x["restart"]["instruction"]=next_action;x["restart"]["next_requirement"]=next_action
p.write_text(json.dumps(x,indent=2)+"\n")
report=root/"docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
report.write_text("## Latest cohort release observation — local receipt, promotion pending\n\n"
 "64verified/234partial/2provisioning-blocked; original1000/1001;0/3qualified cases. Not completion or efficacy.\n\n"
 "```json\n"+json.dumps(receipt,indent=2)+"\n```\n\n## Exact continuation\n\n"+next_action+"\n\n"+report.read_text())
subprocess.run(["python","script/completion-ledger.py"],cwd=root,check=True)
spec=importlib.util.spec_from_file_location("m",root/"script/merge-clause-reconciliation.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
(root/"docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text("# Current acceptance matrix\n\n64verified/234partial/2blocked; CI pending, not new runtime verification.\n\n"+m.matrix(x))
print(json.dumps({k:receipt[k] for k in ["github","ci","runtime_last_observed","new_release_verified"]}))

import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
root=Path("generated-artifacts/renewal");now=datetime.now(timezone.utc).isoformat()
files=["server/calculation/cohortRenewal.ts","server/calculation/companyCohortProjection.ts","script/cohortRenewal.test.ts","script/companyCohortProjection.test.ts"]
e={"at":now,"status":"local integrated calculation; remaining engineering and scientific scope open",
"files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
"functions":["evaluatePeriodicRenewal","projectCompanyCohorts"],
"new":"Annual finite transition hands exact surviving cohorts and debt/WC balances into stationary renewal. Company projection binds the matching physical specification, renewal assumptions and model version. Swapped physical boundary refuses.",
"numerics":{"engineering_only":True,"periodic_project_value":900,"finite_transition_combined_pv":900/1.1,"tolerance":1e-9},
"focused":{"command":"npx tsx --test script/cohortRenewal.test.ts script/companyCohortProjection.test.ts","pass":7,"fail":0,"skip":0,"log":"generated-artifacts/renewal/integrated-focused.log"},
"claims":"No issuer/common-equity identification, scientific acceptance or real approval. Memory lifecycle remains memory, not PostgreSQL.",
"remaining":["Dated storage/charge/loss renewal, complete accrual/AR/tax/legal-claim reconciliation","Bounded inverse/full-domain certification and owner width gates","Actual future-review PostgreSQL/principal execution","UI/API/custom export exposure for admitted genuine future results","Actual issuer/source qualification, original calibration and historical corpus"] }
gate=root/"integrated-full.receipt.json"
e["coherent_gate"]=json.loads(gate.read_text()) if gate.exists() else {"status":"running"}
e["clean_install"]={"scope":"Fresh public4a10e455 checkout, Node22.23.4, npm ci; no copied node_modules",
 "result":"FAILED HTTP403 package firewall for locked proxy-addr2.0.7; calculations never started",
 "log":"generated-artifacts/renewal/clean-install.log",
 "latest_registry_version":"2.0.8","boundary":"Candidate upgrade not installed; original lock and protected bundle pins unchanged. No firewall bypass or claimed clean reproduction."}
b=root/"deployed-ui.json"
if b.exists():e["deployed_ui"]=json.loads(b.read_text())
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
x["prior_renewal_draft_increment"]=x.get("latest_increment");x["latest_increment"]=e
ci=root/"integrated-ci.json"
if ci.exists():
 runs=json.loads(ci.read_text()).get("workflow_runs",[])
 if runs:
  run=runs[0]
  x["pending_release"]={"source":run["head_sha"],"ci":run["id"],"status":run["status"],"conclusion":run["conclusion"],
   "boundary":"Submitted through existing gated workflow; not observed deployed. Do not supersede with local receipt-only changes."}
e["release"]={"source":"e704177e32a11ff6ce95a224f3f46050f40e942b","local_implementation":"b91548db6ac1c67c86c012302ac25d4b91c08406","pending":x.get("pending_release"),
 "last_verified_runtime":"4a10e455c1a4618c2e9c5bc51b26419aa5d71c71"}
e["postledger"]={"command":"npx tsx --test script/reconciliation-stages-14-17.test.ts script/workplan-corrections.test.ts","pass":7,"fail":0,"skip":0,"log":"generated-artifacts/renewal/integrated-postledger.log"}
e["not_attempted_this_increment"]=["New issuer economic-source retrieval","New driver empirical fitting","Future-review PostgreSQL transport","Pinned Python clean installation"]
x["next_action"]="Reconcile the existing promotion for this coherent renewal source, then continue dated storage/accrual/claim/inversion and real future-review PostgreSQL. Clean locked local install failed on proxy-addr2.0.7 firewall; investigate2.0.8 only as a separately versioned compatible dependency change, not an original-lock reproduction pass. Actual issuer/calibration inputs remain unqualified."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S13-017"]:
   r["renewal_integration_evidence"]=e;r["next_action"]=x["next_action"]
  if r["id"]=="S17-009" and e.get("deployed_ui",{}).get("verdict")=="success":
   r["status"]="verified";r["remaining_gaps"]=[];r["gaps"]=[];r["next_action"]="Preserve retired production surfaces and retained developer/history views."
   r["deployed_retirement_evidence"]=e["deployed_ui"]
   receipt={"command":"Restricted read-only deployed browser journey: methodology/dashboard/signal/gap/back",
    "executed_at":now,"exit_code":0,"counts":{"journeys":1,"pass":1,"fail":0},
    "log":"generated-artifacts/renewal/deployed-ui.json"}
   if not any(v.get("log")==receipt["log"] for v in r["executions"]):r["executions"].append(receipt)
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
marker="<!-- renewal-integration-history -->\n";old=r.read_text()
if marker in old:old=old.split(marker,1)[1]
r.write_text("# Latest renewal integration — conditional engineering\n\n"+json.dumps(e,indent=2)+"\n\n"+marker+old)
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],check=True)

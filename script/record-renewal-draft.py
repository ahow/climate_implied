import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
now=datetime.now(timezone.utc).isoformat()
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e={"at":now,"status":"local draft; not integrated or promoted","original_ids":["S13-004","S17-009","S17-015"],
"command":"npx tsx --test script/cohortRenewal.test.ts","executed_at":now,"exit_code":0,
"counts":{"tests":2,"pass":2,"fail":0,"skip":0},"log":"generated-artifacts/renewal/test.log",
"failure_history":["First ledger render rejected missing execution metadata; repaired to the existing required schema without changing validation."],
"files":["server/calculation/cohortRenewal.ts","script/cohortRenewal.test.ts"],
"new":"Explicit two-cycle stationary renewal evaluator reuses operating cohorts; checks age-stock, replacement capital, cash repetition and debt/WC boundaries. Project periodic value only; no market identification.",
"formulas":["cyclePV=sum(FCFE_t/(1+r)^t)","conditionalPeriodicProjectValue=cyclePV/(1-(1+r)^(-L))"],
"engineering_oracle":{"annual_revenue":100,"replacement":10,"annual_cash":90,"rate":0.1,"periodic_value":900,"tolerance":1e-9},
"tests":"npx tsx --test script/cohortRenewal.test.ts:2pass/0fail/0skip; synthetic engineering, no scientific result",
"remaining":["Draft not integrated with companyProjection/API/UI/export or reviewed producer lifecycle","No complete transition, accrual/receivable/claim waterfall or dated storage continuation","No bounded inverse or full-domain certification; no growth perpetuity","Full coherent/private gates not yet run for this draft"],
"deployment":{"ci":43312646996,"validate":"success","promote":"success","validated_branch":"4a10e455c1a4618c2e9c5bc51b26419aa5d71c71","fresh_runtime":"4a10e455c1a4618c2e9c5bc51b26419aa5d71c71","method":"cache-busted safe build-info read","boundary":"New deployed UI/export readback not yet executed; no deployment failure inferred or intervention made"}}
x["latest_increment"]=e
x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={**x.get("current_release",{}),"runtime":e["deployment"]["fresh_runtime"],"ci":43312646996,"ci_conclusion":"success","verified_at":now,"boundary":"Fresh source revision verified; previous export and UI receipts are not new deployed acceptance."}
x.pop("pending_release",None)
x["next_action"]="Complete and integrate the local periodic renewal draft, full claim/timing/energy/inversion contracts and actual future-review PostgreSQL tests. Verify deployed4a10e455 UI retirement and safe exports without rerunning CI. Then clean locked-install reproduction and actual issuer/calibration inputs; no new scientific acceptance."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   for old in r.get("executions",[]):
    if old.get("status")=="local draft; not integrated or promoted":
     for key in ("command","executed_at","exit_code","counts","log"):old.setdefault(key,e[key])
   r.setdefault("executions",[]).append(e)
   r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
r.write_text("# Latest continuation — renewal draft and completed prior promotion\n\n"+json.dumps(e,indent=2)+"\n\n"+r.read_text())
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],check=True)

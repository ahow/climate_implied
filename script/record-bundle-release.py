import json,datetime,importlib.util,hashlib
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e=json.JSONDecoder().raw_decode(Path("/tmp/bundle-after-ledger.log").read_text())[0]
r={"workspace_commit":"8c5b622c92dc6a60f4f4c158ec4041cbfef4df59","github_main":"085d6715d9e88f5748b2a95c60381dba2c12a476","ci":"43039515013 success","railway_deployment":"094228ec-b3b6-490a-8239-84e901e40a33","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"affected":"FSLR GET200 includes newselectedreceipts and revised-history label; exactartifact503 FAIR_ARTIFACT_MISSING withoutfallback; wrongversion409. Private provision not performed.","tests":"Aftercanonicalcorrection722TS/0fail/0skip,179Python,threeissuerprivatevalidators+miningprivatevalidator,typecheck/build. Isolated16bundle29refusals separately;newbrowser3/3.","failed_gate":"43037996241 blockedpromotion: invalidledgercheck_type prose, fixed to existing exact enum; no gateweakening. Earlier179pass preceded offendingledgeredit; later179pass followsrepair.","scope":"Code released, not privatebundleprovisioning/dataactivation/scientificacceptance. Laterdoccommit/localreceipt distinct."}
x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r
x["latest_increment"]["bundle_cohort"].update({"release":r,"finalAfterLedgerExecution":e,"privateValidators":4})
for s in x["stages"]:
 for q in s["requirements"]:
  if "bundle_cohort_increment" not in q:continue
  q["executions"].append(e);q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
  for item in q["bundle_cohort_increment"]["directEvidence"]:
   item["sha256"]=hashlib.sha256(Path(item["file"]).read_bytes()).hexdigest()
x["updated_at"]=r["verified_at"];p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Verified bundle/cohort engineering release; private transfer remains unavailable\n\n"+json.dumps(r,indent=2)+"\n\n41verified/257partial/2blocked. Original1000/1001;0/3qualified. S16-005 finiteengineering verified; no efficacy claim. See fair-private-provisioning-investigation.json for exactoperator action/order/recovery.\n\n"+f.read_text())

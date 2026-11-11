import json,datetime,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"fd808b69ef95f29d99a8de527c108ebb0756ef59","github_main":"1dbe19a116d33729fc378a0e26222adb3f5bc61c","ci":"43046628640 success","railway_deployment":"94e68ba6-9c59-472c-b42b-380db61cd47e","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"health":200,"build_info":"Exact SHA verified","affected":"PublicconditionalAPI returns997600000 recognition and422000000 scopeddistribution; no qualifiedcase/sciencepromotion.","tests":"730TS0fail0skip;189Python;mandatorygrant/privateKaya checks;typecheck/build;5postledgerreconciliation checks.","scope":"Code release; private155bd3ffbundle unchanged/unprovisioned. Laterdocs/localreceipt distinct."}
x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["grant_kaya"]["release"]=r
for s in x["stages"]:
 for q in s["requirements"]:
  if "grant_kaya_increment" in q:q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Verified grant/LLC and territorial input release\n\n"+json.dumps(r,indent=2)+"\n\n41verified257partial2blocked; original1000/1001,0/3qualified. No forecast/efficacy acceptance.\n\n"+f.read_text())

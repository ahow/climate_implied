import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"d91191e73d5b19004eff0d2a3020847fff9d96e1","github_main":"0a97fab1017803690b9cbc88b3e588d64155f6f4","ci":"43011365564 success","railway_deployment":"fc672a66-0c16-4041-9ad7-6b311a79cb31","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"affected":"Public XOM GET contains subsequent Article18qualification and still0qualified; unchanged numeric allowlist fingerprint","tests":"Final561TS/0fail/0skip+typecheck/build;152Python and two newmandatoryprivate XOM validators passed before narrative-only integration, measured code unchanged","scope":"Source/code only, no data/scientific approval. Later documentation/local receipts distinct."}
x["release_history"].append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["primary_inputs"]["release"]=r
e=json.JSONDecoder().raw_decode(Path("/tmp/primary-public-final.log").read_text())[0]
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in ["S04-003","S04-005","S12-001","S16-010"]:
   q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
   if q["id"]=="S12-001":q["executions"].append(e)
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Latest verified primary-input release\n\n"+json.dumps(r,indent=2)+"\n\n40verified/258partial/2blocked;0/3qualifiedcases. Original1000/1001 unchanged. Context boundary, not completion.\n\n"+f.read_text().replace("coherent checks passed; release pending","released; historical checks",1))

import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"eca2c0aea516c16efecc59c3203a68e65ea3b910","github_main":"bc53096928a93e71c6d9f54a177c7f98afe89eb3","ci":"43029223643 success","railway_deployment":"30413e17-b20f-4df5-b288-ad3ca6009fe3","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"affected":"catalog200; exact pinned ensemble selection503 FAIR_ARTIFACT_MISSING, fallbackUsedfalse. Private bundles not deployed; no requestPython/fallback/scientificpromotion.","tests":"Final691TS/0fail/0skip/typecheck/build;172Python/newprivateissuer checks passed beforeclient-onlyinteractionfix; actual16artifact validator separatelypassed. Browserinitial6pass2fail1partial1unrun, focused4residual4pass; historicalevidencepreserved.","scope":"Code release only; sourceartifactvalidation is not deployedartifactavailability orscience. Laterdoc/localreceiptsdistinct."}
x["release_history"].append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["fair_component"]["release"]=r
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in ["S07-002","S12-001","S16-005"]:
   q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Latest verified offline-route/component release\n\n"+json.dumps(r,indent=2)+"\n\n40verified/258partial/2blocked;0/3qualified;original1000/1001. Context boundary, not completion.\n\n"+f.read_text().replace("validated; release pending","released; historical validation detail",1))

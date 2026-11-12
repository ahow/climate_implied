"""Record observed receipts only; does not publish, poll or alter deployment."""
import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
folder=root/"generated-artifacts/clean-covered"
ci=json.loads((folder/"ci-current.json").read_text())
live=json.loads((folder/"observed-build.json").read_text())
health=json.loads((folder/"observed-health.json").read_text())
sha="8835a42d906a7c578c306eaf2225d43b852727e4"
assert ci["head_sha"]==sha
receipt={"observed_at":datetime.now(timezone.utc).isoformat(),
 "workspace_implementation":"95fa94de674e85dbc5055fd8278e31d278f071b4",
 "github_code":sha,"ci":{"id":ci["id"],"status":ci["status"],"conclusion":ci["conclusion"],"url":ci["html_url"]},
 "runtime":live["sourceCommit"],"health":health,
 "release_verified":ci["conclusion"]=="success" and live["sourceCommit"]==sha and health.get("status")=="ok",
 "boundary":"Local1317TS=1316pass/0fail/1optionalPGskip;264Python; mandatory private checks passed. These are not CI counts or scientific acceptance. Railway deployment UUID not obtained.",
 "private_source_assertions":16}
receipt["changed_paths"]=subprocess.check_output(["git","diff-tree","--no-commit-id","--name-only","-r",receipt["workspace_implementation"]],cwd=root,text=True).splitlines()+["script/record-clean-covered-state.py"]
(folder/"state-receipt.json").write_text(json.dumps(receipt,indent=2)+"\n")
p=root/"docs/workplan_completion_ledger.json";x=json.loads(p.read_text())
x["clean_covered_release"]=receipt
x["latest_increment"]["clean_manufacturing_covered_paths"]["release"]=receipt
old=x["current_release"]
if "clean_covered_prior_release" not in x:x["clean_covered_prior_release"]=old.copy()
old.update(runtime=live["sourceCommit"],build_info_source_commit=live["sourceCommit"],
 verified_at=receipt["observed_at"],health=health,
 documentation_boundary="Prior dc2d702c economic implementation;17e67cc6 subsequently observed docs/runtime sync. New candidate and measured runtime are distinct.",
 current_candidate=receipt)
if ci["conclusion"]=="success":
 old.update(workspace_commit=receipt["workspace_implementation"],github_main=sha,production_validated=sha,
  ci=ci["id"],ci_url=ci["html_url"],railway_deployment=None,
  ci_scope="Current candidate validation/promotion; runtime identity independently recorded",
  railway_status="SHA/health verified; deployment UUID unavailable" if receipt["release_verified"] else "Validated branch advanced; runtime replacement not yet observed",
  scope=("Clean/covered code verified live" if receipt["release_verified"] else "Validated source candidate only; runtime replacement not yet observed")+"; no issuer, data or scientific promotion")
else:old["ci_scope"]="Existing prior-release CI fields are historical; current candidate CI is separately recorded above"
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S13-012","S13-017","S13-018","S13-020"]:
   r["revisions"]=receipt;r["git_commit"]=sha;r["deployment_revision"]=live["sourceCommit"]
x["restart"]["instruction"]="Continue ALL original requirements. Preserve tested manufacturer/covered-path engines, real2023 EPA Wyodak observations and read-only API/UI/JSON/XLSX. Check existing CI43277284147/deployment only if pending; do not restart it. Complete physical continuation/cohorts/certified full-domain inversion, actual issuer economics/claim allocation, covered future native/member Stage7 inputs and original dated corpus/calibration. No reruns of unchanged source reconstruction/frozen negatives;0/3qualified cases and scientific acceptance remain unearned."
x["restart"]["next_requirement"]=x["restart"]["instruction"]
p.write_text(json.dumps(x,indent=2)+"\n")
report=root/"docs/WORKPLAN_IMPLEMENTATION_REPORT.md";text=report.read_text()
marker="## Latest clean/covered release observation\n"
if text.startswith(marker):text=text.split("<!-- prior-clean-report -->\n",1)[1]
report.write_text(marker+"\n"+json.dumps(receipt,indent=2)+"\n\n63verified/235partial/2provisioning-blocked; original1000/1001;0/3qualified cases. Complete workplan and efficacy are NOT complete.\n\n<!-- prior-clean-report -->\n"+text)
spec=importlib.util.spec_from_file_location("m",root/"script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
(root/"docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(marker+"\n"+json.dumps(receipt,indent=2)+"\n\n"+m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],cwd=root,check=True)
print(json.dumps(receipt))

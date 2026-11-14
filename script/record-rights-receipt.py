import json,importlib.util,subprocess
from pathlib import Path
b=Path("generated-artifacts/dated-cash")
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
source="e42252979249538a8ace301b834a85b806f2e614"
receipt={"public_source":source,"workspace_code":"80d563d609a4716ed58d26baff75aa04856f8e56",
 "ci":json.loads((b/"rights-ci.json").read_text()),"scope":"Code and local tests; CI status is observed separately. No real future/issuer/science acceptance."}
if (b/"rights-live.json").exists():
 live=json.loads((b/"rights-live.json").read_text())
 if live.get("passed") and live.get("source")==source:
  if x["current_release"].get("runtime")!=source:x.setdefault("release_history",[]).append(x["current_release"])
  x["current_release"]={"runtime":source,"ci":43361503385,"conclusion":"success","readback":live,"scope":"Observed2023 accounting/privacy only, not private rights execution"}
x["latest_increment"]["publication"]=receipt
pending=x["current_release"]["runtime"]!=source
if pending:x["pending_release"]=receipt
else:x.pop("pending_release",None)
prefix=("CI43361503385/sourcee422529 completed SUCCESS; reconcile existing Railway rollout without rerunning CI/restart/cancellation/superseding or receipt-only push. Prior74988dcc remains the last verified runtime; verify exact new runtime/health/safe observedJSON-XLSX/private403 when ready. " if pending else
 "Runtimee422529/CI43361503385/health200/safe observedJSON-XLSX verified; not private future execution. No unchanged rerun. ")
old=x["latest_increment"].setdefault("base_next_action",x["next_action"])
x["next_action"]=prefix+old
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["git_commit"]=source;r["deployment_revision"]=x["current_release"]["runtime"]
   r.setdefault("revisions",{})["rights_2"]=receipt
   r["revision_boundary"]="New rights source and local gates are separate from measured runtime and synthetic private execution."
   r["next_action"]=r["nextAction"]=x["next_action"];r["gaps"]=r["remaining_gaps"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
text=r.read_text();marker="<!-- rights-publication-history -->\n"
if marker in text:text=text.split(marker,1)[1]
r.write_text("# Current rights-ledger publication receipt\n\n"+json.dumps({"current_release":x["current_release"],"pending_release":x.get("pending_release"),"publication":receipt,"next_action":x["next_action"]},indent=2)+"\n\n"+marker+text)
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact rights continuation\n\n"+x["next_action"]+
 "\n\nImplementation80d563d/publice422529. Final local rights-final-full:1362TS/1361pass/0fail/1optionalPGskip;264Python; ALLmandatoryprivate/type/build. rights-boundary-focused1, rights-boundary-pg17/1234rows2468cells, rights-boundary-render actualSSR A-B-A/JSON/XLSX. Earlier rights-full passed before explicit retirement boundary, not final source. Prior cutoff release749 was separately verified live1054rows2108cells at03:22:39Z; not new private execution. A terminal callback may follow this saved handoff: inspect the existing wrapper receipt/user acknowledgement and never resend a matched checkpoint.\n\n"+
 "Next actual implementation: matched delayed post-cutoff physical/service/accrual/cash interval, item-level already-accrued obligation/recovery mapping, fully funded cycle state and compatible inverse. Do not equate service withdrawal with physical removal or ownership extinction. Keep law/source acceptance separate from declared assumptions. Current v2/v5 preserves v1/v4. All300/65verified233partial2blocked/0of3/14pins/original1000of1001/frozen negatives/private403 intact. New primary NucorEx99.2 source examination resolved no fee/billing/opex/funding; don't repeat. All other original tracks remain assigned.\n")

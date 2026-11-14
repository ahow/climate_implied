import json,hashlib,datetime,subprocess
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e={"kind":"prior-retired-ownership-local","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "scope":"Local implementation only, not sustainable cycle closure or release",
 "files":["server/calculation/cohortPostCutoff.ts","server/calculation/companyCohortProjection.ts","script/cohort-post-cutoff.test.ts"],
 "changes":"Previously retired financial cohorts require independent cohort/specification/source-bound ownership; no survivor ownership borrowing. New field enters retained input binding automatically. Integrity is not source approval.",
 "tests":"7 focused pass/0fail/0skip; npm run check passed. No new full gate, PG transport or issuer acceptance.",
 "logs":{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in Path("generated-artifacts/prior-retired").glob("*.log")},
 "release":"CI43543357754 completed success; attempted expected d8f438 runtime readback still observed70b12e8. Failure preserved; no promotion restarted or new source pushed.",
 "remaining":"Whole dated physical/financial cycle closure, funded replacement, interest/recovery/otherWC contracts and exact-branch inverse remain unimplemented/partial. New source qualification not attempted this short continuation."}
x["local_continuation"]=e
x["next_action"]="Resume local prior-retired ownership extension (7 focused tests/typecheck only). Existing CI43543357754 succeeded but d8f438 runtime readback still saw70b12e8; reconcile without restarting or superseding. Continue whole physical/financial funded cycle implementation and exact-branch inverse; do not present this small ownership extension as that milestone. Complete source qualification, changed transport and full mandatory gates before any new promotion. All original0–17 remain authorized;65verified233partial2blocked/0of3 unchanged."
x["restart"]["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":r["local_prior_retired_ownership"]=e;r["next_action"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");r.write_text("# Local ownership continuation — not released\n\n"+json.dumps(e,indent=2)+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Current local continuation\n\n"+x["next_action"]+"\n\n"+json.dumps(e,indent=2)+"\n")

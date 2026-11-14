import json,subprocess,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
ci=json.loads(Path("generated-artifacts/gregorian-renewal/ci.json").read_text())
r={"code_local":"f73c757","integration_local":"8ebfd933b399f616c1eec0864f5241affdd65c7f",
 "public":"59c0fb8a60034313f254624c77c1c770a228b4be","ci":ci,
 "observed_runtime":"b8774031425d61fc16ad44ff04ef3e37d766d232",
 "readback_failure":"generated-artifacts/gregorian-renewal/final-live.log",
 "scope":"New promotion in progress; expected-new-SHA readback correctly refused old runtime. No new deployment claimed. This terminal receipt is LOCAL ONLY."}
x["pending_release"]=r
x["next_action"]="FIRST reconcile existing CI43548780317/head59c0fb8a60034313f254624c77c1c770a228b4be, in_progress at2026-11-14T02:54Z; actual runtime stillb877403. Do not restart/cancel/supersede or make receipt-only push. Continue independent ALL original0–17 work. Preserve new conditional Gregorian400year forward/affine inverse and local1377TS1376pass0fail1skip/264Python/mandatory gates. Finish NEW renewal/inverse retained producer/reader/privatePG/CLI/literalXLSX/localviewer integration (prior finite evidence is NOT this branch); then supported transition/interest/recovery and genuine issuer/driver/dated inputs. Conditional law is NOT market/owner/science acceptance; no general nonlinear inverse or original2.5–4% whole-equity terminal replacement.65verified233partial2blocked/all300/0of3."
x["restart"]["instruction"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
q=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");q.write_text("# LOCAL terminal release boundary\n\n"+json.dumps(r,indent=2)+"\n\n"+x["next_action"]+"\n\n"+q.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact continuation — local terminal receipt\n\n"+x["next_action"]+"\n\n"+json.dumps(r,indent=2)+"\n\nFull final evidence: generated-artifacts/gregorian-renewal/final-full.receipt.json. New source lookup: preceding SECI source record; capacity/allocation NOT cash or produced watts. No repeated source retrieval or frozen-study rerun needed.\n")

import json,subprocess,importlib.util,datetime
from pathlib import Path
b=Path("generated-artifacts/renewal-retained")
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
ci=json.loads((b/"ci-latest.json").read_text())
livepath=Path("generated-artifacts/dated-cash/renewal-retained-final.json")
live=json.loads(livepath.read_text()) if livepath.exists() else None
receipt={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
"implementation_local":"98882d1f96219435f42c2615821a4cb11be581bb",
"published":"d4f59575ef31e8bc1ac59bea435fe751858201cc",
"ci":{k:ci.get(k) for k in ["id","head_sha","status","conclusion"]},
"runtime_readback":live,"node22_stored":json.loads((b/"node22.json").read_text()),
"latest_build_observation":json.loads((b/"runtime-latest.json").read_text()),
"numerics":json.loads((b/"numerics.json").read_text()),
"scope":"Node20-produced synthetic stored document reproduced exactly by Node22 without calculation,0600. Not fresh installation/fullS17/operator/issuer/science. Transport targets derived from the same forward fixture, not market observations.",
"postledger":"5pass0fail; consumer final8pass0fail plus privacy1pass0fail; wrong requested privacy filename retained separately.",
"rollout_history":"03:56:36Z and03:57:57Z expected-d4 checks observed59c0fb8;03:59:27Z fresh build observation still59c0fb8. Both CI jobs and production-validated branch succeeded atd4. No restart/cancel/supersede.",
"report":"https://github.com/ahow/climate_implied/blob/d4f59575ef31e8bc1ac59bea435fe751858201cc/docs/WORKPLAN_IMPLEMENTATION_REPORT.md"}
x["latest_increment"]["terminal_receipt"]=receipt
x["pending_release"]=receipt
if live and live.get("passed") and live.get("source")==receipt["published"]:
 x.setdefault("release_history",[]).append(x["current_release"])
 x["current_release"]={"runtime":live["source"],"ci":ci["id"],"conclusion":ci["conclusion"],"readback":live,
 "scope":"Observed2023, six403 denials and served renewal viewer assets only. No private future/operator/science execution."}
 x["pending_release"]=None
next_action=("Continue ALL original0–17/amendments. "+
 ("Renewal integration release verified; do not rerun unchanged transport/browser/gates. " if live else
 "First reconcile existing CI43553556549 and Railway d4f59575; CI success is not deployment. Do not restart/cancel/supersede or receipt-only push. ")+
 "Next S13-004: supported finite transition into the conditional Gregorian law, explicit interest/eligible recovery/partial ownership and an economically defensible physical DEPLOYMENT-growth parameterization. Freeze NEW claim/domain/calendar/controlset before outputs; frozen price-shift inverse is not deployment growth. S13-017: remaining all-map declared assumption/range accounting; unavailable sets stay visible, numeric available groups are not complete missing-family bounds. Continue actual original issuer/22driver/full-window/dated11–15 inputs; AU684 is aggregate context, not FSLR cash. Genuine principal/owner/provisioning remain narrow; no autoapproval/public private data.65verified233partial2blocked/all300/0of3/original1000of1001/14FaIRpins and frozen negatives unchanged.")
x["next_action"]=next_action;x["restart"]["instruction"]=next_action
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S13-007","S13-017"]:r["renewal_terminal_receipt"]=receipt
p.write_text(json.dumps(x,indent=2)+"\n")
q=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");q.write_text("# Latest retained renewal release/terminal observation\n\n"+json.dumps(receipt,indent=2)+"\n\n"+next_action+"\n\n"+q.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
spec=importlib.util.spec_from_file_location("matrix","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact retained renewal handoff — local terminal receipt\n\n"+next_action+"\n\n"+json.dumps(receipt,indent=2)+"\n\nDetailed evidence: generated-artifacts/renewal-retained. Actual PG initial run failed old finite-regex; focused7-check stored corruption/rollback recovery passed. Browser A/B/A/corrupt/reset/C passed, not exact planned order. Prior/current failed receipts retained. All helper scripts and data exist locally; private files are not in public Git. No terminal callback sent until wrapper runs.\n")

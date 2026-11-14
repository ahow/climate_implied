import json,datetime,importlib.util,subprocess
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
ci=json.loads(Path("generated-artifacts/dated-cash/delayed-ci.json").read_text())
receipt={"recorded_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "workspace_implementation":"ee9381f86ca84606f514ca9e2959cc36eb7311ea",
 "public_source":"d8f43860d1ffd8a73fed99b765740c5a6523daf6","ci":ci,
 "last_verified_runtime":x["current_release"],
 "scope":"Local receipt only; publication is not deployment. No delayed future case executed on production.",
 "postledger":"5pass/0fail/0skip; generated-artifacts/dated-cash/delayed-postledger.log"}
x["latest_increment"]["publication"]=receipt
x["next_action"]="Continue ALL original0–17. First reconcile existing CI43543357754/head d8f43860d1ffd8a73fed99b765740c5a6523daf6 without restart/cancel/superseding; last measured runtime70b12e8/health200 is opening-obligation source only. Delayed finite7 is implemented and locally gated1371TS=1370pass0fail1optionalPGskip+264Python/all mandatory private/type/build, new actualPG17/1465rows2930cells/SSR3/10focused/5postledger. Preserve failures and immutable retrieval. NEXT funded whole physical/financial cycle closure and compatible exact-branch inverse, prior-retired ownership and recovery/adjustment gaps. No generic scenario grids or unchanged reruns. New FSLR Q3 presentation is context, not eligible watts/grant cash.65verified233partial2blocked/all300/0of3 unchanged; no issuer/science/owner/auth acceptance."
x["restart"]["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":r["matched_delayed_interval"]["publication"]=receipt;r["next_action"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
r.write_text("# Latest release distinction — local receipt\n\n"+json.dumps(receipt,indent=2)+"\n\n"+x["next_action"]+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
h=Path("docs/TERMINAL_VIEWER_HANDOFF.md");h.write_text("# Current continuation receipt\n\n"+x["next_action"]+"\n\n"+json.dumps(receipt,indent=2)+"\n\n"+h.read_text())

import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());b=Path("generated-artifacts/prior-retired")
g=json.loads((b/"full.receipt.json").read_text());assert g["exit_code"]==0
files=["server/calculation/cohortPostCutoff.ts","server/calculation/companyCohortProjection.ts","server/calculation/cohortRenewal.ts","server/calculation/renewalClosure.ts","script/cohort-post-cutoff.test.ts","script/cohortRenewal.test.ts"]
e={"kind":"dated-cycle-boundary-and-prior-ownership","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "functions":["ownedFinancialSpecification","reconcileRenewalClosure","evaluatePeriodicRenewal"],
 "files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "scope":"Partial S13-004 engineering: independent prior-retired ownership and necessary executed physical/financial cycle boundary reconciliation. NOT a certified repeating perpetual branch or inverse.",
 "inputs":"Conditional USD project claim; UTC before-boundary events; exact elapsed-day ages; source-bound replacement slots/entities; explicit distributions versus capital return; tolerance1e-9 relative. Actual dated ledger executes before comparison, not caller-supplied closing snapshots.",
 "results":"Three2026/2027/2028 boundary states:1operating unit,365day age,10paid capital, zero cash/AR/AP/tax/otherWC/debt/noncommon. Replacement10 is accrued at Jan1 and settled from collected100 in July; common90. Capital return1 produces drift refusal; changed rights entity refuses; unfunded January replacement refuses. Periodic value remains null. Independently sourced prior-retired25% ownership preserves500 delayed common cash; missing/borrowed/duplicate ownership refuses.",
 "gates":g,"focused":"20pass0fail0skip; initial standalone ownership7pass; corrected typecheck passed",
 "logs":{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in b.glob("*.log")},
 "failures":"TS2802 Set iteration corrected with Array.from; compiler unchanged. Initial expected d8f438 runtime readback still returned70b12e8; retained failure, then actual d8f438 verified.",
 "remaining":["Finite state repetition is necessary, not sufficient for future calendar/exogenous/economic-law periodicity; perpetual value and exact-branch inverse remain unavailable",
 "Partial-calendar/degrading periodic continuation and partial-claim renewal remain unsupported; prior-retired fractional ownership is supported only in the separate finite branch",
 "New closure still needs changed retained transport/consumer journey evidence; priorPG/SSR is not relabelled as testing this branch",
 "Interest accrual/recovery/adjustment/otherWC eligibility and complete claim/obligation law remain partial; genuine principal/source/owner/science acceptance not established"],
 "source":{"url":"https://www.seci.co.in/pli-scheme","retrieved":datetime.datetime.now(datetime.timezone.utc).isoformat(),
  "locator":"Basket1,row3; introductory allocation paragraph and table total","publication":"Page date unknown; describes April2023 letters of award, not proof of2023 public availability",
  "facts":"FS India Solar Ventures:1177.573INR crore allocation;3400MW manufacturing capacity;1700MW PLI-eligible capacity. Five-year post-commissioning allocation schedule is not payment.",
  "discrepancy":"Intro13937.535 versus table13937.575INR crore; preserve0.040crore discrepancy.",
  "exclusions":"Not observed produced watts, US45X/PFE/BOM, India collection amount/day/FX, cash classification or qualified issuer value. Nucor search returned already examined sources; not fetched again.",
  "hash":hashlib.sha256((b/"seci-pli.json").read_bytes()).hexdigest()}}
x["prior_increment"]=x.get("latest_increment");x["latest_increment"]=e
x["previous_local_continuation"]=x.get("local_continuation");x["local_continuation"]=e
x["current_release"]={"runtime":"d8f43860d1ffd8a73fed99b765740c5a6523daf6","ci":43543357754,"conclusion":"success",
 "readback":json.loads(Path("generated-artifacts/dated-cash/closure-base.json").read_text()),
 "scope":"Previous delayed implementation; observed2023 accounting/public403 only, not new closure execution"}
x["next_action"]="Continue ALL original0–17. Preserve prior-retired ownership and new necessary cycle-boundary checks; they DO NOT certify sustainable periodicity or inverse. Finish changed retained/consumer journey, explicit whole-state funded repeat law including calendar/degradation/claim timing, then compatible inverse. New SECI1700MW is India programme eligible capacity, NOT produced watts or cash. Verify any new publication separately from measured d8f438/CI43543357754.65verified233partial2blocked/all300/0of3 unchanged."
x["restart"]["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["dated_cycle_boundary"]=e;r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"]
   r["files_functions_changed"]=files;r["numerical_results"]=e["results"];r.setdefault("executions",[]).append(g)
  if r["id"]=="S12-008":r["seci_eligible_capacity_attempt"]=e["source"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");r.write_text("# Latest necessary cycle-boundary implementation\n\n"+json.dumps(e,indent=2)+"\n\n"+x["next_action"]+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact cycle-boundary continuation\n\n"+x["next_action"]+"\n\n"+json.dumps(e,indent=2)+"\n")

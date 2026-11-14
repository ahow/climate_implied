import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
b=Path("generated-artifacts/dated-cash");p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
g=json.loads((b/"delayed-full.receipt.json").read_text());assert g["exit_code"]==0
files=["server/calculation/cohortPostCutoff.ts","server/calculation/terminalSettlement.ts","server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts","script/cohort-post-cutoff.test.ts","script/futureCohortPostgres.ts","script/finiteCohortTransport.ts","script/disposition-render-readback.ts"]
logs=["delayed-focused.log","delayed-focused-fixed.log","delayed-focused-frozen.log","delayed-type-frozen.log","delayed-pg-frozen.log","delayed-render-frozen.log","delayed-full.log"]
e={"kind":"matched-delayed-interval","recorded_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "scope":"Conditional S13-004 delayed owned daily exposure to classified accrual and dated common cash; not complete sustainable renewal or issuer valuation",
 "files_functions":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "functions":["ownedFinancialSpecification","calculatePostCutoff","settleTerminal","projectCompanyCohorts","finiteProducerBinding"],
 "gates":g,"log_hashes":{str(b/f):hashlib.sha256((b/f).read_bytes()).hexdigest() for f in logs},
 "inputs":"Synthetic USD conditional forecast, captured original specification/ownership/claim, explicit2028 source-assumption coverage and events; UTC civil days, ACT/365.25,10%discount. Owned service prices and owned non-volume costs; otherWC explicitly excludes AR/AP/tax. No dates or amounts inferred from annual net cash.",
 "numerics":"Leap Jan1–Mar1 exclusive:60owned delivered kWh,75charging kWh,15loss,600operating revenue accrual,100separate asset receivable,195operating cost+5tax=500net common cash. PV=505/1.1^(182/365.25)−5/1.1^(59/365.25). 10%age degradation independent daily oracle; booked20 gives480common with200NEW expense, not220. Default100 gives400; restoration1000 gives−500; separatecapital10 and intrayearotherWC30 roundtrip gives490. Relative reconciliation1e-9, stock/energy oracle1e-10.",
 "engineering":"10focused tests pass; new actualPG branch17checks,1465orderedrows2930literalcells; actual component SSR A/B/A/JSON/XLSX. Not interactive browser, genuine principal, source or scientific acceptance.",
 "failures":"Initial delayed positive cases2fail/1pass from undefined optional properties violating canonical JSON; removed absent properties, retained strict canonical rule. Opening-obligation TS2802 earlier retained. No compiler/private/scientific gate weakened.",
 "remaining":["Funded whole physical/financial cycle closure and compatible certified inverse not completed; periodic/whole-equity values remain null",
 "Bounded delayed branch requires explicit ownership for every modeled financial cohort; previously retired cohorts absent from disposition ownership remain unsupported",
 "Independent legal/source authority, item-level otherWC/recovery/adjustment eligibility and actual creditor priority remain unearned",
 "Interest accrual beyond explicit cash interest requires an additional settlement contract; no implicit extrapolation outside declared operating coverage",
 "Genuine private principal/production provisioning, source-complete issuer cases and historical efficacy remain unavailable/unearned"]}
if x.get("latest_increment",{}).get("kind")!=e["kind"]:x["prior_increment"]=x.get("latest_increment")
x["latest_increment"]=e
live=json.loads((b/"obligations-live.json").read_text())
x.setdefault("release_history",[]).append(x.get("current_release",{}))
x["current_release"]={"runtime":live["source"],"ci":43541522533,"conclusion":"success","readback":live,"scope":"Opening-obligation source; observed2023/public403 readback only. Delayed source still local until separately promoted."}
x["next_action"]="Continue ALL original0–17. Preserve opening-obligations1/finite6 and post-cutoff-interval1/finite7, original branches and stored-exact retrieval. Reconcile delayed-source CI/runtime separately from verified70b12e8. NEXT whole physical/financial funded cycle closure and exact-branch bounded inverse; prior-retired ownership and recovery/adjustment gaps explicit. New FSLR Q3 presentation remains context, not eligible watts/cash; no new issuer accepted.65verified233partial2blocked/all300/0of3 unchanged."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["matched_delayed_interval"]=e;r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"]
   r["files_functions_changed"]=files;r["functions"]=e["functions"];r["behaviour_delivered_this_run"]=e["scope"]
   r["numerical_results"]=e["numerics"];r["inputs_versions_assumptions"]=e["inputs"]
   r.setdefault("executions",[]).append({**g,"kind":e["kind"]})
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
r.write_text("# Latest matched delayed interval\n\n"+json.dumps(e,indent=2)+"\n\nVerified previous release: "+json.dumps(x["current_release"])+"\n\nNext: "+x["next_action"]+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact delayed interval continuation\n\n"+x["next_action"]+"\n\n"+e["numerics"]+"\n\n"+e["engineering"]+"\n\n"+json.dumps(e["remaining"],indent=2)+"\n\nEvidence: generated-artifacts/dated-cash/delayed-full.receipt.json, delayed-pg-frozen.log, delayed-render-frozen.log. Source attempt: obligations-source-slides.json. Source-sensitive producer adds cohortPostCutoff.ts only for new branch. Old stored exact retrieval has no new dependency. PrivateHTTP remains403. No callback yet at this record.\n")

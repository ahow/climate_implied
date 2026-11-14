import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
b=Path("generated-artifacts/dated-cash");p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
g=json.loads((b/"obligations-full.receipt.json").read_text());assert g["exit_code"]==0
files=["server/calculation/terminalObligations.ts","server/calculation/terminalSettlement.ts","server/calculation/cohortDisposition.ts","server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts","script/terminal-obligations.test.ts","script/cohort-disposition.test.ts","script/futureCohortPostgres.ts","script/finiteCohortTransport.ts"]
logs=["obligations-focused-final.log","obligations-type.log","obligations-type-fixed.log","obligations-pg.log","obligations-render.log","obligations-full.log","obligations-source-presentation.json","obligations-source-slides.json"]
e={"kind":"opening-obligation-items","recorded_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "scope":"Partial S13-004: item-level payment of opening payables/tax/debt/noncommon, not complete delayed operations/recovery/cycles",
 "files_functions":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "functions":["reconcileOpeningObligations","settleTerminal","compileDispositionSettlement","projectCompanyCohorts","finiteProducerBinding"],
 "gates":g,"log_hashes":{str(b/f):hashlib.sha256((b/f).read_bytes()).hexdigest() for f in logs},
 "numerics":"Opening AR100 minus AP20/tax5/debt10/noncommon5 gives common60; PV60/(1.1^(60/365.25)), tolerance1e-10. Full AR default plus explicit funding40 yields net common−40. Asset proceeds100 minus already-booked restoration20 and NEW tax5 gives75, new expense only5.",
 "engineering":"Four focused tests (three new and changed existing disposition), actualPG17 checks/1301rows2602literal cells; actual component SSR A/B/A/JSON/XLSX, not interactive browser or genuine principal.",
 "failures":"Initial TS2802 MapIterator incompatibility; repaired with Array.from, compiler unchanged. No original/private gates weakened.",
 "remaining":["Matched delayed physical/service/accrual/cash interval remains unimplemented","Item register does not establish external entity/source/legal validity","OtherWC classification, adjustments, recovery/default eligibility and creditor priority remain unsupported beyond existing explicitly declared terminal model","Funded sustainable whole-state cycles/full-domain inverse remain partial","Genuine principal, qualified issuer cases and actual efficacy remain unearned"],
 "source":{"url":"https://s202.q4cdn.com/499595574/files/content_files/Q3-26-Earnings-Presentation-VF-Secured.pdf","publication":"2026-10-29","locator":"Q3’26 Financial Performance; Summarized Balance Sheet; Q4 Preview",
 "finding":"New examined primary presentation reports3.9GW U.S./0.2GW India under net sales and98%/87% utilization; these are NOT proof of eligible US-produced watts/BOM/PFE. Grant receivables1875m vs625m are balances, not collections. Q4 preview assumes no2026Section45X credit sales, not no credit cash of every kind.",
 "missing":"India PLI payment amount/day/FX/classification and eligible component/material-assistance costs remain unresolved. Not a2025-origin input; no model rerun or backdating."}}
if x.get("latest_increment",{}).get("kind")!=e["kind"]:x["prior_increment"]=x.get("latest_increment")
x["latest_increment"]=e
x["next_action"]="Continue ALL original0–17. Preserve opening-obligations-1/finite6 and old branches; matched existing liability payment creates no new expense. NEXT matched delayed physical/service/accrual/cash interval, otherWC/adjustment/recovery eligibility, whole-state funded cycles and compatible inverse. No source/principal/issuer/science acceptance. Reconcile new source validation/promotion only when published; e422529 remains prior verified runtime. Do not repeat unchanged rights/PG/studies. New FSLR Q3 presentation examined; volume/context is not eligible production/cash.65verified233partial2blocked/all300/0of3 unchanged."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["opening_obligations"]=e;r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"]
   r["files_functions_changed"]=files;r["functions"]=e["functions"];r["behaviour_delivered_this_run"]=e["scope"]
   r["numerical_results"]=e["numerics"];r["inputs_versions_assumptions"]=e["engineering"]+" Synthetic USD source-declared balances and ACT/365.25; no legal acceptance."
   r.setdefault("executions",[]).append({**g,"kind":e["kind"]})
  if r["id"]=="S12-008":r["new_primary_presentation_attempt"]=e["source"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");r.write_text("# Latest opening-obligation implementation\n\n"+json.dumps(e,indent=2)+"\n\nNext: "+x["next_action"]+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact opening-obligation continuation\n\n"+x["next_action"]+"\n\n"+e["numerics"]+"\n\n"+e["engineering"]+"\n\nEvidence: generated-artifacts/dated-cash/obligations-full.receipt.json, obligations-pg.log, obligations-render.log, obligations-source-slides.json. New module bound conditionally for opening-register inputs; old stored exact reads must not acquire a new dependency. Delayed interval was NOT implemented. No new source qualified/approved. Full remaining assignment unchanged.\n")

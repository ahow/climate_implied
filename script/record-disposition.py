import json,hashlib,datetime,subprocess,importlib.util,sys
from pathlib import Path
b=Path("generated-artifacts/dated-cash");p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
rights="--rights" in sys.argv
g=json.loads((b/("rights-final-full.receipt.json" if rights else "disposition-final-full.receipt.json")).read_text());assert g["exit_code"]==0
files=["server/calculation/cohortDisposition.ts","server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts",
 "script/cohort-disposition.test.ts","script/futureCohortPostgres.ts","script/finiteCohortTransport.ts","script/disposition-render-readback.ts"]
logs=["disposition-initial.log","disposition-focused-frozen.log","disposition-pg.log","disposition-pg-frozen.log","disposition-render-frozen.log",
 "disposition-full.log","disposition-final-full.log","next-terminal-readback.log","next-terminal-readback-final.log","terminal-live-assets.json",
 "disposition-new-source-search.json","disposition-nucor-ex992.json","disposition-nucor-index.json","disposition-postledger.log"]
e={"kind":"cutoff-asset-disposition","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "functions":["assessCohortDisposition","compileDispositionSettlement","projectCompanyCohorts finite-cohort-accrual-4-disposition","finiteProducerBinding asset module"],
 "scope":"Immediate cutoff disposal cash bridge and pre-disposition stock inventory; explicit owned-claim proceeds, complete declared obligations and independent original finite computation. Synthetic evidence is not issuer/science acceptance.",
 "formula":"Closing gross units reconcile to exact physical parent; owned units = gross units × declared ownership once. Sale creates AR, not operating revenue/taxable gain. Dated receipt and explicit liability accrual/payment feed terminal cash once. 100 owned-claim proceeds −20 restoration −5 tax =75 common cash, NOT37.5.",
 "assumptions":["USD, full-unit-before-ownership physical basis, owned-claim cash basis","Constant ownership must agree with supplied physical cells; ownership transitions not implemented","Disposal at cutoff; independently dated collection/obligation payments","Source completeness declarations remain assumptions until genuine review"],
 "gates":g,"postledger":{"tests":5,"pass":5,"fail":0,"skip":0,"command":"npx tsx --test script/reconciliation-stages-00-03.test.ts script/reconciliation-stages-14-17.test.ts"},
 "focused":{"tests":1,"pass":1,"fail":0,"skip":0,"command":"npx tsx --test script/cohort-disposition.test.ts"},
 "postgres":json.loads(Path("generated-artifacts/renewal-cash/finite-postgres.json").read_text()),
 "postgres_command":"npx tsx script/futureCohortPostgres.ts --local-disposable --finite-branch --terminal-branch --asset-branch",
 "rendered":json.loads((b/"disposition-render-frozen.log").read_text()),
 "adverse":["Initial runtime check expected217 but observedef034; retained mismatch, later exact217 verified.",
 "Initial PG synthetic reset incorrectly replaced evidence array; authentic source guard refused. Corrected numeric-only fixture reset, no validation relaxation.",
 "Initial focused run6 included5 imported old tests; replaced with standalone fixture, final1 new test. No6-new-test claim.",
 "Wait command returned-1 while initial full gate continued; actual gate later exited0. Final gate repeated after explicit stock-basis/ownership-source guard."],
 "log_hashes":{str(b/f):hashlib.sha256((b/f).read_bytes()).hexdigest() for f in logs},
 "source":{"url":"https://www.sec.gov/Archives/edgar/data/73309/000119312526432117/d129328dex992.htm",
 "publication":"2026-10-26","locator":"Exhibit99.2 slide16","period":"Q3 2026",
 "finding":"Newly examined primary presentation confirms previously known CCS operation in Q3, Exxon-operated capture/transport/storage and up-to800kt/year at Convent Louisiana DRI.",
 "decision":"No priced executed instrument, billing amount/calendar, operating cost, funding or common-claim cash resolved. Capacity is not actual throughput. About80% comparison concerns DRI vs blast-furnace pig iron, not issuer cash or total emissions. Existing XOM payment direction unchanged; no backdating."},
 "remaining":["Post-disposition physical-stock/rights ledger is incomplete; sale must not imply global physical retirement or avoided emissions",
 "Delayed disposition needs explicit post-cutoff operating/cash interval; retain outcomes have no automatic periodic value",
 "Already-accrued obligations need item-level opening-liability reconciliation; unavailable rather than re-accrued",
 "Dated ownership transitions, recovery-eligibility/legal priority evidence, funded sustainable cycles/full-domain inversion incomplete",
 "Genuine principal, actual issuer economics and acceptance remain unavailable; no public publication of private inputs"]}
if rights:
 e["kind"]="asset-rights-ledger"
 e["scope"]="Version2 adds a conditional issuer-rights/physical-stock ledger, preserving version1. Sale transfers ownership without removing physical plant; retirement requires a separately declared authority reference. No legal/source acceptance inferred."
 e["formula"]+=" Rights oracle:2gross units×50%=1issuer unit; sale=>0issuer/2physical/2other-owner units. Declared whole-unit retirement=>0physical; missing authority=>null, not zero."
 e["functions"]+=["assessCohortDisposition version2 rightsLedger","projectCompanyCohorts finite-cohort-accrual-5-rights"]
 e["postgres_command"]+=" --rights-branch"
 e["rendered"]=json.loads((b/"rights-boundary-render.log").read_text())
 e["retirement_boundary"]="Ordinary service withdrawal is not physical disposal or extinction of owned-unit rights. Version2 requires an explicit complete-removal boundary and declared authority; neither is legal acceptance."
 e["earlier_gate"]=json.loads((b/"rights-full.receipt.json").read_text())
 e["source_reuse"]="Same-turn primary examination retained; this second engineering unit adds no new qualified economic source."
 e["remaining"]=e["remaining"][1:]
 e["remaining"].insert(0,"Rights ledger is a conditional plan, not a source-qualified legal determination or an executed post-cutoff service/energy/cash interval")
 for f in ["rights-boundary-focused.log","rights-boundary-pg.log","rights-boundary-render.log","rights-final-full.log"]:
  e["log_hashes"][str(b/f)]=hashlib.sha256((b/f).read_bytes()).hexdigest()
 e["postledger"]={"scope":"Prior cutoff metadata5 passed; new rights metadata check not yet recorded"}
 if (b/"rights-postledger.log").exists():
  e["postledger"]={"tests":5,"pass":5,"fail":0,"skip":0,"command":"npx tsx --test script/reconciliation-stages-00-03.test.ts script/reconciliation-stages-14-17.test.ts","log":str(b/"rights-postledger.log")}
if x.get("latest_increment",{}).get("kind")!=e["kind"]:x["prior_increment"]=x.get("latest_increment")
x["latest_increment"]=e;x["latest_changed_paths"]=files
live=json.loads((b/("disposition-live.json" if rights else "next-terminal-live.json")).read_text())
if x.get("current_release",{}).get("runtime")!=live["source"]:x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={"runtime":live["source"],"ci":43356930092 if rights else 43353222176,"conclusion":"success","readback":live,
 "assets":json.loads((b/"terminal-live-assets.json").read_text()),"scope":"Previously verified release, observed2023 and viewer JS only; not new rights branch or future/issuer/science execution"}
x.pop("pending_release",None)
x["next_action"]="Continue original0–17. Preserve cutoff asset disposition and terminal/v4 financial bridge, standalone1 test/actualPG17/new1208rows2416cells SSR JSON XLSX. Do not rerun unchanged old witnesses. Next explicit delayed physical/service/cash interval, already-accrued obligation ledger links, recovery/default/ownership transitions, then funded sustainable stock/financial cycles and compatible inverse. Present immediate cutoff model is not full liquidation/whole equity/science. Nucor new slide resolves no priced CCS economics. Reconcile next publication through existing pipeline without restart/superseding; prior217 runtime verified. No real principal/approval fabricated.65verified233partial2blocked/all300/0of3 unchanged."
if rights:
 x["next_action"]="Continue ALL original0–17; preserve disposition2-rights/finite5 and v1/v4. Sale=>issuer rights0 but physical stock retained; retirement needs declared authority AND complete physical-removal/owned-unit-rights-end boundary; service withdrawal alone refuses. No legal/science acceptance. Rights PG17/1234rows2468cells and SSR A/B/A are synthetic engineering. NEXT actual matched delayed operating/accrual/cash interval, item-level already-accrued obligations/recovery, funded whole-state sustainable cycles and compatible inverse. Preserve all300/65verified233partial2blocked/0of3/14pins/original1000of1001/frozen negatives. Existing promotion only; distinguish source/CI/runtime. No unchanged reruns or owner/principal fabrication."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["asset_disposition"]=e;r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"]
   r["behaviour_delivered_this_run"]=e["scope"]+" Physical inventory and owned-claim cash compiler integrated with retained finite producer, CLI JSON/XLSX and existing viewer. Missing material economics retain null combined value."
   r["inputs_versions_assumptions"]="; ".join(e["assumptions"])+"; synthetic inputs only, no qualified issuer admission."
   r["numerical_results"]="Synthetic 100 proceeds −20 restoration −5 tax =75 common cash; no second50% ownership multiplier.184-day degradation oracle. ActualPG17 named checks; component SSR A/B/A, not new browser acceptance. "+e["formula"]
   for key,items in [("files_functions_changed",files),("functions",e["functions"]),("formulas",[e["formula"]]),("behaviorAndInputs",[r["behaviour_delivered_this_run"],r["inputs_versions_assumptions"]])]:
    for item in items:
     if item not in r[key]:r[key].append(item)
   r["executions"]=[v for v in r["executions"] if not isinstance(v,dict) or v.get("kind")!=e["kind"]]+[{**g,"kind":e["kind"],"focused":e["focused"],"postledger":e["postledger"],"postgres_command":e["postgres_command"],"rendered":e["rendered"],"adverse":e["adverse"]}]
   r["countsLogsAndResults"][e["kind"]]={"counts":g["suite_counts"],"logs":e["log_hashes"],"scope":e["scope"]}
   if rights:
    r["git_commit"]=None
    r["deployment_revision"]=live["source"]
    r["revision_boundary"]="Rights version2 tested as worktree content hashes; not yet published at record time. Prior deployed749 is version1, not rights-version2 execution."
   r["commandsAndDates"].append(f'{e["at"]}: {e["focused"]["command"]}; {e["postgres_command"]}; npx tsx script/disposition-render-readback.ts; full original/private gate in disposition-final-full.receipt.json')
  elif r["id"]=="S12-017":r["nucor_additional_presentation"]=e["source"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");mark="<!-- cutoff-disposition-history -->\n";text=r.read_text()
if mark in text:text=text.split(mark,1)[1]
r.write_text("# Latest cutoff asset disposition\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+mark+text)
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact asset-disposition continuation\n\n"+x["next_action"]+
 "\n\nSource modules: cohortDisposition.ts, companyCohortProjection.ts, companyOperatingReview.ts. New immediate-cutoff branch uses explicit gross physical basis/owned cash basis, source-matching ownership, sale AR, dated collections and classified restoration/tax settlement. No second ownership multiplier. Financial source starts from exact closing states. Unsupported dates/retention/previously accrued obligations retain null combined value and reasons.\n\n"+
 "Final local gate1362TS/1361pass/0fail/1optionalPGskip;264Python plus mandatory private/type/build. New standalone1test, actualPG17checks/1208rows2416cells and actual component SSR A/B/A+JSON/XLSX (not new browser test). Evidence generated-artifacts/dated-cash/disposition-final-full.receipt.json, disposition-pg-frozen.log, disposition-render-frozen.log. Failed first PG reset and old-runtime assertion retained; earlier initial6focused included5 imported old tests, not6new. Previous217 runtime now verified with1054rows2108cells and served viewer privacy markers; not future execution.\n\n"+
 "New primary NucorEx99.2/slide16 and SECindex confirm Oct26publication/Q3operation/up-to800kt and operator diagram, but resolve NO fee/billing/funding/commoncash. Not a new qualified economic source. No repeated scientific fits or approval. Local handoff becomes public only on coherent source synchronization; do not call it available at an earlier commit.\n")
if rights:
 Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact rights-ledger continuation\n\n"+x["next_action"]+
  "\n\nModules: cohortDisposition.ts(v2 retains v1), companyCohortProjection.ts(finite5 retains finite4), retained finiteProducerBinding. Source/gas/stock/claim hashes preserved; no real approvals. New rows separate issuer rights, other owners and physical units. Avoided emissions/future activity stay null. Declared authority is not validated legal authority.\n\n"+
  "Local original/private gate: rights-final-full.receipt.json/log; new PG rights-boundary-pg.log17checks/1234rows2468cells; component SSR/JSON/XLSX rights-boundary-render.log. One expanded standalone test covers v1 cash and v2 sale/retire/retain/unknown authority/boundary. Prior initial-runtime and fixture-reset failures preserved; earlier rights-full passed before final boundary guard, not final-source evidence. No new efficacy/scientific acceptance. Prior74988dcc runtime was verified; do not reset receipt to217. Reconcile subsequent release without restart/superseding.\n")

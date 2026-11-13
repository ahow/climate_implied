import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
b=Path("generated-artifacts/dated-cash");p=Path("docs/workplan_completion_ledger.json")
x=json.loads(p.read_text());g=json.loads((b/"terminal-viewer-final-full.receipt.json").read_text());assert g["exit_code"]==0
files=["server/calculation/terminalSettlement.ts","server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts",
 "script/terminal-settlement.test.ts","script/futureCohortPostgres.ts","script/finiteCohortTransport.ts",
 "client/src/lib/private-finite-reader.ts","client/src/pages/private-finite-viewer.tsx","client/src/pages/private-finite-viewer.test.ts",
 "client/src/App.tsx","client/src/components/app-sidebar.tsx","docs/field_semantics_census.json","script/component-state-contracts.ts","script/component-state-census.test.ts"]
logs=["terminal-final-focused.log","terminal-final-types.log","terminal-pg.log","terminal-final-pg.log",
 "terminal-viewer-full.log","terminal-viewer-final-full.log","terminal-census-correction.log","terminal-census-final.log","terminal-viewer-browser.json","terminal-fourth-amendment.json","terminal-q3-index.json","terminal-new-source-search.json"]
e={"kind":"terminal-settlement-and-local-viewer","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "functions":["settleTerminal","projectCompanyCohorts finite-cohort-accrual-3-terminal","finiteProducerBinding terminal module","browser-local private finite reader"],
 "formula":"Dated common PV = distributions minus contributions discounted ACT/365.25. Opening cash + collected AR + otherWC - opening liabilities - subsequent accrued costs = common net cash. Default is noncash; debt financing cancels principal once.",
 "implementation":"Closing daily balances bind to terminal opening, exact physical parent/claim, dated default/recovery/AP/tax/debt/noncommon/otherWC settlement, subsequent classified accrual, funding and common-after-liabilities priority. Original finite/liquidation branches retained; simultaneous legacy liquidation refuses. Combined finite project PV includes terminal once.",
 "limitations":["Financial balances only, not disposition/valuation of surviving physical assets","No intraday ordering or complete legal creditor-priority determination",
 "Funded sustainable replacement/periodic continuation and compatible full-domain inversion remain partial","No actual issuer qualification or genuine HTTP principal; private routes403 unchanged"],
 "full_gate":g,"focused":{"tests":10,"pass":10,"fail":0,"skip":0,"command":"npx tsx --test script/terminal-settlement.test.ts client/src/pages/private-finite-viewer.test.ts"},
 "postgres":json.loads(Path("generated-artifacts/renewal-cash/finite-postgres.json").read_text()),
 "postgres_command":"npx tsx script/futureCohortPostgres.ts --local-disposable --finite-branch --terminal-branch",
 "browser":json.loads((b/"terminal-viewer-browser.json").read_text()),
 "adverse":["First terminal PG run failed old exact v2 assertion; retained failure, version3 required only for terminal branch. Original v2 check preserved for nonterminal.",
 "Intermediate full gate1361 tests:1356pass/4fail/1optionalPGskip due missing two new component policies. First census correction2pass/2fail exposed stale totals96vs98 and preserved original60 cohort. Added exact new component names/policies; final focused census4pass, original60 unchanged.",
 "Browser mandatory comparisons passed; final optional recapture interrupted by Vite restart, not counted as completed recapture.",
 "Initial fourth-amendment search returned irrelevant results; direct primary SEC index resolved actual exhibit."],
 "log_hashes":{str(b/f):hashlib.sha256((b/f).read_bytes()).hexdigest() for f in logs},
 "source":{"url":"https://www.sec.gov/Archives/edgar/data/1603145/000160314526000039/xplr-q32026xex102d.htm",
 "filing":"2026-11-03","effective":"2026-08-28","locator":"Fourth amendment section1 and replacement ExhibitB",
 "facts":{"project":"Palo Duro BESS","outsideContributionDate":"2026-09-30","governmentalApprovalDeadline":"2027-02-28","expectedCOD":"2027-11-15","capacityMWac":150,"interconnectionAssetValueAsPrinted":"$13,578,528"},
 "decision":"Contractual future schedule, NOT payment/approved permit/operating capacity/October40m recipient or NEE common cash. No earlier public-vintage use. Printed fee reservations remain unresolved."}}
if (b/"terminal-postledger.log").exists():
 e["postledger"]={"tests":5,"pass":5,"fail":0,"skip":0,"command":"npx tsx --test script/reconciliation-stages-00-03.test.ts script/reconciliation-stages-14-17.test.ts","log":str(b/"terminal-postledger.log"),"sha256":hashlib.sha256((b/"terminal-postledger.log").read_bytes()).hexdigest()}
if x.get("latest_increment",{}).get("kind")!=e["kind"]:x["prior_increment"]=x.get("latest_increment")
x["latest_increment"]=e;x["latest_changed_paths"]=files
live=json.loads((b/"ef-live.json").read_text())
if x.get("current_release",{}).get("runtime")!=live["source"]:x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={"runtime":live["source"],"ci":43348563023,"conclusion":"success","readback":live,"scope":"Observed2023 and403 only, not future execution"}
x.pop("pending_release",None)
x["next_action"]="Preserve terminal-settlement-1/finite-cohort-accrual-3-terminal and browser-local viewer; full gate and mandatory private checks recorded, synthetic PG17 terminal branch/964rows1928cells and browser A/B/A literal readback passed. Reconcile subsequent promotion without restart/superseding. Continue physical-asset retirement/liability obligations and funded sustainable cycle boundary/inversion; do NOT call financial-balance settlement complete liquidation/whole equity. Genuine HTTP principal unavailable; local file reader has no uploads/persistence, integrity is not authentication. New fourth XPLR amendment published Nov3 sets Sep30 contribution deadline, not actual cash or October40m link. Next source: actual election/finalLLCA/settlement/common-claim evidence. Continue original22driver/dated11–15 work; all300/65verified233partial2blocked/0of3 unchanged."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["terminal_settlement"]=e;r["remaining_gaps"]=e["limitations"];r["next_action"]=x["next_action"]
  elif r["id"]=="S12-017":r["fourth_amendment"]=e["source"]
  elif r["id"]=="S16-007":r["additional_local_viewer"]="Additional owner-file viewer verified on synthetic terminal JSON/XLSX, no uploads/HTTP auth/science acceptance. Original closed finite export criterion not reopened."
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- terminal-settlement-history -->\n";history=r.read_text()
if marker in history:history=history.split(marker,1)[1]
r.write_text("# Latest dated terminal settlement and private local viewer\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+marker+history)
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))

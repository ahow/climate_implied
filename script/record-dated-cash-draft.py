import json,hashlib,subprocess
from pathlib import Path
from datetime import datetime,timezone
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e={"at":datetime.now(timezone.utc).isoformat(),"status":"Finite dated accounting integrated into renewal; full S13-004 remains partial; not yet released",
"files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in ["server/calculation/cohortCashLedger.ts","script/cohortRenewal.test.ts"]},
"function":"reconcileDatedAccruals -> deriveDatedProjectCash -> valueDatedProjectCash; evaluatePeriodicRenewal finite accounting integration",
"scope":"Explicit accrual and settlement dates maintain AR/AP/tax/debt/noncommon/otherWC/cash and common contribution/distribution balances; each annual closing reconciles once. Settling before accrual/funding refuses. Integrated renewal-3-finite-dated-accounting returns finite dated accounting and null periodic value: dated transition/sustainable cycles not certified. Same-day netting, no intraday/prepayment/full asset-equity accounting.",
"tests":{"command":"npx tsx --test script/cohortRenewal.test.ts","pass":10,"fail":0,"skip":0,"log":"generated-artifacts/dated-cash/accrual-integrated.log","log_sha256":hashlib.sha256(Path("generated-artifacts/dated-cash/accrual-integrated.log").read_bytes()).hexdigest()},
"typecheck":{"initial":"FAILED TS2802 iterator target incompatibility at three loops, including prior draft","failure_log":"generated-artifacts/dated-cash/component-types.log","fix":"Array.from, no compiler setting relaxation","corrected":"passed","log":"generated-artifacts/dated-cash/component-types-corrected.log"},
"oracle":"90/(1.1^(182/365.25))+90/(1.1^(547/365.25)); tolerance1e-9. Early unfunded payout and invalid February30 refuse.",
"not_executed":["Admitted API/UI/export integration","Qualified new issuer input","Additional PostgreSQL transport cases","Partial-calendar/degrading sustainable cycles"],
"science":"No issuer qualification or empirical efficacy; no original clause promoted"}
e["files"]["server/calculation/cohortRenewal.ts"]=hashlib.sha256(Path("server/calculation/cohortRenewal.ts").read_bytes()).hexdigest()
gate=Path("generated-artifacts/dated-cash/accrual-full.receipt.json")
e["full_gate"]=json.loads(gate.read_text()) if gate.exists() else {"status":"running"}
pg=Path("generated-artifacts/dated-cash/pg-committed.receipt.json")
if pg.exists():
 e["additional_local_postgresql"]=json.loads(pg.read_text())
 e["additional_local_postgresql_scope"]="After the application gate and published source: v3 accounting, eight dependency/review/result faults with savepoint rollback, concurrent committed staging/decisions, conflicting decision, reconnect and transaction-failure atomicity. First rollback phase zero headers; committed phase six synthetic headers in stopped private local cluster. No HTTP/operator authorization proof."
 e["files"]["script/futureCohortPostgres.ts"]=hashlib.sha256(Path("script/futureCohortPostgres.ts").read_bytes()).hexdigest()
 e["not_executed"]=[v for v in e["not_executed"] if v!="Additional PostgreSQL transport cases"]
 e["not_executed"].append("Genuine authenticated operator reader/access isolation")
ci=Path("generated-artifacts/dated-cash/ci.json")
if ci.exists():
 runs=json.loads(ci.read_text()).get("workflow_runs",[])
 if runs:
  run=runs[0];e["release"]={"source":run["head_sha"],"ci":run["id"],"status":run["status"],"conclusion":run["conclusion"],
   "runtime_observation":json.loads(Path("generated-artifacts/dated-cash/runtime.json").read_text()),
   "boundary":"Runtime observation recorded separately; extra PostgreSQL harness is local and not in this published source"}
e["postledger"]={"pass":7,"fail":0,"skip":0,"log":"generated-artifacts/dated-cash/accrual-postledger.log"}
e["new_source_attempt"]={"at":e["at"],"XPLR":"Targeted legal-party/payment query returned previously examined releases; not reread or counted as new economic evidence.",
"FSLR":"Targeted Indian government PLI-disbursement query; retrieved first two extracted chunks of https://mnre.gov.in/static/uploads/2026/10/dddd221c6d2f2bb411584c5624c71c4e.pdf. No issuer-specific grant amount/day/classification qualified in examined chunks; remainder not examined, no global unavailability claim.",
"files":["generated-artifacts/dated-cash/india-source-search.json","generated-artifacts/dated-cash/mnre-2026-extract.md","generated-artifacts/dated-cash/mnre-2026-extract-2.md"],"accepted_inputs":0}
e["log_hashes"]={str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in [
 Path("generated-artifacts/dated-cash/pg-schema-aligned.log"),Path("generated-artifacts/dated-cash/pg-committed.receipt.json"),
 Path("generated-artifacts/dated-cash/accrual-postledger.log")] if f.exists()}
e["transport_correction"]="Earlier real-PG runs used text company IDs/minimal review columns. Final run aligned company integer identity/name/unique ISIN and review constraints with shared/schema.ts. Earlier receipts retained; no full-schema or genuine-principal claim."
x["prior_cash_increment"]=x.get("latest_increment");x["latest_increment"]=e
x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={"runtime":"bff160798d2e795eaaea508cc9bf608ccae2d0ec","ci":43321351329,"conclusion":"success",
"observation":"User independently observed2026-11-12 22:52; not rechecked this turn","health":200,
"identity":"b0b168096232e5c708f1ad808061830ff5972f75c8f9c10c3d64cb6d04449a8e","rows":1054,"cells":2108,
"scope":"Observed2023 accounting, not future cash/renewal execution"}
live=Path("generated-artifacts/dated-cash/live-readback.json")
if live.exists() and e.get("release",{}).get("runtime_observation",{}).get("sourceCommit")==e.get("release",{}).get("source"):
 x["current_release"]={"runtime":e["release"]["source"],"ci":e["release"]["ci"],"conclusion":e["release"]["conclusion"],
 "readback":json.loads(live.read_text()),"scope":"Agent observed safe accounting readback; no future accounting/issuer execution claim"}
 e["status"]="Application finite dated accounting validated/deployed at1f809c58; subsequent PostgreSQL harness extension locally executed; full S13-004 remains partial"
x.pop("pending_release",None)
x["next_action"]="Source1f809c58/CI43327129911 succeeded and exact runtime plus safe1054-row/2108-cell accounting readback verified. Do not repeat promotion. Preserve renewal-v3 finite dated accrual and null periodic value. Local actualPG extension covers eight dependency/review/result faults, concurrent committed stages/decisions, reconnect and atomic rollback; it is not in published1f809c58 and genuine operator reader/access isolation remains. Finish matched partial-calendar/degrading transition/sustainable cycles, explicit cash-versus-accrual cost/AP-otherWC boundaries, certified inverse and admitted consumers. Qualify original issuer inputs; examined government chunks yielded no qualified FSLR payment."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":r["dated_cash_draft"]=e;r["next_action"]=x["next_action"]
  if r["id"]=="S13-017":
   r["next_action"]="Preserve coveredPhysicalPaths full-declared-set/null-range tests; finish completeness audit of actual producer-map assumption manifests and admitted consumers against this finite criterion, without adding unrelated scientific/owner acceptance."
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- dated-accrual-history -->\n";history=r.read_text()
if marker in history:history=history.split(marker,1)[1]
r.write_text("# Latest finite dated-accounting integration\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+marker+history)
subprocess.run(["python","script/completion-ledger.py"],check=True)

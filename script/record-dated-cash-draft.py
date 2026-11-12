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
e["new_source_attempt"]={"at":e["at"],"XPLR":"Targeted legal-party/payment query returned previously examined releases; not reread or counted as new economic evidence.",
"FSLR":"Targeted Indian government PLI-disbursement query; retrieved first two extracted chunks of https://mnre.gov.in/static/uploads/2026/10/dddd221c6d2f2bb411584c5624c71c4e.pdf. No issuer-specific grant amount/day/classification qualified in examined chunks; remainder not examined, no global unavailability claim.",
"files":["generated-artifacts/dated-cash/india-source-search.json","generated-artifacts/dated-cash/mnre-2026-extract.md","generated-artifacts/dated-cash/mnre-2026-extract-2.md"],"accepted_inputs":0}
x["prior_cash_increment"]=x.get("latest_increment");x["latest_increment"]=e
x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={"runtime":"bff160798d2e795eaaea508cc9bf608ccae2d0ec","ci":43321351329,"conclusion":"success",
"observation":"User independently observed2026-11-12 22:52; not rechecked this turn","health":200,
"identity":"b0b168096232e5c708f1ad808061830ff5972f75c8f9c10c3d64cb6d04449a8e","rows":1054,"cells":2108,
"scope":"Observed2023 accounting, not future cash/renewal execution"}
x.pop("pending_release",None)
x["next_action"]="Resume finite dated-accrual integration (renewal v3, periodic value deliberately null). Finish matched physical transition/degrading sustainable cycles, dated claim/inversion and retained consumers. Preserve actualPG witness; extend corruption/concurrency/committed/authenticated reader tests. Qualify issuer-specific inputs rather than programme totals; latest government search examined only two chunks and yielded no qualified FSLR payment. Reconcile gate/release receipts before promotion."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":r["dated_cash_draft"]=e;r["next_action"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");r.write_text("# Latest local dated-cash draft — not released\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)

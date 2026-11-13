import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
receipt=Path("generated-artifacts/dated-cash/ap-v2-full.receipt.json")
e={"at":datetime.now(timezone.utc).isoformat(),"scope":"S13-004 partial: version2 explicit accrued operating costs versus cash settlements",
 "files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in ["server/calculation/cohortCashLedger.ts","server/calculation/cohortRenewal.ts","script/cohortRenewal.test.ts"]},
 "functions":["reconcileDatedAccruals","evaluatePeriodicRenewal"],
 "formula":"cashAdjustment=accruedVariableCost+accruedEnergyCost-paidVariableCost-paidEnergyCost; APclosing=APopening+accruals-settlements. Already-cash-paid costs bypass AP; otherWC must explicitly exclude AR/AP/tax.",
 "oracle":"Each year revenue100, operating accrual20, operating payment10, cash-paid replacement10, distribution80; APclosing10 then20. Periodic value null. Engineering only.",
 "focused":{"pass":11,"fail":0,"skip":0,"command":"npx tsx --test script/cohortRenewal.test.ts","log":"generated-artifacts/dated-cash/ap-v2-integrated.log"},
 "typecheck":{"command":"npm run check","log":"generated-artifacts/dated-cash/ap-v2-integrated-types.log","result":"passed"},
 "full_gate":json.loads(receipt.read_text()) if receipt.exists() else {"status":"running"},
 "source_attempt":{"url":"https://mnre.gov.in/static/uploads/2026/10/dddd221c6d2f2bb411584c5624c71c4e.pdf",
 "examined":"Previously unexamined extracted characters100000–150000; still truncated. No FS India/First Solar/PLI-disbursement match in this portion.",
 "log":"generated-artifacts/dated-cash/mnre-next-extract.md","qualified_inputs":0,"boundary":"No whole-document or global-unavailability conclusion; no amount/date/FX/classification inferred."},
 "science":"No issuer qualification, historical efficacy, periodic certification or market inference. Prior negative studies untouched.",
 "remaining":["Daily physical engine exists; matched partial-calendar/degrading periodic continuation remains unsupported",
 "Admitted API/UI/XLSX consumers and genuine operator access remain incomplete",
 "Accrual v2 is not full asset/equity accounting, terminal liability settlement or certified inverse"]}
physical=Path("generated-artifacts/dated-cash/physical-finite-full.receipt.json")
if physical.exists():
 e["prior_accrual_gate"]=e["full_gate"];e["full_gate"]=json.loads(physical.read_text())
 e["scope"]+="; finiteAccounting now connects companyProjection's actual partial-calendar/degrading physical model independently of renewal"
 for f in ["server/calculation/companyCohortProjection.ts","script/companyCohortProjection.test.ts"]:
  e["files"][f]=hashlib.sha256(Path(f).read_bytes()).hexdigest()
 e["functions"].append("projectCompanyCohorts")
 e["physical_oracle"]="92 daily exposures sum(0.9^(day/365.25)); storage charge=service/0.8. Explicit20 contribution before construction20; accrual and settlement are separate. Early funding refuses; periodic value null; matching physical parent and complete assumptions retained."
 e["focused"]={"pass":16,"fail":0,"skip":0,"command":"npx tsx --test script/companyCohortProjection.test.ts script/cohortRenewal.test.ts","log":"generated-artifacts/dated-cash/physical-finite-corrected.log"}
 e["adverse"]={"initial_types":"TS2783 duplicate version overwritten by spread","log":"generated-artifacts/dated-cash/physical-finite-types.log","fix":"Set finite-cohort-accrual-1 after spread; explicit assertion added; no compiler relaxation"}
 e["remaining"].append("Annual physical amounts and explicit accrual dates are linked; exact within-period revenue/cost recognition law still needs stronger temporal qualification")
x["prior_increment"]=x.get("latest_increment");x["latest_increment"]=e
x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={"runtime":"fadd24d8d283579aa25fb98dcb93be63b65cbd94","ci":43330611914,"conclusion":"success",
 "observation":"Supervisor independently verified2026-11-12T23:57:08Z; not rerun by agent","health":200,
 "rows":1054,"literalCells":2108,"identity":"6e8c9023920b0bd59b513c850b35f50688bd09b1dd081bf50d8382e031fa45bc",
 "scope":"Observed2023 accounting, not new accrual-v2/future renewal execution"}
x.pop("pending_release",None)
live=Path("generated-artifacts/dated-cash/ap-v2-live.json")
if live.exists():
 x["current_release"]={"runtime":"ba2090066efb85c7f206baafea01947a7771d537","ci":43335033391,"conclusion":"success","readback":json.loads(live.read_text()),
 "scope":"Agent observed exact source and safe observed-accounting export; not future-case execution"}
x["next_action"]="Preserve accrued/paid operating cost bridge v2 and11focused checks; inspect current full gate receipt before promotion. Reuse existing daily physical engine to connect partial-calendar/degradation/storage and dated accrual/cash into finite projection independently of periodic certification; settle remaining terminal liabilities before any complete project-value claim. Finish admitted consumers/reader and certified continuation/inverse; no operator/selfapproval bypass. MNRE next portion yielded no qualified issuer receipt. Preserve prior actualPG transport without rerunning unchanged cases."
if e["full_gate"].get("exit_code")==0:
 x["next_action"]=x["next_action"].replace("inspect current full gate receipt before promotion","full gate passed1355TS/1354pass/0fail/1optionalPGskip+264Python and mandatory private/type/build; reconcile the new existing promotion and verify its exact runtime")
if physical.exists():
 x["next_action"]="Preserve independent finiteAccounting branch in companyProjection, partial-calendar/degrading generation/storage oracle, accrued-versus-paid v2 bridge and null periodic value. Latest full gate1356TS/1355pass/0fail/1optionalPGskip+264Python/private/type/build;16focused. Earlier AP release ba209006/CI43335033391 verified live; do not repeat it. Reconcile the subsequent finite-path publication. Finish within-period physical/recognition timing qualification, admitted reader/UI/export journey, terminal liability/common-claim boundaries and funded sustainable continuation/inverse. New finite branch has not been executed through genuine operator/production records; previous PG tests are not evidence of this new branch. Keep original issuer/driver sources and all remaining0–17 clauses advancing; MNRE next portion qualified no issuer payment."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["accrual_v2"]=e;r["next_action"]=x["next_action"]
   r["remaining_gaps"]=e["remaining"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
r.write_text("# Latest accrued-versus-paid operating integration\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))

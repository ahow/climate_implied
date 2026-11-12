"""Incremental evidence; preserves original clauses and adverse receipts."""
import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
now=datetime.now(timezone.utc).isoformat()
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
files=["server/calculation/operatingCohorts.ts","server/calculation/companyCohortProjection.ts",
"server/calculation/coveredPhysicalPaths.ts","server/snapshots/companyOperatingReview.ts",
"script/datedOperatingCohorts.test.ts","script/companyCohortProjection.test.ts",
"client/src/pages/dashboard.tsx","client/src/pages/decarb-signal.tsx","client/src/pages/decarb-gap-signal.tsx"]
files.append("script/remaining-component-contracts.test.ts")
files+=["script/component-state-contracts.ts","script/component-state-census.test.ts"]
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
logs={}
for f in Path("generated-artifacts/dated-cohort").glob("*.log"):
 logs[str(f)]={"sha256":sha(f),"completed_at":datetime.fromtimestamp(f.stat().st_mtime,timezone.utc).isoformat()}
e={"recorded_at":now,"files":{f:sha(f) for f in files},
"functions":["calculateOperatingCohorts","projectCompanyCohorts","stageCompanyOperatingInTransaction","validateCohortProducer","decideCompanyOperatingInTransaction","projectReviewedCompanyInTransaction"],
"new":"UTC civil-day commissioning/retirement and legacy stock; explicit storage charge/loss/cash; actual operating review lifecycle retains server-calculated cohort result and code, authentic source/evidence and financial identity. Current-executable mismatch refuses instead of current-code substitution. Missing/corrupt dependencies refuse; duplicate cohort channels/ownership refuse; incomplete declared scenario domain cannot be admitted.",
"numerics":{"fixture_only":True,"leap_year_service":182,"charge_kWh":227.5,"loss_kWh":45.5,"grid_cash":22.75,"fcfe":331.25,"energy_tolerance":1e-10,"cash_tolerance":1e-9,"owned_native_CO2_tonnes":100},
"commands":["npx tsx --test script/datedOperatingCohorts.test.ts script/operatingCohorts.test.ts script/cohortGrowthInverse.test.ts",
"npx tsx --test script/companyCohortProjection.test.ts script/datedOperatingCohorts.test.ts","npm run check",
"npx tsx script/field-semantics-census.ts","npx tsx script/output-register.ts",
"python script/workplan-evidence-run.py --receipt-only --full-checks --timeout 7200 --log generated-artifacts/dated-cohort/coherent-final.log --receipt generated-artifacts/dated-cohort/coherent-final.receipt.json"],
"focused":"Earlier10/10; admission initial3pass1fail (duplicate shared parent), corrected4pass0fail0skip. Memory transport exercises actual helpers, NOT PostgreSQL/auth proof.",
"failure_history":"First coherent1333TS:1328pass/4fail/1optionalPGskip. Two stale census checks, browser-environment reference and stale warning source fingerprint; retained, not hidden.",
"scientific_decision":"Engineering only; no qualified company case, calibrated ensemble, historical efficacy, actual new source retrieval or owner approval.",
"remaining":["Finite liquidation/replacement/steady-state economics and full claim/valuation continuation remain incomplete.",
"Real source-complete future cohorts and genuine owner/identity approval absent; no production activation.",
"Broader production comparator inventory/rendered deployment verification remains separate from three changed routes.",
"New primary economic/source retrieval and original frozen studies unattempted this increment, not globally unavailable."],
"logs":logs}
receipt=Path("generated-artifacts/dated-cohort/coherent-verified.receipt.json")
if receipt.exists():e["coherent_receipt"]=json.loads(receipt.read_text())
for path in Path("generated-artifacts/dated-cohort").glob("coherent*.receipt.json"):
 record=json.loads(path.read_text())
 if not any(r.get("log")==record.get("log") for r in x.setdefault("run_executions",[])):
  x["run_executions"].append(record)
e["new_source_attempt"]={"issuer":"XPLR, not consolidated NEE common equity",
"url":"https://www.investor.xplrinfrastructure.com/~/media/Files/x/xplr-infrastructure-ir/reports-and-fillings/quartely-earnings/2026/2026-1103%20XPLRQ32026News%20Release%20vFinal.pdf",
"document_date":"2026-11-03","availability":"publication day, not exact timestamp or earlier historical vintage",
"retained_extract":"generated-artifacts/dated-cohort/xplr-q3-source.md",
"sha256":sha("generated-artifacts/dated-cohort/xplr-q3-source.md"),
"locator":"Condensed consolidated cash flows, nine months ended September30; investing activities",
"finding":"Payments FROM related parties under CSCS agreement NET $7m (2026), $114m comparator. Not gross NEER recipient cash. Current/noncurrent due-to-related balances do not establish cash settlement.",
"decision":"No new NEE common-FCFE coefficient; named gross recipients, settlement dates and attribution remain absent from examined release. Not a global nondisclosure claim."}
e["subsequent_primary_filing"]={
"url":"https://www.sec.gov/Archives/edgar/data/1603145/000160314526000039/xplr-20260930.htm",
"accession":"0001603145-26-000039","period":"2026-09-30","filed_day":"2026-11-03",
"locator":"Note9 Related Party Transactions, Due to Related Parties",
"retained_extract":"generated-artifacts/dated-cohort/xplr-q3-note9.md",
"sha256":sha("generated-artifacts/dated-cohort/xplr-q3-note9.md"),
"hash_surface":"Retained webFetch markdown extraction of the SEC URL; not raw SEC bytes, exact acceptance timestamp or independent authentication",
"observed_statement":{"approximate_paid_USD_millions":40,"paid_month":"2026-10","exact_day":None,"recipient_description":"NEER; filing abbreviation may include subsidiaries","purpose":"repowering payables","average_terms_days":165},
"not_established":["Named legal recipient/project allocation","Parent common cash or project margin","Same cohort as June246m payable","Exact payment day","2024/2025-origin availability"],
"decision":"Material new cash-timing evidence, not recognition-to-cash inference. Retain as subsequent-period input; no common-FCFE allocation or prior frozen-study rerun."}
e["failure_history"]+=" Second coherent1335TS:1332pass/2fail/1skip; retained legacy-view assertions needed explicit development view after production retirement. Assertions retained; production absence assertion added."
e["failure_history"]+=" Third coherent1336TS:1333pass/2fail/1skip; census correctly detected two new internal retained views. Total95 explicitly includes these two additions; original60 component denominator preserved."
e["remaining"][3]="New XPLR primary release examined; other issuer/calibration source attempts not executed this increment. Exact missing economics remain, not global unavailability."
x.setdefault("latest_increment",{})["dated_cohort_admission"]=e
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S12-017":
   r["dated_primary_cash_evidence"]=e["subsequent_primary_filing"]
   r["next_action"]="Resolve named recipient/project allocation and common-claim/cost classification for the newly sourced October2026 approximately40m payment; do not equate it to June246m settlement or backdate."
  if r["id"] in ["S13-004","S13-012","S13-017","S13-020","S17-009"]:
   r["dated_cohort_evidence"]=e
   r["files_functions_changed"]=files
   r["behaviour_delivered_this_run"]=e["new"] if r["id"]!="S17-009" else "Production-only retirement of dashboard legacy toggle and two legacy ranking backtest/table surfaces; ordinary diagnostics and retained paired research preserved; developer implementations retained."
   r["next_action"]={"S13-004":e["remaining"][0],"S13-012":e["remaining"][1],"S13-017":"Finish authoritative assumption/range coverage across all actual Tier1 producers; no unrelated scientific criterion added.","S13-020":"Retain covered reconciliation and explicit unavailable expanded population; no invented global denominator.","S17-009":e["remaining"][2]}[r["id"]]
old=x.get("current_release")
if old and old.get("runtime")!="f3ef9067abb42b4e0f6825ded0375b0e0675339d":x.setdefault("release_history",[]).append(old)
x["current_release"]={"runtime":"f3ef9067abb42b4e0f6825ded0375b0e0675339d","build_info_source_commit":"f3ef9067abb42b4e0f6825ded0375b0e0675339d","ci":43289646254,"ci_conclusion":"success","health":{"status":"ok"},"railway_deployment":None,"verified_at":now,"scope":"Prior cohort promotion verified; this dated/admission/UI increment LOCAL ONLY","readback":{"JSON_XLSX_exact_literal_cells":1051,"identity":"5d42662b3f9ed3bfd6823830e783f05949060e180bdf53532e0835d077b93121","log":"generated-artifacts/dated-cohort/prior-live-readback.log"}}
x["current_release"]["verified_at"]=datetime.fromtimestamp(Path("generated-artifacts/dated-cohort/promoted-build.json").stat().st_mtime,timezone.utc).isoformat()
x["current_release"]["local_workspace_head"]=subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip()
x["current_release"]["new_increment_deployed"]=False
x["next_action"]="Finish dated cohort terminal/claim continuation, real source/approval-bound future activity and remaining production comparator routes. Inspect final dated-cohort gate and browser receipts; promote only after coherent mandatory checks. Continue original source/case/calibration work; no new science acceptance."
x.setdefault("restart",{})["instruction"]=x["next_action"]
e["browser"]="Production-browser assignment cancelled after it failed to return a result; no browser passing receipt claimed. Actual production-entry SSR assertions retained separately."
e["static_render"]={"initial":"Static harness404 from Vite client-relative output directory; build moved into ignored root artifact directory, no app-code workaround",
"corrected":"Production-built dashboard renders explicit unavailable-data states; static server has no backend and was stopped after capture",
"screenshot":"screenshots/dated-cohort-production-static-corrected.jpg","scope":"Single static viewport, not interactive/live-route acceptance"}
e["build_warnings"]=["Existing retainedPairedResearchProjection import.meta/CJS warning remains; build success is not proof that all historical report paths are executable.","Existing frontend chunk-size warning retained."]
x["latest_changed_paths"]=files
p.write_text(json.dumps(x,indent=2)+"\n")
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- prior-dated-cohort-report -->\n";text=report.read_text()
if marker in text:text=text.split(marker,1)[1]
report.write_text("# Dated cohort admission — latest local increment\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+marker+text)
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],check=True)
# Current source fingerprints only; retained original warning bytes stay immutable.
w=Path("docs/scientific-strands-warning-evidence.json");v=json.loads(w.read_text())
for row in v["warningInventory"]:row["currentSha256"]=sha(row["path"])
w.write_text(json.dumps(v,indent=2)+"\n")

"""Incremental evidence for existing original criteria; no approval/status invention."""
import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
now=datetime.now(timezone.utc).isoformat()
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
files=["server/calculation/cohortLiquidation.ts","server/calculation/operatingCohorts.ts","server/calculation/cohortGrowthInverse.ts",
 "server/retainedPairedResearchProjection.ts","script/run-paired-research-pipeline.ts","script/paired-projection-cjs.test.ts",
 "server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts","script/companyCohortProjection.test.ts",
 "docs/Cohort_Liquidation_Protocol.json","script/cohortLiquidation.test.ts",
 "client/src/pages/methodology.tsx","script/remaining-component-contracts.test.ts",
 "script/quantity-label-contracts.test.ts","script/component-state-contracts.ts","script/component-state-census.test.ts"]
root=Path("generated-artifacts/liquidation")
e={"recorded_at":now,"files":{f:sha(f) for f in files},
 "functions":["calculateCohortLiquidation","calculateOperatingCohorts","MethodologyView"],
 "previous":"Dated stock/storage, future review helpers, proportional polynomial and source-bound observed report retained.",
 "new":"Explicit finite offline liquidation: surviving units, dated salvage, retirement/remediation, tax/WC/debt/non-common balances, holding/transaction cash, ACT365.25 PV and interim funding shortfalls. No perpetual/whole-equity inference. Methodology legacy evidence mounts only in developer view; original regression assertions retained there.",
 "inputs":"Explicit USD balances and future payment dates, source evidence IDs, declared offline service and rate. Subsequent accruals separate from opening liabilities; annual cash is not deducted again.",
 "numerics":{"engineering_only":True,"surviving_units":2,"opening_cash":10,"net_settlement_cash":57,
 "common_residual":67,"zero_salvage_residual":-33,"early_tax_interim_funding":6,"cash_test_tolerance":1e-9},
 "claims":"No issuer case, original-vintage history, Stage7 ensemble, scientific efficacy or owner approval conferred.",
 "failure_history":["Focused Node20 mixed test command timed out after300s; no final count or passing claim.",
 "First full Node22 gate1339 tests:1333pass/5fail/1optionalPGskip. Stale field census, two preserved legacy-render expectations and current warning fingerprints; no Python/private gate run after failed TS stage."],
 "remaining":["Sustainable replacement/steady-state stock/cash and compatible issuer valuation are not implemented by finite liquidation.",
 "Future source-complete approved producer still unavailable; memory helper tests do not prove PostgreSQL/principal acceptance.",
 "Clean reproduction uses explicitly copied dependencies; not a fresh locked dependency install or complete S17 pack.",
 "Production comparator runtime of this changed methodology is not yet verified."] }
e["logs"]={str(f):{"sha256":sha(f),"finished_at":datetime.fromtimestamp(f.stat().st_mtime,timezone.utc).isoformat()} for f in root.glob("*.log")}
e["executions"]=[]
for f in root.glob("*.receipt.json"):
 r=json.loads(f.read_text());e["executions"].append(r)
 if not any(a.get("log")==r.get("log") for a in x.setdefault("run_executions",[])):x["run_executions"].append(r)
if (root/"browser-result.json").exists():
 b=json.loads((root/"browser-result.json").read_text());e["browser"]={k:b.get(k) for k in ["verdict","text","screenshots"]}
if (root/"fresh-actual.json").exists():e["fresh_observed_reproduction"]=json.loads((root/"fresh-actual.json").read_text())
if (root/"fresh-python-selected-lock.json").exists():e["python_lock"]=json.loads((root/"fresh-python-selected-lock.json").read_text())
pg=root/"fresh-public/docs/disposable-cache-transport-evidence.json"
if pg.exists():
 pgdata=json.loads(pg.read_text())
 if pgdata["startedAt"]>"2026-11-12T20:40:00":
  e["fresh_postgres"]={k:pgdata.get(k) for k in ["startedAt","finishedAt","passed","commands","counts","isolation","scope","blockers"]}
e["additional_failure_history"]="Fresh Python module-qualified invocation failed two imports; documented unittest discovery corrected5/5. Universal lock check initially flagged two absent packages; their Windows/Emscripten markers exclude Linux. All25 selected Linux packages exactly match the retained lock; no packages installed or assertions skipped."
e["additional_failure_history"]+=" Second full gate1341TS:1339pass/1fail/1optionalPGskip; Track B immutable assessment retry refused changed source bytes while model manifest edits were being integrated. Guard retained; final gate must run on frozen code. Intermediate union typecheck failed; fixed by narrowing the actual cohort projection, not an any cast."
e["cjs_fix"]="Removed server producer dependence on import.meta.url in CommonJS. Trusted CLI passes its checkout root; server uses declared working directory; missing files refuse. Actual bundled CommonJS hashes all11 source modules correctly from isolated cwd. Focused CJS/TrackB14/14 passed before final coherent gate."
e["publication_history"]="First source synchronization correctly refused the dirty memory working tree; nothing published by that attempt. Memory changes committed with the next coherent increment, no export guard bypass."
e["fslr_search"]="Targeted US volumes/PFE search returned the Q32026 release already retained in issuer-cash-source-followup-evidence.json. Did not re-fetch it; no new actual eligible watts/BOM/cost inputs acquired."
e["new_source_attempt"]={"url":"https://www.sec.gov/Archives/edgar/data/73309/000119312526454565/nue-20261003.htm",
 "accession":"0001193125-26-454565","issuer":"Nucor","fiscal_period_end":"2026-10-03",
 "publication_timestamp":None,"retrieved_at":now,"surface":"Complete139450-character webFetch markdown, not raw SEC authentication",
 "parts":{str(f):sha(f) for f in root.glob("nucor-q3-part*.md")},
 "finding":"No Exxon/carbon capture/carbon dioxide/45Q/sequestration matches in this examined quarterly filing. No priced CCS instrument, billings, project operating costs or funding term acquired.",
 "decision":"No numerical model update or global nondisclosure claim. Existing FY2025 payment direction retained. Exact missing contract fields remain."}
e["new_nee_source"]={"url":"https://www.sec.gov/Archives/edgar/data/37634/000075330826000081/nee-20260930.htm",
 "accession":"0000753308-26-000081","period_end":"2026-09-30","currency_unit":"USD millions",
 "locator":"Related-party transactions paragraph beginning Through XPLR OpCo; retained fifth markdown chunk",
 "retrieved_at":datetime.fromtimestamp(min(f.stat().st_mtime for f in root.glob("nee-q3-part*.md")),timezone.utc).isoformat(),"publication_timestamp":None,"surface":"webFetch extraction, not raw-byte authentication",
 "parts":{str(f):sha(f) for f in root.glob("nee-q3-part*.md")},
 "facts":{"NEE_noncontrolling_XPLR_percent":52.4,"service_costs_Q3_2026":20,"service_costs_nine_months_2026":120,
 "current_due_from_XPLR_Sep2026":178,"noncurrent_due_from_XPLR_Sep2026":170,
 "current_due_from_XPLR_Dec2025":498,"noncurrent_due_from_XPLR_Dec2025":183},
 "meaning":"Costs under several service agreements, primarily wind repowering, have been or will be reimbursed. These are costs and receivable balances, NOT gross cash collection, project return, named LLC allocation or parent common FCFE.",
 "decision":"Material new cost/boundary evidence; no receivable-difference cash inference, no inference that June246m was settled, no insertion into FY2024 or original historical origins. Further filing content beyond250000 characters was not examined in this bounded attempt."}
x.setdefault("latest_increment",{})["finite_liquidation"]=e
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S13-017","S13-020","S17-009","S17-002","S17-015","S12-017"]:
   r["finite_liquidation_evidence"]=e
   r["next_action"]={
    "S13-004":"Complete explicit sustainable replacement/steady-state and source-qualified common-claim valuation; finite liquidation is now implemented, not an identified issuer inversion.",
    "S13-017":"Complete assumption-set accounting across remaining actual producer maps; keep failed/missing sets visible.",
    "S13-020":"Finish separately source-bound expanded population accounting; retain exact covered reconciliation without invented denominator.",
    "S17-009":"Verify updated production methodology assets after existing gates/promotion; rendered production-build journey passed, historical evidence remains in developer view.",
    "S17-002":"Bounded Node22 fresh-checkout observed reproduction, selected locked Python packages and isolated PostgreSQL/archive pack passed. Complete fresh dependency installation/full private recovery and supported genuine future-review transport; these bounded checks are not full acceptance.",
    "S17-015":"Verify exact promoted source, health and displayed selected model/data/manifest agreement; routine promotion already authorized, not an additional owner-only gate.",
    "S12-017":"Obtain executed priced CCS instrument/project cash terms; this new Nucor quarter did not disclose them. Qualify named NEER recipient/project for the retained October40m payment; other issuer gaps remain."
   }[r["id"]]
   r["remaining_gaps"]=[r["next_action"]];r["gaps"]=[r["next_action"]]
live=root/"live-build-info"
if live.exists():
 observed=json.loads(live.read_text())
 if x.get("current_release",{}).get("runtime")!=observed["sourceCommit"]:x.setdefault("release_history",[]).append(x.get("current_release"))
 x["current_release"]={"runtime":observed["sourceCommit"],"ci":43300128977,"ci_conclusion":"success",
 "verified_at":datetime.fromtimestamp(live.stat().st_mtime,timezone.utc).isoformat(),
 "health":json.loads((root/"live-health").read_text()),"readback":e.get("fresh_observed_reproduction"),
 "boundary":"Verified observed2023 accounting only, NOT future cohort/private review execution. New liquidation changes local, not deployed.",
 "local_receipt":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"railway_deployment":None}
 x.pop("pending_release",None)
ci_file=root/"ci.json"
if ci_file.exists():
 runs=json.loads(ci_file.read_text()).get("workflow_runs",[])
 if runs:
  run=runs[0]
  x["pending_release"]={"source":run["head_sha"],"ci":run["id"],"status":run["status"],
   "conclusion":run["conclusion"],"observed_at":datetime.fromtimestamp(ci_file.stat().st_mtime,timezone.utc).isoformat(),
   "boundary":"Existing promotion only; do not restart, cancel, supersede or push receipt-only documents over this run."}
e["latest_coherent_gate"]=json.loads((root/"cjs-release-gate.receipt.json").read_text()) if (root/"cjs-release-gate.receipt.json").exists() else None
e["postledger_checks"]={"command":"npx tsx --test script/reconciliation-stages-14-17.test.ts script/workplan-corrections.test.ts",
 "tests":7,"pass":7,"fail":0,"skip":0,"log":str(root/"postledger.log"),"sha256":sha(root/"postledger.log")} if (root/"postledger.log").exists() else None
e["execution_stop"]="Execution-context checkpoint, not task completion or exhausted actionable work. Existing CI remains active; no receipt-only push may supersede it."
e["source_entity_boundary"]="NEE Q32026 defines NEER as an operating segment and NextEra Energy Resources as LLC. XPLR glossary defines NEER as LLC but expressly permits subsidiary/group shorthand. Do not join acronym-only or infer the named project recipient or cash collection from these costs/receivables."
x["next_action"]="First reconcile existing CI43312646996 for GitHub4a10e455; do not supersede it. Verify exact runtime/health and safe clean-covered JSON/XLSX and deployed UI retirement. Then complete sustainable replacement/steady-state and compatible claim/inversion (dated liquidation remains excluded from annual polynomial), actual future-review PostgreSQL/principal integration and source-qualified issuer/Stage11–15 inputs. Bounded fresh Node22/Python/PG reproduction is not the full S17 pack. Preserve all frozen negatives."
x.setdefault("restart",{})["instruction"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- prior-finite-liquidation-report -->\n";text=report.read_text()
if marker in text:text=text.split(marker,1)[1]
report.write_text("# Finite liquidation and production retirement — latest increment\n\n"+json.dumps({"current_release":x["current_release"],"pending_release":x.get("pending_release"),"next_action":x["next_action"],"increment":e},indent=2)+"\n\n"+marker+text)
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],check=True)
w=Path("docs/scientific-strands-warning-evidence.json");v=json.loads(w.read_text())
for row in v["warningInventory"]:row["currentSha256"]=sha(row["path"])
w.write_text(json.dumps(v,indent=2)+"\n")

"""Save current original-clause work without promoting incomplete integration."""
import argparse,hashlib,json,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument("--receipt");args=p.parse_args()
path=ROOT/"docs/workplan_completion_ledger.json";ledger=json.loads(path.read_text())
now=datetime.now(timezone.utc).isoformat()
files=["server/calculation/cleanManufacturingMap.ts","server/calculation/coveredPhysicalPaths.ts",
 "script/cleanManufacturingMap.test.ts","script/coveredPhysicalPaths.test.ts","script/completion-ledger.py",
 "server/calculation/cleanCoveredReport.ts","shared/cleanCoveredSource.ts","server/producerReserveApi.ts",
 "shared/economicBridgeSchema.ts","shared/serverDownloadRegistry.ts","script/validate-clean-covered-private.ts",
 "client/src/lib/clean-covered-reader.ts","client/src/hooks/use-clean-covered.ts",
 "client/src/components/clean-covered-panel.tsx","client/src/components/clean-covered-panel.test.ts",
 "client/src/pages/climate-valuation.tsx","script/component-state-contracts.ts",
 "script/component-state-census.test.ts","script/economic-bridge-ui.test.ts",
 "script/methodology-download.test.ts","script/methodology-download-portable.test.ts","script/workplan-evidence-run.py"]
files+=["script/economic-bridge-api.test.ts","script/residual-label-scan.ts",
 "docs/field_semantics_census.json","docs/System_Output_Register.md"] if (ROOT/"docs/System_Output_Register.md").exists() else ["script/economic-bridge-api.test.ts","script/residual-label-scan.ts","docs/field_semantics_census.json"]
def sha(f):return hashlib.sha256((ROOT/f).read_bytes()).hexdigest()
# Preserve frozen provenance and prove the runner change only ADDS a private gate.
pp=ROOT/"docs/status-choice-width-increment-evidence.json";pt=pp.read_text();pv=json.loads(pt)
runner=next(s for s in pv["sources"] if s["path"]=="script/workplan-evidence-run.py")
if runner["sha256"]!=sha(runner["path"]):
 old=subprocess.check_output(["git","show","HEAD:"+runner["path"]],cwd=ROOT,text=True)
 added='    "echo \'=== Mandatory private covered primary source ===\'; npx tsx script/validate-clean-covered-private.ts; "\n'
 if (ROOT/runner["path"]).read_text().replace(added,"",1)!=old:raise ValueError("Unexpected runner change")
 runner.setdefault("coveredPriorSha256",[]).append(runner["sha256"]);runner["sha256"]=sha(runner["path"])
 runner["coveredChange"]="Only added unconditional EPA source validator; original private/public gates untouched"
 start=pt.index('    {"path": "script/workplan-evidence-run.py"');end=pt.index("\n",start)
 pp.write_text(pt[:start]+"    "+json.dumps(runner)+","+pt[end:])
wp=ROOT/"docs/scientific-strands-warning-evidence.json";warning=json.loads(wp.read_text())
for host in warning["warningInventory"]:
 current=sha(host["path"])
 if host["currentSha256"]!=current:
  host.setdefault("priorCurrentSha256",[]).append(host["currentSha256"]);host["currentSha256"]=current
  host["currentChange"]="Added clean-covered read-only source panel; prior limitations retained"
wp.write_text(json.dumps(warning,indent=2)+"\n")
entry={"recorded_at":now,"scope":"S13-004/012/017/018/020 — unfinished engineering, no issuer/science acceptance",
 "files":{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in files},
 "reuse":"calculateCompanyFullCashflowCase/valueCompanyFullCashflowCase; existing issuerOperatingDriverReverse and frozen v4 remain unchanged",
 "new":"Explicit manufacturer shipment/cost/capital map, declared discrete candidate inversion; source/parent-period/unit-bound activity×native-gas intensity×ownership; full declared scenario/cell denominator and covered totals.",
 "numerics":"Engineering-only100USDm revenue minus40variable/10fixed/10depreciation gives40operating profit and35FCFE after5cash tax/10capex; manufacturing1e9W×1e-7tonnes/W=100tonnes, not avoided emissions. Shared80%/20% ownership reconciles50tonnes from100MWh×0.5t/MWh.",
 "assumptions":"EPA eGRID2023 Metric Rev2 released2025-06-12, captured by2026-11-12T17:40:36Z; no exact original publication instant/vintage asserted. SHA3dfbbcf2f949d58d5b2dbee3aab8150bd04a0c8ebb730ba1cd37a013bd4450ab. ORIS6101 oneunitBW91/onegenerator1:1776490netMWh and2215360.4693472nativeCO2tonnes. Derived1.2470435912091822t/MWh; conditional80% equity1772288.37547776tonnes, not operational-control inventory. Public primary facts only; rawworkbook private.",
 "limits":["Read-only API/UI/JSON/XLSX implemented for the actual2023 source reconstruction; runtime verification recorded separately. No actual manufacturing issuer inversion.",
 "Generation-owning/cohort businesses and complete physical terminal mapping still need implementation; five-year manufacturer map is not the whole S13-004 requirement.",
 "Exact declared population/cell ranges implemented; covered/global Stage7 member integration remains unavailable, with four separate measure groups null.",
 "Parent hash/pointer integrity is not original-source authentication or owner approval; trusted producer admission remains integration work.",
 "GHGRP facility nativeCO2 exceeds eGRID electricity-unit mass by191.53065280010924tonnes; scope differs, not forced closed. AR4CO2e not nativegas mass. Source rounded rate differs from raw mass/netMWh ratio.",
 "No materially new NEE/FSLR/XOM economic retrieval this increment; specific economics remain unattempted here, not globally unavailable."],
 "failures":["Initial focused4tests passed but typecheck found Map/Set iteration incompatible with current compiler target. Fixed using Array.from; subsequent typecheck passed.",
 "Primary-workbook Python attempt found openpyxl unavailable; used existing Node xlsx dependency without installation.",
 "Integration76tests:73pass/3fail/0skip. Failures were missing3 rendered-census registrations, additive route count9vs12, and exact writer audit blocked by intervening stale-selection guard. Registered actual components, updated explicit additive routes, and moved guard after BlobURL creation with immediate revocation before any stale link. No audit weakening."],
 "release":"Local unfinished code only. Last measured runtime remains dc2d702c; documentation17e67cc6 is separate."}
entry["focused"]={"date":"2026-11-12","command":"npx tsx --test script/coveredPhysicalPaths.test.ts script/cleanManufacturingMap.test.ts",
 "tests":7,"pass":7,"fail":0,"skip":0,"typecheck":"npm run check passed",
 "timing":"Observed after execution; exact focused start not retained",
 "logs":{f:hashlib.sha256((ROOT/f).read_bytes()).hexdigest() for f in [
  "generated-artifacts/clean-covered/focused.log","generated-artifacts/clean-covered/typecheck.log",
  "generated-artifacts/clean-covered/initial-typecheck-failure.log"]}}
if args.receipt:
 entry["coherent_gate"]=json.loads((ROOT/args.receipt).read_text())
entry["prior_gate_failure"]={"receipt":"generated-artifacts/clean-covered/final-coherent.receipt.json",
 "result":"1317TS:1312pass/4fail/1optionalPGskip; Python/private/build not reached",
 "correction":"Regenerated actual field/output consumer censuses; exact two physical-unavailable label exceptions, not a whitelist or threshold relaxation"}
entry["development_readback"]={"time":"2026-11-12T17:55:23.482Z","route":"/api/cv/clean-covered",
 "rows":1043,"literalChecks":4,"identity":"1d0456aff704485878b27cd6bea584fb7e8c92c15b9861164a98b561f832dbb2",
 "scope":"Actual development HTTP/XLSX values and identity; not production or scientific acceptance"}
ledger.setdefault("latest_increment",{})["clean_manufacturing_covered_paths"]=entry
ledger["updated_at"]=now
for stage in ledger["stages"]:
 for r in stage["requirements"]:
  if r["id"] in ["S13-004","S13-012","S13-017","S13-018","S13-020"]:
   r["current_clean_covered_evidence"]=entry
   r["files_changed"]=files
   r["files_functions_changed"]=files
   r["inputs_versions_assumptions"]=entry["assumptions"]
   r["numerical_results"]=entry["numerics"]+" Actual source:1776490MWh,2215360.4693472tCO2; derived1.2470435912091822t/MWh;80%conditional1772288.37547776t."
   r["formulas"]=["revenue=shipped units×unit price/1e6; operating profit=revenue−cash variable/fixed costs−depreciation; existing accrual/FCFE bridge reused",
     "native emissions=activity×compatible intensity×ownership once; no scope/gas mixing or global expansion",
     "source intensity=reported unit nativeCO2 / same-period net generation; derived, not independent observation"]
   focused_execution={"command":entry["focused"]["command"],"executed_at":"2026-11-12 (exact start not retained)",
      "exit_code":0,"counts":{"tests":7,"pass":7,"fail":0,"skipped":0},"log":"generated-artifacts/clean-covered/focused.log"}
   r["executions"]=[focused_execution]+([entry["coherent_gate"]] if "coherent_gate" in entry else [])
   r["commandsAndDates"]=r["executions"]
   r["countsLogsAndResults"]=entry.get("coherent_gate",entry["focused"])
   r["remaining_gaps"]=entry["limits"]
   additions=(["calculateCleanManufacturing","freezeManufacturingDomain","invertManufacturingDomain"]
              if r["id"]=="S13-004" else ["calculateCoveredPhysicalPaths"])
   r["functions"]=list(dict.fromkeys([*r.get("functions",[]),*additions]))
   r["behaviour_delivered_this_run"]=entry["new"]
   r["scientific_acceptance"]="Not established;0/3qualified issuer cases. Actual EPA observation reconstruction is not forecast efficacy. Synthetic cash/inverse tests are engineering only."
   r["next_action"]="Complete physical continuation/cohort economics and certified full-domain inversion, accepted producer/source admission and complete future native/member Stage7 inputs. Preserve real2023 EPA source reconstruction and read-only API/UI/export integration; obtain missing issuer economics."
  if r["id"]=="S13-003":
   r["new_same_period_source"]=entry["assumptions"]
   r["next_action"]="2023 net generation/nativeCO2 now source-bound through EPA ORIS6101 one-unit/one-generator join. Obtain same-period unit cash costs, legal retirement obligation, approved recovery/timing and compatible asset target; historical generation is not a future retirement forecast."
ledger["restart"]["next_requirement"]="Preserve new clean-manufacturing/covered-path engines and real EPA2023 Wyodak reconstruction/API/UI/JSON/XLSX; verify final gate/release receipts. Complete physical continuation/cohorts/full-domain inverse and source-qualified issuer economics, future native/member coupling, original dated corpus/calibration. No repeat source-case fixtures or old b8d98 restart; scientific acceptance remains unearned."
ledger["restart"]["instruction"]=ledger["restart"]["next_requirement"]
path.write_text(json.dumps(ledger,indent=2)+"\n")
spec=importlib.util.spec_from_file_location("matrix",ROOT/"script/merge-clause-reconciliation.py")
matrix=importlib.util.module_from_spec(spec);spec.loader.exec_module(matrix)
(ROOT/"docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text("## Latest clean/covered increment — local, not yet released\n\nPrior verified runtime dc2d702c; docs17e67cc6 separate. Source/evidence and exact remaining gaps are recorded by original clause below. No scientific/status promotion.\n\n"+matrix.matrix(ledger))
report=ROOT/"docs/WORKPLAN_IMPLEMENTATION_REPORT.md";text=report.read_text()
marker="## Clean manufacturing and covered paths — current work\n"
if text.startswith(marker):text=text.split("\n<!-- retained-history -->\n",1)[1]
text=text.replace("## Current verified economic-bridge code release — 2026-11-12",
                  "## Historical economic-bridge code release — 2026-11-12",1)
lead=marker+"\nLatest measured runtime: **dc2d702c93a354da3c6c7846cd63b2c45254034b**, CI43261776788; later published docs17e67cc6 separate. Prior retirement local1299TS/1298pass/0fail/1skip and264Python are local receipts, not CI totals or efficacy.\n\nNew work is unfinished local implementation. All300 original clauses remain63verified/235partial/2provisioning-blocked; original1000/1001 and0/3qualified cases unchanged.\n\n"+json.dumps(entry,indent=2)+"\n\n<!-- retained-history -->\n"
report.write_text(lead+text)
subprocess.run(["python","script/completion-ledger.py"],cwd=ROOT,check=True)
print("Saved current lead and partial original-clause evidence; no status promotion")

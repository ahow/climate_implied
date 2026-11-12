"""Record original-clause evidence; no release or scientific promotion."""
import json,hashlib,subprocess,importlib.util,argparse
from pathlib import Path
from datetime import datetime,timezone
root=Path(__file__).resolve().parents[1]
p=argparse.ArgumentParser();p.add_argument("--receipt");args=p.parse_args()
def sha(path):return hashlib.sha256((root/path).read_bytes()).hexdigest()
files=["server/calculation/operatingCohorts.ts","server/calculation/polynomialDomain.ts",
 "server/calculation/cohortGrowthInverse.ts","server/coveredProducerAdmission.ts",
 "server/producerReserveApi.ts","server/calculation/cleanCoveredReport.ts",
 "script/operatingCohorts.test.ts","script/polynomialDomain.test.ts","script/cohortGrowthInverse.test.ts",
 "script/coveredProducerAdmission.test.ts","script/cohort-continuation-run.ts"]
log="generated-artifacts/cohort-continuation/final-focused.log"
focused={"command":"npx tsx --test script/operatingCohorts.test.ts script/polynomialDomain.test.ts script/cohortGrowthInverse.test.ts script/coveredProducerAdmission.test.ts",
 "executed_at":datetime.fromtimestamp((root/log).stat().st_mtime,timezone.utc).isoformat(),
 "time_meaning":"Log completion, not exact start","exit_code":0,
 "counts":{"tests":14,"pass":14,"fail":0,"skipped":0},"log":log,"log_sha256":sha(log)}
e={"recorded_at":datetime.now(timezone.utc).isoformat(),"files":{f:sha(f) for f in files},
 "functions":["calculateOperatingCohorts","reconcileCohortIssuerCash","freezeCohortGrowthDeck",
 "invertCohortGrowthDeck","evaluateCohortGrowthDeck","certifyPolynomialDomain","admitCurrentCoveredProducer"],
 "engineering":"Annual commissioning/retirement/degradation/service stock and project cash; existing accrual-to-FCFE reconciliation; exact rational interval polynomial certification with unresolved intervals retained; actual registered current producer verification; private CLI JSON/XLSX literal readback.",
 "numerics":"Synthetic2MW×100MWh/MW/year×0.5 gives100 then90MWh with10% degradation; retired stock produces0. Independent cash660USD matches existing FCFE engine within1e-9USD. Separate finite project110USD year1 discounted10%=100USD; declared replication u=1 yields target100;u=1.5 yields150 and165MWh. These are engineering fixtures, not actual issuer economics.",
 "limits":["Current trusted admission supports registered EPA observation only; authentic future cohort/archive/review admission remains ENGINEERING work.",
 "Finite proportional-replication project polynomial only; cash allocation and scaling are explicit conditional assumptions. Not whole-equity identification, general piecewise certification, or sustainable perpetual cash/stock.",
 "Annual-start commissioning convention, no mid-year interpolation; actual source economics, storage input-energy/losses and terminal replacement policies need qualification.",
 "No actual issuer fit or scientific efficacy;0/3qualified cases. Future native-gas/member inputs and accepted population remain unavailable."],
 "source_attempt":{"url":"https://investor.firstsolar.com/news/news-details/2026/First-Solar-Inc--Announces-Second-Quarter-2026-Financial-Results-and-Reaffirms-Guidance",
 "published_day":"2026-07-30","capture":"generated-artifacts/cohort-continuation/fslr-q2-primary.md",
 "sha256":sha("generated-artifacts/cohort-continuation/fslr-q2-primary.md"),
 "finding":"Inspected primary contents:17.0–18.2GW annual sales and3.2–3.7GW Q3US guidance,2.10–2.19bn45X assumption. Not observed eligible watts/BOM/PFE or India payment amount/day/FX. No qualifying economic field resolved. NEE/XOM source retrieval not attempted in this increment, not globally unavailable."},
 "failures":["Initial exact-arithmetic typecheck TS2791(BigInt exponent target) and TS7006(implicit any); replaced exponent with integer multiplication and typed declaration. Original failed stdout exists in chat only; not falsely claimed as retained log.",
 "coherent.log:1329TS/1327pass/1fail/1skip; companion S13-018 verdict stale. ledger-correction.log: scope lacked required S13-018 ONLY prefix. Both corrected, tests unchanged.",
 "dev-readback.log: incorrect helper import failed. Corrected import in dev-readback-corrected.log proves1051 actual HTTP JSON/XLSX literal rows.",
 "corrected-coherent run began before final numerical-display guard; its receipt is explicitly pre-final, NOT a coherent final-code acceptance."],
 "executions":[focused],"release":"Unreleased changed code; prior measured8835a42d/CI43277284147 retained, no restart."}
nee="generated-artifacts/cohort-continuation/xplr-q2-primary-partial.md"
if (root/nee).exists():
 e["nee_primary_attempt"]={"url":"https://www.sec.gov/Archives/edgar/data/1603145/000160314526000032/xplr-20260630.htm",
  "accession":"0001603145-26-000032","period":"2026-06-30","capture":nee,"sha256":sha(nee),
  "scope":"First150000 extracted characters; NOT complete filing inventory. Note9 printed18–19.",
  "facts":"USDmillions: cash sweep held in NEER/affiliate accounts2 versus11 at2025-12-31;246 current repowering payable to NEER under average150-day terms;35 current/39noncurrent repowering obligations with NEER-related-payable terms;90 noninterest no-maturity restricted-reserve note. Six-month CSCS O&M expense5 is not collections.",
  "decision":"Genuine named-recipient payable/timing evidence, not actual receipts or NEE common FCFE. Average150days is not exact payment date. Requires actual settlement, margin/cost and common-cash attribution; no2026backdating or arbitrary schedule."}
nucor="generated-artifacts/cohort-continuation/nucor-2025-primary-partial.md"
if (root/nucor).exists():
 e["nucor_primary_attempt"]={"url":"https://www.sec.gov/Archives/edgar/data/73309/000119312526071575/nue-20251231.htm",
  "accession":"0001193125-26-071575","fiscal_year":2025,"capture":nucor,"sha256":sha(nucor),
  "scope":"First100000 extracted characters, CCS Activity heading; not complete exhibit inventory or exact acceptance timestamp authentication.",
  "finding":"Nucor states agreement signed2023; ExxonMobil receives related credits and pays Nucor per supplied metric tonne. Fee amount/billings/opex/funding not disclosed in examined passage.600000–800000 tonnes is projected, not measured throughput.",
  "chronology":"Older expected late2026 startup is NOT current status. Preserve retained September162026 ExxonMobil operating update in qualified-primary-inputs-evidence.json; it does not supply executed priced terms.",
  "decision":"Payment-direction evidence, not a usable fee coefficient or XOM fee revenue. No Nucor-specific computational binding found in server/calculation/shared; old frozen XOM controls unchanged."}
if args.receipt:e["executions"].append(json.loads((root/args.receipt).read_text()))
lp=root/"docs/workplan_completion_ledger.json";x=json.loads(lp.read_text())
x.setdefault("latest_increment",{})["cohort_continuation"]=e
for execution in e["executions"]:
 if execution not in x.setdefault("run_executions",[]):x["run_executions"].append(execution)
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S13-012","S13-017","S13-018","S13-020"]:
   r["cohort_continuation_evidence"]=e;r["files_functions_changed"]=files
   r["functions"]=list(dict.fromkeys(r.get("functions",[])+e["functions"]))
   r["executions"]=r.get("executions",[])
   for execution in e["executions"]:
    if execution not in r["executions"]:r["executions"].append(execution)
   r["behaviour_delivered_this_run"]=e["engineering"];r["numerical_results"]=e["numerics"]
   if r["id"]=="S13-018":
    assert r["requirement"]=="A lineage test confirms emissions come through activity × intensity."
    r["status"]="verified";r["remaining_gaps"]=[];r["gaps"]=[]
    r["check_scope"]="S13-018 ONLY: finite lineage engineering; existing actual manufacturing→physical path witness and new trusted-producer admission tests; no additional issuer/market/science prerequisite."
    r["next_action"]="Preserve these lineage witnesses as activity adapters change; larger source/issuer/science requirements remain separate."
    r["nextAction"]=r["next_action"]
    r["scientific_acceptance"]="Finite engineering verification only; no issuer, owner, physical-ensemble or historical-efficacy acceptance."
   else:
    r["remaining_gaps"]=e["limits"]
    r["next_action"]="Complete authentic future cohort producer/review admission, physical continuation/perpetuity and source-qualified issuer economics; preserve finite polynomial scope, execute original compatible studies only when ready."
old=x["current_release"]
receipt="generated-artifacts/clean-covered/state-receipt.json"
if old.get("receipt")!=receipt:
 stale={k:old.pop(k) for k in ["receipt","receipt_sha256","ci_steps","failure_history"] if k in old}
 if stale:x.setdefault("prior_release_receipt_history",[]).append(stale)
old["receipt"]=receipt;old["receipt_sha256"]=sha(receipt)
old["receipt_scope"]="Actual prior clean-covered observation; retirement receipts preserved only in prior_release_receipt_history"
observed=root/"generated-artifacts/cohort-continuation/railway-prior-build.json"
if observed.exists():
 old["runtime"]=json.loads(observed.read_text())["sourceCommit"]
 old["runtime_observation"]={"path":str(observed.relative_to(root)),"sha256":sha(str(observed.relative_to(root))),
  "scope":"Safe read shows later docs/runtime sync; separate from measured8835a42d economic receipt and new local cohort implementation."}
x["latest_increment"]["cohort_continuation"]["release"]="Local cohort implementation4cb9d34; measured prior code8835a42d and observed later docs/runtimeca8c59c remain separate. New promotion not claimed without CI/live receipt."
x["restart"]["instruction"]="Continue ALL original0–17/amendments. Preserve cohort cash/stock, exact finite-project polynomial and current trusted producer admission. Complete future-cohort approved/archive producer integration and physically sustainable terminal/claim economics; no assumption of full issuer identification. S13-018 finite lineage is verified, do not re-add unrelated science gates. Preserve original negative studies. New full gate/release receipt governs changed code; prior8835a42d remains separate."
x["restart"]["next_requirement"]=x["restart"]["instruction"]
x["updated_at"]=e["recorded_at"];lp.write_text(json.dumps(x,indent=2)+"\n")
proposal_path=root/"docs/reconciliation-stages-10-13.json"
proposal=json.loads(proposal_path.read_text())
lineage=next(r for s in x["stages"] for r in s["requirements"] if r["id"]=="S13-018")
for r in proposal["records"]:
 if r["id"]=="S13-018":
  r["status"]="verified";r["gaps"]=[];r["remaining_gaps"]=[]
  r["check_scope"]=lineage["check_scope"];r["nextAction"]=lineage["next_action"]
  r["cohort_continuation_evidence"]=e
proposal_path.write_text(json.dumps(proposal,indent=2)+"\n")
report=root/"docs/WORKPLAN_IMPLEMENTATION_REPORT.md";text=report.read_text();marker="## Cohort continuation — latest increment\n"
if text.startswith(marker):text=text.split("<!-- earlier-cohort-report -->\n",1)[1]
report.write_text(marker+"\n"+json.dumps(e,indent=2)+"\n\n<!-- earlier-cohort-report -->\n"+text)
spec=importlib.util.spec_from_file_location("m",root/"script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
(root/"docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(marker+"\nFinite S13-018 lineage verified; larger clauses remain partial.\n\n"+m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],cwd=root,check=True)

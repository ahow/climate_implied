"""Update only changed original criteria; preserve source clauses and receipts."""
import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
spec=importlib.util.spec_from_file_location("merge",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());contract=m.contract_digest(x)
groups=[
 (["S04-007","S04-008","S04-010"],"docs/driver-consumption-evidence.json",
  ["server/calculation/driverParameterRegistry.ts","server/calculation/driverConsumptionTrace.ts","script/run-regional-ensemble.ts"],
  "Actual Stage5 CLI consumes source-verified paired distributions; all10 retained distributions remain sensitivity-only. All22 curated central controls reject; legacy comparator is explicitly separate. No accepted real six-region joint registry or calibrated central forecast.",
  ["Complete accepted distributions/dependence and actual eligible central evidence for remaining drivers; legacy diagnostics are not a calibrated replacement."]),
 (["S04-002"],"docs/wind-cost-source-evidence.json",["script/wind_cost_source_attempt.py"],
  "Obtained original publisher wind-cost and capacity PDFs; frozen full-window source gate stopped before fitting. Missing2010–2014 capacity and exact installed-cost table; no window shortening/splicing.",
  ["Obtain compatible full-window capacity and exact cost table; source vintages and statistical gates remain unpassed."]),
 (["S07-008"],"docs/physical-attribution-evidence.json",
  ["script/physical_counterfactual_attribution.py","script/audit_physical_counterfactual.py","script/physical_temporal_statistics.py"],
  "Executed paired fresh FaIR counterfactuals; factual retained reproduction exact, natural forcing unchanged, memberwise baselines retained. Audited64species/53emissions inputs. Implemented source-defined SR1.5 memberwise2011–2025 trend endpoint separately from annual and decade means.",
  ["Source-justified spatial GMST operator, actual historical2015–2025 inputs instead of SSPs, and attribution-convention compatibility. GMST member share remains null."]),
 (["S12-001"],"docs/issuer-analytics-evidence.json",
  ["server/calculation/issuerCashflowCase.ts","server/calculation/issuerCashflowReconciliation.ts","script/assemble-issuer-cashflow-cases.ts","script/validate-issuer-cashflow-reconciliation-private.ts"],
  "Authenticated primary SEC sources and166 monetary facts; all3 historical income/CFO/CFI/CFF/cash bridges reconcile. Six separately frozen operating benchmarks calculated; two FSLR zero-growth maintenance pairs are NOT original2.5–4% terminal or qualified climate-linked cases.",
  ["0/3qualified original cases. NEE gross non-common waterfalls/project returns; XOM project funding/CCS economics and replacement; FSLR normalization/rollover/excesscash/positive post-credit terminal need evidenced resolution. No invented tariffs or approval."]),
 (["S12-018"],"docs/company-coverage-evidence.json",
  ["server/calculation/companyCoverage.ts","server/snapshots/companyCoverage.ts","client/src/components/company-coverage.tsx","shared/companyCoverageSemantics.ts","server/routes.ts"],
  "Actual selected-workbook full/eligible market-cap/emissions/mapping coverage, distinct null/missing/conflict/invalid/zero, exact-day read-only source adapter and complete JSON export. Full2442, financial-eligible1; operating/HQ mappings unavailable rather than inferred.",
  []),
]
lookup={r["id"]:r for s in x["stages"] for r in s["requirements"]};changed=[]
for ids,evidence,files,behavior,gaps in groups:
 proposal=json.loads(Path(evidence).read_text())
 for id in ids:
  r=lookup[id];changed.append(id)
  r.setdefault("before_ready_implementation_20261110",{"status":r["status"],"behaviour_delivered_this_run":r["behaviour_delivered_this_run"]})
  r["prior_analytics_state"]={k:r.get(k) for k in ["status","remaining_gaps","files_functions_changed"]}
  r.update(status="verified" if id=="S12-018" else "partial",files_functions_changed=files,
    behaviour_delivered_this_run=behavior,inputs_versions_assumptions=proposal,numerical_results=proposal,
    remaining_gaps=gaps,next_action="Preserve scoped engineering check; continue remaining original requirements." if not gaps else gaps[0],
    evidence_report=evidence,scientific_acceptance="No independent owner/scientific acceptance, issuer approval or central promotion.",
    reviewed_at=datetime.now(timezone.utc).isoformat(),git_commit="pending integrated commit",
    deployment_revision=x["current_release"]["github_main"])
  r["existing_evidence"]=list(dict.fromkeys(r["existing_evidence"]+[evidence]+files))
  r["analytics_source_hashes"]={f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files if Path(f).exists()}
r=lookup["S12-012"];changed.append(r["id"])
r.setdefault("before_ready_implementation_20261110",{"status":r["status"]})
r.update(status="verified",files_functions_changed=["script/company-projection.test.ts"],
 behaviour_delivered_this_run="Named S12-012 perturbation increases one issuer's base revenue, changes every member growth, preserves all peer outputs byte-for-byte under repeated/interleaved calls, and preserves retained inputs.",
 remaining_gaps=[],next_action="Preserve named independence regression; continue actual issuer qualification.",
 scientific_acceptance="Synthetic engineering isolation fixture, not actual issuer/scientific acceptance.")
r["executions"].append({"command":"npx tsx --test script/company-coverage-route.test.ts script/company-projection.test.ts","executed_at":"2026-11-10T13:49:38.065447+00:00","exit_code":0,"counts":{"tests":7,"pass":7,"fail":0,"skipped":0},"log":"generated-artifacts/workplan-completion/20261110T134938065447Z.log"})
x["latest_increment"]["substantive_analytics"]={"changed_original_ids":changed,"source_contract_hash":contract,
 "boundary":"Actual analytics and scoped engineering; not full original completion. No reindexing, approvals or frozen-study retuning."}
x["restart"]["instruction"]="Continue alloriginal0–17/amendments. Preserve new actualStage5 registeredCLI and sensitivity-only distributions; pairedFaIR emissions-intervention/memberbaseline and exact15yearSR1.5temporaloperator (NOTGMST acceptance); actual3issuer166fact reconciliations andseparatezero-growthmaintenancebenchmarks (0/3qualifiedoriginalcases); actualcoverage/API/JSON/full2442eligible1 andpeerisolation. Windcostsourcegate missing2010–14capacity/exactcosttable, not fitted. Next complete defensible climate-linked operating/reinvestment/stub/terminal/currency/class inputs, real joint-driver evidence and historical2015–25/GMSToperator; authenticoperatorHTTPidentity remainsnarrowowner dependency. Preserve frozenbeta/fleet/EV/storage/Gordonprimary, original1001gap1 and immutableprivateFSLR10cases50rows. Neverresend matchedcheckpoint."
assert contract==m.contract_digest(x)
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
paths=sorted(set(subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()))
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:
 f.write("\n\n## Substantive analytics — 2026-11-10\n\n")
 for ids,evidence,files,behavior,gaps in groups:f.write(", ".join(ids)+": "+behavior+"\n\nEvidence: `"+evidence+"`. Remaining: "+("; ".join(gaps) or "Scoped engineering delivered; no scientific acceptance.")+"\n\n")
 f.write("S12-012 named peer-isolation test delivered; actual source fixtures remain separate. Current release stays the prior verified revision until CI/Railway receipts. Detailed source/date/freeze/results/command/log hashes are retained per changed original criterion.\n\n### Complete changed paths\n\n"+"\n".join("- `"+v+"`" for v in paths)+"\n")
print("Updated",changed)

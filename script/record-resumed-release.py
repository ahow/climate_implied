import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
smoke=json.loads(Path("generated-artifacts/workplan-completion/resumed-live.json").read_text())
release={"workspace_commit":"89bf438f5df7d98e6f7e684d33b128fa0c47b51c","github_main":"274440b5e644a49fdfe2c5470397241391d3ee2a",
 "ci":"42924327747 validate/promote success","railway_deployment":"8b3f1d05-ce55-4047-931b-bcdfd543817f","railway_status":"SUCCESS",
 "verified_at":smoke["verifiedAt"],"smoke":smoke,"receipt_boundary":"Verified implementation, not the later documentation receipt. Production coverage503 remains unavailable; no production data/science activation."}
x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=release
inc=x["latest_increment"]["credit_resumed_analytics"];inc["release"]=release
groups={
 "issuer":(["S12-001"],"docs/issuer-analytics-evidence.json",["server/calculation/issuerOriginalOperatingCase.ts","server/calculation/issuerOperatingDriverReverse.ts"],
 "Implemented and executed source-bound funded five-year/fade/terminal/stub operating paths and interval-certified operating-driver reverse; no FCFE-path adjustment relabelled activity growth.",
 "18 v4 assessments:7 certified no-root,5 nonpositive-terminal bracket refusals,6 unsupported NEE driver refusals;0 actual operating target matches;0/3qualified original cases. V3 nine mathematical pairs remain separate.",
 "Next separately freeze source-supported paid-spare-capacity FSLR experiment without widening v4 bounds to force a root; source NEE project/FFO allocation and XOM CCS economics; verify current-law45X and genuine identity/date pairing."),
 "physical":(["S07-008"],"docs/physical-attribution-evidence.json",["script/igcc_observation_operator.py","script/validate_igcc_official_sources.py"],
 "Implemented source GWI observational-constraint operator and actual official history comparisons; no arbitrary GSAT conversion or old SSP rerun.",
 "2015–25 SSP245/actual ERF RMSE:CO2 .06038374,CH4 .04022194,N2O .00448006,solar .03448956,volcanic .09825245 W/m2. Qualified GMST share null.",
 "Obtain permitted ancillary ensemble/observation/control inputs and source-compatible fingerprints; resolve alpha1/2.2.4 thermal bridge and native histories through2025."),
 "driver":(["S04-002","S04-004","S04-008"],"docs/driver-source-continuation-evidence.json",["server/calculation/driverParameterRegistry.ts","script/driver_source_continuation.py"],
 "Added evaluatePolicyExposure/retainedPolicyExposureSnapshot with hash/source/denominator/status guards; inspected full-window original IRENA source, retaining missing cells.",
 "2025 covered-price≈19 ×coverage≈.28 gives5.32USD2025/total tCO2e descriptive gross exposure only.1264 null capacity cells not zeros; no wind fit or calibration promotion.",
 "Resolve compatible complete capacity/exact cost table; evidence exemptions/enforcement and real policy response distributions before forecast consumption."),
 "portfolio":(["S14-010","S14-012","S14-014","S15-008","S15-010","S15-011","S15-013"],"docs/portfolio-frequency-evidence.json",["server/calculation/pairedResearchFrequency.ts","server/calculation/pairedResearchCorpus.ts","server/calculation/pairedResearchPipeline.ts","server/calculation/pairedResearchSleeves.ts"],
 "Connected source-bound simultaneous monthly sleeve NAVs, entry/exit costs, cash/collateral/lifecycle and dated regional/workbook factors to declared12month inference cells; retained hypothetical borrow accounting separately from investability.",
 "36 focused tests passed including hand-reconciled accounting, actual pipeline inference and price/FX substitution refusals; source-only engineering, not historical efficacy.",
 "Assemble genuine source-qualified monthly holdings/lifecycle/factors and reviewed paired projections, then actual frozen-family evaluation; no synthetic acceptance."),
 "quality":(["S15-009","S01-001"],"docs/Return_Quality_Protocol.json",inc["quality"]["newPaths"],
 "Froze full-workbook random sample, implemented independent split/dividend reinvestment reconciliation and retained bounded FMP identity attempts. Clarified observation-label versus exchange-close semantics.",
 "411339 population;50 sampled;50/50 exactISIN candidates;24 weekend-boundary intervals;0 qualified return comparisons;break rates null, not zero.",
 "Verify original listing/currency/class history and exact price/dividend/split/calendar conventions; retain all50 denominator and do not substitute dates or sampled rows.")
}
for ids,path,files,behavior,result,next_action in groups.values():
 data=json.loads(Path(path).read_text())
 for s in x["stages"]:
  for r in s["requirements"]:
   if r["id"] not in ids:continue
   r.setdefault("prior_credit_resume_fields",{k:r.get(k) for k in ["files_functions_changed","behaviour_delivered_this_run","inputs_versions_assumptions","numerical_results","remaining_gaps","next_action"]})
   r["files_functions_changed"]=(r["files_functions_changed"] or [])+[a for a in files if a not in (r["files_functions_changed"] or [])]
   r["behaviour_delivered_this_run"]=behavior
   if not isinstance(r["inputs_versions_assumptions"],dict):r["inputs_versions_assumptions"]={"prior":r["inputs_versions_assumptions"]}
   r["inputs_versions_assumptions"]["credit_resume"]={"evidence":path,"source_details":data}
   if not isinstance(r["numerical_results"],dict):r["numerical_results"]={"prior":r["numerical_results"]}
   r["numerical_results"]["credit_resume"]=result
   r["remaining_gaps"]=list(dict.fromkeys(r["remaining_gaps"]+[next_action]))
   r["next_action"]=next_action;r["git_commit"]=release["workspace_commit"];r["deployment_revision"]=release["github_main"]
   r["live_release_observation"]=release
x["restart"]["instruction"]="Verified live274440b5/CI42924327747/Railway8b3f1d05.511publicTS+123publicPython;newprivatepolicy3 andmandatoryissuer/355pinned assertions passed separately. "+x["restart"]["instruction"]+" Next FSLR separately frozen paid-spare-capacity/tranche model, not widened v4 bounds;NEE project/FFO not EPS proxy;XOM evidence not invented CCS tariff. v4 outcomes7no-root/5terminal refusals/6NEE refusals;0/3qualified."
inc["stop_reason"]="Context limit after recovered release, substantive parallel implementation/studies, integrated checks and verified new gated release; ready work remains, not completion."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:
 f.write("\n## Resumed run: final verified release and clause-level outcomes\n\n"+json.dumps(release,indent=2)+"\n\n")
 for ids,path,files,behavior,result,next_action in groups.values():
  f.write(f"### {', '.join(ids)}\n{behavior}\n\n{result}\n\nNext: {next_action}\n\nEvidence: `{path}`; changed: "+", ".join(f"`{a}`" for a in files)+"\n\n")
 f.write(inc["finalCheckOutcome"]+"\n\n"+inc["stop_reason"]+"\nOriginalcoverage1000/1001 unchanged;1703definitions/current1323/1324/expanded1484/1485 are supplemental, not originalclosure.39verified259partial2blocked0unreconciled;0/3qualifiedoriginalissuer cases and efficacy withheld. Independent owner/audit acceptance unclaimed.\n")

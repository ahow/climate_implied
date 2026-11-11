import json,hashlib,datetime,importlib.util,re,subprocess
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
execution=json.JSONDecoder().raw_decode(Path("/tmp/bundle-coherent-final.log").read_text())[0]
failure=json.JSONDecoder().raw_decode(Path("/tmp/bundle-coherent.log").read_text())[0]
entries={
"S07-002":(["docs/originalS07-002-private-bundle-evidence.json","docs/fair-private-provisioning-investigation.json"],
"Exact16 private bundle with atomic install/activation/recovery,13protected source snapshots,all13456member identities,29refusals,permissions/export identity. Live storage/authorized transfer unavailable: no bucket/volume/CLI session/SSH principal or connector write tool.",
"Authorized Railway operator privately transfers current155bd3ff bundle, installs source-matching release and configures absolute FAIR_ARTIFACT_ROOT; verify live selected/member/summary reads and refusals. Preserve private recovery copy across ephemeral deployments.",
["Actual live successful selected artifact reads still unproven; authenticated private transfer is required. This is not the production archive-schema dependency."]),
"S12-001":(["docs/issuer-financial-followup-evidence.json"],
"New primary Rose tracker identifies Texas project/application and proposed wells, not final permit or CF crosswalk; global FSLR production/sales do not identify US-qualified module allocation.",
"Obtain actual component/production geography allocation and verified CF-to-Rose legal/site crosswalk; do not substitute HQ or corporate volumes.",
["Operating allocation, project crosswalk and approved permit limits remain unresolved."]),
"S12-008":(["docs/fslr-cohort-integrated-evidence.json","docs/fslr-public-cohort-evidence.json"],
"Integrated retained FSLR recognition/collections and2023-origin normalization in original5year+10yearfade cash basis; removed forecast overlap before actual receipts. Two source-bounded Q1 timing conventions,32cash rows. Later outcomes explicitly revised history, not known2025-02-21; no double discount/WC/cash.",
"Resolve exact Q1 receipt day, unallocated grant bridge and eligible production economics; retain original terminal/reinvestment and refusal gates before qualified pairing.",
["Conditional revised-history integration is not fully sourced operating case or qualified projection/valuation pair."]),
"S12-011":(["docs/fslr-public-cohort-evidence.json"],
"API/UI/JSON/XLSX explicitly label later2025/2026 collection facts as revised history, not inputs available at original2025-02-21 origin.",
"Assemble genuinely origin-available complete company inputs for historical paired study; do not backdate this receipt integration.",
["No newly qualified historical company origin."]),
"S12-017":(["docs/fslr-cohort-integrated-evidence.json","docs/issuer-financial-followup-evidence.json"],
"Substantive FSLR cash integration and new Rose/ONEOK primary investigation retained;0/3qualified worked companies. No old grids/root forcing.",
"Complete eligible FSLR activity/margin/reinvestment, NEE gross LLC priorities/project returns and XOM actual fee/funding/replacement contracts; owner review remains separate.",
["0/3 original fully qualified end-to-end company cases."]),
"S04-005":(["docs/climatetrace-mining-method-source-evidence.json"],
"Publisher methodology proves annual disaggregation/extrapolation and carried2023activity; new native activity/factor audit118279rows reproduces23268yearpairs/1939Januarypairs exactly. Reject as independent fresh2025/26monthly outcomes; retain source-modelled revised history only.",
"Find original dated full-scope monthly/dailyCO2 outcomes with actual freshness and compatible territorial/sector definitions; mining modeled estimates cannot supply independent holdout targets.",
["Full-scope origin-vintage monthly outcomes remain unavailable; no nowcast fitting/scoring performed."]),
"S16-005":(["script/s16-005-finite-obligation-inventory.json","generated-artifacts/rendered-states/s16-005-finite-engineering-evidence.json"],
"Finite written partial/unavailable-measure obligations fulfilled:60component invocation evidence plus prior interactions and3changed browser cases. Null dates withhold affected headlines/charts/exports; named missing tooltip series; selectedSDG cannot borrow carbon/ambition fields; pending/error exports withheld. Valid zero retained.",
"Preserve these finite engineering regression contracts when components change. Scientific and issuer acceptance remain separate clauses.",
[])}
for stage in x["stages"]:
 for r in stage["requirements"]:
  if r["id"] not in entries:continue
  files,behavior,nextaction,gaps=entries[r["id"]]
  evidence=[{"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest()} for f in files]
  r["bundle_cohort_increment"]={"directEvidence":evidence,"behavior":behavior,"execution":execution,"priorFailedExecution":failure}
  if execution not in (r.get("executions") or []):
   r["executions"]=(r.get("executions") or [])+[execution]
  r["behaviour_delivered_this_run"]=behavior;r["remaining_gaps"]=gaps;r["next_action"]=nextaction
  r["remainingGaps"]=gaps;r["ready_action"]=nextaction
  if r["id"]=="S16-005":
   r["status"]="verified";r["proposedStatus"]="verified";r["check_type"]="exact"
   r["check_scope"]="finite engineering component/render/browser contracts"
   r["scientific_acceptance"]="Not a scientific acceptance claim; original engineering criterion verified."
  paths={"S07-002":["server/calculation/fairArtifactFiles.ts","server/calculation/fairArtifacts.ts","script/fair-artifact-bundle.ts","script/rehearse-fair-artifact-bundle.ts","script/fair-artifact-bundle.test.ts"],
  "S04-005":["script/climatetrace_mining_method_qualification.py","script/test_climatetrace_mining_method_qualification.py"],
  "S16-005":["client/src/pages/decarb-signal.tsx","client/src/pages/decarb-gap.tsx","script/s16-005-finite-obligations.test.ts"],
  "S12-001":["server/calculation/issuerFinancialFollowupInputs.ts","script/validate-issuer-financial-followup-private.ts"]}.get(r["id"],["server/calculation/fslrCohortIntegratedLedger.ts","shared/companyConditionalData.ts","shared/companyConditionalSemantics.ts","script/validate-fslr-cohort-integrated-private.ts","script/validate-fslr-public-cohort-private.ts"])
  r["new_files_functions"]=[{"path":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"namedFunctions":re.findall(r"(?:function|def)\s+(\w+)",Path(f).read_text())} for f in paths if Path(f).exists()]
  if "prior_files_functions_preserved" not in r:r["prior_files_functions_preserved"]=r.get("files_functions_changed")
  r["files_functions_changed"]=r["new_files_functions"]
x["latest_changed_paths"]=sorted(set(subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()))
x["updated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat()
x["latest_increment"]["bundle_cohort"]={"clauses":list(entries),"execution":execution,"pythonTests":179,"privateValidators":3,"browserChangedCases":"3/3pass; prior failures/followups retained","originalSemantics":"1000/1001 unchanged;18supplemental definitions added,1792total","counts":"41verified257partial2blocked","provisioning":"private authorized transfer unavailable; no new resources"}
x["restart"]["instruction"]="S07-002 needs authenticated private transfer of current155bd3ff bundle and live selected reads; do not rerun isolated29refusals unchanged. S16-005 finite engineering verified, preserve3newbrowserpasses. Continue FSLR unallocatedgrants/Q1day/eligiblevolumes, NEE LLCcash, XOM actualcontract/Rosecrosswalk. Miningmonthly candidate rejected as fresh independent outcomes by primary methodology; seek genuine dated/fullscope sources. All0–17remaining requirements persist;0/3cases, no efficacy."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
old=f.read_text()
if old.startswith("# Private bundle rehearsal,"):old=old[old.index("# Latest verified offline-route/component release"):]
f.write_text("# Private bundle rehearsal, integrated FSLR receipts and finite UI acceptance\n\n"+json.dumps(x["latest_increment"]["bundle_cohort"],indent=2)+"\n\n"+"\n\n".join(k+": "+v[1]+"\nNext: "+v[2] for k,v in entries.items())+"\n\n"+old)

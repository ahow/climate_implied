import json,hashlib,subprocess,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
sources={
 "docs/issuer-analytics-evidence.json":["S12-001"],
 "docs/physical-attribution-evidence.json":["S07-008"],
 "docs/driver-source-continuation-evidence.json":["S04-002","S04-004","S04-008"],
 "docs/portfolio-frequency-evidence.json":["S14-010","S14-012","S14-014","S15-008","S15-010","S15-011","S15-013"],
 "docs/Return_Quality_Protocol.json":["S15-009","S01-001"]}
paths=sorted(set(subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()))
evidence=[{"path":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"originalClauses":ids} for f,ids in sources.items()]
receipt=json.JSONDecoder().raw_decode(Path("/tmp/resumed-final.log").read_text())[0]
recovery=json.JSONDecoder().raw_decode(Path("/tmp/resumed-final-recovery.log").read_text())[0]
quality={"protocolHash":"1cff730fd30647e4bc10de0371353ab7f6a265a51d72f66436a008a7b37d6052",
 "population":411339,"sampled":50,"sourceRequests":50,"exactIsinCandidates":50,"computedReturns":0,"unavailableReturns":50,
 "weekendBoundaries":24,"allSampleLabelsDayOfMonth":22,"breakRates":None,
 "sampleHash":"56f4fc0469a3669d8337b43deda20f6383e737093703b2bee06d29007efa492e",
 "resultHash":"f150fb2bbac73557d52d71569cb245dfcb2dfc03e756b62dc515b1a5a8c2bd78",
 "remaining":"Exact common-share/listing/currency/history evidence and prices/dividends/splits/share basis. No sample replacements, owner approval, nearest-close substitution or actual50-return reconciliation.",
 "softwareCorrection":"First attempt completed and retained all50 source requests, then console hashing rejected undefined optional fields. Explicit null handling fixed; retained data and calls were not repeated.",
 "newPaths":["server/calculation/returnQuality.ts","script/return-quality.test.ts","script/prepare-return-quality-sample.ts","script/attempt-return-quality-identities.ts","script/validate-return-quality-private.ts","shared/fieldSemantics.ts"]}
increment={"recordedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"scope":"Continuation after credit interruption; not full completion",
 "evidence":evidence,"quality":quality,"finalExecution":receipt,"recoveryExecution":recovery,"changedPaths":paths,
 "finalCheckOutcome":"511publicTS/0fail/0skip;123publicPython passed;3new mandatoryprivate policy tests passed; return-quality and original-issuer private validators passed. Initial shell then refused because operator-driver validator lacked explicit --private-primary flag. Recovery used required flag (no guard change), passed new validator plus primary-file/pinned355-assertion validators and build. Typecheck passed. Existing4driver/4wind private receipts preserved, not recounted as new.",
 "priorVerified":"482 publicTS+4mandatoryprivate-driver;117Python+4mandatoryprivate-wind. Older484/121 historical. S12-012/018 not rerun for completion.",
 "remaining":"Original0–17 and amendments remain. 0/3 qualified issuer cases until original criteria pass; historical attributedGMST unavailable; no calibrated10k/family efficacy. Genuine operator principal and supported provisioning remain narrow owner dependencies.",
 "releaseBoundary":"Recovered f814fb21269fa867f4b400f032678bc289ff9338 with successful CI42835210133 and Railway4b2d87aa-b434-4e68-9440-f2c89f2725a3. New source not yet claimed deployed."}
for s in x["stages"]:
 for r in s["requirements"]:
  matches=[a for a in evidence if r["id"] in a["originalClauses"]]
  if matches:
   r["resumed_analytics"]={"evidence":matches,"execution":receipt,"quality":quality if r["id"] in ["S15-009","S01-001"] else None,
     "acceptance":"Partial; new engineering/source diagnostics do not establish original scientific acceptance."}
   r["executions"].extend([receipt,recovery])
x["latest_increment"]["credit_resumed_analytics"]=increment
x["restart"]["instruction"]="Continue original0–17/amendments from resumed analytics evidence. Preserve new operating funded-case and reverse findings; monthly sleeve/factor integration; source-backed policy exposure5.32 conditionalonly; actualIGCC history/operator diagnostics; fixed50sample with50candidateISINmatches but0qualifiedreturncomparisons. Complete remaining source-qualified operating-growth/terminal/identity links, compatiblehistoricalGMST/nativeinputs/jointdistributions and actual dated portfolio outcomes. No unchanged reruns/refits/proxy efficacy/selfapproval. Originalunknownsummary1 remains. Genuine authenticatedoperator identity/provisioning owner actions narrowonly. Refresh release receipts; callback onlytrueend."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:
 f.write("\n## Resumed substantive analytics after credit interruption\n\n"+json.dumps(increment,indent=2)+"\n")
 f.write("\nNo original clause/source/amendment reindexing. Existing39verified259partial2provisioning-blocked remain; all300 retained. Source hashes are not publication vintages; tests are not science acceptance. Owner-approved/public data were not activated. Existing scheduler/cadence/auth/approval boundaries preserved.\n")

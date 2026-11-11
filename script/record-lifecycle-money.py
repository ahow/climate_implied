import json,datetime,hashlib,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());e=json.JSONDecoder().raw_decode(Path("/tmp/lifecycle-verified.log").read_text())[0]
groups={
"S02-004":("docs/s10-lifecycle-and-original-pilot-provenance-evidence.json","Versioned lifecycle×identity denominator,35cells reconcile2442full/0eligible; lifecycle independent reviewstates.","No historicalapproval/financialeligibility inferred."),
"S10-001":("docs/s10-lifecycle-and-original-pilot-provenance-evidence.json","120provider-activeobservations withactualdatedsources;2322unknown; acquisition/merger/delistingknown0. Lastobservation/inactiveflag/acceptedidentity neverimplieslifecycle.","Provider observations not original historicalinvestability."),
"S10-008":("docs/s10-lifecycle-and-original-pilot-provenance-evidence.json","Every2442company paired lifecycle/sevenstate; API/UI/XLSX22214rows+2auditrows reconcile, immutableeligible0.","Legacyaccepted1 remainsunretained/unknownlifecycle; no approvalrefreeze."),
"S10-009":("docs/s10-lifecycle-and-original-pilot-provenance-evidence.json","All120nonunknownsources audited;0unverifiednonunknownlabels.","Do notinferlistingfromidentity or corporateactionsfromlastworkbookdate."),
"S10-003":("docs/s10-lifecycle-and-original-pilot-provenance-evidence.json","Existing100caseaudit authenticated50unmatched+50ambiguous fromFULL2442,notoriginal200; boundedartifact/readonlysnapshot search retained.","Originaldated200membership/results/sourceversion required; no replacement sample."),
"S10-007":("docs/S10-007-013-workbook-money-evidence.json","Actual811572numericmoneycells audited;0explicitcurrencies/qualifiedscales/authorizedexactdayFX,0conversions.193dates;16Profitzeros/192samemonthcrossdatepairs preserved. UNITS tokenswere2securitynames,notunits.","Need datatypecurrency/minorunit/multiplier andactual-source-dayFX receipts; identityapprovalalonecannotqualify worksheetmoney."),
"S10-013":("docs/S10-007-013-currency-consumers-evidence.json","Allactualnominalconsumers/weights/rawMC-Profitfallback guarded; moneytotals/shares/unknownbacktests withheldnot0.2437nativecapitalizationobservations and390215reportedpositivePE retained;1255unsupportedfallbackswithheld. Actualprivateconsumer/XLSXproof.","Currencyengineeringverified, not qualifiedmonetarydata/valuation. IndependentdimensionlessPE retained."),
"S03-004":("docs/S03-004-source-missingness-evidence.json","RemovedNOAA/OWIDprematurerounding;sourceprecision retained,underflowrefused. Readonlyqualifiedarchive fourstates andinteriorinfillonlyactualblank/donors/source-suppliedpaireddraws.8observations/1zero/1infill/2derivedsamples/4withheld. Oldscopeaggregate2rows10emissions→1observedzero row0 documented.","Fullfourstatepersistence/review/UI andrealproviderpaired-draw evidence remain; deterministic/carryforward diagnostics not sampledstandard."),
}
verified={"S02-004","S10-001","S10-008","S10-009","S10-013","S16-014"}
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"]=="S16-014":
   q.setdefault("before_lifecycle_currency",{"status":q["status"],"published_ledger_revision":"57a264ba106a22f744707b0ccd0bcab0683e8869"})
   q["status"]="verified";q["proposedStatus"]="verified";q["check_type"]="exact";q["remaining_gaps"]=[];q["remainingGaps"]=[]
   q["behaviour_delivered_this_run"]="8routes desktop/mobile;42applicable controlledloading/empty/errorcells,6static404NA. Mobiletableoverflow708px→307px within309wrapper fixed;summaryloadingfeedbackfixedwithactualquerySSR. Syntheticemptyzeros notrealfindings."
   q["lifecycle_currency_increment"]={"file":"docs/S16-014-desktop-mobile-review.md","execution":e};q["next_action"]="Preserve earlierfailedmobile/feedbackreceipts; this is finiteUIengineering not scientificacceptance."
   q["executions"]=(q.get("executions")or[])+[e]
   q["files_functions_changed"]=(q.get("files_functions_changed")or[])+["client/src/components/company-conditional-summary.tsx","client/src/pages/climate-valuation.tsx","script/valuation-indicator-partial-state.test.ts"]
   continue
  if q["id"] not in groups:continue
  f,b,n=groups[q["id"]];q.setdefault("before_lifecycle_currency",{"status":q["status"],"published_ledger_revision":"57a264ba106a22f744707b0ccd0bcab0683e8869"})
  q["lifecycle_currency_increment"]={"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"evidence":json.loads(Path(f).read_text()),"execution":e}
  q["behaviour_delivered_this_run"]=b;q["next_action"]=n
  paths=["server/financialData/stage10Lifecycle.ts","server/financialData/stage10Coverage.ts"] if q["id"] in {"S02-004","S10-001","S10-003","S10-008","S10-009"} else ["server/dataIngestion/adapters/qualifiedArchive.ts","script/source-qualified-missingness.test.ts"] if q["id"]=="S03-004" else ["server/financialData/workbookMoney.ts","server/financialData/workbookMoneyConsumers.ts","server/workbookMoneyAuditApi.ts"]
  prior=q.get("files_functions_changed")or[];q["files_functions_changed"]=prior+[v for v in paths if v not in prior]
  if e not in(q.get("executions")or[]):q["executions"]=(q.get("executions")or[])+[e]
  if q["id"] in verified:q["status"]="verified";q["proposedStatus"]="verified";q["check_type"]="exact";q["remaining_gaps"]=[];q["remainingGaps"]=[];q["operational_scientific_boundaries"]=n
  else:q["remaining_gaps"]=[n];q["remainingGaps"]=[n]
x["latest_increment"]["lifecycle_currency"]={"execution":e,"counts":"56verified242partial2blocked","semantics":"Original1000/1001unchanged;extra64component/supplementalfieldsnotoriginalclosure","release":"NOT DEPLOYED; existing queues observed independently","failure_history":"Interrupted/constrained validation attempts retained. Cachetransport fixture unqualifiedaftermoneyguard; Nodeassertion diagnostic inferencehung; explicitmessages/qualifiedsyntheticreceipts/sharedESMcontexts/boundedtimeouts fixed without productiongateweakening. Mobileoverflow andsummaryfeedback failures fixed, receipts preserved."}
x["restart"]["instruction"]="First inspectexistingGitHubCI/promotion; lastobservedruntime09b, newworknotclaimeddeployed. Lifecycle2442/120listedobservations/2322unknown/0eligible andcurrencyguards implemented; unknownunits/FX no financialapproval. S10original200cohort missing; no substitute. Full42cell desktop/mobile review done with mobilefix. Continue actualsource-currency/FX/issueroperatinginputs/qualifiedhistoricalcorpus andsource-supported scientificstudies; frozen negatives unchanged. Bundle2025 only matchingreplacementsource, no provision on09b."
x["updated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat();p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Lifecycle evidence and checked monetary aggregation\n\n"+json.dumps(x["latest_increment"]["lifecycle_currency"],indent=2)+"\n\n"+"\n\n".join(k+": "+v[1]+"\nNext/boundary: "+v[2] for k,v in groups.items())+"\n\n"+f.read_text())

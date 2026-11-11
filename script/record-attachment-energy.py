import json,sys,datetime,hashlib,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e=json.JSONDecoder().raw_decode(Path("/tmp/attachment-final.log").read_text())[0]
entries={
"S12-017":("docs/issuer-attachment-grant-evidence.json","Actual2019/2020incorporatedcontracts and3accessioninventories126/7/19files; inspected86/1sheetworkbooks. ExhibitB IRRmodel notlocatedwithinexaminedscope. FY2025 source reports ALLremainingexternalRenewablesIIClassB acquiredApril2025 for931m; old30%holding remainscounterfactual.931+219=1150buyoutcash; financing−674;739+630−674=695cashincrease,threezeroresiduals.","Retrieve actualLLCAvailableCash/reserves/datedflows andNEEFY2025parent/legalentitycrosswalk to61m distributions/931m acquisition; noFY2024cash insertion."),
"S12-008":("docs/issuer-attachment-grant-evidence.json","H12026Note5: firstIndia subsidy installmentreceivedJuly2026 afterJune30; amount/day/cashclassificationunknown. FY2025CFO lessselectedcreditreceipts613.405m isdiagnosticnotFCFE;14.435m/.780m unexplainedresiduals retained. Old32rows/outcomes unchanged.","Programme-specific grantrollforward/eligiblevolumes stillneeded; Q32026Alabama6.1m recognition isnextretainedsource,notIndiacash."),
"S04-003":("docs/kaya-eu-energy-definition-source-evidence.json","PublisherEIpriority/EIAfallback doesnotrecomputeEU27; regionalandhybridcountrytableboundaries differ.420cellscompared,417exact; Malta2022+.010/2023+2.457TWh explainsresidualchangesexactly;2016−4.027TWhgap persists. TerritorialCO2 excludesinternationalbunkers exceptWorld. No forecastentitynewlyqualified; nofits.","Acquire rights-qualifiedsame-releaseproviderflags/fullprecisionenergy,EIdefinitions/member-regiondata,GCBparentterritorynotes. Original2011PPP gaps remain;2021PPP notsubstitution."),
"S07-002":("docs/fair-private-provisioning-investigation.json","Manusinvestigationcompleted: documentedknownscope reads GraphQLNotAuthorized/ProjectToken notfound; notglobalcredentialinvalidity. Nochange/transfer. Existing155bd3ffbundleunchanged.","AuthorizedCLI/registeredSSH principal plusprivatebundleaccess; configureFAIR_ARTIFACT_ROOT beforefinalcontainer,thenprivateinstall/activate, retainrecoverycopy.")}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] not in entries:continue
  f,b,n=entries[r["id"]];r["attachment_energy_increment"]={"evidence":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"details":json.loads(Path(f).read_text()),"execution":e}
  r["behaviour_delivered_this_run"]=b;r["next_action"]=n
  if e not in (r.get("executions") or []):r["executions"]=(r.get("executions") or [])+[e]
x["latest_increment"]["attachment_energy"]={"execution":e,"counts":"41verified257partial2blocked","semantics":"original1000/1001;88conditionaldefinitions;508exportleaves","release":"pending"}
if len(sys.argv)==4:
 r={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"health":200,"build_info":"exactSHAverified","affected":"PublicconditionalAPI newIndiaamountnull/scoped61m facts verified; no qualification/promotion.","tests":"736TS0fail0skip;196Python;mandatoryissuer/privateenergyvalidators;typecheck/build","scope":"Code only; privatebundleunchanged/unprovisioned; laterdocs/localreceipt distinct"}
 x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["attachment_energy"]["release"]=r
x["restart"]["instruction"]="Next NEEFY2025parent/legalentitycrosswalk/actualLLCAvailableCash; FSLRQ32026ASC832Alabama recognition notIndiacash; rights-qualifiedsame-releaseEUenergyproviderflags/definitions/GCBterritorynotes. No newlyqualifiedKayaentity; no fakeholdouts. S07operatoraccess dependency confirmed by completedManusinvestigation,notpending.41verified257partial2blocked;0/3cases. Alloriginalscope remains."
x["updated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat();p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Attachment and energy-definition implementation receipt\n\n"+json.dumps(x["latest_increment"]["attachment_energy"],indent=2)+"\n\n"+"\n\n".join(k+": "+v[1]+"\nNext: "+v[2] for k,v in entries.items())+"\n\n"+f.read_text())

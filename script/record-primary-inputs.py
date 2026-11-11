import json,hashlib,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());e=json.JSONDecoder().raw_decode(Path("/tmp/primary-inputs-check.log").read_text())[0]
g={"S12-001":["docs/xom-source-inputs-evidence.json","docs/xom-contract-permit-evidence.json"],"S04-003":["docs/kaya-highfrequency-source-evidence.json"],"S04-005":["docs/kaya-highfrequency-source-evidence.json"]}
summary={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":e,
"company":"Actual XOM/CF/UKlaw/EA sources acquired. Corporate sixyear cashcapex arithmetic167–194bn not CCSallocation. Statutory1allowance/tCO2e closed. CF explicit2024metric capacity2m/0.5m; conditional2025–29ceiling11mtonnes, not billings. Clientcapturecapital200m/100m is NOT XOMcost.2022shorttons distinct. ExactEApermitcrosswalk absent; tariffs/opex/funding contract not located, not globally undisclosed.0/3qualified.",
"climate":"FixedEU27nativeMPD351memberyears/13GDPyears2010–22 assembled;54required2023–24cells absent. PPP2011 unchanged, no splice/windowshortening. OriginalDESNZ June2024/2025/2026releases provide18quarterly power outcomes; not daily/monthlyCO2 or accepted nowcast. No holdout scored.",
"next":"Continue actual CF2022primary announcement via documented archivepage2, full executedcontract/fee/funding discovery and exactETS11402crosswalk; NEEgrosscash/LLC/projecteconomics and FSLRlaw remain. Need missingcompatibleGDPcells and originalmonthly/dailyCO2releases before frozenholdouts; no substitutequarterlypower acceptance. Preserve all completed sourceassemblies/negative studies.",
"counts":"40verified258partial2blocked after exact S16-010 engineering acceptance reconciliation; no scientific/owner acceptance. Original1000/1001 unchanged."}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in g:
   r["primary_source_increment"]=[{"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"details":json.loads(Path(f).read_text())} for f in g[r["id"]]]
   r["executions"].append(e);r["behaviour_delivered_this_run"]=summary["company" if r["id"]=="S12-001" else "climate"];r["next_action"]=summary["next"]
  if r["id"]=="S16-010":
   r["status"]="verified";r["remaining_gaps"]=[];r["next_action"]="Retest affected rendered routes when their implementation changes; no additional science prerequisite belongs to this engineering criterion."
   r["behaviour_delivered_this_run"]="All seven actual routes plus fallback have retained passing all-absent browser checks; exact written all-pages-unavailable acceptance met. Historical partial timing failure and focused correction retained separately."
   r["criterion_reconciliation"]={"scope":r["requirement"],"evidence":["generated-artifacts/rendered-states/rendered-state-report-41.json","generated-artifacts/rendered-states/rendered-state-remainder-report.json"],"scientific_or_owner_acceptance":"not implied"}
  if r["id"]=="S16-005":
   r["remaining_gaps"]=["All-route unavailable fixtures and specific missingness reasons are demonstrated; universal every-component partial-state assertion remains broader than the finite route fixture coverage. No missing-render-fixture claim remains."]
   r["next_action"]="Bind per-component partial-field contracts to the existing route inventory; no unrelated scientific/owner prerequisites."
x["latest_increment"]["primary_inputs"]=summary;x["restart"]["instruction"]=summary["next"]+" "+summary["counts"];x["updated_at"]=summary["at"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Primary input acquisition — coherent checks passed; release pending\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())

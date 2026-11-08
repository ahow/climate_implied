/** Reconciled regional allocation from the published GCB 2025 bookkeeping data. */
import XLSX from "xlsx";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { regionalLandUse } from "../server/calculation/regionalLandUse";
import { reconcileRegionalInventory } from "../server/calculation/regionalInventory";
import { contentHash } from "../server/calculation/analysisManifest";
import inventory from "../server/calculation/data/inventory2024.json";
const url = "https://globalcarbonbudget.org/download/2348/?tmstv=1762816074";
const sha = "7dcf3e8706ab79e989d0346a2878c04b0d8dc7bfc6eea3a299060221aab02474";
const root = "generated-artifacts/regional-inventory";
const response = await fetch(url);
if (!response.ok) throw new Error("GCB land-use source unavailable");
const bytes = Buffer.from(await response.arrayBuffer());
if (createHash("sha256").update(bytes).digest("hex")!==sha) throw new Error("GCB source changed; explicit review required");
await writeFile(`${root}/gcb-national-land-2025.xlsx`,bytes);
const book = XLSX.read(bytes);
const models = ["BLUE","OSCAR","LUCE"].map(model=>{
  const rows = XLSX.utils.sheet_to_json<any[]>(book.Sheets[model],{header:1});
  if (!String(rows[1]?.[0]).includes("3.664")) throw new Error("Native carbon conversion missing");
  const header = rows.find(r=>r.includes("Global"));
  const row = rows.find(r=>r[0]===2024);
  if (!header || !row) throw new Error("Missing 2024 national bookkeeping data");
  const value=(name:string)=>row[header.indexOf(name)];
  return {model,globalMtC:value("Global"),eu27MtC:value("EU27"),usMtC:value("USA"),
    chinaMtC:value("China"),indiaMtC:value("India")};
});
const anchor = inventory.cells.find(c=>c.sector==="LULUCF")!.nativeMt;
const land = regionalLandUse(models,anchor);
const previous = JSON.parse(await readFile(`${root}/inventory.json`,"utf8"));
const cells = [...previous.cells.filter((c:any)=>c.sector!=="LULUCF"), ...land.cells];
const reconciliation = reconcileRegionalInventory(cells,inventory.cells);
if (!reconciliation.passed) throw new Error("Complete native regional accounting failed");
const totals: Record<string,number>={};
for (const c of cells) {
  const gwp=inventory.cells.find(g=>g.gas===c.gas&&g.sector===c.sector)?.gwp100;
  if (gwp===undefined) throw new Error("Missing GWP");
  totals[c.region]=(totals[c.region]??0)+c.nativeMt*gwp/1000;
}
const report={ version:"regional-inventory-2",year:2024,cells,reconciliation,regionalGtCO2e:totals,
  sourceHashes:{...previous.sourceHashes,"national-land-2025.xlsx":sha},landUse:{...land,url,models,
    sourcePage:"https://globalcarbonbudget.org/datahub/the-latest-gcb-data-2025/",
    citation:"Friedlingstein et al., Global Carbon Budget 2025; BLUE, OSCAR and LUCE modelling groups",
    terms:"GCB fair-use statement: cite GCB and individual sources; acknowledge contributing modelling groups"},
  evidenceState:"Model-assisted estimate",productionEligible:false,
  limitations:["Inventory accounting is not calibrated projection or climate-model validation",
    "Rest of World includes territories and residual accounts in the source global total"] };
await writeFile(`${root}/complete-inventory.json`,JSON.stringify({id:contentHash(report),...report},null,2));
console.log(JSON.stringify({id:contentHash(report),regions:totals,nativeAccounting:reconciliation.passed,
  cells:cells.length,landUse:land},null,2));

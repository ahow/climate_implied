/** Offline assessment only: never overwrites the full-universe audit or approvals. */
import { readFile, writeFile } from "node:fs/promises";
import { diagnoseMapping } from "../server/financialData/mappingDiagnostics";
import { contentHash } from "../server/calculation/analysisManifest";
const path="generated-artifacts/financial-data";
const source=JSON.parse(await readFile(`${path}/root-cause-audit.json`,"utf8"));
const rows=source.rows.map((r:any)=>({
  companyId:r.companyId,isin:r.isin,previousStatus:r.status,
  originalStatus:r.originalStatus,profileCollectionTruncated:r.profileCollectionTruncated,
  ...diagnoseMapping(r.isin,r.profiles,r.figi.data??[]),
}));
const report={sourceHash:contentHash(source),selectionHash:source.selectionHash,rows,
  counts:Object.fromEntries(["unmatched","ambiguous","candidate-needs-issuer-review"]
    .map(status=>[status,rows.filter((r:any)=>r.status===status).length])),
  changed:rows.filter((r:any)=>r.status!==r.previousStatus).length,
  approved:0,scope:"100-case diagnostic sample only; not full-universe coverage"};
await writeFile(`${path}/reassessed-root-causes.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,rows:undefined},null,2));

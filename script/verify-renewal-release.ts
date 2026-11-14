import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync,writeFileSync} from "node:fs";
const [sha,name]=process.argv.slice(2);
assert.match(sha,/^[a-f0-9]{40}$/);assert.match(name,/^[a-z0-9-]+$/);
const old=spawnSync(process.execPath,["--import","tsx","script/verify-retained-release.ts",sha,name],{stdio:"inherit"});
assert.equal(old.status,0);
const base="https://dashboard-production-4d39.up.railway.app";
for(const format of ["json","xlsx"]){
 const r=await fetch(base+"/api/calculation/research-contracts",{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({operation:"reviewed-renewal-company-document",format})});
 assert.equal(r.status,403);
}
const html=await(await fetch(base+"/private-finite-viewer")).text();
const asset=html.match(/src="([^"]*\/assets\/[^"]+\.js)"/)?.[1];assert.ok(asset);
const js=await(await fetch(new URL(asset,base))).text();
assert.ok(js.includes("private-renewal-page"));assert.ok(js.includes("private-renewal-company-document-1"));
const file=`generated-artifacts/dated-cash/${name}.json`,receipt=JSON.parse(readFileSync(file,"utf8"));
writeFileSync(file,JSON.stringify({...receipt,privateReaderRefusals:6,renewalViewerAssets:true,
 scope:"Observed2023 literal readback, six403 refusals and deployed viewer assets. Not private future execution or interactive production authentication."},null,2));

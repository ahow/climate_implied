import assert from "node:assert/strict";
import fs from "node:fs";
import Excel from "exceljs";
import {spawnSync} from "node:child_process";
import {economicBridgeCells} from "../shared/economicBridgeSchema";
const [sha,name]=process.argv.slice(2),root="generated-artifacts/dated-cash";
assert.match(sha,/^[a-f0-9]{40}$/);assert.match(name,/^[a-z0-9-]+$/);
const b="https://dashboard-production-4d39.up.railway.app";
try{
 const build=await(await fetch(`${b}/api/build-info?now=${Date.now()}`)).json();
 assert.equal(build.sourceCommit,sha);
 const health=await fetch(b+"/api/health");assert.equal(health.status,200);
 assert.equal((await health.json()).status,"ok");
 const a=await(await fetch(b+"/api/cv/clean-covered")).json();
 const j=await(await fetch(b+"/api/cv/clean-covered/export.json")).json();assert.deepEqual(a,j);
 const r=await fetch(b+"/api/cv/clean-covered/export.xlsx");assert.equal(r.status,200);
 const bytes=Buffer.from(await r.arrayBuffer()),path=`${root}/${name}.xlsx`;fs.writeFileSync(path,bytes);
 const w=new Excel.Workbook();await w.xlsx.load(bytes);
 const rows=economicBridgeCells(j),s=w.worksheets[0];assert.equal(s.rowCount,rows.length+1);
 let cells=0;s.eachRow((row,n)=>row.eachCell((c,k)=>{
  assert.equal(typeof c.value,"string");assert.ok(!c.formula&&!c.hyperlink);
  if(n>1){assert.equal(c.value,k===1?rows[n-2].pointer:rows[n-2].jsonValue);cells++;}
 }));
 assert.equal(spawnSync("python",["-c","import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); assert not any('externalLinks/' in n for n in z.namelist())",path]).status,0);
 for(const operation of ["reviewed-company-projection","reviewed-finite-company-document"])
  for(const format of ["json","xlsx"]){
   const denial=await fetch(b+"/api/calculation/research-contracts",{method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({operation,format})});
   assert.equal(denial.status,403);
  }
 const result={passed:true,at:new Date().toISOString(),source:sha,health:200,identity:a.identity.id,
  rows:rows.length,cells,privateReaderRefusals:4,
  scope:"Observed2023 accounting and private-reader403 only; not future execution, owner or science acceptance"};
 fs.writeFileSync(`${root}/${name}.json`,JSON.stringify(result,null,2));console.log(result);
}catch(e){fs.writeFileSync(`${root}/${name}-failed.json`,JSON.stringify({at:new Date().toISOString(),expected:sha,error:String(e)}));throw e;}

import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import {releaseSafety} from "../server/releaseSafety";
import {registerProspectiveResearchApi} from "../server/prospectiveResearchApi";
import {finiteCompanyPrivacy} from "../server/finiteCompanyPrivacy";
test("public diagnostics cannot read retained private company results or exports",async()=>{
 const app=express();app.use(express.json());app.use(releaseSafety());app.use(finiteCompanyPrivacy);registerProspectiveResearchApi(app);
 let legacy=0;app.post("/api/calculation/research-contracts",(_req,res)=>{legacy++;res.json({private:"must-not-escape"});});
 const server=app.listen(0,"127.0.0.1");await new Promise<void>(r=>server.once("listening",r));
 try{
  const port=(server.address() as any).port;
  for(const operation of ["reviewed-company-projection","reviewed-finite-company-document","reviewed-renewal-company-document","reviewed-funded-company-document"])
   for(const format of ["json","xlsx"]){
    const response=await fetch(`http://127.0.0.1:${port}/api/calculation/research-contracts`,{
     method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation,format,decisionId:"a".repeat(64)})});
    assert.equal(response.status,403);assert.equal((await response.json()).error,"operator-cli-required");
   }
  assert.equal(legacy,0);
 }finally{await new Promise<void>((r,e)=>server.close(err=>err?e(err):r()));}
});

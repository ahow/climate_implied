import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {z} from "zod";
import {companyCoverage} from "../server/calculation/companyCoverage";
import {bindNestedOutput} from "../shared/outputFieldSemantics";

function actualRoute(getCompanyCoverage:Function) {
  const text=readFileSync("server/routes.ts","utf8");
  const source=ts.createSourceFile("routes.ts",text,ts.ScriptTarget.Latest,true);
  let registration="",handler:any;
  function visit(node:ts.Node) {
    if(ts.isCallExpression(node)&&node.expression.getText(source)==="app.get"&&
      ts.isStringLiteral(node.arguments[0])&&node.arguments[0].text==="/api/calculation/company-coverage")
      registration=node.getText(source);
    ts.forEachChild(node,visit);
  }
  visit(source);assert.ok(registration);
  assert.ok(text.indexOf(registration)<text.indexOf('app.use("/api", async'));
  vm.runInNewContext(ts.transpile(registration,{target:ts.ScriptTarget.ES2022}),
    {z,Date,getCompanyCoverage,bindNestedOutput,app:{get:(_:string,h:any)=>{handler=h;}}});
  return async(query:object)=>{
    const res:any={code:200,headers:{},body:null,
      set(k:string,v:string){this.headers[k]=v;return this;},
      status(code:number){this.code=code;return this;},
      json(body:unknown){this.body=body;return this;}};
    await handler({query},res);return res;
  };
}
test("Actual coverage HTTP handler rejects filters, overlays, arrays and future boundaries before reads",async()=>{
  let reads=0;const run=actualRoute(()=>{reads++;throw new Error("Unexpected read");});
  for(const query of [{overlayIds:"fixture"},{geography:"US"},{snapshotId:["a".repeat(64)]},
    {informationCutoff:"2999-01-01T00:00:00Z"},
    {observationDate:"2025-01-02",informationCutoff:"2025-01-01T00:00:00Z"}]){
    assert.equal((await run(query)).code,422);
  }
  assert.equal(reads,0);
});
test("Actual coverage HTTP handler binds complete real calculator output and preserves selected-source identity",async()=>{
  const snapshotId="a".repeat(64);let seen:any;
  const body=companyCoverage({companies:[],observations:[],reviews:[],sourceId:snapshotId,
    observationDate:"2025-01-01",informationCutoff:"2025-01-02T00:00:00Z"});
  const run=actualRoute(async(options:any)=>{seen=options;return body;});
  const r=await run({snapshotId,observationDate:"2025-01-01",informationCutoff:"2025-01-02T00:00:00Z"});
  assert.equal(r.code,200);assert.equal(r.body,body);assert.equal(seen.snapshotId,snapshotId);
  assert.equal(r.headers["Cache-Control"],"no-store");
  assert.deepEqual(r.headers["X-Field-Semantics"].split(","),bindNestedOutput("companyCoverage",body).map(f=>f.id));
});
test("Actual coverage HTTP storage rejection does not substitute current or leak source details",async()=>{
  const r=await actualRoute(()=>{throw new Error("Private internal source detail");})({});
  assert.equal(r.code,503);assert.doesNotMatch(JSON.stringify(r.body),/Private internal/);
});

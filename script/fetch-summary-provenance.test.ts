import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
import {
  FETCH_SUMMARY_SOURCE_FILES, bindKnownPersistedSummary, bindFetchSummaryEvidence,
  packFetchSummaryManifest, verifyFetchSummaryManifest, readFetchSummarySourceHashes,
  type SummaryRun,
} from "../server/dataIngestion/summaryContract";
import { describePersistedSummary } from "../shared/dataManagementSemantics";
import { fetchSummarySemantics, unverifiedFetchSummary } from "../shared/fetchSummarySemantics";
import { ADAPTERS } from "../server/dataIngestion/adapters";
import { INDICATOR_KEYS } from "../server/dataIngestion/indicatorRegistry";
import { outputFieldSemantics } from "../shared/outputFieldSemantics";
import { remainingApiBindings } from "../shared/remainingFieldSemantics";
import ts from "typescript";
import vm from "node:vm";

// Synthetic contract fixtures only. No collector, database or network invocation.
const producer={adapters:ADAPTERS,indicatorKeys:INDICATOR_KEYS};
function completed():SummaryRun {
  return {
    id:"contract-fixture-run",trigger:"manual",status:"completed",
    startedAt:"2026-01-01T00:00:00.000Z",finishedAt:"2026-01-01T00:01:00.000Z",
    proposalsCreated:0,adaptersSucceeded:ADAPTERS.length-1,adaptersFailed:1,
    summary:{perAdapter:ADAPTERS.map((a,i)=>i===1
      ? {id:a.id,values:0,error:"fixture adapter failure"} : {id:a.id,values:i})},
  };
}
function mutation(input:unknown) { return structuredClone(input) as any; }
function evaluateFunction(path:string,name:string,bindings:Record<string,unknown>) {
  const source=ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true);
  const fn=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  assert.ok(fn,`Missing production function ${name}`);
  const context=vm.createContext(bindings);
  const code=ts.transpile(fn.getText(source).replace(/^export /,""),{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
  });
  vm.runInContext(`${code};this.productionFunction=${name}`,context);
  return context.productionFunction;
}
function routeCallback(method:string,path:string|undefined,needle:string,bindings:Record<string,unknown>) {
  const source=ts.createSourceFile("routes.ts",readFileSync("server/routes.ts","utf8"),ts.ScriptTarget.Latest,true);
  let expression="";
  function walk(node:ts.Node) {
    if(ts.isCallExpression(node)&&node.expression.getText(source)===`app.${method}` &&
      (path===undefined || node.arguments[0]?.getText(source)===JSON.stringify(path)) &&
      node.getText(source).includes(needle))
      expression=node.arguments[path===undefined ? 0 : 1].getText(source);
    ts.forEachChild(node,walk);
  }
  walk(source);assert.ok(expression,`Missing production app.${method} ${path}`);
  const code=ts.transpile(`const callback=${expression};this.callback=callback`,{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
  });
  const context=vm.createContext(bindings);vm.runInContext(code,context);return context.callback;
}

test("actual runs handler and summary middleware preserve JSON identity and bind only the owning verified run",async()=>{
  const fixture=archiveFixture(),verifiedRun=completed();
  await fixture.archive(fixture.db,verifiedRun,producer);
  const untagged={...completed(),id:"untagged-run"};
  const opaque={...completed(),id:"opaque-run",summary:{legacy:["kept",false,0,null]}};
  const runs=[verifiedRun,untagged,opaque],before=JSON.stringify(runs);
  const handler=routeCallback("get","/api/data/runs","getRecentRuns",{
    getRecentRuns:async(limit:number)=>{assert.equal(limit,10);return runs;},
    loadFetchSummaryEvidence:fixture.load,console:{error:()=>{}},
  });
  let body:any,header="";
  const res={statusCode:200,json:(value:unknown)=>{body=value;return res;},
    set:(name:string,value:string)=>{assert.equal(name,"X-Field-Semantics");header=value;return res;}};
  const middleware=routeCallback("use",undefined,"bindKnownPersistedSummary",{
    remainingApiBindings,outputFieldSemantics,bindKnownPersistedSummary,bindFetchSummaryEvidence,
  });
  middleware({method:"GET",path:"/api/data/runs"},res,()=>{});
  await handler({},res);
  assert.strictEqual(body.runs,runs);
  for(let i=0;i<runs.length;i++) assert.strictEqual(body.runs[i].summary,runs[i].summary);
  assert.equal(JSON.stringify(runs),before);
  assert.equal(body.summaryEvidence[verifiedRun.id].availability,"verified");
  assert.equal(body.summaryEvidence[untagged.id].availability,"unverified");
  assert.equal(body.summaryEvidence[opaque.id].availability,"unverified");
  assert.ok(header.includes("fetchSummaryProducer.perAdapter[].values"));
  assert.ok(header.includes("fetchSummaryEvidence.manifest.runHash"));
  assert.ok(!header.includes("legacy")&&!header.includes("sourceFiles.server/"));
  const unverifiedBody={runs:[untagged,opaque],summaryEvidence:await fixture.load([untagged,opaque])};
  res.json(unverifiedBody);
  assert.ok(!header.includes("fetchSummaryProducer."),"Compatible untagged JSON never gets verified leaf headers");
  fixture.chunks[0].payload.summaryHash="0".repeat(64);
  await handler({},res);
  assert.equal(body.summaryEvidence[verifiedRun.id].availability,"unverified");
  assert.match(body.summaryEvidence[verifiedRun.id].reason,/verification failed/);
  assert.ok(!header.includes("fetchSummaryProducer."),"Corrupt archived provenance cannot certify summary leaves");
});

test("actual finishing function shares its transaction with archive and rolls back archive failures",async()=>{
  const original={...completed(),status:"running",finishedAt:null,summary:null};
  let stored:any=structuredClone(original),depth=0,archiveCalls=0,fail=false;
  const table={id:"id"};
  const tx={
    update(selected:unknown) {
      assert.strictEqual(selected,table);assert.equal(depth,1);
      return {set(fields:unknown) {
        return {where() {return {async returning() {
          stored={...stored,...fields as object};return [stored];
        }};}};
      }};
    },
  };
  const finish=evaluateFunction("server/dataIngestion/dataStore.ts","finishFetchRun",{
    db:{async transaction(work:(transaction:unknown)=>Promise<unknown>) {
      assert.equal(depth,0,"No nested transaction is started");
      const before=structuredClone(stored);depth++;
      try {return await work(tx);} catch(error) {stored=before;throw error;} finally {depth--;}
    }},
    indicatorFetchRuns:table,eq:()=>true,
    archiveFetchSummary:async(transaction:unknown,run:SummaryRun,registered:unknown)=>{
      assert.strictEqual(transaction,tx);assert.equal(depth,1);
      assert.strictEqual(registered,producer);assert.strictEqual(run,stored);archiveCalls++;
      if(fail) throw new Error("fixture archive write failed");
    },
  });
  const fields={status:"completed",proposalsCreated:0,adaptersSucceeded:4,adaptersFailed:1,
    summary:completed().summary,summaryProducer:producer};
  fail=true;
  await assert.rejects(()=>finish(original.id,fields),/archive write failed/);
  assert.equal(JSON.stringify(stored),JSON.stringify(original));
  fail=false;
  await finish(original.id,fields);
  assert.equal(stored.status,"completed");
  assert.strictEqual(stored.summary,fields.summary);
  assert.equal(archiveCalls,2);
  assert.equal(depth,0);
});

test("actual orchestrator does not hide a persistent prospective archive failure as completed collection",async()=>{
  let finishCalls=0;
  const context:any={
    inFlight:false,hasRunningFetch:async()=>false,createFetchRun:async()=>({id:"fixture"}),
    ADAPTERS:[{id:"fixture-adapter",keys:[],fetch:async()=>[]}],INDICATOR_KEYS:[],
    getCuratedValue:()=>undefined,LATEST_CURATED_YEAR:2024,
    insertProposals:async()=>0,finishFetchRun:async()=>{
      finishCalls++;throw new Error("fixture persistent manifest archive failure");
    },console:{error:()=>{},log:()=>{}},
  };
  const run=evaluateFunction("server/dataIngestion/orchestrator.ts","runFetchLocked",context);
  await assert.rejects(()=>run("manual"),/persistent manifest archive failure/);
  assert.equal(finishCalls,2,"Existing outer failure path attempts to retain a failed summary, never returns completed");
});
function archiveFixture(available=true) {
  const headers:any[]=[],chunks:any[]=[];
  const headerTable={id:"id",kind:"kind",parentId:"parentId"},chunkTable={snapshotId:"snapshotId"};
  const match=(row:any,condition:any):boolean=>condition.type==="and"
    ? condition.conditions.every((c:any)=>match(row,c)) : row[condition.key]===condition.value;
  const db={
    insert(table:unknown) {
      let value:any;
      return {
        values(input:unknown) { value=input;return this; },
        onConflictDoNothing() { return this; },
        async returning() {
          const target=table===headerTable ? headers : chunks;
          if(target.some(row=>row.id===value.id)) return [];
          target.push(structuredClone(value));return [value];
        },
        then(resolve:any,reject:any) {
          try { chunks.push(structuredClone(value));return Promise.resolve().then(resolve,reject); }
          catch(error) { return Promise.reject(error).then(resolve,reject); }
        },
      };
    },
    select() {
      let target:any[]=[],condition:any;
      return {
        from(table:unknown) { target=table===headerTable ? headers : chunks;return this; },
        where(input:unknown) { condition=input;return this; },
        orderBy() { return this; },
        then(resolve:any,reject:any) { return Promise.resolve(target.filter(row=>match(row,condition))).then(resolve,reject); },
      };
    },
  };
  const bindings={
    db,cvAnalysisSnapshots:headerTable,cvAnalysisChunks:chunkTable,
    snapshotsAvailable:async()=>available,FETCH_SUMMARY_KIND:"indicator-fetch-summary",
    packFetchSummaryManifest,verifyFetchSummaryManifest,unverifiedFetchSummary,
    eq:(key:string,value:unknown)=>({type:"eq",key,value}),
    and:(...conditions:unknown[])=>({type:"and",conditions}),asc:(value:unknown)=>value,
    console:{warn:()=>{}},
  };
  return {
    headers,chunks,db,
    archive:evaluateFunction("server/dataIngestion/summaryArchive.ts","archiveFetchSummary",bindings),
    load:evaluateFunction("server/dataIngestion/summaryArchive.ts","loadFetchSummaryEvidence",bindings),
  };
}

test("actual archive writer and loader reuse immutable chunks without modifying the retained run",async()=>{
  const fixture=archiveFixture(),run=completed(),before=JSON.stringify(run);
  const written=await fixture.archive(fixture.db,run,producer);
  assert.equal(written.availability,"verified");
  assert.equal(fixture.headers.length,1);
  assert.equal(fixture.chunks.length,1);
  assert.equal(fixture.headers[0].parentId,run.id);
  const repeated=await fixture.archive(fixture.db,run,producer);
  assert.equal(repeated.manifestId,written.manifestId);
  assert.equal(fixture.chunks.length,1,"Identical archive writes are idempotent");
  const loaded=await fixture.load([run]);
  assert.equal(loaded[run.id].availability,"verified");
  assert.equal(loaded[run.id].manifestId,written.manifestId);
  assert.equal(JSON.stringify(run),before);
  fixture.chunks[0].payload.summaryHash="0".repeat(64);
  assert.equal((await fixture.load([run]))[run.id].availability,"unverified");
  assert.match((await fixture.load([run]))[run.id].reason,/verification failed/);
  await assert.rejects(()=>fixture.archive(fixture.db,run,producer),/mismatch/);
});

test("actual archive read path fails closed for missing, conflicting, incomplete and unprovisioned storage",async()=>{
  const run=completed(),fixture=archiveFixture();
  assert.match((await fixture.load([run]))[run.id].reason,/No prospective producer manifest/);
  await fixture.archive(fixture.db,run,producer);
  fixture.headers.push({...fixture.headers[0],id:"f".repeat(64)});
  assert.match((await fixture.load([run]))[run.id].reason,/Conflicting/);
  fixture.headers.pop();
  fixture.chunks.splice(0);
  assert.match((await fixture.load([run]))[run.id].reason,/Incomplete/);
  const unavailable=archiveFixture(false);
  assert.equal((await unavailable.archive(unavailable.db,run,producer)).availability,"unverified");
  assert.equal(unavailable.headers.length,0);
  assert.match((await unavailable.load([run]))[run.id].reason,/not provisioned/);
});

test("real source registry and allowlisted file bytes produce a prospective versioned run-bound manifest",()=>{
  const run=completed(),before=JSON.stringify(run),hashes=readFetchSummarySourceHashes();
  assert.deepEqual(Object.keys(hashes),[...FETCH_SUMMARY_SOURCE_FILES]);
  assert.ok(Object.values(hashes).every(hash=>/^[a-f0-9]{64}$/.test(hash)));
  const packed=packFetchSummaryManifest(run,producer,hashes);
  assert.equal(packed.manifest.producer,"server/dataIngestion/orchestrator.ts");
  assert.equal(packed.manifest.kind,"indicator-fetch-summary");
  assert.equal(packed.manifest.version,"indicator-fetch-summary-1");
  assert.equal(packed.manifest.runId,run.id);
  assert.equal(packed.manifest.summaryHash,contentHash(run.summary));
  assert.equal(packed.manifest.sourceHash,contentHash(hashes));
  assert.deepEqual(packed.manifest.adapters,ADAPTERS.map(a=>({id:a.id,keys:[...a.keys]})));
  assert.equal(packed.id,contentHash(packed.manifest));
  assert.equal(verifyFetchSummaryManifest(run,packed.id,packed.manifest).availability,"verified");
  assert.equal(JSON.stringify(run),before,"Original raw JSON and metadata are not rewritten");
  assert.ok(!JSON.stringify(packed.manifest).includes("const "),"Archive contains digests, not source file export");
});

test("untagged compatible and opaque historical JSON earn zero verified leaf bindings",()=>{
  for(const raw of [completed().summary,{perAdapter:[]},null,0,false,"archive text",[],{},
    {perAdapter:[],unexpected:true},{perAdapter:[{id:"x",values:-1}]}]) {
    const before=JSON.stringify(raw),description=describePersistedSummary(raw);
    assert.equal(description.provenance,"unverified");
    assert.deepEqual(bindKnownPersistedSummary(raw),[]);
    assert.deepEqual(bindKnownPersistedSummary(raw,unverifiedFetchSummary("No prospective manifest")),[]);
    assert.equal(JSON.stringify(raw),before);
  }
});

test("changed run, counts, raw JSON, source, kind, producer, version and archive identity all fail closed",()=>{
  const run=completed(),packed=packFetchSummaryManifest(run,producer);
  for(const field of ["id","trigger","status","startedAt","finishedAt","proposalsCreated","adaptersSucceeded","adaptersFailed"]) {
    const changed=mutation(run);
    changed[field]=typeof changed[field]==="number" ? changed[field]+1 :
      field.endsWith("At") ? "2026-01-02T00:00:00.000Z" : "changed";
    assert.throws(()=>verifyFetchSummaryManifest(changed,packed.id,packed.manifest),undefined,field);
  }
  const changed=mutation(run);
  changed.summary.perAdapter[0].values+=1;
  assert.throws(()=>verifyFetchSummaryManifest(changed,packed.id,packed.manifest),/mismatch/);
  assert.throws(()=>verifyFetchSummaryManifest(run,"0".repeat(64),packed.manifest),/mismatch/);
  for(const field of ["producer","kind","version","runId","runHash","summaryHash","sourceHash"]) {
    const bad=mutation(packed.manifest);
    bad[field]=field.endsWith("Hash") ? "0".repeat(64) : "unknown";
    assert.throws(()=>verifyFetchSummaryManifest(run,contentHash(bad),bad),undefined,field);
  }
  const bad=mutation(packed.manifest);
  bad.sourceFiles[".env"]="0".repeat(64);
  bad.sourceHash=contentHash(bad.sourceFiles);
  assert.throws(()=>verifyFetchSummaryManifest(run,contentHash(bad),bad),/allowlist/);
  assert.throws(()=>packFetchSummaryManifest(run,{...producer,adapters:[...ADAPTERS].reverse()}),/order/);
  assert.throws(()=>packFetchSummaryManifest(run,{...producer,indicatorKeys:[]}),/unregistered/);
});

test("failure prefixes and genuine zero results are retained; unknown extensions are not silently stripped",()=>{
  const run=completed();
  const failed={...run,status:"failed",adaptersSucceeded:1,adaptersFailed:1,
    summary:{perAdapter:(run.summary as any).perAdapter.slice(0,2),error:"fixture insert failure"}};
  const packed=packFetchSummaryManifest(failed,producer);
  const evidence=verifyFetchSummaryManifest(failed,packed.id,packed.manifest);
  const bindings=bindKnownPersistedSummary(failed.summary,evidence);
  assert.ok(bindings.some(f=>f.id==="fetchSummaryProducer.perAdapter[].values"));
  assert.ok(bindings.some(f=>f.id==="fetchSummaryProducer.error"));
  assert.equal((failed.summary as any).perAdapter[0].values,0);
  const bad=mutation(failed);bad.summary.newMeaning=1;
  assert.throws(()=>packFetchSummaryManifest(bad,producer));
  assert.throws(()=>bindKnownPersistedSummary(bad.summary,evidence),/match/);
  const wrong=mutation(failed);wrong.summary.perAdapter[1].values=1;
  assert.throws(()=>packFetchSummaryManifest(wrong,producer),/cannot report/);
});

test("supplemental definitions and explicit sidecar/display bindings stay separate from the original opaque slot",()=>{
  assert.equal(fetchSummarySemantics.length,16);
  assert.equal(new Set(outputFieldSemantics.map(f=>f.id)).size,outputFieldSemantics.length);
  const run=completed(),packed=packFetchSummaryManifest(run,producer);
  const verified=verifyFetchSummaryManifest(run,packed.id,packed.manifest);
  assert.ok(bindFetchSummaryEvidence(verified).every(f=>f.id.startsWith("fetchSummaryEvidence.")));
  assert.equal(bindFetchSummaryEvidence(unverifiedFetchSummary("No archive")).length,4);
  const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
  assert.equal(census.originalGapReconciliation.originalPublicSlots,1001);
  assert.equal(census.originalGapReconciliation.remainingOriginalUnboundSlots,1);
  assert.equal(census.originalGapReconciliation.closedOriginalSlots,571);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields,1000);
  assert.equal(census.completion,false);
  const ui=readFileSync("client/src/pages/data-management.tsx","utf8");
  const source=ts.createSourceFile("ui.tsx",ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const label=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="runSummaryClaimLabel")!;
  const code=ts.transpile(label.getText(source),{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None});
  const context=vm.createContext({describePersistedSummary});
  vm.runInContext(`${code};this.label=runSummaryClaimLabel`,context);
  assert.match(context.label(run.summary),/Schema-compatible.*unverified/);
  assert.match(context.label(run.summary,verified),/manifest verified/);
  assert.match(context.label("unknown"),/unavailable.*unchanged/);
  for(const id of ["fetchSummaryDisplay.claim","fetchSummaryEvidence.reason","fetchSummaryEvidence.manifestId",
    "fetchSummaryEvidence.manifest.version","fetchSummaryProducer.perAdapter[].id",
    "fetchSummaryProducer.perAdapter[].values","fetchSummaryProducer.perAdapter[].error","fetchSummaryProducer.error"])
    assert.ok(ui.includes(`data-field-id="${id}"`),id);
});

test("prospective write path reuses immutable storage, preserves producer JSON, and does not add collection activation or DDL",()=>{
  const orchestrator=readFileSync("server/dataIngestion/orchestrator.ts","utf8");
  assert.equal((orchestrator.match(/summaryProducer: \{ adapters:ADAPTERS, indicatorKeys:INDICATOR_KEYS \}/g)||[]).length,2);
  assert.ok(orchestrator.includes("summary: { perAdapter },"));
  assert.ok(orchestrator.includes("summary: { perAdapter, error: (e as Error).message },"));
  const store=readFileSync("server/dataIngestion/dataStore.ts","utf8");
  assert.match(store,/db\.transaction\(async tx/);
  assert.match(store,/if\(fields\.summaryProducer\) await archiveFetchSummary\(tx,run,fields\.summaryProducer\)/);
  const archive=readFileSync("server/dataIngestion/summaryArchive.ts","utf8");
  assert.match(archive,/snapshotsAvailable\(tx\)/);
  assert.match(archive,/onConflictDoNothing/);
  assert.match(archive,/parentId:run\.id/);
  assert.doesNotMatch(archive,/CREATE TABLE|ALTER TABLE|setInterval|runFetch\(/i);
  const loader=archive.slice(archive.indexOf("export async function loadFetchSummaryEvidence"));
  assert.doesNotMatch(loader,/\.insert\(|\.update\(|\.delete\(/);
});

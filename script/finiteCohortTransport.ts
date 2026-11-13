import assert from "node:assert/strict";
import {Pool} from "pg";
import {PgDialect} from "drizzle-orm/pg-core";
import {contentHash} from "../server/calculation/analysisManifest";
import {materialLeaves} from "../server/calculation/companyProjectionAsOf";
import {packCompanySource} from "../server/calculation/companySourceArchive";
import {finiteCompanyDocument,finiteCompanyWorkbook} from "../server/finiteCompanyDocument";
import {spawnSync} from "node:child_process";
import {readFileSync,statSync,mkdtempSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {resolve,join} from "node:path";
import {randomUUID} from "node:crypto";
import * as XLSX from "xlsx";
import {readEconomicBridgeCells} from "../shared/economicBridgeSchema";
/** Runs only inside the existing explicitly disposable local harness. */
export async function finiteCohortTransport(pool:Pool,input:any,api:any){
 const run=async(fn:(tx:any,c:any)=>Promise<any>,p=pool)=>{
  const c=await p.connect(),d=new PgDialect();
  const tx={execute:(q:any)=>{const v=d.sqlToQuery(q);return c.query(v.sql,v.params);}};
  try{await c.query("BEGIN");const v=await fn(tx,c);await c.query("COMMIT");return v;}
  catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 };
 const identity={companyId:"42",isin:"ZZ0000000010"};
 await run(async(_,c)=>{
  await c.query("INSERT INTO cv_companies(id,isin,name) OVERRIDING SYSTEM VALUE VALUES(42,$1,'Synthetic finite only')",[identity.isin]);
  await c.query("INSERT INTO financial_reviews(id,status,payload,reviewed_at) VALUES('synthetic-finite','approved',$1,transaction_timestamp())",[JSON.stringify({identity})]);
 });
 const capture=async(x:any)=>{
  const claims=Object.entries(materialLeaves(x)).map(([path,value])=>({path,value,valueHash:contentHash(value),
   locator:path,unit:"synthetic",period:"2027",geography:"fixture",basis:"assumption",availableAt:x.cutoff,method:"isolated engineering fixture",dependencies:[]}));
  const source=packCompanySource({version:"company-operating-source-1",...identity,url:"https://example.invalid/finite",
   publisher:"Synthetic",publishedAt:x.cutoff,retrievedAt:x.cutoff,content:"fixture",contentHash:contentHash("fixture"),licence:"Synthetic",claims});
  const evidence=claims.map(c=>({path:c.path,valueHash:c.valueHash,availableAt:c.availableAt,basis:c.basis,sourceArchiveId:source.id}));
  const ids=await Promise.all([0,1].map(()=>run(t=>api.stage(t,x,evidence,[source.payload],identity,x.cutoff))));
  assert.equal(ids[0],ids[1]);
  const decision=await run(t=>api.decide(t,ids[0],"approved","synthetic-finite"));
  return {proposalId:ids[0],decision};
 };
 const a=await capture(input);
 const read=(d:any,p=pool)=>run(t=>api.read(t,d.id,d.decidedAt),p);
 const first=await read(a.decision),doc=finiteCompanyDocument(first);
 for(const cutoff of ["2027-02-30T00:00:00Z","2027-01-01T12:00:00"])
  await assert.rejects(run(tx=>api.read(tx,a.decision.id,cutoff)),/UTC calendar cutoff/);
 for(const target of ["computedResult","result"]){
  const changed=structuredClone(first);changed[target].members[0].physical.rows[0].service++;
  assert.throws(()=>finiteCompanyDocument(changed),/result mismatch/);
 }
 const wrongReview=structuredClone(first);wrongReview.result.financialReviewId="borrowed";
 assert.throws(()=>finiteCompanyDocument(wrongReview),/review identity mismatch/);
 const wrongCode=structuredClone(first);wrongCode.result.producerManifest.codeId="f".repeat(64);
 assert.throws(()=>finiteCompanyDocument(wrongCode),/proposal\/source identity mismatch/);
 assert.equal(first.result.members[0].finiteAccounting.version,input.scenarios[0].finiteAccounting.assetDisposition?"finite-cohort-accrual-4-disposition":input.scenarios[0].finiteAccounting.terminal?
  "finite-cohort-accrual-3-terminal":"finite-cohort-accrual-2-daily-bound");
 if(input.scenarios[0].finiteAccounting.terminal){
  const f=first.result.members[0].finiteAccounting;
  assert.equal(f.terminal.commonNetCash,input.scenarios[0].finiteAccounting.assetDisposition?75:-input.scenarios[0].finiteAccounting.terminal.opening.payables);
  assert.equal(f.combinedFiniteProjectPresentValueUsd,f.finiteCommonCashPvUsd+f.terminal.presentCommonCashUsd);
  assert.equal(f.periodicValueUsd,null);
 }
 assert.equal(first.result.members[0].finiteAccounting.periodicValueUsd,null);
 assert.equal(doc.producer.finiteExecution.orderedMembers[0].recognitionLaw,"earned-service-prefix-1");
 const bytes=finiteCompanyWorkbook(doc);
 const base=`generated-artifacts/private-exports/synthetic-finite-${randomUUID()}`;
 const cli=(format:string,path:string)=>spawnSync(process.execPath,["--import","tsx","script/company-operating-review.ts",
  format,a.decision.id,a.decision.decidedAt,path],{encoding:"utf8",timeout:60000,env:process.env});
 for(const [format,suffix] of [["finite-json","json"],["finite-xlsx","xlsx"]]){
  const execution=cli(format,`${base}.${suffix}`);assert.equal(execution.status,0,execution.stderr);
  assert.equal(statSync(`${base}.${suffix}`).mode&0o777,0o600);
 }
 assert.deepEqual(JSON.parse(readFileSync(`${base}.json`,"utf8")),doc);
 const wb=XLSX.read(readFileSync(`${base}.xlsx`),{type:"buffer"});
 const literal=XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true}).slice(1);
 assert.deepEqual(readEconomicBridgeCells(literal.map(r=>({pointer:r[0],jsonValue:r[1]}))),doc);
 assert.notEqual(cli("finite-json",`${base}.json`).status,0,"Existing private export must not be overwritten");
 const empty=mkdtempSync(join(tmpdir(),"stored-finite-reader-"));
 const outside=(action:string)=>spawnSync(process.execPath,["--import",import.meta.resolve("tsx"),
  resolve("script/company-operating-review.ts"),action,a.decision.id,a.decision.decidedAt,
  "generated-artifacts/private-exports/stored.json"],{cwd:empty,encoding:"utf8",timeout:60000,
   env:{...process.env,TSX_TSCONFIG_PATH:resolve("tsconfig.json")}});
 const stored=outside("finite-json");assert.equal(stored.status,0,stored.stderr);
 assert.deepEqual(JSON.parse(readFileSync(join(empty,"generated-artifacts/private-exports/stored.json"),"utf8")),doc);
 const recalc=outside("finite-recalculate-json");
 assert.notEqual(recalc.status,0,"Recalculation requires its source checkout, unlike stored retrieval");
 const second=structuredClone(input);second.scenarios[0].finiteAccounting.declaration.discountRate=.12;
 const b=await capture(second);
 const selected=await Promise.all([read(a.decision),read(b.decision),read(a.decision)]);
 writeFileSync(`${base}-b.json`,JSON.stringify(finiteCompanyDocument(selected[1])),{flag:"wx",mode:0o600});
 assert.deepEqual(selected[0],selected[2]);assert.notEqual(contentHash(selected[0]),contentHash(selected[1]));
 const reconnect=new Pool(pool.options);
 try{assert.deepEqual(await read(a.decision,reconnect),first);}finally{await reconnect.end();}
 const before=Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count);
 await assert.rejects(()=>run(async(t,c)=>{
  const proposal=(await c.query("SELECT payload FROM cv_analysis_chunks WHERE snapshot_id=$1",[a.proposalId])).rows[0].payload;
  proposal.producer.finiteExecution.orderedMembers[0].physicalParentHash="f".repeat(64);
  const id=contentHash(proposal);
  await c.query("INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note) VALUES($1,'company-operating-proposal',1,1,1,'synthetic tamper')",[id]);
  await c.query("INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload) VALUES($1,0,$2)",[id,JSON.stringify(proposal)]);
  await api.decide(t,id,"approved","synthetic-finite");
 }),/finite execution binding mismatch/);
 assert.equal(Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),before);
 assert.deepEqual(await read(a.decision),first);
 return {passed:true,scope:"New daily-bound branch, actual disposable PostgreSQL; synthetic review only, NOT genuine principal/owner acceptance",
  documentId:doc.id,fixtureFiles:{a:`${base}.json`,b:`${base}-b.json`,xlsx:`${base}.xlsx`},workbookBytes:bytes.length,cliRows:literal.length,cliLiteralCells:literal.length*2,privateFileMode:"0600",
  checks:["concurrent idempotent staging","daily-bound retained producer","fresh-process operator CLI JSON/XLSX equality","owner-only files and overwrite refusal",
   "stored retrieval without source checkout","recalculation missing-source refusal","invalid or ambiguous cutoff refusal",
   "ordered physical/code/material/rule identities","literal XLSX writer/readback","A/B/A selection isolation",
   "committed reconnect equality","swapped physical parent refusal","tamper rollback atomicity",
   "altered stored result refusal","altered display result refusal","borrowed review refusal","borrowed code refusal"],headers:before};
}

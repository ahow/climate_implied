import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {Pool} from "pg";
import {PgDialect} from "drizzle-orm/pg-core";
import {contentHash} from "../server/calculation/analysisManifest";
// Explicit existing disposable socket only. No ambient database or provisioning.
const socket=process.argv[2],file=process.argv[3],out=process.argv[4];
assert.match(socket??"",/^\/tmp\/future-cohort-[A-Za-z0-9]+\/socket$/);
assert.ok(file&&out);
process.env.DATABASE_URL=`postgresql://future_test@localhost/future_cohort_disposable?host=${encodeURIComponent(socket)}`;
const pool=new Pool({host:socket,user:"future_test",database:"future_cohort_disposable"});
const run=async(fn:any)=>{
 const c=await pool.connect(),d=new PgDialect();
 const t={execute:(q:any)=>{const v=d.sqlToQuery(q);return c.query(v.sql,v.params);}};
 try{await c.query("BEGIN");const v=await fn(t,c);await c.query("COMMIT");return v;}
 catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
};
try{
 const identity=(await pool.query("SELECT current_database() db,inet_server_addr() address")).rows[0];
 assert.equal(identity.db,"future_cohort_disposable");assert.equal(identity.address,null);
 const api=await import("../server/snapshots/companyOperatingReview");
 const {renewalCompanyDocument}=await import("../server/finiteCompanyDocument");
 const doc=JSON.parse(readFileSync(file,"utf8"));
 const read=()=>run((t:any)=>api.readRetainedRenewalInTransaction(t,doc.decisionId,doc.cutoff,"stored"));
 const first=await read();assert.deepEqual(renewalCompanyDocument(first),doc);
 const decision=(await pool.query("SELECT payload FROM cv_analysis_chunks WHERE snapshot_id=$1",[doc.decisionId])).rows[0].payload;
 const proposalId=decision.proposalId;
 assert.ok(proposalId);
 const before=Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count);
 const faults=[
  ["physical parent",(p:any)=>p.producer.renewalExecution.orderedMembers[0].physicalParentHash="f".repeat(64)],
  ["law",(p:any)=>p.producer.renewalExecution.orderedMembers[0].lawHash="f".repeat(64)],
  ["certificate",(p:any)=>p.producer.renewalExecution.orderedMembers[0].inverseDefinitionHash="f".repeat(64)],
 ];
 for(const [name,mutate] of faults as [string,(p:any)=>void][]){
  await assert.rejects(()=>run(async(t:any,c:any)=>{
   const p=(await c.query("SELECT payload FROM cv_analysis_chunks WHERE snapshot_id=$1",[proposalId])).rows[0].payload;
   mutate(p);const id=contentHash(p);
   await c.query("INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note) VALUES($1,'company-operating-proposal',1,1,1,'synthetic renewal recovery tamper')",[id]);
   await c.query("INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload) VALUES($1,0,$2)",[id,JSON.stringify(p)]);
   // Adversarial copy of an existing SYNTHETIC fixture decision, rolled back.
   // Stored reads must reject corruption without executing today's model.
   const badDecision={...decision,proposalId:id},badId=contentHash(badDecision);
   await c.query("INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note) VALUES($1,'company-operating-decision',1,1,1,'synthetic corrupt decision copy')",[badId]);
   await c.query("INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload) VALUES($1,0,$2)",[badId,JSON.stringify(badDecision)]);
   await api.readRetainedRenewalInTransaction(t,badId,doc.cutoff,"stored");
  }),/renewal execution binding mismatch/);
  assert.equal(Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),before);
  console.log("refusal + atomic rollback",name);
 }
 assert.deepEqual(await read(),first);
 writeFileSync(out,JSON.stringify({at:new Date().toISOString(),passed:true,scope:"Focused recovery of final failed assertion; actual existing disposable PostgreSQL, synthetic review only",checks:7,faults:faults.map(x=>x[0]),headers:before,documentId:doc.id,priorFailure:"pg-phases.log retained; old finite error regex rejected correct renewal refusal"},null,2));
}finally{await pool.end();}

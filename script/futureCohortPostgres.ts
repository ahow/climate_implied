/** Explicit local-only disposable transport. No ambient database or HTTP principal. */
import {spawnSync} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {Pool} from "pg";
import {PgDialect} from "drizzle-orm/pg-core";
import assert from "node:assert/strict";
if(process.argv[2]!=="--local-disposable")throw Error("Explicit local disposable authorization required");
const dir=mkdtempSync(join(tmpdir(),"future-cohort-")),socket=join(dir,"socket"),data=join(dir,"data");
mkdirSync(socket,{mode:0o700});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>k!=="DATABASE_URL"&&!k.startsWith("PG")));
const logs:string[]=[];
function run(cmd:string,args:string[]){const r=spawnSync(cmd,args,{env,encoding:"utf8"});logs.push(`${cmd} ${args.join(" ")}\n${r.stdout}${r.stderr}`);if(r.status!==0)throw Error(`${cmd} failed`);}
let pool:Pool|undefined,running=false;
const receipt:any={at:new Date().toISOString(),scope:"Synthetic rollback fixture; actual PostgreSQL, not genuine operator authentication",passed:false};
try{
 run("initdb",["-D",data,"-U","future_test","--auth-local=trust","--auth-host=reject","--no-locale","--encoding=UTF8"]);
 run("pg_ctl",["-D",data,"-l",join(dir,"postgres.log"),"-o",`-c listen_addresses='' -c unix_socket_directories='${socket}' -c unix_socket_permissions=0700`,"-w","start"]);running=true;
 pool=new Pool({host:socket,user:"future_test",database:"postgres",max:1});
 await pool.query("CREATE DATABASE future_cohort_disposable");await pool.end();
 pool=new Pool({host:socket,user:"future_test",database:"future_cohort_disposable",max:3});
 const identity=await pool.query("SELECT current_database() AS db,inet_server_addr() AS address");
 assert.equal(identity.rows[0].db,"future_cohort_disposable");assert.equal(identity.rows[0].address,null);
 // Existing supported local snapshot schema and documented immutable guards.
 for(const sql of [
  `CREATE TABLE cv_analysis_snapshots(id varchar(64) PRIMARY KEY,kind text NOT NULL,source_upload_id integer,parent_id varchar(64),company_count integer NOT NULL,observation_count integer NOT NULL,chunk_count integer NOT NULL,source_note text NOT NULL,inserted_tx text NOT NULL DEFAULT txid_current()::text,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE cv_analysis_chunks(snapshot_id varchar(64) NOT NULL REFERENCES cv_analysis_snapshots(id),ordinal integer NOT NULL,payload jsonb NOT NULL,UNIQUE(snapshot_id,ordinal))`,
  `CREATE TABLE cv_companies(id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,isin varchar(12) NOT NULL UNIQUE,name text NOT NULL,geography varchar(100),sector varchar(100),sub_sector varchar(100),industry varchar(100),sdg_alignment_score real,emission_target_2050 real)`,
  `CREATE TABLE financial_reviews(id text PRIMARY KEY,status text NOT NULL CHECK(status IN ('pending','approved','rejected','superseded')),payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz)`
 ])await pool.query(sql);
 const guards=readFileSync("docs/Snapshot_Database_Guards.md","utf8").match(/```sql\n([\s\S]*?)\n```/)?.[1];
 assert.ok(guards);await pool.query(guards);
 // Import application modules only after binding their optional default connection to this fresh local DB.
 process.env.DATABASE_URL=`postgresql://future_test@localhost/future_cohort_disposable?host=${encodeURIComponent(socket)}`;
 process.env.NODE_ENV="test";
 const {stageCompanyOperatingInTransaction:stage,decideCompanyOperatingInTransaction:decide,projectReviewedCompanyInTransaction:project}=await import("../server/snapshots/companyOperatingReview");
 const {materialLeaves}=await import("../server/calculation/companyProjectionAsOf");
 const {contentHash}=await import("../server/calculation/analysisManifest");
 const {packCompanySource}=await import("../server/calculation/companySourceArchive");
 // Extract the existing explicit synthetic fixture without registering/re-running its memory tests.
 const fixtureSource=readFileSync("script/companyCohortProjection.test.ts","utf8");
 const begin=fixtureSource.indexOf("export function cohortFixture()");
 const end=fixtureSource.indexOf("\n}\n",begin)+2;
 const fixture=fixtureSource.slice(begin,end).replace("export function cohortFixture():CompanyCohortInput","function cohortFixture()").replaceAll(" as const","");
 if(process.argv.includes("--finite-branch")){
  const start=fixtureSource.indexOf("  const x=cohortFixture(),s=x.scenarios[0],c=");
  const finish=fixtureSource.indexOf("  const r=projectCompanyCohorts(x),m=",start);
  assert.ok(start>0&&finish>start);
  const input=Function("storage",`${fixture};${fixtureSource.slice(start,finish).replaceAll(" as const","")};s.finiteAccounting.recognitionLaw="earned-service-prefix-1";return x;`)(true);
  const {readRetainedFiniteInTransaction:read}=await import("../server/snapshots/companyOperatingReview");
  const {finiteCohortTransport}=await import("./finiteCohortTransport");
  Object.assign(receipt,await finiteCohortTransport(pool,input,{stage,decide,read}));
 }else{
 const renewalStart=fixtureSource.indexOf(" const x=cohortFixture(),s=x.scenarios[0]");
 const renewalEnd=fixtureSource.indexOf(" const result=projectCompanyCohorts(x);",renewalStart);
 assert.ok(renewalStart>0&&renewalEnd>renewalStart);
 const input=Function(`${fixture};${fixtureSource.slice(renewalStart,renewalEnd)};return x;`)();
 input.scenarios[0].renewal.cashLedger={
  version:"cohort-cash-ledger-1",currency:"USD",claimantId:"synthetic-project-42",
  claim:"declared-project-common-distribution-not-whole-equity",distributionRightsEvidenceId:"fixture",
  years:input.years.map((year:number)=>({year,openingReceivables:0,closingReceivables:0,collections:100,
   openingOtherWorkingCapital:0,closingOtherWorkingCapital:0,openingUnpaidTax:0,closingUnpaidTax:0,taxAccrual:0,
   openingDebt:0,closingDebt:0,openingNonCommonLiability:0,closingNonCommonLiability:0,nonCommonAccrual:0,
   operatingFixedCash:0,holdingCash:0,transactionCash:0,openingCash:0,closingCash:0,
   commonContribution:0,commonDistribution:90,evidenceIds:["fixture"]}))
 };
 input.scenarios[0].renewal.datedAccounting={
  declaration:{version:"dated-project-cash-1",valuationOn:"2027-01-01",discountRate:.1,convention:"ACT/365.25",claimantId:"synthetic-project-42"},
  timing:input.years.flatMap((year:number)=>["collections","replacement","commonDistribution"].map(component=>({year,component,allocations:[{on:`${year}-07-01`,fraction:1,evidenceIds:["fixture"]}]}))),
  accrual:{version:"dated-accrual-1",claimantId:"synthetic-project-42",payables:input.years.map((year:number)=>({year,opening:0,closing:0})),
   entries:input.years.flatMap((year:number)=>[{id:`r${year}`,on:`${year}-06-01`,kind:"revenue",usd:100,evidenceIds:["fixture"]},
    {id:`p${year}`,on:`${year}-06-02`,kind:"payable",usd:10,evidenceIds:["fixture"]}])}
 };
 const actor={companyId:"42",isin:"ZZ0000000010"};
 let staged:any;
 const client=await pool.connect(),dialect=new PgDialect();
 const tx:any={execute:async(q:any)=>{const query=dialect.sqlToQuery(q);return client.query(query.sql,query.params);}};
 try{
  await client.query("BEGIN");
  await client.query("INSERT INTO cv_companies(id,isin,name) OVERRIDING SYSTEM VALUE VALUES($1,$2,'Synthetic fixture')",[actor.companyId,actor.isin]);
  await client.query("INSERT INTO financial_reviews(id,status,payload,reviewed_at) VALUES('synthetic-only','approved',$1,transaction_timestamp())",[JSON.stringify({identity:actor})]);
  const claims=Object.entries(materialLeaves(input)).map(([path,value])=>({path,valueHash:contentHash(value),value,locator:path,unit:"synthetic",period:"2027",geography:"fixture",basis:"assumption",availableAt:input.cutoff,method:"rollback fixture",dependencies:[]}));
  const source=packCompanySource({version:"company-operating-source-1",...actor,url:"https://example.invalid/fixture",publisher:"Synthetic",publishedAt:input.cutoff,retrievedAt:input.cutoff,content:"fixture",contentHash:contentHash("fixture"),licence:"Synthetic",claims});
  const evidence=claims.map(c=>({path:c.path,valueHash:c.valueHash,availableAt:c.availableAt,basis:c.basis,sourceArchiveId:source.id}));
  staged={source,evidence};
  const id=await stage(tx,input,evidence,[source.payload],actor,input.cutoff);
  assert.equal(await stage(tx,input,evidence,[source.payload],actor,input.cutoff),id);
  const decision=await decide(tx,id,"approved","synthetic-only");
  assert.equal((await decide(tx,id,"approved","synthetic-only")).id,decision.id);
  await assert.rejects(()=>decide(tx,id,"rejected","synthetic-only"),/Conflicting/);
  await assert.rejects(()=>project(tx,decision.id,input.cutoff),/Approval unavailable/);
  const result=await project(tx,decision.id,decision.decidedAt);
  assert.equal(result.covered.scenarios[0].rows[0].emissionsTonnes,100);
  assert.equal(result.modelVersions[0].renewal,"renewal-3-finite-dated-accounting");
  assert.equal(result.members[0].renewal.conditionalPeriodicProjectValueUsd,null);
  assert.equal(result.members[0].renewal.datedAccounting.accrualDays[2].cash,0);
  const code=await client.query("SELECT c.payload FROM cv_analysis_snapshots s JOIN cv_analysis_chunks c ON s.id=c.snapshot_id WHERE s.kind='company-cohort-code'");
  assert.ok(code.rows[0].payload.files["server/calculation/cohortCashLedger.ts"]);
  assert.deepEqual(await project(tx,decision.id,decision.decidedAt),result);
  await assert.rejects(()=>project(tx,"f".repeat(64),decision.decidedAt),/corrupt/);
  receipt.headers=Number((await client.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count);
  const proposal=(await client.query("SELECT payload FROM cv_analysis_chunks WHERE snapshot_id=$1",[id])).rows[0].payload;
  const faults:{name:string;alter:(p:any)=>void}[]=[
   {name:"swapped code/result",alter:p=>{[p.producer.codeId,p.producer.resultId]=[p.producer.resultId,p.producer.codeId];}},
   {name:"wrong model",alter:p=>p.producer.modelVersion="wrong"},
   {name:"wrong assumption hash",alter:p=>p.producer.assumptionHash="a".repeat(64)},
   {name:"missing source",alter:p=>p.evidence[0].sourceArchiveId="f".repeat(64)},
   {name:"altered material",alter:p=>p.input.scenarios[0].specification.years[0].pricePerServiceUsd++}
  ];
  receipt.faults=[];
  for(const fault of faults){
   await client.query("SAVEPOINT fault");
   const bad=structuredClone(proposal);fault.alter(bad);const badId=contentHash(bad);
   await client.query("INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note) VALUES($1,'company-operating-proposal',1,1,1,'isolated corrupt candidate')",[badId]);
   await client.query("INSERT INTO cv_analysis_chunks VALUES($1,0,$2)",[badId,JSON.stringify(bad)]);
   let message="";
   await assert.rejects(()=>decide(tx,badId,"approved","synthetic-only"),(error:Error)=>{message=error.message;return /manifest|conflict|hash|source|value|model|corrupt/i.test(message);});
   await client.query("ROLLBACK TO SAVEPOINT fault");
   assert.equal(Number((await client.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),receipt.headers);
   receipt.faults.push({name:fault.name,message,atomicRollback:true});
  }
  for(const mode of ["wrong reviewed identity","future review","valid hash wrong computed result"]){
   await client.query("SAVEPOINT binding");
   const bad=structuredClone(proposal);bad.fixtureBindingCase=mode;
   let review="synthetic-only";
   if(mode!=="valid hash wrong computed result"){
    review="synthetic-binding";
    await client.query("INSERT INTO financial_reviews(id,status,payload,reviewed_at) VALUES($1,'approved',$2,transaction_timestamp()+$3::interval)",
     [review,JSON.stringify({identity:mode==="wrong reviewed identity"?{...actor,companyId:"43"}:actor}),mode==="future review"?"1 day":"0 days"]);
   }else{
    const wrong=structuredClone(result);wrong.members[0].physical.rows[0].revenue+=1;
    const rid=contentHash(wrong);
    await client.query("INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note) VALUES($1,'company-cohort-result',1,1,1,'synthetic incorrect computed result')",[rid]);
    await client.query("INSERT INTO cv_analysis_chunks VALUES($1,0,$2)",[rid,JSON.stringify(wrong)]);
    bad.producer.resultId=rid;
   }
   const pid=contentHash(bad);
   await client.query("INSERT INTO cv_analysis_snapshots(id,kind,company_count,observation_count,chunk_count,source_note) VALUES($1,'company-operating-proposal',1,1,1,'synthetic binding case')",[pid]);
   await client.query("INSERT INTO cv_analysis_chunks VALUES($1,0,$2)",[pid,JSON.stringify(bad)]);
   let message="";
   await assert.rejects(()=>decide(tx,pid,"approved",review),(e:Error)=>{message=e.message;return /identity|required|Future financial|result mismatch/i.test(message);});
   await client.query("ROLLBACK TO SAVEPOINT binding");
   assert.equal(Number((await client.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),receipt.headers);
   receipt.faults.push({name:mode,message,atomicRollback:true});
  }
  receipt.resultHash=contentHash(result);receipt.checks=["stage idempotency","decision idempotency","conflicting decision refusal","preapproval cutoff refusal","actual retained producer/source/code/result readback","renewal v3 and cash module captured","finite dated accrual balances and null periodic value","repeat identity","missing decision refusal"];
 }finally{await client.query("ROLLBACK");client.release();}
 assert.equal(Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),0);
 receipt.rollbackHeaders=0;
 const transact=async<T>(fn:(tx:any,c:any)=>Promise<T>):Promise<T>=>{
  const c=await pool!.connect();const d=new PgDialect();
  const t={execute:async(q:any)=>{const v=d.sqlToQuery(q);return c.query(v.sql,v.params);}};
  try{await c.query("BEGIN");const value=await fn(t,c);await c.query("COMMIT");return value;}
  catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
 };
 await transact(async(_,c)=>{
  await c.query("INSERT INTO cv_companies(id,isin,name) OVERRIDING SYSTEM VALUE VALUES($1,$2,'Synthetic fixture')",[actor.companyId,actor.isin]);
  await c.query("INSERT INTO financial_reviews(id,status,payload,reviewed_at) VALUES('synthetic-only','approved',$1,transaction_timestamp())",[JSON.stringify({identity:actor})]);
 });
 const proposals=await Promise.all([0,1].map(()=>transact(t=>stage(t,input,staged.evidence,[staged.source.payload],actor,input.cutoff))));
 assert.equal(proposals[0],proposals[1]);
 const decisions=await Promise.all([0,1].map(()=>transact(t=>decide(t,proposals[0],"approved","synthetic-only"))));
 assert.equal(decisions[0].id,decisions[1].id);
 const conflicts=await Promise.allSettled([
  transact(t=>decide(t,proposals[0],"approved","synthetic-only")),
  transact(t=>decide(t,proposals[0],"rejected","synthetic-only"))
 ]);
 assert.equal(conflicts.filter(r=>r.status==="fulfilled").length,1);
 assert.equal(conflicts.filter(r=>r.status==="rejected"&&/Conflicting/.test(String(r.reason))).length,1);
 const committed=await transact(t=>project(t,decisions[0].id,decisions[0].decidedAt));
 await pool.end();
 pool=new Pool({host:socket,user:"future_test",database:"future_cohort_disposable",max:3});
 const reconnected=await transact(t=>project(t,decisions[0].id,decisions[0].decidedAt));
 assert.equal(contentHash(committed),contentHash(reconnected));
 const countBefore=Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count);
 await assert.rejects(()=>transact(async(t,c)=>{
  await c.query("INSERT INTO cv_companies(isin,name) VALUES('ZZ0000000020','rollback-marker')");
  await project(t,"f".repeat(64),decisions[0].decidedAt);
 }),/corrupt/);
 assert.equal((await pool.query("SELECT * FROM cv_companies WHERE name='rollback-marker'")).rows.length,0);
 assert.equal(Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),countBefore);
 receipt.committedTransport={concurrentStages:2,concurrentIdempotentDecisions:2,conflictFulfilled:1,conflictRejected:1,
  reconnectedResultHash:contentHash(reconnected),failureMarkerRolledBack:true,headers:countBefore,
  boundary:"Committed synthetic fixtures remain only in the newly created private local cluster, which is stopped. No production/HTTP principal proof."};
 receipt.schemaScope="Company and financial-review columns/constraints aligned to shared/schema.ts; snapshot guards from documented local setup. Not the full application schema.";
 receipt.passed=true;
 }
}catch(e){receipt.error=String(e);process.exitCode=1;}
finally{
 if(pool)await pool.end();if(running)run("pg_ctl",["-D",data,"-m","fast","-w","stop"]);
 const out=resolve("generated-artifacts/renewal-cash");mkdirSync(out,{recursive:true});
 const prefix=process.argv.includes("--finite-branch")?"finite-postgres":"future-postgres";
 writeFileSync(join(out,`${prefix}.json`),JSON.stringify(receipt,null,2));
 writeFileSync(join(out,`${prefix}-setup.log`),logs.join("\n"));console.log(receipt);
}

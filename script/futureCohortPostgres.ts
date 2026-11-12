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
 pool=new Pool({host:socket,user:"future_test",database:"future_cohort_disposable",max:1});
 const identity=await pool.query("SELECT current_database() AS db,inet_server_addr() AS address");
 assert.equal(identity.rows[0].db,"future_cohort_disposable");assert.equal(identity.rows[0].address,null);
 // Existing supported local snapshot schema and documented immutable guards.
 for(const sql of [
  `CREATE TABLE cv_analysis_snapshots(id varchar(64) PRIMARY KEY,kind text NOT NULL,source_upload_id integer,parent_id varchar(64),company_count integer NOT NULL,observation_count integer NOT NULL,chunk_count integer NOT NULL,source_note text NOT NULL,inserted_tx text NOT NULL DEFAULT txid_current()::text,created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE cv_analysis_chunks(snapshot_id varchar(64) NOT NULL REFERENCES cv_analysis_snapshots(id),ordinal integer NOT NULL,payload jsonb NOT NULL,UNIQUE(snapshot_id,ordinal))`,
  `CREATE TABLE cv_companies(id text PRIMARY KEY,isin text NOT NULL)`,
  `CREATE TABLE financial_reviews(id text PRIMARY KEY,status text,payload jsonb,reviewed_at timestamptz)`
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
 const actor={companyId:"42",isin:"ZZ0000000010"};
 const client=await pool.connect(),dialect=new PgDialect();
 const tx:any={execute:async(q:any)=>{const query=dialect.sqlToQuery(q);return client.query(query.sql,query.params);}};
 try{
  await client.query("BEGIN");
  await client.query("INSERT INTO cv_companies VALUES($1,$2)",[actor.companyId,actor.isin]);
  await client.query("INSERT INTO financial_reviews VALUES('synthetic-only','approved',$1,transaction_timestamp())",[JSON.stringify({identity:actor})]);
  const claims=Object.entries(materialLeaves(input)).map(([path,value])=>({path,valueHash:contentHash(value),value,locator:path,unit:"synthetic",period:"2027",geography:"fixture",basis:"assumption",availableAt:input.cutoff,method:"rollback fixture",dependencies:[]}));
  const source=packCompanySource({version:"company-operating-source-1",...actor,url:"https://example.invalid/fixture",publisher:"Synthetic",publishedAt:input.cutoff,retrievedAt:input.cutoff,content:"fixture",contentHash:contentHash("fixture"),licence:"Synthetic",claims});
  const evidence=claims.map(c=>({path:c.path,valueHash:c.valueHash,availableAt:c.availableAt,basis:c.basis,sourceArchiveId:source.id}));
  const id=await stage(tx,input,evidence,[source.payload],actor,input.cutoff);
  assert.equal(await stage(tx,input,evidence,[source.payload],actor,input.cutoff),id);
  const decision=await decide(tx,id,"approved","synthetic-only");
  assert.equal((await decide(tx,id,"approved","synthetic-only")).id,decision.id);
  await assert.rejects(()=>decide(tx,id,"rejected","synthetic-only"),/Conflicting/);
  await assert.rejects(()=>project(tx,decision.id,input.cutoff),/Approval unavailable/);
  const result=await project(tx,decision.id,decision.decidedAt);
  assert.equal(result.covered.scenarios[0].rows[0].emissionsTonnes,100);
  assert.equal(result.modelVersions[0].renewal,"periodic-renewal-2-cash-dated");
  assert.ok(Math.abs(result.members[0].renewal.conditionalPeriodicProjectValueUsd-900)<1e-9);
  const code=await client.query("SELECT c.payload FROM cv_analysis_snapshots s JOIN cv_analysis_chunks c ON s.id=c.snapshot_id WHERE s.kind='company-cohort-code'");
  assert.ok(code.rows[0].payload.files["server/calculation/cohortCashLedger.ts"]);
  assert.deepEqual(await project(tx,decision.id,decision.decidedAt),result);
  await assert.rejects(()=>project(tx,"f".repeat(64),decision.decidedAt),/corrupt/);
  receipt.headers=Number((await client.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count);
  receipt.resultHash=contentHash(result);receipt.checks=["stage idempotency","decision idempotency","conflicting decision refusal","preapproval cutoff refusal","actual retained producer/source/code/result readback","renewal v2 and cash module captured","900 common cash oracle","repeat identity","missing decision refusal"];
 }finally{await client.query("ROLLBACK");client.release();}
 assert.equal(Number((await pool.query("SELECT count(*) FROM cv_analysis_snapshots")).rows[0].count),0);
 receipt.passed=true;receipt.rollbackHeaders=0;
}catch(e){receipt.error=String(e);process.exitCode=1;}
finally{
 if(pool)await pool.end();if(running)run("pg_ctl",["-D",data,"-m","fast","-w","stop"]);
 const out=resolve("generated-artifacts/renewal-cash");mkdirSync(out,{recursive:true});
 writeFileSync(join(out,"future-postgres.json"),JSON.stringify(receipt,null,2));
 writeFileSync(join(out,"future-postgres-setup.log"),logs.join("\n"));console.log(receipt);
}

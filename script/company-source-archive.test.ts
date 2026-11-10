import test from "node:test";
import assert from "node:assert/strict";
import {contentHash} from "../server/calculation/analysisManifest";
import {packCompanySource,resolveCompanySourceEvidence} from "../server/calculation/companySourceArchive";
const identity={companyId:"isolated-engineering-fixture",isin:"US0000000001"};
const source={version:"company-operating-source-1",...identity,url:"https://example.org/fixture",
  publisher:"Engineering fixture, not company evidence",publishedAt:"2024-01-01T00:00:00Z",retrievedAt:"2024-02-01T00:00:00Z",
  content:"fixture only",contentHash:contentHash("fixture only"),licence:"Synthetic test",
  claims:[{path:"/currency",valueHash:contentHash("USD"),locator:"fixture",unit:"ISO4217",
    period:"2024",geography:"US",basis:"observed",availableAt:"2024-01-01T00:00:00Z",method:"Identity",dependencies:[]}]};
test("company material leaves resolve exact archived claims; absent/corrupt/future/identity conflicts reject",async()=>{
 const packed=packCompanySource(source),claim=source.claims[0];
 const evidence=[{path:claim.path,valueHash:claim.valueHash,sourceArchiveId:packed.id,availableAt:claim.availableAt,basis:claim.basis}];
 const run=(load:(id:string)=>Promise<unknown>,who=identity,cutoff="2024-02-01T00:00:00Z")=>
   resolveCompanySourceEvidence({currency:"USD"},evidence,cutoff,who,load);
 const result=await run(async()=>packed.payload);
 assert.equal(result.originalVintageProven,false);
 await assert.rejects(()=>run(async()=>null));
 await assert.rejects(()=>run(async()=>({...packed.payload,content:"corrupt"})),/hash/);
 await assert.rejects(()=>run(async()=>packed.payload,{...identity,companyId:"other"}),/identity/);
 await assert.rejects(()=>run(async()=>packed.payload,identity,"2023-12-31T00:00:00Z"),/Future/);
 const inconsistent=packCompanySource({...source,claims:[{...claim,valueHash:contentHash("GBP")}]});
 await assert.rejects(()=>resolveCompanySourceEvidence({currency:"USD"},[{...evidence[0],sourceArchiveId:inconsistent.id}],
   "2024-02-01T00:00:00Z",identity,async()=>inconsistent.payload),/conflicting/);
});
test("unknown dates and duplicate claims cannot be certified by hashes",()=>{
 assert.throws(()=>packCompanySource({...source,publishedAt:null}),/Unknown publication/);
 assert.throws(()=>packCompanySource({...source,claims:[source.claims[0],source.claims[0]]}),/Duplicate/);
 assert.throws(()=>packCompanySource({...source,publishedDate:"2024-01-02"}),/Conflicting publication/);
 assert.throws(()=>packCompanySource({...source,publishedAt:null,publishedDate:"2024-01-02",
   claims:[{...source.claims[0],basis:"revised-history"}]}),/predates/);
});

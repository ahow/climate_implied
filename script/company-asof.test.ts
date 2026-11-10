import test from "node:test";
import assert from "node:assert/strict";
import { materialLeaves,validateCompanyInputEvidence } from "../server/calculation/companyProjectionAsOf";
import { contentHash } from "../server/calculation/analysisManifest";
const input={currency:"GBP",members:[{id:"one",capex:0}],tax:.2};
const evidence=Object.entries(materialLeaves(input)).map(([path,value])=>({
  path,valueHash:contentHash(value),sourceArchiveId:"a".repeat(64),
  availableAt:"2020-01-01T00:00:00Z",basis:"assumption",
}));
test("all company input leaves require exact dated evidence; order is deterministic",()=>{
  const cutoff="2020-01-01T00:00:00Z";
  assert.deepEqual(validateCompanyInputEvidence(input,evidence,cutoff),
    validateCompanyInputEvidence(input,[...evidence].reverse(),cutoff));
  assert.throws(()=>validateCompanyInputEvidence(input,evidence.slice(1),cutoff),/Missing/);
  assert.throws(()=>validateCompanyInputEvidence(input,[...evidence,evidence[0]],cutoff),/duplicate/);
  assert.throws(()=>validateCompanyInputEvidence({...input,tax:.3},evidence,cutoff),/Conflicting/);
  assert.throws(()=>validateCompanyInputEvidence(input,evidence,"2019-12-31T23:59:59Z"),/Future/);
});

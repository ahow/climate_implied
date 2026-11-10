import test from "node:test";
import assert from "node:assert/strict";
import { packOverlay,applyOverlays,unpackOverlay } from "../server/snapshots/overlayContract";
const entry={companyId:1,observationDate:"2020-01-01",availableAt:"2021-01-01",
  kind:"sdg",field:"sdgAlignmentScore",unit:"score",source:"test",historyBasis:"revised-history",value:1};
const first=packOverlay([{...entry,approvalEvidence:"review:a;decidedAt:2021-01-01T00:00:00.000Z;sourceReview:x"}]);
const last=packOverlay([{...entry,value:2,approvalEvidence:"review:b;decidedAt:2021-01-02T00:00:00.000Z;sourceReview:x"}]);
const baseline:any={companies:[{id:1}],timeSeries:[]};
test("approved overlay order and exact UTC day boundary enforced",()=>{
  assert.equal(applyOverlays(baseline,[first.payload,last.payload],"2021-01-02").companies[0].sdgAlignmentScore,2);
  assert.throws(()=>applyOverlays(baseline,[last.payload,first.payload],"2021-01-02"),/reversed/);
  assert.throws(()=>applyOverlays(baseline,[last.payload],"2021-01-01"),/cutoff/);
  assert.throws(()=>unpackOverlay(first.id,last.payload),/hash/);
  assert.equal(baseline.companies[0].sdgAlignmentScore,undefined);
});
test("future workbook observations and mixed decision evidence fail closed",()=>{
  assert.throws(()=>applyOverlays({companies:[],timeSeries:[{date:new Date("2025-01-01")}] } as any,[],"2024-12-31"),/cutoff/);
  const mixed=packOverlay([{...entry,approvalEvidence:"unverified"},{...entry,companyId:2,
    approvalEvidence:"review:a;decidedAt:2021-01-01T00:00:00.000Z;sourceReview:x"}]);
  assert.throws(()=>applyOverlays(baseline,[mixed.payload],"2021-01-02"),/Conflicting/);
});

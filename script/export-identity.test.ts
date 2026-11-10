import test from "node:test";
import assert from "node:assert/strict";
import { exportDataIdentity } from "../client/src/lib/export-identity";
test("export identity ignores column insertion order, retains zero/null and row order",async()=>{
  const a=await exportDataIdentity([{b:0,a:null}]);
  assert.equal(a.hash,(await exportDataIdentity([{a:undefined,b:0}])).hash);
  assert.notEqual(a.hash,(await exportDataIdentity([{a:0,b:0}])).hash);
  assert.notEqual((await exportDataIdentity([{a:1},{a:2}])).hash,
    (await exportDataIdentity([{a:2},{a:1}])).hash);
});

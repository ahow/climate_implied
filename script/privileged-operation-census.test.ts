import test from "node:test";
import assert from "node:assert/strict";
import {scanOperations} from "./privileged-operation-inventory";
test("privileged discovery finds added calls without a fixed route whitelist",()=>{
 const r=scanOperations("fixture.ts",`
 db.insert(table); db.update(table); db.delete(table);
 await fetch("https://example.invalid/?token=DO_NOT_EXPORT");
 cache.clear(); startScheduler(); process.argv;
 const q=sql\`UPDATE test SET n=1\`;
 `);
 for(const kind of ["database-or-executor-candidate","provider-or-network-candidate","cache-mutation-candidate","scheduler-or-timer-candidate","cli-entry-candidate","mutating-sql-candidate"])
  assert.ok(r.operations.some(x=>x.kind===kind),kind);
 assert.ok(!JSON.stringify(r).includes("DO_NOT_EXPORT"));
 assert.ok(!JSON.stringify(r).includes("https://"));
 assert.equal(r.sourceSha256.length,64);
});
test("discovery is deterministic and explicitly non-authorizing",()=>{
 const s="function later(){ return provider.get(url); }";
 assert.deepEqual(scanOperations("x.ts",s),scanOperations("x.ts",s));
 assert.match(scanOperations("x.ts",s).operations[0].review,/not permission/);
});

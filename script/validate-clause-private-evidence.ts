/** Required authorized-workspace check. Missing private bytes FAIL, never skip. */
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
const early=JSON.parse(readFileSync("docs/reconciliation-stages-00-03.json","utf8"));
const late=JSON.parse(readFileSync("docs/reconciliation-stages-14-17.json","utf8")).records;
let checked=0;
for(const record of Object.values(early) as any[]){
  if(record.status==="verified")assert.ok(record.executions.some((e:any)=>
    e.log_inspected&&e.exit_code===0&&existsSync(e.log)),record.id);
  for(const e of record.executions){
    if(e.log_sha256){
      const bytes=readFileSync(e.log);
      assert.equal(createHash("sha256").update(bytes).digest("hex"),e.log_sha256,e.log);
      checked++;
    }
  }
}
for(const record of late)for(const e of record.executions){
  const bytes=readFileSync(e.log);
  assert.ok(bytes.length>0,e.log);
  if(e.log_sha256!==undefined)
    assert.equal(createHash("sha256").update(bytes).digest("hex"),e.log_sha256,e.log);
  checked++;
}
console.log(JSON.stringify({privateReceiptAssertions:checked,missingFilesSkipped:0}));

/** Read-only advisory-lock acceptance; no collectors or provider calls. */
import assert from "node:assert/strict";
import { db } from "../server/db";
import { withCollectionLock } from "../server/dataIngestion/collectionLock";
if (process.env.NODE_ENV === "production") throw new Error("Development only");
try {
  const first = await withCollectionLock(db.$client, async () => {
    const competing = await withCollectionLock(db.$client, async () => "must-not-run");
    assert.equal(competing.acquired, false);
    return 1;
  });
  assert.deepEqual(first,{acquired:true,result:1});
  assert.deepEqual(await withCollectionLock(db.$client,async()=>2),{acquired:true,result:2});
  console.log("PASS: separate PostgreSQL sessions exclude concurrent collectors; release permits next collector");
} finally { await db.$client.end(); }

import test from "node:test";
import assert from "node:assert/strict";
import { withCollectionLock } from "../server/dataIngestion/collectionLock";

test("collection lock skips competing hosts and releases its connection", async () => {
  let released = 0, ran = 0;
  const client = { query: async () => ({ rows: [{ acquired: false }] }), release: () => { released++; } };
  const result = await withCollectionLock({ connect: async () => client }, async () => ++ran);
  assert.equal(result.acquired, false);
  assert.equal(ran, 0);
  assert.equal(released, 1);
});
test("collection lock releases after success and error; broken unlock discards session", async () => {
  for (const fails of [false, true]) {
    const queries: string[] = [];
    let released = 0;
    const client = { query: async (sql: string) => { queries.push(sql); return { rows: [{ acquired: true }] }; },
      release: () => { released++; } };
    const action = () => withCollectionLock({ connect: async () => client }, async () => {
      if (fails) throw new Error("adapter failure");
      return 17;
    });
    if (fails) await assert.rejects(action, /adapter failure/);
    else assert.deepEqual(await action(), { acquired: true, result: 17 });
    assert.match(queries[0], /pg_try_advisory_lock/);
    assert.match(queries[1], /pg_advisory_unlock/);
    assert.equal(released, 1);
  }
  let destroyed = false;
  let calls = 0;
  const client = { query: async () => {
    if (++calls === 2) throw new Error("lost connection");
    return { rows: [{ acquired: true }] };
  }, release: (error?: Error | boolean) => { destroyed = !!error; } };
  await assert.rejects(() => withCollectionLock({ connect: async () => client }, async () => 1));
  assert.equal(destroyed, true);
});

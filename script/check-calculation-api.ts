/** Read-only development endpoint check; GET calculations may populate caches. */
import assert from "node:assert/strict";
const base = `https://${process.env.REPLIT_DEV_DOMAIN}`;
async function get(path: string) {
  const response = await fetch(base + path);
  assert.equal(response.status, 200, `${path}: ${response.status}`);
  return response.json();
}
const contract = await get("/api/calculation-contract");
assert.equal(contract.validation, "characterization-only");
const first = await get("/api/projection"), second = await get("/api/projection");
assert.deepEqual(first, second);
assert.equal(first.calculation.contractVersion, contract.contractVersion);
const uploads = await get("/api/cv/uploads");
const completed = uploads.find((row: { status: string }) => row.status === "completed");
if (!completed) throw new Error("Finance integration check needs a completed development dataset");
const path = `/api/cv/carbon-price?uploadId=${completed.id}&method=absolute`;
const cold = await get(path), warm = await get(path);
assert.deepEqual(cold, warm, "Finance cache must preserve exact serialized results");
console.log(`PASS: contract, repeat projection, finance cache precision (${cold.length} dates).`);

/** Actual running DEV HTTP surface. No privileged mutation capability is assumed. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { replayPaths } from "./replay-sdg-result";
if (process.env.NODE_ENV !== "development") throw new Error("Requires explicit NODE_ENV=development");
const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
const directory = "generated-artifacts/nine-http-recovery";
mkdirSync(directory, { recursive: true, mode: 0o700 });
async function request(path: string, status = 200, method = "GET") {
  const response = await fetch(base + path, { method, signal: AbortSignal.timeout(180000) });
  const body = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(body)}`);
  return { body, headers: response.headers };
}
// These endpoints remain publicly forbidden. Never send an upload or approval payload.
for (const path of ["/api/cv/upload", "/api/data/indicator/evSalesSharePct/manual"])
  await request(path, 403, "POST");
const status = await request("/api/analysis/snapshot-status");
assert.equal(status.body.status, "immutable-workbook-snapshot");
const id = status.body.snapshotId;
const uploads = await request("/api/cv/uploads");
const upload = uploads.body.find((row: { status: string }) => row.status === "completed");
assert.ok(upload, "Actual HTTP current selection requires a completed development upload");
const results = [];
for (const path of replayPaths) {
  const endpoint = `/api/cv${path}?method=absolute${path === "/carbon-price" ? `&uploadId=${upload.id}` : ""}`;
  const first = await request(endpoint);
  const [warm, selected] = await Promise.all([
    request(endpoint), request(`${endpoint}&snapshotId=${id}`),
  ]);
  assert.deepEqual(warm.body, first.body, `${path} warm repeat`);
  assert.deepEqual(selected.body, first.body, `${path} concurrent historical selection`);
  assert.equal(first.headers.get("X-Analysis-Snapshot"), id);
  const resultId = first.headers.get("X-Analysis-Result");
  assert.ok(resultId, `${path} response must archive result`);
  const stored = await request(`/api/analysis/results/${resultId}`);
  assert.deepEqual(stored.body.result, first.body, `${path} stored retrieval`);
  const returned = await request(endpoint);
  assert.deepEqual(returned.body, first.body, `${path} return to default selection`);
  await request(`${endpoint}&snapshotId=${"0".repeat(64)}`, 422);
  results.push({ path, storedRetrieval: true, repeat: true, concurrentSelections: true,
    returnedToDefault: true, invalidSelectionRejected: true });
}
const report = { results, publicPost403: true, productionWrites: 0,
  limits: [
    "Default selection is the latest retained workbook snapshot, NOT a proven mutable-current source lifecycle.",
    "No authorized privileged HTTP loader/review/capture facility is exposed; no public writes attempted.",
    "Current workbook AND approved source mutation, suspended HTTP refresh, and post-mutation restore remain UNPROVEN.",
    "Concurrent default/explicit selections refer to the same workbook; this does not prove distinct-selection isolation.",
    "Warm repetition proves equal responses, not an instrumented cache hit; GETs can append immutable result/material archives.",
  ] };
writeFileSync(`${directory}/report.json`, JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify(report));

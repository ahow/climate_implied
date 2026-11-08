import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { releaseSafety, schedulerEnabled } from "../server/releaseSafety";

test("scheduler is explicitly opt-in", () => {
  assert.equal(schedulerEnabled(undefined), false);
  assert.equal(schedulerEnabled("false"), false);
  assert.equal(schedulerEnabled("true"), true);
});
test("HTTP mutations denied, diagnostics bounded, read requests preserved", async () => {
  const app = express();
  app.use(releaseSafety({ diagnosticLimit: 2 }));
  let writes = 0;
  app.post("/api/cv/upload", (_req, res) => { writes++; res.json({ ok: true }); });
  app.post("/api/calculation/ensemble-summary", (_req, res) => res.json({ ok: true }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(base + "/api/cv/upload", { method: "POST" })).status, 403);
    assert.equal(writes, 0);
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal((await fetch(base + "/api/calculation/ensemble-summary", { method: "POST" })).status, 200);
    assert.equal((await fetch(base + "/api/calculation/ensemble-summary", { method: "POST" })).status, 200);
    assert.equal((await fetch(base + "/api/calculation/ensemble-summary", { method: "POST" })).status, 429);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

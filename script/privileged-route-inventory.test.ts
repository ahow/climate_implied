import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import express from "express";
import { publicDiagnostics, releaseSafety } from "../server/releaseSafety";

test("every declared mutating route is either a bounded diagnostic or denied before execution", async () => {
  const source = readFileSync("server/routes.ts", "utf8");
  const routes = [...source.matchAll(/app\.(post|put|patch|delete)\("([^"]+)"/g)]
    .map(m => ({ method: m[1], path: m[2] }));
  assert.ok(routes.length >= 14, "inventory unexpectedly incomplete");
  for (const path of publicDiagnostics) assert.ok(routes.some(r => r.path === path));
  const app = express();
  app.use(releaseSafety({ diagnosticLimit: 100 }));
  app.use(express.json({ limit: "256kb" }));
  let executed = 0;
  for (const r of routes) (app as any)[r.method](r.path, (_req: unknown, res: any) => {
    executed++; res.json({ ok: true });
  });
  app.use((error: any, _req: any, res: any, _next: any) => res.status(error.status || 500).json({ error: error.type }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    for (const r of routes) {
      const before = executed;
      const response = await fetch(base + r.path.replace(/:[^/]+/g, "test"), { method: r.method.toUpperCase() });
      const diagnostic = publicDiagnostics.has(r.path);
      assert.equal(response.status, diagnostic ? 200 : 403, r.path);
      assert.equal(executed - before, diagnostic ? 1 : 0);
    }
    const before = executed;
    const oversized = await fetch(base + [...publicDiagnostics][0], {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(262144) }),
    });
    assert.equal(oversized.status, 413);
    assert.equal(executed, before);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("boot and upload-list reads cannot silently delete or reclassify source records", () => {
  const source = readFileSync("server/routes.ts", "utf8");
  const boot = source.slice(source.indexOf("export async function registerRoutes"), source.indexOf("function clearProjectionCaches"));
  assert.doesNotMatch(boot, /DELETE FROM|CREATE UNIQUE INDEX|db\.update\(cvDataUploads\)/);
  const listing = source.slice(source.indexOf('app.get("/api/cv/uploads"'), source.indexOf('app.post("/api/cv/uploads'));
  // Bound precisely at the next route rather than inspecting unrelated writes.
  const firstRoute = listing.split(/\n  app\.(get|post|put|delete)\(/)[0];
  assert.doesNotMatch(firstRoute, /db\.update|db\.delete|DELETE FROM|UPDATE /);
});
test("financial review reads verify schema instead of creating it", () => {
  const source = readFileSync("server/financialData/reviewStore.ts", "utf8");
  assert.doesNotMatch(source, /CREATE TABLE|ALTER TABLE/);
  assert.match(source, /to_regclass/);
});

import assert from "node:assert/strict";
import { projectionResponseSchema } from "../shared/projectionResponse";
import { thresholdDiagnosticSchema } from "../shared/thresholdDiagnosticSchema";
import { nativeResidualDiagnosticsSchema } from "../shared/nativeThresholdSchema";

// GET-only probe for an already-running development server. No app launch,
// provider trigger, archive capture, approval, upload or other mutating request.
const base = process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "http://127.0.0.1:5000";
assert.ok(base===`https://${process.env.REPLIT_DEV_DOMAIN}` || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base), "Development preview only");
async function get(path: string) {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return { body: await response.json(), headers: response.headers };
}
const main = projectionResponseSchema.parse((await get("/api/projection")).body);
for (const scenario of ["constant", "transition", "dashboard"]) {
  const body = (await get(`/api/emissions/candidate?scenario=${scenario}`)).body;
  const native = nativeResidualDiagnosticsSchema.parse(body.residualDiagnostics);
  assert.equal(native.records.length, 27);
  assert.match(native.baselineInputId, /^captured-native-inventory-sha256:1bb224d96626cd69f675126892dd8ee0e423a9defb16c67b967a891dcdfccd29$/);
  for (const r of native.records) {
    assert.notEqual(r.diagnostic.status, "withheld");
    assert.equal(r.diagnostic.thresholdValue, 0.05 * r.diagnostic.baselineValue!);
    assert.match(r.diagnostic.basis!.unit, /^Mt .+\/year$/);
  }
}
assert.ok(main.metrics.thresholdDiagnostic);
const categories = (await get("/api/projection/categories")).body;
for (const c of categories) {
  const d = thresholdDiagnosticSchema.parse(c.thresholdDiagnostic);
  if (d.status !== "withheld") {
    assert.equal(d.baselineValue, c.trajectory.find((r: { year: number }) => r.year === 2024)?.p50);
    assert.equal(d.thresholdValue, 0.05 * d.baselineValue!);
  }
}
const history = (await get("/api/projection/historical-trend")).body;
for (const row of history) thresholdDiagnosticSchema.parse(row.thresholdDiagnostic);
const categoryHistory = (await get("/api/projection/categories/historical-trend")).body;
for (const row of categoryHistory)
  for (const category of ["all", "technology", "policy", "corporate", "socioeconomic", "financial", "emissions"])
    thresholdDiagnosticSchema.parse(row[category].thresholdDiagnostic);

const inventory = (await get("/api/analysis/snapshots?kind=indicator-overrides")).body;
assert.ok(inventory.items?.length, "Existing indicator archive needed for selected-input HTTP replay; none created by this probe");
const selectedId = inventory.items[0].id;
const selected = await get(`/api/projection?indicatorSnapshotId=${selectedId}`);
assert.equal(selected.headers.get("X-Indicator-Snapshot"), selectedId);
const replay = projectionResponseSchema.parse(selected.body);
const replayAgain = projectionResponseSchema.parse((await get(`/api/projection?indicatorSnapshotId=${selectedId}`)).body);
assert.deepEqual(replayAgain, replay, "Selected historical response must reproduce exactly");
const selectedCategories = (await get(`/api/projection/categories?indicatorSnapshotId=${selectedId}`)).body;
for (const c of selectedCategories) thresholdDiagnosticSchema.parse(c.thresholdDiagnostic);

const regionalInventory = (await get("/api/analysis/snapshots?kind=regional-intensity")).body;
assert.ok(regionalInventory.items?.length, "Existing regional archive needed; live provider fetch is deliberately not triggered");
const regionalId = regionalInventory.items[0].id;
const regions = await get(`/api/projection/regions?indicatorSnapshotId=${selectedId}&regionalSnapshotId=${regionalId}`);
assert.equal(regions.headers.get("X-Regional-Snapshot"), regionalId);
for (const row of regions.body) thresholdDiagnosticSchema.parse(row.thresholdDiagnostic);
console.log(JSON.stringify({
  checkedAt: new Date().toISOString(), result: "passed", requests: "GET only, localhost",
  selectedIndicatorSnapshot: selectedId, selectedRegionalSnapshot: regionalId,
  mainStatus: main.metrics.thresholdDiagnostic.status, categoryRows: categories.length,
  historicalRows: history.length, categoryHistoricalRows: categoryHistory.length,
  regionalRows: regions.body.length,
  boundary: "Software/API replay checks only; not scientific acceptance, original-vintage certification or observed baseline validation",
}, null, 2));

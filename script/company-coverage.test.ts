import test from "node:test";
import assert from "node:assert/strict";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { companyCoverageSemantics } from "../shared/companyCoverageSemantics";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prepareQualifiedJsonExport, validateCompanyCoverageJson } from "../client/src/lib/export-contract";
const base = {
  companies: [1, 2, 3, 4].map(id => ({ id, isin: `issuer-${id}` })),
  observationDate: "2024-12-31", informationCutoff: "2025-01-02T00:00:00Z", sourceId: "test-only",
  observations: [
    { companyId: 1, date: "2024-12-31", marketCap: 100, scope1Emissions: 0, scope2Emissions: 20, scope3Emissions: null },
    { companyId: 2, date: "2024-12-31", marketCap: 300, scope1Emissions: 40, scope2Emissions: null },
    { companyId: 3, date: "2024-11-30", marketCap: 500 },
    { companyId: 4, date: "2024-12-31", marketCap: null, scope1Emissions: -1 },
  ],
  reviews: [
    { companyId: 1, eligible: true, mapping: "operating-geography" as const },
    { companyId: 2, eligible: true, mapping: "headquarters-fallback" as const },
    { companyId: 3, eligible: false, mapping: "missing" as const },
    { companyId: 4, eligible: false, eligibilityConflict: true, mapping: "conflicted" as const },
  ],
};
test("S12-018 stable full workbook AND eligible denominators; count versus known-value shares", () => {
  const r = companyCoverage(base);
  assert.equal(r.fullWorkbook.denominator, 4); assert.equal(r.eligible.denominator, 2);
  assert.equal(r.fullWorkbook.mapping["operating-geography"].share, .25);
  assert.equal(r.eligible.mapping["operating-geography"].share, .5);
  assert.equal(r.fullWorkbook.metrics.marketCap.operatingGeography.shareOfKnownValue, .25);
  assert.equal(r.fullWorkbook.metrics.marketCap.headquartersFallback.shareOfKnownValue, .75);
  assert.equal(r.fullWorkbook.metrics.marketCap.availableShare, .5);
  assert.equal(r.eligibleKnownValueCoverage.marketCap, 1);
  assert.equal(r.eligibleCompanyShare, .5);
});
test("null/missing/invalid distinct; observed zero is not missing; no carry-forward", () => {
  const r = companyCoverage(base);
  assert.deepEqual(r.fullWorkbook.metrics.marketCap.states, { present: 2, null: 1, missing: 1, conflicted: 0, invalid: 0 });
  assert.deepEqual(r.fullWorkbook.metrics.scope1Emissions.states, { present: 2, null: 0, missing: 1, conflicted: 0, invalid: 1 });
  assert.equal(r.fullWorkbook.metrics.scope3Emissions.knownTotal, null);
  assert.equal(r.fullWorkbook.metrics.scope3Emissions.operatingGeography.knownValue, null);
});
test("duplicate date conflicts are never deduplicated into apparent coverage", () => {
  const r = companyCoverage({ ...base, observations: [...base.observations, base.observations[0]] });
  assert.equal(r.fullWorkbook.metrics.marketCap.states.conflicted, 1);
  assert.equal(r.fullWorkbook.metrics.marketCap.knownTotal, 300);
});
test("no eligible population is null shares, not fake zero success", () => {
  const r = companyCoverage({ ...base, reviews: [] });
  assert.equal(r.eligible.denominator, 0);
  assert.equal(r.eligible.metrics.marketCap.availableShare, null);
  assert.equal(r.fullWorkbook.mapping["operating-geography"].count, 0);
  assert.equal(r.eligible.mapping.missing.share, null);
});
test("all observed emissions zero retains zero known total but null value-weighted share", () => {
  const r = companyCoverage({ ...base, observations: base.observations.map(o => ({ ...o, scope1Emissions: 0 })) });
  assert.equal(r.fullWorkbook.metrics.scope1Emissions.knownTotal, 0);
  assert.equal(r.fullWorkbook.metrics.scope1Emissions.operatingGeography.shareOfKnownValue, null);
});
test("identity conflicts exclude eligibility, reject duplicate universe, and reject future observation", () => {
  const r = companyCoverage({ ...base, reviews: base.reviews.map(r => ({ ...r, eligibilityConflict: true })) });
  assert.equal(r.eligible.denominator, 0);
  assert.equal(r.eligibilityConflicts, 4);
  assert.throws(() => companyCoverage({ ...base, companies: [...base.companies, base.companies[0]] }), /Duplicate/);
  assert.throws(() => companyCoverage({ ...base, observationDate: "2026-01-01" }), /after/);
});
test("explicit incompatible currency conflicts instead of silently aggregating currencies", () => {
  const r = companyCoverage({ ...base, observations: base.observations.map(o => ({ ...o, marketCapCurrency: o.companyId === 1 ? "EUR" : "USD" })) });
  assert.equal(r.fullWorkbook.metrics.marketCap.states.conflicted, 1);
  assert.equal(r.fullWorkbook.metrics.marketCap.knownTotal, 300);
});
test("JSON export preserves null/zero/statuses and every new primitive has separate exact semantics", () => {
  const report = companyCoverage(base);
  const exported = JSON.parse(JSON.stringify(report));
  assert.deepEqual(exported, report);
  assert.equal(exported.fullWorkbook.metrics.scope3Emissions.knownTotal, null);
  assert.equal(exported.fullWorkbook.mapping["operating-geography"].count, 1);
  const ids = new Set(companyCoverageSemantics.map(s => s.id));
  assert.equal(ids.size, companyCoverageSemantics.length);
  function check(value: unknown, path: string) {
    if (Array.isArray(value)) { assert.ok(ids.has(`${path}[]`), path); return; }
    if (value !== null && typeof value === "object") {
      Object.entries(value).forEach(([key, child]) => check(child, `${path}.${key}`)); return;
    }
    assert.ok(ids.has(path), `Missing exact new coverage semantic: ${path}`);
  }
  check(report, "companyCoverage");
});
test("supplemental census inventories exact API/display/JSON domains without original cohort credit", () => {
  const census = JSON.parse(readFileSync("docs/field_semantics_census.json", "utf8"));
  const coverage = census.supplementalQualifiedChanges.companyCoverage;
  const ids = companyCoverageSemantics.map(f => f.id);
  assert.deepEqual(coverage.ids, ids);
  assert.deepEqual(coverage.api.fields.map((f: any) => f.id), ids);
  assert.deepEqual(coverage.jsonExport.ids, ids);
  assert.ok(coverage.api.fields.every((f: any) => f.bound));
  assert.ok(coverage.display.bindings.every((f: any) => f.bound && ids.includes(f.id)));
  assert.match(coverage.boundary, /No original1001 closure credit/);
  const frozen = JSON.parse(readFileSync("docs/field_semantics_original_cohort.json", "utf8"));
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.slotIdentityFingerprint, frozen.slotIdentityFingerprint);
  assert.equal(census.supplementalSlotAccounting.removedOriginalSlots.length, 0);
});
test("central qualified JSON export preserves full report and carries evidence plus exact content identity", async () => {
  const report = companyCoverage({ ...base, sourceId: "a".repeat(64) });
  const prepared = await prepareQualifiedJsonExport(report, "coverage", "coverage.json", "2026-11-10T00:00:00Z", validateCompanyCoverageJson);
  const restored = JSON.parse(prepared.text);
  assert.deepEqual(restored.data, report);
  assert.equal(restored.dataIdentity.hash, createHash("sha256").update(JSON.stringify(restored.data, null, 2)).digest("hex"));
  assert.equal(prepared.hash, restored.dataIdentity.hash);
  assert.equal(restored.data.fullWorkbook.metrics.scope3Emissions.knownTotal, null);
  assert.equal(restored.data.fullWorkbook.metrics.scope1Emissions.operatingGeography.knownValue, 0);
  assert.match(JSON.stringify(restored.interpretation), /not an immutable analysis archive/);
  assert.match(JSON.stringify(restored.interpretation), /global physical inventory/);
  for (const changed of [{ ...report, version: "wrong" }, { ...report, sourceId: "unverified" },
    { ...report, fullWorkbook: { ...report.fullWorkbook, denominator: undefined } }, { ...report, scientificAcceptance: true }])
    await assert.rejects(prepareQualifiedJsonExport(changed, "coverage", "coverage.json", "now", validateCompanyCoverageJson));
});
test("central JSON validation rechecks active selected source and refuses overlays at download time", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  let selection: unknown = { workbook: "b".repeat(64), indicators: "c".repeat(64) };
  Object.defineProperty(globalThis, "window", { configurable: true,
    value: { sessionStorage: { getItem: () => JSON.stringify(selection) } } });
  try {
    const report = companyCoverage({ ...base, sourceId: "a".repeat(64) });
    assert.throws(() => validateCompanyCoverageJson(report), /source conflicts/);
    selection = { workbook: "a".repeat(64), indicators: "c".repeat(64) };
    assert.doesNotThrow(() => validateCompanyCoverageJson(report));
    selection = { workbook: "a".repeat(64), indicators: "c".repeat(64), overlays: ["d".repeat(64)], asOf: "2025-01-01" };
    assert.throws(() => validateCompanyCoverageJson(report), /without overlays/);
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
import { lifecycleProfileEvidence, resolveStage10Lifecycle, type LifecycleEvidence } from "../server/financialData/stage10Lifecycle";
import { buildStage10Coverage } from "../server/financialData/stage10Coverage";
import { stage10LifecycleStates, stage10IdentityStates, stage10CoverageSchema } from "../shared/stage10Coverage";
const company = { id: 1, isin: "US0378331005", sector: "Engineering", geography: "Engineering region" };
const cutoff = "2021-07-01T00:00:00Z", capturedAt = "2021-03-01T00:00:00Z";
const profile = { isin: company.isin, symbol: "ENGINEERING_ONLY", exchange: "ENGINEERING", isActivelyTrading: true };
const hash = contentHash({ syntheticEngineeringOnly: true });
const proof = () => lifecycleProfileEvidence(company, profile, capturedAt, hash, "retained-worked-profile")[0];
function input() {
  return { workbookHash: hash, cutoff, years: [2020], companies: [
    company, { ...company, id: 2, isin: "US17275R1023" }, { ...company, id: 3, isin: "US5949181045" },
    { ...company, id: 4, isin: "US4592001014" }, { ...company, id: 5, isin: "US1912161007" },
  ], attempts: [{ companyId: 1, isin: company.isin, status: "unmatched" }], reviews: [], eligibleIds: [], cells: [],
    sourceIdentity: { syntheticEngineeringOnly: true }, retainedVersions: 0, selectedVersions: 0, sourceGaps: ["Synthetic engineering only"],
    lifecycleEvidence: [proof()] };
}
test("exact original lifecycle criteria keep verification and actual2442 denominator separate from identity acceptance", () => {
  const ledger = readFileSync("docs/WORKPLAN_COMPLETION_LEDGER.md", "utf8");
  assert.match(ledger, /A company's last workbook observation is not evidence; without verification, status is “unknown”/);
  assert.match(ledger, /All 2,442 companies have both a lifecycle status \(including “unknown”\) and an identity-review state, and counts reconcile/);
  assert.match(ledger, /No lifecycle status other than “unknown” lacks a verification source/);
  assert.match(ledger, /Root-cause audit of 50 unmatched and 50 ambiguous cases from the earlier 200-company run/);
});
test("dated exact-security provider listing evidence is independent; inactive/last observation/missing profile never delisting", () => {
  assert.equal(resolveStage10Lifecycle(company, [proof()], cutoff).state, "listed");
  assert.equal(resolveStage10Lifecycle({ ...company, lastWorkbookObservation: cutoff } as any, [], cutoff).state, "unknown");
  const inactive = lifecycleProfileEvidence(company, { ...profile, isActivelyTrading: false }, capturedAt, hash, "retained-worked-profile");
  assert.equal(resolveStage10Lifecycle(company, inactive, cutoff).state, "unknown");
  assert.deepEqual(lifecycleProfileEvidence(company, { ...profile, isin: "US17275R1023" }, capturedAt, hash, "retained-worked-profile"), []);
  for (const changed of [{ capturedAt: "" }, { effectiveAt: "2022-01-01T00:00:00Z" }, { capturedAt: "2022-01-01T00:00:00Z" },
    { sourceHash: "unverified" }, { endpoint: "https://example.org/unapproved-provider" }, { fact: "true" }, { isin: "US17275R1023" }])
    assert.equal(resolveStage10Lifecycle(company, [{ ...proof(), ...changed }], cutoff).state, "unknown");
});
test("synthetic dated exchange/action classifiers retain provenance,refuse contradictory terminal/provider evidence; no real approval", () => {
  const merged: LifecycleEvidence = { ...proof(), kind: "corporate-action", state: "merged", fact: "merged",
    endpoint: "https://example.org/engineering-only-action", effectiveAt: "2021-04-01T00:00:00Z", capturedAt: "2021-04-02T00:00:00Z" };
  assert.equal(resolveStage10Lifecycle(company, [proof(), merged], cutoff).state, "merged");
  const laterProvider = { ...proof(), capturedAt: "2021-05-01T00:00:00Z", effectiveAt: "2021-05-01T00:00:00Z" };
  assert.equal(resolveStage10Lifecycle(company, [merged, laterProvider], cutoff).state, "unknown");
  assert.equal(resolveStage10Lifecycle(company, [merged, { ...laterProvider, kind: "exchange-listing", fact: "listed",
    endpoint: "https://example.org/engineering-only-relisting" }], cutoff).state, "listed");
});
test("actual35-cell lifecycle×seven-identity joint reconciles both populations; listing never approves identity or changes field denominator", () => {
  const report = buildStage10Coverage(input()), without = buildStage10Coverage({ ...input(), lifecycleEvidence: [] });
  assert.equal(report.fullWorkbookCompanies, 5); assert.equal(report.verifiedEligibleCompanies, 0);
  assert.equal(report.admittedStage11To15Records, 0);
  assert.equal(report.lifecycleNonUnknownCompanies, 1); assert.equal(report.lifecycleAuditedNonUnknownCompanies, 1);
  assert.equal(report.lifecycleUnverifiedNonUnknownCompanies, 0);
  assert.equal(report.denominatorVersion, without.denominatorVersion, "Lifecycle never changes denominator membership");
  assert.notEqual(report.lifecycleSourceSetHash, without.lifecycleSourceSetHash);
  for (const population of ["full-workbook", "verified-eligible"]) {
    const rows = report.rows.filter(r => r.population === population && r.sector === "All sectors" && r.region === "All regions");
    const joint = rows.filter(r => r.dimension === "lifecycle-identity");
    assert.equal(joint.length, 35);
    assert.equal(joint.reduce((n, r) => n + r.present!, 0), population === "full-workbook" ? 5 : 0);
    for (const lifecycle of stage10LifecycleStates) for (const identity of stage10IdentityStates)
      assert.ok(joint.some(r => r.key === `${lifecycle}|${identity}`));
  }
  assert.equal(report.rows.find(r => r.population === "full-workbook" && r.sector === "All sectors" && r.key === "listed|unmatched")?.present, 1);
  assert.deepEqual(report.rows.filter(r => r.dimension === "financial-field"), without.rows.filter(r => r.dimension === "financial-field"));
  const malformed = { ...report, lifecycleAuditedNonUnknownCompanies: 0 };
  assert.equal(stage10CoverageSchema.safeParse(malformed).success, false);
});
test("every nonunknown proof source audit uses safe aggregate hashes,actual capture,not private identifiers", () => {
  const report = buildStage10Coverage(input());
  assert.equal(report.lifecycleEvidenceAudit.length, 2);
  const group = report.lifecycleEvidenceAudit.find(r => r.sourceKind === "retained-worked-profile")!;
  assert.equal(group.evidenceRecords, 1); assert.equal(group.usedNonUnknownCompanies, 1);
  assert.equal(group.firstCapturedAt, capturedAt); assert.equal(group.lastCapturedAt, capturedAt);
  const text = JSON.stringify(report);
  assert.ok(!text.includes("ENGINEERING_ONLY")); assert.ok(!text.includes(company.isin));
  assert.ok(!text.includes('"companyId":'));
});

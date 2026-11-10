import test from "node:test";
import assert from "node:assert/strict";
import { coverageReviews } from "../server/snapshots/companyCoverage";
import { contentHash } from "../server/calculation/analysisManifest";
import { materialLeaves } from "../server/calculation/companyProjectionAsOf";
import { packCompanySource } from "../server/calculation/companySourceArchive";
const cutoff = "2025-03-01T00:00:00Z", availableAt = "2025-02-01T00:00:00Z";
const companies = [{ id: 1, isin: "US0378331005" }];
function fixture(basis = "operating-geography") {
  const identity = { companyId: 1, isin: companies[0].isin, symbol: "TEST", currency: "USD",
    exchange: "TEST", shareClassFIGI: "TEST-FIGI", issuerId: "test-issuer", marketCapScope: "issuer",
    primaryListingEvidence: "https://example.org/listing", issuerEvidence: "https://example.org/issuer", reviewedAt: availableAt };
  const payload = { identity, quote: { price: 1, marketCap: 100, observedAt: availableAt },
    statement: { netIncome: 1, period: "2024-12-31", filingDate: "2025-01-20", currency: "USD" }, fetchedAt: availableAt };
  const financial = [{ id: "financial", status: "approved", payload, reviewed_at: availableAt }];
  const companyIdentity = { companyId: "1", isin: identity.isin };
  const year = { exposures: [{ region: "fixture", sector: "fixture", activityGrowth: .01 }],
    marketShareMultiplier: 1, operatingMargin: .1, taxRate: .2, interest: 0, depreciation: 10, capex: 10,
    increaseWorkingCapital: 0, netBorrowing: 0, nonOperatingIncome: 0, incomeAttributionAdjustment: 0, otherCashAdjustments: 0,
    scope1IntensityMultiplier: 1, scope2IntensityMultiplier: 1, scope3IntensityMultiplier: 1,
    scope1LiableFraction: 0, scope2LiableFraction: 0, effectiveCarbonPrice: 0, passThrough: 0 };
  const input = { companyId: "1", manifestId: "test", currency: "USD", businessType: "non-financial",
    baseYear: 2024, baseRevenue: 1000, baseFcfe: 80, baseEmissionsTonnes: { scope1: 100, scope2: 0, scope3: 100 },
    marginBounds: { minimum: 0, maximum: .2, evidence: ["test fixture"] },
    mapping: { basis, evidence: ["test fixture"], shares: [{ region: "fixture", sector: "fixture", weight: 1 }] },
    members: ["a", "b"].map(id => ({ id, years: Array.from({ length: 5 }, (_, i) => ({ ...year, year: 2025 + i })) })) };
  const claims = Object.entries(materialLeaves(input)).map(([path, value]) => ({
    path, valueHash: contentHash(value), locator: "fixture", unit: "test unit", period: "2024-2029", geography: "fixture",
    basis: "assumption", availableAt, method: "Synthetic focused test only", dependencies: [],
  }));
  const source = packCompanySource({ version: "company-operating-source-1", ...companyIdentity,
    url: "https://example.org/fixture", publisher: "Test fixture", publishedAt: availableAt, retrievedAt: availableAt,
    content: "fixture", contentHash: contentHash("fixture"), licence: "Synthetic", claims });
  const archive = (kind: string, value: unknown) => ({ id: contentHash(value), kind, payload: value,
    chunk_count: 1, ordinal: 0, created_at: availableAt });
  const proposal = archive("company-operating-proposal", { identity: companyIdentity, input,
    evidence: claims.map(({ path, valueHash, basis, availableAt }) => ({ path, valueHash, basis, availableAt, sourceArchiveId: source.id })) });
  const archivedIdentity = archive("company-operating-identity", { financialReviewId: "financial", reviewedAt: availableAt, status: "approved", payload });
  const decision = archive("company-operating-decision", { proposalId: proposal.id, decision: "approved",
    financialReviewId: "financial", financialIdentityArchive: archivedIdentity.id, financialReviewedAt: availableAt, decidedAt: availableAt });
  return { financial, archives: [archive("company-operating-source", source.payload), proposal, archivedIdentity, decision] };
}
test("read-only complete review evaluator verifies operating and explicit HQ fallback source archives", async () => {
  for (const basis of ["operating-geography", "headquarters-fallback"] as const) {
    const f = fixture(basis), r = await coverageReviews(companies, f.financial, f.archives, cutoff);
    assert.equal(r[0].eligible, true); assert.equal(r[0].mapping, basis);
  }
});
test("corrupt archived claims conflict, rather than silently count as mapping", async () => {
  const f = fixture();
  (f.archives[0].payload as any).content = "tampered";
  const r = await coverageReviews(companies, f.financial, f.archives, cutoff);
  assert.equal(r[0].mapping, "conflicted"); assert.equal(r[0].eligible, true);
});
test("pending source packet is unknown, no packet is missing, no geography inference", async () => {
  const f = fixture();
  assert.equal((await coverageReviews(companies, f.financial, [], cutoff))[0].mapping, "missing");
  assert.equal((await coverageReviews(companies, f.financial, f.archives.slice(0, 2), cutoff))[0].mapping, "unknown");
});
test("future financial approval or incompatible snapshot currency cannot be eligible", async () => {
  const f = fixture();
  f.financial[0].reviewed_at = "2026-01-01T00:00:00Z";
  assert.equal((await coverageReviews(companies, f.financial, f.archives, cutoff))[0].eligible, false);
  f.financial[0].reviewed_at = availableAt;
  f.financial[0].payload.statement.currency = "EUR";
  const r = await coverageReviews(companies, f.financial, f.archives, cutoff);
  assert.equal(r[0].eligible, false); assert.equal(r[0].eligibilityConflict, true);
});
test("duplicate approval identities and duplicate operating decisions cannot inflate coverage", async () => {
  const f = fixture();
  assert.equal((await coverageReviews(companies, [...f.financial, f.financial[0]], f.archives, cutoff))[0].eligibilityConflict, true);
  const decision = { ...f.archives[3], payload: { ...(f.archives[3].payload as any), extra: "second decision" } };
  decision.id = contentHash(decision.payload);
  assert.equal((await coverageReviews(companies, f.financial, [...f.archives, decision], cutoff))[0].mapping, "conflicted");
});

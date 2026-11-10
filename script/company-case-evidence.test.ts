import assert from "node:assert/strict";
import test from "node:test";
import { contentHash } from "../server/calculation/analysisManifest";
import { assessSourcedCompanyCase, assessSourcedOriginalNominalCase, pairSourcedCompanyCase } from "../server/calculation/companyCaseEvidence";

// Engineering-only contract fixture. No actual issuer or future forecast data.
function fixture() {
  const hash = "a".repeat(64), published = "2026-12-31T20:00:00.000Z";
  const frozenAt = "2026-12-31T21:00:00.000Z", referenceAt = "2026-12-31T22:00:00.000Z";
  const identity = { symbol: "TEST", cik: "0000000001", security: "Synthetic common" };
  const facts = { ...identity, issuer: "Engineering fixture only", currency: "USD", fiscalEnd: "2024-12-31",
    documentDate: "2025-02-25", observedAt: published, sourceUrl: "https://example.org/fixture",
    sourceHash: hash, textHash: hash, operatingCashFlow: 100, capitalSpend: 30,
    debtProceeds: 0, debtRepayments: 0, accountingCaveats: [] };
  const primary: any = { id: "primary", kind: "primary-disclosure", ...identity,
    url: facts.sourceUrl, sha256: hash, capturedAt: published, availableAt: published,
    publicationBasis: "verified-publication", rationale: "Engineering evidence only",
    licence: "Test fixture, not licensed market data", dependencies: [], claims: [] };
  const assumption: any = { ...primary, id: "assumption", kind: "frozen-analyst-assumption",
    capturedAt: frozenAt, availableAt: frozenAt, publicationBasis: "actual-assumption-freeze", claims: [],
    rationale: "Explicit engineering-only cash, stub and reinvestment assumptions" };
  const bind = (e: any, path: string, value: unknown) =>
    e.claims.push({ path, valueHash: contentHash(value), locator: "Engineering fixture" });
  bind(primary, "/facts", facts);
  const years = Array.from({ length: 5 }, (_, i) => ({
    year: 2027 + i, cashFlowDate: `${2027 + i}-12-31`, evidenceIds: ["assumption"],
    nonClimateRevenue: 100, climateRevenue: 0, operatingMarginBeforeClimateCostsAndCredits: .5,
    climateOperatingCost: 0, recognizedPolicyCredit: 0, cashPolicyCredit: 0, depreciation: 10,
    otherNonCash: 0, openingReceivables: 20, closingReceivables: 20,
    increaseOtherOperatingWorkingCapital: 0, interestPaid: 0, cashTax: 5, otherOperatingCash: 0,
    capitalSpend: 10, debtProceeds: 0, debtRepayments: 0, nonCommonCashClaims: 0,
  }));
  const bindings: Record<string, string[]> = {};
  years.forEach((row, i) => Object.entries(row).forEach(([key, value]) => {
    if (typeof value !== "number") return;
    const path = `/financialCashflow/years/${i}/${key}`;
    bindings[path] = ["assumption"]; bind(assumption, path, value);
  }));
  bindings["/financialCashflow/baseFcfe"] = ["primary"];
  bind(primary, "/financialCashflow/baseFcfe", 70);
  const engineInput = { ...identity, currency: "USD", referenceDate: referenceAt.slice(0, 10), frozenAt,
    firstYear: 2027, baseFcfe: 70, boundary: "whole-issuer-common-equity",
    unresolvedAccountingClaims: [], years,
    evidence: [{ id: "assumption", kind: assumption.kind, rationale: assumption.rationale,
      availableAt: frozenAt, sha256: hash }] };
  const stub = { throughDate: "2026-12-31", cashFlows: [], completenessEvidenceIds: ["assumption"],
    cashBasis: "FCFE-whole-issuer-common-equity", currency: "USD", rationale: "Engineering explicit year-end zero stub" };
  bind(assumption, "/stub", stub);
  const topics = ["discountRate", "terminalGrowth", "continuationGrowthAtYear5",
    "maintenanceAndGrowthReinvestment", "workingCapital", "cashTax", "financing",
    "nonCommonClaims", "policyExpiryAndEligibility"];
  const terminal: any = { model: "explicit-fcfe-ten-year-fade", rateBasis: "nominal",
    discountRate: .08, terminalGrowth: .02, continuationGrowthAtYear5: .02,
    sustainableYearFiveFcfe: 45,
    evidenceByTopic: Object.fromEntries(topics.map(t => [t, ["assumption"]])),
    basisByTopic: Object.fromEntries(topics.map(t => [t, `Engineering-only explicit ${t} support; no issuer inference`])) };
  for (const topic of topics) bind(assumption, `/terminal/basisByTopic/${topic}`, terminal.basisByTopic[topic]);
  for (const key of ["discountRate", "terminalGrowth", "continuationGrowthAtYear5", "sustainableYearFiveFcfe"])
    bind(assumption, `/terminal/${key}`, terminal[key]);
  const primaryShares = { symbol: identity.symbol, cik: identity.cik,
    issuer: facts.issuer, effectiveDate: "2026-12-31",
    classes: [{ security: identity.security, outstanding: 10, precision: "exact", issued: 12, treasury: 2 }],
    allCommonClassesCovered: true, evidence: { url: facts.sourceUrl, sha256: hash, capturedAt: published,
      publishedDate: "2026-12-31", publicationBasis: "issuer-filing-index", locator: "Engineering fixture" } };
  const reference = { ...identity, currency: "USD", referenceDate: "2026-12-31", priceDate: "2026-12-31",
    sharesDate: "2026-12-31", price: 100, shares: 10, sourceUrl: facts.sourceUrl, sourceHash: hash,
    observedAt: referenceAt, usageAuthorization: "Engineering-only fixture", sharesBasis: "total-common-outstanding-not-diluted-or-float" };
  bind(primary, "/market/reference", reference); bind(primary, "/market/primaryShares", primaryShares);
  return { version: "sourced-company-case-1", facts, referenceAt, frozenAt, evidence: [primary, assumption],
    financialBasisEvidenceIds: ["primary"], financialCashflow: { engineInput, bindings },
    stub, terminal, market: { reference, quoteAt: referenceAt, quoteEvidenceIds: ["primary"],
      shareEvidenceIds: ["primary"], primaryShares }, unresolvedClaims: [] };
}

test("Explicit sourced contract invokes existing cash ledger but confers no valuation/approval", () => {
  const a = assessSourcedCompanyCase(fixture());
  assert.equal(a.status, "dependency-ready-conditional-case");
  assert.deepEqual(a.gaps, []);
  assert.equal(a.ledger!.years[0].fcfe, 45);
  assert.equal(a.actualMarketPairs, 0);
  assert.equal(a.completeApprovedIssuerCases, 0);
  assert.equal(a.identityApproved, false);
});
test("Missing stub/terminal/schedules are dependencies, never zero or perpetuities", () => {
  const x = fixture();
  const a = assessSourcedCompanyCase({ ...x, financialCashflow: null, stub: null, terminal: null });
  assert.equal(a.status, "blocked");
  assert.ok(a.gaps.some(g => g.includes("stub")));
  assert.ok(a.gaps.some(g => g.includes("terminal")));
  assert.equal(a.ledger, null);
});
test("Frozen assumptions cannot be backdated; field-level tampering and unknown sources refuse", () => {
  const x = fixture();
  x.evidence[1].availableAt = "2027-01-01T00:00:00.000Z";
  assert.ok(assessSourcedCompanyCase(x).gaps.some(g => g.includes("unavailable at reference")));
  const y = fixture();
  y.financialCashflow.engineInput.years[0].capitalSpend = 20;
  assert.ok(assessSourcedCompanyCase(y).gaps.some(g => g.includes("does not bind")));
  y.financialCashflow.bindings["/financialCashflow/years/0/capitalSpend"] = ["unknown"];
  assert.ok(assessSourcedCompanyCase(y).gaps.some(g => g.includes("Missing evidence: unknown")));
});
test("No ticker-only successor/class merge or marketCap/price share inference", () => {
  const x = fixture();
  x.market.reference.cik = "0000000002";
  assert.ok(assessSourcedCompanyCase(x).gaps.some(g => g.includes("succession review")));
  const y = fixture();
  y.market.reference.shares = 11;
  assert.ok(assessSourcedCompanyCase(y).gaps.some(g => g.includes("exact same-date primary")));
  const z = fixture();
  z.market.quoteEvidenceIds = ["assumption"];
  assert.ok(assessSourcedCompanyCase(z).gaps.some(g => g.includes("not analyst assumptions")));
});
test("Distinct FY2025 anchor cannot silently replace selected FY2024 facts", () => {
  const x = fixture();
  x.financialCashflow.engineInput.baseFcfe = 75;
  assert.ok(assessSourcedCompanyCase(x).gaps.some(g => g.includes("FY2024")));
});
test("Original nominal adapter withholds missing original evidence, never treating FCFE as earnings", () => {
  const a = assessSourcedOriginalNominalCase(fixture(), { baseEarnings: 70, discountRate: .08,
    returnOnEquity: .2, stageOneGrowth: .05, sharesBasis: "total-equity", rateBasis: "nominal",
    returnOnEquityEvidence: "Engineering only", discountRateEvidence: "Engineering only" }, {});
  assert.equal(a.originalNominalAssessment, null);
  assert.ok(a.gaps.some(g => g.includes("/originalNominal/baseEarnings")));
});
test("Availability, evidence cycles, terminal mismatches and stub coverage fail explicitly", () => {
  const x = fixture();
  x.evidence[0].publicationBasis = "signed-report-only";
  assert.ok(assessSourcedCompanyCase(x).gaps.some(g => g.includes("public availability")));
  const y = fixture();
  y.evidence[1].dependencies = ["assumption"];
  assert.throws(() => assessSourcedCompanyCase(y), /Cyclic/);
  const z = fixture();
  z.terminal.sustainableYearFiveFcfe = 46;
  assert.ok(assessSourcedCompanyCase(z).gaps.some(g => g.includes("does not reconcile")));
  const s = fixture();
  s.stub.throughDate = "2027-01-01";
  assert.throws(() => assessSourcedCompanyCase(s), /Stub must cover/);
});
test("Value-bound original earnings inputs delegate to separate original 2.5–4% assessment", () => {
  const x = fixture();
  const original = { baseEarnings: 60, discountRate: .08, returnOnEquity: .2, stageOneGrowth: .05,
    sharesBasis: "total-equity" as const, rateBasis: "nominal" as const,
    returnOnEquityEvidence: "Engineering-only supported return", discountRateEvidence: "Engineering-only nominal r" };
  const bindings: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(original)) {
    const path = `/originalNominal/${key}`;
    const e = key === "baseEarnings" ? x.evidence[0] : x.evidence[1];
    e.claims.push({ path, valueHash: contentHash(value), locator: "Engineering original-model fixture" });
    bindings[path] = [e.id];
  }
  const result = assessSourcedOriginalNominalCase(x, original, bindings);
  assert.equal(result.status, "dependency-ready-conditional-case");
  assert.equal(result.originalNominalAssessment!.status, "conditional-assessment");
  if (result.originalNominalAssessment!.status === "conditional-assessment")
    assert.deepEqual(result.originalNominalAssessment!.terminalRange.grid, [.025, .03, .035, .04]);
  assert.equal(result.actualMarketPairs, 0);
});
test("Sourced prospective model accepts known prior close after actual forecast freeze without inventing shares", () => {
  const x = fixture();
  x.market.quoteAt = "2026-12-30T22:00:00.000Z";
  x.market.reference.priceDate = "2026-12-30";
  x.market.reference.sharesDate = "2026-12-30";
  x.market.primaryShares.effectiveDate = "2026-12-30";
  for (const [path, value] of [
    ["/market/reference", x.market.reference], ["/market/primaryShares", x.market.primaryShares],
  ] as const) x.evidence[0].claims.find((c: any) => c.path === path)!.valueHash = contentHash(value);
  const prospective = { ...x, assessmentMode: "prospective-conditional", informationCutoff: x.referenceAt };
  const a = pairSourcedCompanyCase(prospective);
  assert.equal(a.assessment.status, "dependency-ready-conditional-case");
  assert.equal(a.pairing?.pairing, "conditional-same-basis-whole-equity");
  assert.equal(assessSourcedCompanyCase(x).status, "blocked", "Historical exact timestamp/reference remains strict");
  x.market.reference.shares = 11;
  assert.ok(assessSourcedCompanyCase({ ...x, assessmentMode: "prospective-conditional" }).gaps.some(g =>
    g.includes("exact same-date primary")));
});

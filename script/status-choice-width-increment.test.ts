import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import express from "express";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { registerProspectiveValuationChoices, assessProspectiveValuationBranch } from "../server/calculation/prospectiveValuationChoices";
import { registerProspectiveWidth, evaluateProspectiveWidth } from "../server/calculation/prospectiveAssumptionWidth";
import { scientificEvidenceApiConsumers, scientificEvidenceApiConsumer, scientificEvidenceStatusRows } from "../shared/scientificEvidenceConsumers";
import { scientificEvidenceStatuses } from "../shared/scientificEvidence";
import { ScientificEvidenceStrands } from "../client/src/components/scientific-evidence-strands";
import { registerScientificEvidenceApi } from "../server/scientificEvidenceApi";
import { fairArtifactCatalog } from "../server/calculation/fairArtifactCatalog";
import { calculationReadiness } from "../server/calculation/readiness";
import { prospectiveResearchHandler } from "../server/prospectiveResearchApi";

(globalThis as any).React = React;
// All numeric inputs below are synthetic engineering fixtures, not new study
// thresholds, rates or source evidence for an issuer or historical corpus.
const choices = () => ({
  version: "prospective-valuation-choices-1", studyId: "engineering-unscored-only",
  cashFlowBasis: { primary: "FCFE", primaryDiscount: "cost-of-equity",
    crossCheck: "unavailable", debtReliabilityRule: "Debt data absent in engineering fixture" },
  cashFlows: { operatingCashFlowFormula: "OCF-capex+netBorrowing",
    earningsFormula: "netIncome+nonCashCharges-capex-increaseWorkingCapital+netBorrowing",
    interestClassification: "Fixture requires explicit accounting reconciliation",
    reinvestmentReturnOnCapitalRule: "Positive growth funded from earnings using supported ROE" },
  discountRate: { betaMonths: 60, shrinkageTarget: 1, shrinkageWeight: .5,
    benchmarkDefinition: "Engineering benchmark only", riskFreeRange: { minimum: .02, maximum: .04 },
    equityRiskPremiumRange: { minimum: .04, maximum: .06 },
    observedDebtCostRule: "Unavailable without observed debt evidence", commonRateVariant: .08, rateBasis: "nominal" },
  financials: { method: "not-modelled", reason: "No validated residual-income implementation supplied" },
  lossMakers: { method: "history-or-close-peer-supported-normalised-margin-else-no-defensible-solution",
    historyOrPeerEligibilityRule: "Explicitly support comparability before using margin",
    marginIdentificationRule: "Require identified positive margin and source reference" },
});
const branch = () => ({
  registerHash: registerProspectiveValuationChoices(choices()).registerHash,
  businessType: "non-financial", revenue: 1000, netIncome: -1,
  normalisedMargin: .1, marginEvidence: { basis: "company-history",
    sourceReferences: ["engineering-only"], identificationExplanation: "Synthetic margin support, not issuer evidence" },
  discountRate: .08, terminalGrowth: .03, returnOnEquity: .2, stageOneGrowth: .05,
  returnOnEquityEvidence: "engineering-only", discountRateEvidence: "engineering-only",
});
const widthSpec = () => ({
  version: "prospective-assumption-width-1", studyId: "engineering-unscored-only",
  thresholdProvenance: "new-unscored-prospective-assumptions-not-original-thresholds",
  ownerConfirmationReference: null,
  segments: [{ segmentId: "engineering-segment", measure: "synthetic activity change", unit: "fixture units", horizon: "fixture horizon",
    metric: "maximum-minus-minimum-across-all-declared-assumption-sets",
    assumptions: ["a", "b", "c"].map(id => ({ id, commodityPriceDeck: "fixture deck",
      margins: "fixture margin", discountRate: "fixture rate", capitalAllocation: "fixture allocation",
      otherAssumptions: [], defensibilityReferences: ["engineering-only"] })),
    thresholds: { looser: 5, tighter: 2 } }],
});
const widthResults = () => ({
  registerHash: registerProspectiveWidth(widthSpec()).registerHash,
  segments: [{ segmentId: "engineering-segment", measure: "synthetic activity change", unit: "fixture units", horizon: "fixture horizon",
    results: [{ assumptionId: "a", value: -1, unavailableReason: null },
      { assumptionId: "b", value: 1, unavailableReason: null }, { assumptionId: "c", value: 4, unavailableReason: null }] }],
});

test("S11-001 prospective register covers all five original children without historic timing claims", () => {
  const r = registerProspectiveValuationChoices(choices());
  assert.equal(r.status, "unscored-prospective-specification");
  assert.match(r.originalPreBuildTiming, /unknown/);
  assert.equal(r.modelSelectionRun, false);
  assert.equal(r.productionEligible, false);
  for (const child of ["cashFlowBasis", "cashFlows", "discountRate", "financials", "lossMakers"]) {
    const x: any = choices(); delete x[child];
    assert.throws(() => registerProspectiveValuationChoices(x));
  }
  const corrected: any = choices();
  corrected.cashFlows.operatingCashFlowFormula = "OCF-capex-increaseWorkingCapital+netBorrowing";
  assert.throws(() => registerProspectiveValuationChoices(corrected));
  assert.throws(() => registerProspectiveValuationChoices({ ...choices(), frozenAt: "2010-01-01" }));
});

test("S11-001 financials and unsupported loss-makers are explicit unscored unavailable branches", () => {
  for (const businessType of ["bank", "insurer"])
    assert.equal(assessProspectiveValuationBranch(choices(), { ...branch(), businessType }).status, "not-modelled");
  for (const amendment of [{ marginEvidence: null }, { normalisedMargin: null }, { normalisedMargin: -.1 },
    { normalisedMargin: 1.1 }, { revenue: null }, { revenue: 0 }, { netIncome: null }])
    assert.equal(assessProspectiveValuationBranch(choices(), { ...branch(), ...amendment }).status, "no-defensible-solution");
  assert.throws(() => assessProspectiveValuationBranch(choices(), { ...branch(), registerHash: "a".repeat(64) }));
});

test("S11-001 supported recovery is revenue times margin with funded reinvestment, never primary FCFE or selection", () => {
  const r = assessProspectiveValuationBranch(choices(), branch());
  assert.equal(r.status, "conditional-assessment");
  if (r.status !== "conditional-assessment") throw new Error("Missing conditional branch");
  assert.equal(r.baseEarnings, 100);
  assert.equal(r.projection.years[0].reinvestmentRate, .25);
  assert.match(r.basis, /not the FCFE primary or D8/);
  assert.equal(r.modelSelectionRun, false);
  assert.equal(r.scientificAcceptance, false);
  assert.equal(assessProspectiveValuationBranch(choices(), { ...branch(), stageOneGrowth: .3 }).status, "no-defensible-solution");
  assert.equal(assessProspectiveValuationBranch(choices(), { ...branch(), terminalGrowth: .04, discountRate: .04 }).status, "no-defensible-solution");
});

test("S13-010 width has no invented original threshold and no numeric defaults", () => {
  const r = registerProspectiveWidth(widthSpec());
  assert.equal(r.ownerConfirmation, "missing");
  assert.match(r.originalThresholds, /unknown/);
  assert.equal(r.marketExpectationClaim, false);
  const noThreshold: any = widthSpec(); delete noThreshold.segments[0].thresholds;
  assert.throws(() => registerProspectiveWidth(noThreshold));
  assert.throws(() => registerProspectiveWidth({ ...widthSpec(), thresholdProvenance: "original-approved" }));
  const reversed = widthSpec(); reversed.segments[0].thresholds.tighter = 6;
  assert.throws(() => registerProspectiveWidth(reversed));
});

test("S13-010 full envelope is strict, both sets reported and width never grants identification", () => {
  const r = evaluateProspectiveWidth(widthSpec(), widthResults());
  assert.equal(r.segments[0].width, 5);
  assert.equal(r.segments[0].looser, false, "equal width does not satisfy narrower");
  assert.equal(r.segments[0].tighter, false);
  const input = widthResults(); input.segments[0].results[2].value = 0;
  const narrow = evaluateProspectiveWidth(widthSpec(), input);
  assert.equal(narrow.segments[0].width, 2);
  assert.equal(narrow.segments[0].looser, true);
  assert.equal(narrow.segments[0].tighter, false);
  assert.equal(narrow.marketExpectationClaim, false);
  assert.equal(narrow.identification, "not-established");
  assert.equal(narrow.oldCorpusScored, false);
});

test("S13-010 missing/null sets never yield a selected-subset range", () => {
  const partial = widthResults(); partial.segments[0].results.pop();
  const r = evaluateProspectiveWidth(widthSpec(), partial).segments[0];
  assert.equal(r.status, "unavailable");
  assert.equal(r.width, null);
  assert.deepEqual("missingAssumptions" in r && r.missingAssumptions, ["c"]);
  const missing: any = widthResults();
  missing.segments[0].results[2] = { assumptionId: "c", value: null, unavailableReason: "Not observed" };
  assert.equal(evaluateProspectiveWidth(widthSpec(), missing).segments[0].width, null);
  missing.segments[0].results[2].unavailableReason = null;
  assert.throws(() => evaluateProspectiveWidth(widthSpec(), missing));
});

test("S13-010 duplicate/undeclared domains, mismatch hashes and incompatible quantities refuse", () => {
  for (const mutate of [
    (x: any) => { x.registerHash = "a".repeat(64); },
    (x: any) => { x.segments = []; },
    (x: any) => { x.segments.push(x.segments[0]); },
    (x: any) => { x.segments[0].unit = "different"; },
    (x: any) => { x.segments[0].measure = "different"; },
    (x: any) => { x.segments[0].horizon = "different"; },
    (x: any) => { x.segments[0].results.push(x.segments[0].results[0]); },
    (x: any) => { x.segments[0].results[0].assumptionId = "undeclared"; },
    (x: any) => { x.segments[0].results[0].value = NaN; },
  ]) { const x = widthResults(); mutate(x); assert.throws(() => evaluateProspectiveWidth(widthSpec(), x)); }
  const changed = widthSpec(); changed.segments[0].thresholds.looser = 6;
  assert.throws(() => evaluateProspectiveWidth(changed, widthResults()), /hash mismatch/);
});

test("S07-003 finite route matcher includes all retained artifact routes, not unrelated/private operations", () => {
  assert.equal(scientificEvidenceApiConsumers.length, 24);
  for (const [method, path] of scientificEvidenceApiConsumers)
    assert.equal(scientificEvidenceApiConsumer(method, path.replace(":artifactId", "fixture").replace(":memberId", "member")), true);
  for (const [method, path] of [["GET", "/api/projection/unknown"], ["POST", "/api/refresh"],
    ["POST", "/api/projection"], ["GET", "/api/calculation/fair-artifacts/a/summary/extra"]])
    assert.equal(scientificEvidenceApiConsumer(method, path), false);
});

test("S07-003 actual middleware and compact UI use identical three statuses with no body/pin mutation", () => {
  const app = express(); let middleware: any;
  app.use = ((handler: unknown) => { middleware = handler; return app; }) as any;
  registerScientificEvidenceApi(app);
  const headers = new Map<string, string>(); let calls = 0;
  middleware({ method: "GET", path: "/api/projection" },
    { set: (key: string, value: string) => headers.set(key, value) }, () => calls++);
  assert.equal(calls, 1);
  const html = renderToStaticMarkup(React.createElement(ScientificEvidenceStrands, { compact: true }));
  for (const row of scientificEvidenceStatusRows()) {
    assert.equal(headers.get(`X-Scientific-Evidence-${row.key}`), row.status);
    assert.ok(html.includes(`data-evidence-status="${row.status}"`));
    assert.equal(row.status, scientificEvidenceStatuses()[row.key].status);
  }
  assert.equal(calculationReadiness().candidateEnabled, false);
  // Inspected source has 16 pins (4 reference/history plus 12 infill), despite
  // the task shorthand "14". Preserve the exact existing catalog, not that count.
  assert.equal(fairArtifactCatalog.length, 16);
  assert.equal(createHash("sha256").update(readFileSync("server/calculation/fairArtifactCatalog.ts")).digest("hex"),
    "448441232d3d9cd6d05442a6ee0756f667ee947308fdc947f94284a322a32e0c");
  assert.ok(fairArtifactCatalog.every(a => a.manifest.productionEligible === false && a.manifest.scientificAcceptance === "not-accepted"));
});

test("S07-003 chart consumers actually mount shared statuses, not invented chart passes", () => {
  for (const name of ["emissions-chart", "temperature-histogram", "sensitivity-chart", "regional-comparison", "category-trend-chart", "temperature-gauge", "category-comparison", "historical-trend-chart"])
    assert.match(readFileSync(`client/src/components/${name}.tsx`, "utf8"), /<ScientificEvidenceStrands compact \/>/);
  const routes = readFileSync("server/prospectiveResearchApi.ts", "utf8");
  for (const operation of ["prospective-valuation-choices", "prospective-valuation-branch", "prospective-width-specification", "prospective-assumption-width"])
    assert.ok(routes.includes(`case "${operation}"`));
  const frozen = readFileSync("server/routes.ts", "utf8");
  assert.ok(!frozen.includes("prospective-valuation-choices"));
  assert.ok(!frozen.includes("registerScientificEvidenceApi"));
  const index = readFileSync("server/index.ts", "utf8");
  assert.ok(index.includes("registerScientificEvidenceApi(app)"));
  assert.ok(index.includes("registerProspectiveResearchApi(app)"));
});

test("prospective additive API executes four operations, refuses bad inputs and preserves original fallthrough", () => {
  for (const body of [
    { operation: "prospective-valuation-choices", input: choices() },
    { operation: "prospective-valuation-branch", choices: choices(), input: branch() },
    { operation: "prospective-width-specification", input: widthSpec() },
    { operation: "prospective-assumption-width", specification: widthSpec(), input: widthResults() },
  ]) {
    let payload: any; let code = 200; let nextCalls = 0;
    const res: any = { set: () => res, status: (value: number) => { code = value; return res; },
      json: (value: unknown) => { payload = value; return res; } };
    prospectiveResearchHandler({ body } as any, res, () => { nextCalls++; });
    assert.equal(code, 200);
    assert.equal(nextCalls, 0);
    assert.equal(payload.status, "submitted-input-diagnostic");
    assert.equal(payload.modelPromoted, false);
  }
  let code = 200; let nextCalls = 0;
  const res: any = { status: (value: number) => { code = value; return res; }, json: () => res };
  prospectiveResearchHandler({ body: { operation: "prospective-valuation-choices", input: {} } } as any,
    res, () => { nextCalls++; });
  assert.equal(code, 422);
  prospectiveResearchHandler({ body: { operation: "member-metrics", input: {} } } as any,
    res, () => { nextCalls++; });
  assert.equal(nextCalls, 1);
});

test("increment evidence hashes and remaining criteria are source-exact, no completion promotion", () => {
  const evidence = JSON.parse(readFileSync("docs/status-choice-width-increment-evidence.json", "utf8"));
  assert.equal(evidence.scientificAcceptance, false);
  assert.equal(evidence.oldCorpusScored, false);
  for (const source of evidence.sources)
    assert.equal(createHash("sha256").update(readFileSync(source.path)).digest("hex"), source.sha256, source.path);
  for (const criterion of ["S07-003", "S11-001", "S13-010"])
    assert.ok(evidence.remainingCriteria[criterion].length);
});

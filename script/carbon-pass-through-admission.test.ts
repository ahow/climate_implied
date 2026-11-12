import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  admitCarbonPassThroughRegister, calculateQualifiedCarbonDrag, getCarbonPassThroughReview,
} from "../server/calculation/carbonPassThroughAdmission";
import {
  carbonPassThroughEvidence, carbonPassThroughSources,
} from "../shared/carbonPassThroughEvidence";
import { registerCarbonPassThroughRoutes, CARBON_PASS_THROUGH_ROUTE } from "../server/carbonPassThroughApi";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";

// Synthetic component inputs only. These are NOT issuer observations, forecasts or studies.
function fixture() {
  const ref = ["synthetic-accounting-evidence-not-issuer-qualified"];
  return {
    assumption: {
      version: "s12-007-qualified-drag-assumption-1", evidenceId: "ce2015-petrol-DE",
      sector: "petroleum-refining", product: "petrol", jurisdiction: "DE", regime: "EU-ETS-phase2-3",
      projectionYear: 2030, recoveryFraction: .8, channel: "direct-scope1-same-cost-recovery",
      temporalTransferRationale: "Synthetic future-transfer assertion tests explicit declaration, not empirical validity.",
      denominatorReconciliationEvidence: ref, issuerOperatingExposureEvidence: ref, incrementalLiabilityEvidence: ref,
      collectionAndTaxTreatmentEvidence: ref, baselineExcludesCarbonCostAndRecoveryEvidence: ref,
      classification: "analyst-assumption-not-source-observation",
    },
    input: {
      scope: "scope1", year: 2030, currency: "EUR", incrementalLiableTonnesNetAllocation: 100,
      incrementalEffectivePricePerTonne: 10, priceBasis: "increment-above-cost-already-in-baseline",
      accountingBasis: "pre-tax-accrual-not-common-cash",
    },
  };
}

test("register preserves original points, exact windows, and >100% without clipping", () => {
  const review = getCarbonPassThroughReview();
  const frozen = JSON.stringify(review);
  assert.ok(bindNestedOutput("carbonPassThroughReview", review).length > 50);
  assert.equal(JSON.stringify(review), frozen);
  assert.throws(() => bindNestedOutput("carbonPassThroughReview", { unreviewedField: 1 }), /Unmapped/);
  assert.match(requireOutputSemantic("carbonPassThroughReview.evidence[].reported.value").formula, /1.17 preserved/);
  assert.match(requireOutputSemantic("carbonPassThroughReview.evidence[].reported.interval").meaning, /No numerical source interval/);
  assert.equal(review.sources.length, 2);
  assert.equal(review.evidence.length, 10);
  const peak = review.evidence.find(r => r.id === "sijm-2006-DE-peak")!;
  assert.equal(peak.reported.kind, "point-with-bootstrap-span");
  if (peak.reported.kind === "point-with-bootstrap-span") {
    assert.equal(peak.reported.value, 1.17);
    assert.deepEqual([peak.reported.interval.lower, peak.reported.interval.upper], [.97, 1.17]);
  }
  const petrol = review.evidence.find(r => r.id === "ce2015-petrol-DE")!;
  assert.deepEqual(petrol.observedPeriod, { start: "2008-01", end: "2013-02" });
  assert.equal(petrol.reported.kind, "point");
  const diesel = review.evidence.find(r => r.id === "ce2015-diesel-DE-not-significant")!;
  assert.equal(diesel.metric, "log-price-elasticity");
  assert.equal(review.qualifiedIssuerCases, 0);
  assert.equal(review.issuerStudiesRun, 0);
  assert.equal(review.oldCasesRetuned, false);
  assert.equal(review.productionEligible, false);
  assert.deepEqual(Object.keys(review.remainingThreeCaseInputs), ["NEE", "FSLR", "XOM"]);
  assert.deepEqual(Object.keys(review.originalOperatingCorpusIndustrialInputs), ["CAT"]);
  assert.equal(admitCarbonPassThroughRegister([...carbonPassThroughSources].reverse(),
    [...carbonPassThroughEvidence].reverse()).registerHash, review.registerHash);
});

test("admission rejects duplicates, unknown original source, malformed hash and reversed period", () => {
  assert.throws(() => admitCarbonPassThroughRegister(carbonPassThroughSources,
    [...carbonPassThroughEvidence, carbonPassThroughEvidence[0]]), /Duplicate/);
  assert.throws(() => admitCarbonPassThroughRegister(carbonPassThroughSources,
    [{ ...carbonPassThroughEvidence[0], sourceId: "secondary-summary" }]), /Unregistered/);
  assert.throws(() => admitCarbonPassThroughRegister([{ ...carbonPassThroughSources[0], sha256: "fake" }], carbonPassThroughEvidence));
  assert.throws(() => admitCarbonPassThroughRegister(carbonPassThroughSources,
    [{ ...carbonPassThroughEvidence[0], observedPeriod: { start: "2006-01", end: "2005-01" } }]));
});

test("qualified standalone same-cost component reconciles but never claims cash or production eligibility", () => {
  const { assumption, input } = fixture();
  const result = calculateQualifiedCarbonDrag(assumption, input);
  assert.equal(result.grossIncrementalCost, 1000);
  assert.equal(result.assumedSameCostRecovery, 800);
  assert.equal(result.carbonDrag, 200);
  assert.equal(result.productionEligible, false);
  assert.equal(result.assumption.classification, "analyst-assumption-not-source-observation");
  assert.equal("fcfe" in result, false);
  assert.equal("profit" in result, false);
  assert.notEqual(calculateQualifiedCarbonDrag({ ...assumption, temporalTransferRationale: "changed synthetic rationale" }, input).assumptionHash,
    result.assumptionHash);
  assert.throws(() => calculateQualifiedCarbonDrag({ ...assumption, recoveryFraction: .81 }, input), /invented literature interval/);
  assert.throws(() => calculateQualifiedCarbonDrag({ ...assumption, temporalTransferRationale: "" }, input));
  assert.throws(() => calculateQualifiedCarbonDrag({ ...assumption, denominatorReconciliationEvidence: [] }, input));
});

test("no geographic/sector/regime extrapolation, Scope2/3 confusion, elasticity or >100% clipping", () => {
  const { assumption: a, input: x } = fixture();
  for (const patch of [{ jurisdiction: "US" }, { sector: "machinery" }, { regime: "UK-ETS" }, { product: "CCS" }])
    assert.throws(() => calculateQualifiedCarbonDrag({ ...a, ...patch }, x), /mismatch/);
  for (const scope of ["scope2", "scope3"]) assert.throws(() => calculateQualifiedCarbonDrag(a, { ...x, scope }));
  assert.throws(() => calculateQualifiedCarbonDrag({ ...a, evidenceId: "sijm-2006-NL-peak" }, x), /electricity price formation/);
  assert.throws(() => calculateQualifiedCarbonDrag({ ...a, evidenceId: "ce2015-diesel-DE-not-significant" }, x), /elasticity/);
  assert.throws(() => calculateQualifiedCarbonDrag({ ...a, evidenceId: "ce2015-diesel-FR-above100", product: "diesel",
    jurisdiction: "FR", recoveryFraction: 1 }, x), /Unbounded/);
  assert.throws(() => calculateQualifiedCarbonDrag(a, { ...x, year: 2031 }), /years differ/);
  assert.throws(() => calculateQualifiedCarbonDrag(a, { ...x, incrementalEffectivePricePerTonne: Infinity }));
  assert.throws(() => calculateQualifiedCarbonDrag(a, { ...x, incrementalLiableTonnesNetAllocation: Number.MAX_VALUE }), /Nonfinite/);
  assert.throws(() => calculateQualifiedCarbonDrag(a, { ...x, accountingBasis: "common-cash" }));
});

test("public GET and JSON export return identical admitted evidence; no calculation endpoint", () => {
  const handlers = new Map<string, Function>();
  registerCarbonPassThroughRoutes({ get: (path: string, handler: Function) => handlers.set(path, handler) } as any);
  assert.deepEqual([...handlers.keys()], [CARBON_PASS_THROUGH_ROUTE, `${CARBON_PASS_THROUGH_ROUTE}/export.json`]);
  function invoke(path: string, query = {}) {
    let body: any, status = 200;
    const res = { setHeader() {}, attachment() {}, json(value: unknown) { body = value; },
      status(code: number) { status = code; return res; } };
    handlers.get(path)!({ query }, res);
    return { body, status };
  }
  assert.deepEqual(invoke(CARBON_PASS_THROUGH_ROUTE), invoke(`${CARBON_PASS_THROUGH_ROUTE}/export.json`));
  assert.equal(invoke(CARBON_PASS_THROUGH_ROUTE, { recoveryFraction: ".8" }).status, 400);
  assert.equal(invoke(CARBON_PASS_THROUGH_ROUTE).body.registerHash, getCarbonPassThroughReview().registerHash);
});

test("separate pre-study protocol remains frozen; consumer source binding is explicit opt-in", () => {
  const protocol = readFileSync("docs/carbon-pass-through-protocol.json");
  assert.equal(createHash("sha256").update(protocol).digest("hex"), getCarbonPassThroughReview().protocolSha256);
  assert.equal(JSON.parse(protocol.toString()).frozenBeforeNumericalStudies, true);
  const consumer = readFileSync("server/calculation/companyProjection.ts", "utf8");
  assert.match(consumer, /qualifiedPassThrough: qualifiedProjectionPassThroughSchema.optional/);
  assert.match(consumer, /if \(p.qualifiedPassThrough\)/);
});

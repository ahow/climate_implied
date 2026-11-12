import test from "node:test";
import assert from "node:assert/strict";
import { projectCompanyMembers } from "../server/calculation/companyProjection";
import { contentHash } from "../server/calculation/analysisManifest";
import { carbonPassThroughEvidence } from "../shared/carbonPassThroughEvidence";
import { getCarbonPassThroughReview } from "../server/calculation/carbonPassThroughAdmission";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { exportCompanyProjectionReplay } from "../server/calculation/companyProjectionReplay";
import * as XLSX from "xlsx";

function fixture(qualified = false): any {
  const refs = ["synthetic-consumer-accounting-reference-not-issuer-evidence"];
  const companyId = "synthetic-refinery-not-an-actual-issuer";
  return {
    companyId, manifestId: "synthetic-consumer-only", currency: "EUR", businessType: "non-financial",
    baseYear: 2026, baseRevenue: 10000, baseFcfe: 500,
    baseEmissionsTonnes: { scope1: 100, scope2: 50, scope3: 1000 },
    marginBounds: { minimum: .05, maximum: .2, evidence: refs },
    mapping: { basis: "operating-geography", evidence: refs,
      shares: [{ region: "DE", sector: "petroleum-refining", weight: 1 }] },
    members: ["synthetic-a", "synthetic-b"].map(id => ({
      id, years: Array.from({ length: 5 }, (_, i) => ({
        year: 2027 + i, exposures: [{ region: "DE", sector: "petroleum-refining", activityGrowth: 0 }],
        marketShareMultiplier: 1, operatingMargin: .1, taxRate: .2, interest: 0, depreciation: 100,
        capex: 100, increaseWorkingCapital: 0, netBorrowing: 0, nonOperatingIncome: 0,
        incomeAttributionAdjustment: 0, otherCashAdjustments: 0,
        scope1IntensityMultiplier: 1, scope2IntensityMultiplier: 1, scope3IntensityMultiplier: 1,
        scope1LiableFraction: .5, scope2LiableFraction: 0, effectiveCarbonPrice: 10, passThrough: qualified ? 0 : .8,
        ...(qualified ? { qualifiedPassThrough: {
          companyId, treatment: "replace-legacy-drag-with-qualified-incremental-scope1-component",
          priceBasis: "increment-above-cost-already-in-baseline", accountingBasis: "pre-tax-accrual-not-common-cash",
          cashBridge: { classification: "analyst-declared-not-observed-cash",
            workingCapitalCollectionTimingEvidence: refs, cashTaxRealizationEvidence: refs,
            noDuplicateRevenueMarginRecoveryEvidence: refs },
          assumption: {
            version: "s12-007-qualified-drag-assumption-1", evidenceId: "ce2015-petrol-DE",
            sector: "petroleum-refining", product: "petrol", jurisdiction: "DE", regime: "EU-ETS-phase2-3",
            projectionYear: 2027 + i, recoveryFraction: .8, channel: "direct-scope1-same-cost-recovery",
            temporalTransferRationale: "Synthetic temporal transfer for consumer tests only, not an actual issuer forecast.",
            denominatorReconciliationEvidence: refs, issuerOperatingExposureEvidence: refs,
            incrementalLiabilityEvidence: refs, collectionAndTaxTreatmentEvidence: refs,
            baselineExcludesCarbonCostAndRecoveryEvidence: refs,
            classification: "analyst-assumption-not-source-observation",
          },
        } } : {}),
      })),
    })),
  };
}
function projection(x: any) {
  const result = projectCompanyMembers(x);
  if (result.status !== "conditional-projection") throw new Error("Expected conditional projection");
  return result;
}

test("actual projection consumer uses derived Scope1 incremental tonnes and qualified drag in existing tax/FCFE arithmetic", () => {
  const x = fixture(true), result = projection(x), first = result.members[0].years[0];
  assert.equal(first.carbonDragQualification?.component.grossIncrementalCost, 500);
  assert.equal(first.carbonDragQualification?.component.assumedSameCostRecovery, 400);
  assert.equal(first.carbonDrag, 100);
  assert.equal(first.cashTax, 180);
  assert.equal(first.netIncome, 720);
  assert.equal(first.fcfe, 720);
  assert.equal(first.carbonDragQualification?.component.productionEligible, false);
  assert.equal(first.carbonDragQualification?.cashBridge.classification, "analyst-declared-not-observed-cash");
  assert.ok(bindNestedOutput("companyProjection.carbonDragQualification", first.carbonDragQualification).length > 50);
  assert.match(requireOutputSemantic("companyProjection.carbonDragQualification.component.carbonDrag").formula, /grossIncrementalCost - assumedSameCostRecovery/);
  assert.throws(() => bindNestedOutput("companyProjection.carbonDragQualification", { commonCashValidated: true }), /Unmapped/);
  const scope3 = structuredClone(x); scope3.baseEmissionsTonnes.scope3 = 999999;
  assert.equal(projection(scope3).members[0].years[0].fcfe, first.fcfe);
  const liability = structuredClone(x); liability.members[0].years[0].scope1LiableFraction = 1;
  assert.equal(projection(liability).members[0].years[0].carbonDrag, 200);
  assert.notEqual(projection(liability).inputHash, result.inputHash);
});

test("legacy raw passThrough remains unqualified and unchanged in arithmetic, output shape and input identity", () => {
  const x = fixture(false), result = projection(x), first = result.members[0].years[0];
  assert.equal(first.carbonDrag, 100 * .5 * 10 * (1 - .8));
  assert.equal(first.fcfe, (1000 - first.carbonDrag) * .8);
  assert.equal("carbonDragQualification" in first, false);
  assert.equal(result.inputHash, contentHash(x));
  assert.equal(result.claim, "conditional company operating projection; not empirically validated");
  // New provenance does not alter the numerical ledger when both explicit choices coincide.
  const qualified = projection(fixture(true));
  assert.ok(Math.abs(qualified.members[0].years[0].fcfe - first.fcfe) < 1e-10);
  assert.notEqual(qualified.inputHash, result.inputHash);
});

test("actual consumer rejects source/channel/economic-basis mismatches and missing cash bridge", () => {
  const reject = (mutate: (x: any, y: any, q: any) => void, pattern?: RegExp) => {
    const x = fixture(true), y = x.members[0].years[0], q = y.qualifiedPassThrough;
    mutate(x, y, q);
    if (pattern) assert.throws(() => projection(x), pattern);
    else assert.throws(() => projection(x));
  };
  reject((_x, y) => { y.scope2LiableFraction = .1; }, /Scope2/);
  reject((_x, y) => { y.passThrough = .8; }, /legacy raw/);
  reject((_x, _y, q) => { q.companyId = "different-issuer"; }, /issuer mismatch/);
  reject((x) => { x.mapping.basis = "headquarters-fallback"; }, /operating geography/);
  reject((_x, _y, q) => { q.assumption.jurisdiction = "US"; }, /operating geography/);
  reject((_x, _y, q) => { q.assumption.regime = "UK-ETS"; }, /regime mismatch/);
  reject((_x, _y, q) => { q.assumption.evidenceId = "sijm-2006-DE-peak"; }, /electricity price formation/);
  reject((_x, _y, q) => { q.assumption.evidenceId = "ce2015-diesel-DE-not-significant"; }, /elasticity/);
  reject((_x, _y, q) => { q.priceBasis = "total-carbon-price-already-in-margin"; });
  reject((_x, _y, q) => { q.accountingBasis = "source-observed-common-cash"; });
  reject((_x, _y, q) => { q.cashBridge.workingCapitalCollectionTimingEvidence = []; });
  reject((_x, _y, q) => { q.assumption.recoveryFraction = .7; }, /invented literature interval/);
  reject((_x, _y, q) => { q.assumption.channel = "scope3-product-use"; });
});

test("source facts retain >100% and insignificant coefficient is never treated as zero recovery", () => {
  const protocol = readFileSync("docs/carbon-pass-through-consumer-protocol.json");
  assert.equal(createHash("sha256").update(protocol).digest("hex"),
    getCarbonPassThroughReview().consumerIntegration.protocolSha256);
  const peak = carbonPassThroughEvidence.find(r => r.id === "sijm-2006-DE-peak")!;
  assert.equal(peak.reported.kind !== "lower-bound-only" && peak.reported.value, 1.17);
  const diesel = carbonPassThroughEvidence.find(r => r.id === "ce2015-diesel-DE-not-significant")!;
  assert.equal(diesel.metric, "log-price-elasticity");
  assert.equal(diesel.reported.kind !== "lower-bound-only" && diesel.reported.value, .012);
  const over = carbonPassThroughEvidence.find(r => r.id === "ce2015-diesel-FR-above100")!;
  assert.equal(over.reported.kind, "lower-bound-only");
});

test("qualified replay semantics are opt-in only; legacy workbook metadata stays exact", () => {
  function exportFixture(qualified: boolean) {
    const manifestId = contentHash("synthetic-qualified-export-metadata-only");
    const result = { ...projection(fixture(qualified)), replayManifestId: manifestId };
    const exported = exportCompanyProjectionReplay({ manifestId, result, resultHash: contentHash(result) } as any);
    const workbook = XLSX.read(exported.bytes, { type: "buffer" });
    return XLSX.utils.sheet_to_json(workbook.Sheets.Semantics, { header: 1, defval: null }) as any[][];
  }
  const legacy = exportFixture(false), qualified = exportFixture(true);
  const legacyDrag = legacy.find(row => row[0] === "companyReplay.ledger.carbonDrag")!;
  const qualifiedDrag = qualified.find(row => row[0] === "companyReplay.ledger.carbonDrag")!;
  assert.equal(legacyDrag[1], "Unpassed liable-emissions charge");
  assert.equal(legacyDrag[3], "(scope1*liable1 + scope2*liable2) * effectiveCarbonPrice * (1-passThrough)");
  assert.match(qualifiedDrag[3], /row.carbonDragQualification present/);
  assert.match(qualifiedDrag[1], /never validated common cash/);
  assert.equal(legacy.some(row => String(row[0]).startsWith("companyProjection.carbonDragQualification.")), false);
  assert.equal(qualified.some(row => row[0] === "companyProjection.carbonDragQualification.component.carbonDrag"), true);
});

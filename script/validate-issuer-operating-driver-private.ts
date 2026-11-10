import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { rebuildOperatingDriverCash, reverseOperatingDriver, extractXomOperatingMarginEnvelope } from "../server/calculation/issuerOperatingDriverReverse";
if (process.env.NODE_ENV === "production" || !process.argv.includes("--private-primary"))
  throw new Error("Explicit private-primary validator only, not code-only CI");
const root = "generated-artifacts/company-operating-corpus/issuer-operating-driver-v4";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const latest = read(`${root}/latest.json`), report = read(latest.reportPath), freeze = read(latest.freezePath);
assert.equal(sha(latest.freezePath), report.freezeHash);
assert.ok(Date.parse(freeze.frozenAt) <= Date.parse(report.scoredAt));
for (const p of [...freeze.preserve, ...freeze.sourceCode]) assert.equal(sha(p.path), p.sha256);
const oldFreeze = read(freeze.preserve[1].path), xom = oldFreeze.prepared.find((p: any) => p.symbol === "XOM");
assert.deepEqual(extractXomOperatingMarginEnvelope(readFileSync(xom.source.path, "utf8"), xom.input.reconciliation.identity), freeze.marginEnvelope);
let supported = 0, independentlyRepriced = 0, undefinedBaselineGrowth = 0, independentNonzeroCashRebuilds = 0;
for (const p of freeze.prepared) {
  const summary = report.cases.find((c: any) => c.id === p.id);
  assert.equal(summary.error, undefined);
  assert.equal(sha(summary.path), summary.sha256);
  const saved = read(summary.path);
  const replay = reverseOperatingDriver(p.curve, p.equityReference);
  assert.equal(JSON.stringify(replay), JSON.stringify(saved.result));
  assert.equal(p.market.currency, "USD");
  assert.equal(p.market.referenceDate, p.market.priceDate);
  assert.equal(p.market.priceDate, p.market.sharesDate);
  if (p.curve.driver.kind === "unsupported") { assert.equal(replay.status, "unsupported-operating-driver"); continue; }
  supported++;
  const base = rebuildOperatingDriverCash(p.curve, 0);
  const oldRows = [...p.curve.baseline.ledger.years, ...p.curve.baseline.ledger.continuationYears, p.curve.baseline.ledger.terminalYear];
  base.rows.forEach((r: any, i: number) => {
    assert.ok(Math.abs(r.fcfe - oldRows[i].fcfe) < .02);
    assert.ok(Math.abs(r.capex - oldRows[i].capitalSpend) < .02);
    assert.ok(Math.abs(r.cashTax - oldRows[i].cashTax) < .02);
  });
  // Nonzero source-bound endpoint reconciliation is a cash-engine test, NOT a
  // sampled monotonicity/uniqueness argument. The solver uses full intervals.
  const nonzero = rebuildOperatingDriverCash(p.curve, p.curve.driver.upper);
  const x = p.curve.baseline.engineInput, o = p.curve.input.reconciliation.normalized;
  const time = (year: number) => (Date.parse(`${year}-12-31T00:00:00Z`) -
    Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  let independentPv = x.stub.cashFlows.reduce((sum: number, y: any) => sum + y.fcfe /
    (1 + x.discountRate) ** ((Date.parse(`${y.date}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25)), 0);
  assert.ok(Math.abs(independentPv - nonzero.stubPresentValue) < .02);
  nonzero.rows.forEach((r: any, i: number) => {
    const baseline = oldRows[i];
    const expectedTax = p.curve.symbol === "FSLR" ? Math.max(0, .21 * (r.coreProfit - r.interest + r.otherOperatingCash)) :
      Math.max(0, baseline.cashTax + o.cashTax / (o.operatingProfit + o.otherCash - o.interest) *
        (r.coreProfit - baseline.operatingProfitBeforeClimate));
    assert.ok(Math.abs(expectedTax - r.cashTax) < .02);
    assert.ok(Math.abs(r.closingPpe - r.openingPpe + r.depreciation - r.capex +
      (baseline.capitalSpend - p.curve.baseline.funding[i + 1].cashPpe) * (p.curve.symbol === "FSLR" ? r.activityMultiplier : 1)) < .02);
    const independentCash = r.coreProfit + r.depreciation + r.otherOperatingCash + r.policyCash -
      r.receivablesIncrease - r.otherWorkingCapitalIncrease - r.interest - r.cashTax - r.capex +
      r.debtProceeds - r.debtRepayments - r.nonCommonCashClaims;
    assert.ok(Math.abs(independentCash - r.fcfe) < .02);
    independentPv += i < 15 ? independentCash / (1 + x.discountRate) ** time(r.year) :
      independentCash / (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** time(2040);
    if (p.curve.symbol === "FSLR") {
      assert.ok(r.globalWatts <= p.curve.driver.maximumGlobalWatts);
      assert.equal(r.policyCash, baseline.cashPolicyCredit);
    }
  });
  assert.ok(Math.abs(independentPv - nonzero.formalSignedCashSum) < .02);
  independentNonzeroCashRebuilds++;
  if (p.curve.symbol === "FSLR") {
    assert.ok("baselineGrowth" in replay && replay.baselineGrowth.status === "rejected-nonpositive-actual-baseline");
    undefinedBaselineGrowth++;
    assert.equal(base.statutory45xEligibilityVerified, false);
  }
  if ("rebuilt" in replay && replay.rebuilt) {
    const root = replay.rebuilt, x = p.curve.baseline.engineInput;
    const time = (year: number) => (Date.parse(`${year}-12-31T00:00:00Z`) -
      Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
    const independent = x.stub.cashFlows.reduce((sum: number, y: any) => sum + y.fcfe /
      (1 + x.discountRate) ** ((Date.parse(`${y.date}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25)), 0) +
      root.rows.slice(0, 15).reduce((sum: number, y: any) => {
        const independentCash = y.coreProfit + y.depreciation + y.otherOperatingCash + y.policyCash -
          y.receivablesIncrease - y.otherWorkingCapitalIncrease - y.interest - y.cashTax - y.capex +
          y.debtProceeds - y.debtRepayments - y.nonCommonCashClaims;
        assert.ok(Math.abs(independentCash - y.fcfe) < .02);
        return sum + independentCash / (1 + x.discountRate) ** time(y.year);
      }, 0) + root.rows[15].fcfe / (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** time(2040);
    assert.ok(Math.abs(independent / p.equityReference - 1) < 1e-8);
    assert.ok("proof" in replay && (replay.proof.lowerDerivative > 0 || replay.proof.upperDerivative < 0));
    independentlyRepriced++;
  }
}
assert.equal(report.cases.length, 18); assert.equal(supported, 12); assert.equal(undefinedBaselineGrowth, 6);
assert.equal(independentNonzeroCashRebuilds, 12);
assert.equal(report.preservedV3Pairs, 9); assert.equal(report.oldExperimentsReexecuted, false);
assert.equal(report.originalQualifiedIssuers, 0); assert.equal(report.newNetworkRequests, 0);
console.log(JSON.stringify({ status: "passed", newExperiments: 18, supportedOperatingRebuilds: supported,
  unsupportedConsolidatedNeeDrivers: 6, nonpositiveActualFslrBaselineGrowthRejections: undefinedBaselineGrowth,
  independentNonzeroCashRebuilds,
  independentlyRepricedOperatingTargets: independentlyRepriced, preservedImmutableV3Pairs: 9,
  originalQualifiedIssuers: 0, originalQualifiedPairs: 0, statutory45xEligibilityVerified: false,
  oldExperimentBuildersOrScoringExecuted: false, codeOnlyCiPrivateFiles: false, newNetworkRequests: 0 }));

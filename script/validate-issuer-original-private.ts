import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { buildOriginalIssuerOperatingCase, assessOriginalIssuerOperatingCase,
  extractOriginalIssuerInputs } from "../server/calculation/issuerOriginalOperatingCase";

if (process.env.NODE_ENV === "production" || !process.argv.includes("--private-primary"))
  throw new Error("Explicit private-primary validation only; never a code-only CI test or production action");
const root = "generated-artifacts/company-operating-corpus/issuer-original-v3";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const latest = read(`${root}/latest.json`), report = read(latest.reportPath), freeze = read(latest.freezePath);
assert.equal(sha(latest.freezePath), report.freezeHash);
assert.ok(Date.parse(freeze.frozenAt) <= Date.parse(report.calculatedAt));
for (const p of [...freeze.code, ...freeze.preserve]) assert.equal(sha(p.path), p.sha256);
assert.equal(report.fullPathCandidateCases, 18);
assert.equal(report.additionalFundingClaims, 39);
assert.equal(report.newProviderRequests, 0);
assert.equal(report.newNetworkRequests, 8);
let annualRows = 0, fadeRows = 0, terminalRows = 0, stubs = 0, fundingRows = 0, provedPairs = 0;
for (const p of freeze.prepared) {
  for (const s of [p.source, p.cover, p.supplemental, p.quoteReceipt]) assert.equal(sha(s.path), s.sha256);
  const sourceInput = extractOriginalIssuerInputs(readFileSync(p.source.path, "utf8"),
    readFileSync(p.supplemental.path, "utf8"), p.input.reconciliation,
    { primaryHash: p.input.primaryHash, supplementHash: p.input.supplementHash, publishedAt: p.input.publishedAt });
  assert.equal(JSON.stringify(sourceInput), JSON.stringify(p.input));
  assert.equal(p.market.referenceDate, p.market.priceDate);
  assert.equal(p.market.priceDate, p.market.sharesDate);
  assert.equal(p.market.currency, "USD");
  assert.equal(p.market.shares, p.shareClaim.value);
  for (const summary of report.cases.filter((c: any) => c.symbol === p.symbol)) {
    assert.equal(summary.calculationError, undefined);
    assert.equal(sha(summary.path), summary.sha256);
    const stored = read(summary.path), built = buildOriginalIssuerOperatingCase(p.input, summary.options);
    assert.equal(JSON.stringify(built), JSON.stringify(stored.built));
    const assessed = assessOriginalIssuerOperatingCase(built, p.market);
    assert.equal(JSON.stringify(assessed), JSON.stringify(stored.assessed));
    annualRows += built.ledger.years.length; fadeRows += built.ledger.continuationYears.length;
    terminalRows += Number(!!built.ledger.terminalYear); stubs += built.engineInput.stub.cashFlows.length;
    fundingRows += built.funding.length;
    for (const f of built.funding as any[]) {
      assert.ok(Math.abs(f.fixedCapitalResidual) < .01);
      assert.ok(Math.abs(f.debtResidual) < .01);
      assert.ok(f.cashReserve > 0);
    }
    for (const y of [...built.ledger.years, ...built.ledger.continuationYears, built.ledger.terminalYear!]) {
      const earnings = y.operatingProfit - y.interestPaid + y.otherOperatingCash - y.cashTax;
      const fromEarnings = earnings + y.depreciation - y.recognizedPolicyCredit + y.cashPolicyCredit -
        y.receivablesIncrease - y.increaseOtherOperatingWorkingCapital - y.capitalSpend +
        y.debtProceeds - y.debtRepayments - y.nonCommonCashClaims;
      assert.ok(Math.abs(y.fcfe - fromEarnings) < .01);
    }
    assert.ok(assessed.funding.every(f => f.residual === 0));
    assert.equal(built.qualifiedOriginalCases, 0);
    if (assessed.pair) {
      provedPairs++;
      assert.ok("relativeRepricingError" in assessed.pair);
      assert.ok(assessed.pair.relativeRepricingError < 1e-8);
      const x = built.engineInput;
      const dateYears = (d: string) => (Date.parse(`${d}T00:00:00Z`) -
        Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
      const explicit = [...built.ledger.years, ...built.ledger.continuationYears];
      const independentValue = (adjustment: number) => x.stub.cashFlows.reduce((sum, y) =>
        sum + y.fcfe / (1 + x.discountRate) ** dateYears(y.date), 0) +
        explicit.reduce((sum, y, i) => sum + y.fcfe * (1 + adjustment) ** (i + 1) /
          (1 + x.discountRate) ** dateYears(y.cashFlowDate), 0) +
        built.ledger.terminalYear!.fcfe * (1 + adjustment) ** 16 /
          (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** dateYears(explicit[14].cashFlowDate);
      assert.ok(Math.abs(independentValue(0) - assessed.forward!.forwardWholeEquity) < .01);
      assert.ok(Math.abs(independentValue(assessed.pair.impliedAnnualFcfeAdjustment) /
        (p.market.price * p.market.shares) - 1) < 1e-8);
      assert.ok("reverseProof" in assessed && assessed.reverseProof?.type);
      assert.ok(built.ledger.terminalYear!.fcfe > 0);
    }
    if (p.symbol === "FSLR") {
      assert.equal(built.ledger.terminalYear!.recognizedPolicyCredit, 0);
      assert.equal(built.ledger.terminalYear!.cashPolicyCredit, 0);
      assert.ok(built.activity.every(a => a.noObservedFutureActivityClaim));
    }
    if (p.symbol === "XOM") assert.ok(built.activity.every(a => a.ccsTariff === null && a.incrementalCcsCashRevenue === 0));
    if (p.symbol === "NEE") {
      assert.equal(p.input.renewableTaxCreditCash, 1304e6);
      assert.equal(built.ledger.terminalYear!.cashPolicyCredit, 0);
      assert.equal(built.ledger.continuationYears.find(y => y.year === 2039)!.cashPolicyCredit, 0);
      assert.ok(built.ledger.years.every(y => y.recognizedPolicyCredit === 0));
    }
  }
}
assert.equal(annualRows, 90); assert.equal(fadeRows, 180); assert.equal(terminalRows, 18);
assert.equal(stubs, 18); assert.equal(fundingRows, 306);
assert.equal(provedPairs, report.canonicalSamePathPairs + report.signedCertifiedSamePathPairs);
assert.equal(report.originalQualifiedIssuers, 0);
assert.equal(report.originalQualifiedPairs, 0);
console.log(JSON.stringify({ status: "passed", actualIssuerInputs: 3, newFundingClaims: 39,
  cases: 18, annualRows, fadeRows, terminalRows, stubs, fundingRows, provedPairs,
  qualifiedOriginalIssuers: 0, originalQualifiedPairs: 0, prior166FactAuditAndFslr10Cases50RowsUnchanged: true,
  codeOnlyCiDoesNotReadPrivateFiles: true, newProviderRequests: 0, boundedPublicPrimaryRequests: 8 }));

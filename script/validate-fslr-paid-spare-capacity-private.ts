import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractPaidCapacitySources, buildPaidCapacityCase } from "../server/calculation/fslrPaidSpareCapacityCase";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Mandatory actual/private source validator; not code-only CI");
const root = "generated-artifacts/company-operating-corpus/fslr-paid-spare-capacity-v1";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const latest = read(`${root}/latest.json`), report = read(latest.reportPath), f = read(latest.freezePath);
assert.equal(sha(latest.freezePath), report.freezeHash);
assert.ok(Date.parse(f.frozenAt) <= Date.parse(report.calculatedAt));
for (const p of [...f.code, ...f.preserve, ...f.sources]) assert.equal(sha(p.path), p.sha256);
assert.deepEqual(extractPaidCapacitySources(readFileSync(f.sources[0].path, "utf8")), f.facts);
assert.equal(f.facts.noncurrentInventory, 275372000);
assert.equal(f.facts.rawMaterials + f.facts.workInProcess + f.facts.finishedGoods, 1359756000);
let cashRows = 0, negativeFundedYears = 0;
for (const c of report.cases) {
  assert.equal(sha(c.path), c.sha256);
  const saved = read(c.path).result, base = f.baselines.find((b: any) => b.id === c.baselineId).built;
  const option = f.options.find((o: any) => o.id === c.optionId);
  assert.deepEqual(buildPaidCapacityCase(f.input, f.facts, base, option), saved);
  assert.equal(saved.policyEligibilityVerified, false); assert.equal(saved.initialExcessCashRelease, 0);
  assert.equal(saved.actualFcfeGrowth.status, "rejected-nonpositive-actual-baseline");
  const oldRows = [...base.ledger.years, ...base.ledger.continuationYears, base.ledger.terminalYear];
  const x = base.engineInput;
  const time = (d: string) => (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  let pv = x.stub.cashFlows.reduce((s: number, r: any) => s + r.fcfe / (1 + x.discountRate) ** time(r.date), 0);
  saved.rows.forEach((r: any, i: number) => {
    const b = oldRows[i], stock = base.funding[i + 1];
    assert.ok(r.producedWattsAssumed <= option.availableWatts);
    assert.equal(r.producedWattsAssumed, r.soldWatts);
    assert.equal(r.closingPpe, stock.closingPpe); assert.equal(r.closingDebt, stock.closingDebt);
    assert.equal(r.debtProceeds, b.debtProceeds); assert.equal(r.debtRepayments, b.debtRepayments);
    const cashCore = (b.operatingProfitBeforeClimate + b.depreciation) * r.unitMultiplier -
      (option.cashCostMode === "additional-da-wear-reserve" ? b.depreciation * (r.unitMultiplier - 1) : 0);
    const core = cashCore - b.depreciation;
    assert.ok(Math.abs(core - r.coreProfit) < .02);
    const tax = Math.max(0, core + b.otherOperatingCash * r.unitMultiplier - b.interestPaid) * .21;
    const independent = cashCore + b.otherOperatingCash * r.unitMultiplier + r.cashPolicyCredit -
      (r.closingReceivables - r.openingReceivables) - (r.closingOtherWorkingCapital - r.openingOtherWorkingCapital) -
      b.interestPaid - tax - b.capitalSpend + b.debtProceeds - b.debtRepayments - b.nonCommonCashClaims;
    assert.ok(Math.abs(independent - r.fcfe) < .02);
    if (r.year >= 2034) { assert.equal(r.cashPolicyCredit, 0); assert.equal(r.recognizedPolicyCredit, 0); }
    if (option.creditMode === "all-post-stub-credit-value-zero") assert.equal(r.cashPolicyCredit, 0);
    if (r.fcfe < 0) negativeFundedYears++;
    pv += i < 15 ? independent / (1 + x.discountRate) ** time(r.cashFlowDate) :
      independent / (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** time(oldRows[14].cashFlowDate);
    cashRows++;
  });
  assert.ok(Math.abs(pv - saved.formalSignedCashSum) < .02);
  assert.equal(saved.reverseScoringPerformed, false); assert.equal(saved.qualifiedOriginalIssuers, 0);
}
assert.equal(report.fullNewCases, 48); assert.equal(cashRows, 768);
assert.equal(report.oldCasesReexecuted, false); assert.equal(report.originalV4BoundsWidened, false);
console.log(JSON.stringify({ status: "passed", newCases: 48, independentCashRows: cashRows, postCreditTerminalRows: 48,
  negativeCommonFundingYearsRetained: negativeFundedYears, originalQualifiedIssuers: 0,
  sourceRequests: 0, observedPaidCompletionOrEligibilityInvented: false, oldCasesReexecuted: false }));

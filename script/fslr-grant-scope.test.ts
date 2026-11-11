import assert from "node:assert/strict";
import { test } from "node:test";
import { extractFslrGrantScope, reconcileFslrGrantScope } from "../server/calculation/fslrGrantScopeBridge";

// Entirely synthetic public fixture, not retained filing bytes or private outputs.
function fixture() {
  let contexts = "", facts = "", seq = 0;
  function f(name: string, year: number, instant: boolean, value: number, member?: string, negative = false) {
    const id = `x${seq++}`;
    contexts += `<xbrli:context id="${id}"><xbrli:entity><xbrli:identifier>0001274494</xbrli:identifier>${member ?
      `<xbrli:segment><xbrldi:explicitMember dimension="d">${member}</xbrldi:explicitMember></xbrli:segment>` : ""}</xbrli:entity><xbrli:period>${instant ?
        `<xbrli:instant>${year}-12-31</xbrli:instant>` :
        `<xbrli:startDate>${year}-01-01</xbrli:startDate><xbrli:endDate>${year}-12-31</xbrli:endDate>`}</xbrli:period></xbrli:context>`;
    facts += `<ix:nonFraction name="${name}" contextRef="${id}" unitRef="usd" scale="3"${negative ? ' sign="-"' : ""}>${value}</ix:nonFraction>`;
  }
  f("us-gaap:GovernmentAssistanceAmount", 2024, false, 12000, "us-gaap:CostOfSalesMember");
  f("us-gaap:GovernmentAssistanceAmount", 2024, false, 2000, "fslr:ResearchAndDevelopmentMember");
  f("us-gaap:GovernmentAssistanceAmount", 2024, false, 1000, "fslr:ProductionStartUpMember");
  f("fslr:IncreaseDecreaseInGovernmentGrantsReceivable", 2024, false, 2000, undefined, true);
  for (const [year, c, n] of [[2023, 6000, 3000], [2024, 4000, 4000]]) {
    f("us-gaap:GrantsReceivableCurrent", year, true, c); f("us-gaap:GrantsReceivableNoncurrent", year, true, n);
    f("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", year, true, n, "us-gaap:PropertyPlantAndEquipmentMember");
    f("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", year, true, 100, "us-gaap:OtherAssetsMember");
    f("fslr:ProceedsToBeReceivedFromAssetBasedGovernmentGrants", year, false, n + 200);
  }
  return contexts + facts + "During the year ended December 31, 2024, we recognized $10.0 million of Section 45X credits as a reduction to “Cost of sales.” Supplemental disclosure of noncash investing and financing activities: Proceeds to be received from asset-based government grants";
}
test("synthetic native entity/period/dimension/scaling and negative CFOmovement", () => {
  const s = extractFslrGrantScope(fixture());
  assert.equal(s.reportedSpecific45xCostSalesUsd, 10000000);
  assert.equal(s.cfoGrantAdjustment, 2000000);
  assert.deepEqual(s.income, { costSales: 12000000, research: 2000000, startup: 1000000 });
  const r = reconcileFslrGrantScope(s, { fiserv: 8000000, visa: 7000000 });
  assert.equal(r.incomeScopeDifferenceUsd, 5000000);
  assert.equal(r.deliberatelyMixedScopeResidualUsd, -3000000);
  assert.equal(r.priorUnallocatedResidualUsd, 2000000);
  assert.equal(r.priorBookCfoResidualUsd, 1000000);
  assert.equal(r.assetBenefitStockChangeUsd, 1000000);
  assert.equal(r.cashAdjustmentAppliedUsd, 0);
  assert.equal(r.observedOtherGrantCashUsd, null);
  assert.equal(r.assetSupplementTreatedAsInstantReceivable, false);
  assert.equal(r.unallocatedResidualFullyResolved, false);
});
test("refuses wrong entity, period, dimension, unit and missing narrative rather than filling bridge", () => {
  for (const bad of [
    fixture().replace(/0001274494/g, "0000000000"),
    fixture().replace(/2024-01-01/g, "2024-04-01"),
    fixture().replace(/unitRef="usd"/g, 'unitRef="eur"'),
    fixture().replace(/us-gaap:CostOfSalesMember/g, "us-gaap:OtherMember"),
    fixture().replace("10.0 million of Section 45X", "10.0 million of Other"),
    fixture().replace("Supplemental disclosure of noncash", "Supplemental disclosure of cash")
  ]) assert.throws(() => extractFslrGrantScope(bad));
});
test("independent forward cash decomposition, no double release, and source perturbation identity", () => {
  const s = extractFslrGrantScope(fixture()), receipts = { fiserv: 8000000, visa: 7000000 };
  const base = reconcileFslrGrantScope(s, receipts);
  const shifted = reconcileFslrGrantScope({ ...s, income: { ...s.income, research: s.income.research + 123000 } }, receipts);
  assert.equal(shifted.incomeScopeDifferenceUsd - base.incomeScopeDifferenceUsd, 123000);
  assert.equal(shifted.priorUnallocatedResidualUsd - base.priorUnallocatedResidualUsd, 123000);
  assert.equal(shifted.deliberatelyMixedScopeResidualUsd, base.deliberatelyMixedScopeResidualUsd);
  assert.equal(base.priorUnallocatedResidualUsd + base.selectedCashUsd,
    s.income.costSales + s.income.research + s.income.startup + s.cfoGrantAdjustment);
  assert.equal(base.cashAdjustmentAppliedUsd, 0);
  assert.throws(() => reconcileFslrGrantScope(s, { fiserv: NaN, visa: 0 }));
});

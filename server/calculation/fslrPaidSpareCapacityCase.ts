import type { OriginalIssuerInputs } from "./issuerOriginalOperatingCase";

export interface PaidCapacitySources {
  existingNameplateWatts: number; plannedAdditionalWatts: number;
  producedWatts2024: number; soldWatts2024: number;
  guidedSoldWatts2025: number; guidedProductionRange2025: number[];
  remainingFacilityInvestment2025: number; capexRange2025: number[];
  rawMaterials: number; workInProcess: number; finishedGoods: number;
  currentInventory: number; noncurrentInventory: number;
  cashPaidObservation: false;
}
const plain = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ");
export function extractPaidCapacitySources(html: string): PaidCapacitySources {
  const text = plain(html);
  const clauses = [
    "across all our facilities to approximately 21 GW",
    "expanding our manufacturing capacity by approximately 4 GW",
    "During 2024, we produced 15.5 GW and sold 14.1 GW",
    "During 2025, we expect to produce between 18 GW and 19 GW and sell between 18 GW and 20 GW",
    "remaining investment in this U.S. facility to be approximately $0.7 billion, which is expected to be incurred throughout 2025",
    "During 2025, we expect to spend between $1.3 billion and $1.5 billion for capital expenditures",
    "expected to commence operations in the second half of 2025",
  ];
  for (const clause of clauses) if (!text.includes(clause)) throw new Error(`Exact primary capacity/funding disclosure absent: ${clause}`);
  const context = Array.from(html.matchAll(/<xbrli:context\b[^>]*id="c-14"[^>]*>[\s\S]*?<\/xbrli:context>/g));
  if (context.length !== 1 || !context[0][0].includes("2024-12-31") ||
    !context[0][0].includes("0001274494") || /<xbrli:segment/.test(context[0][0]))
    throw new Error("FY2024 consolidated USD inventory instant context not authenticated");
  const fact = (name: string, expected: number) => {
    const matches = Array.from(html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/g)).filter(m =>
      m[1].includes(`name="${name}"`) && m[1].includes('contextRef="c-14"'));
    const values = matches.map(m => {
      if (!m[1].includes('unitRef="usd"') || !m[1].includes('scale="3"')) throw new Error("Inventory source unit/scale mismatch");
      return Number(plain(m[2]).replace(/,/g, "").trim()) * 1000;
    });
    if (!values.length || values.some(value => value !== expected)) throw new Error(`Exact primary inventory fact absent: ${name}`);
    return expected;
  };
  const rawMaterials = fact("us-gaap:InventoryRawMaterialsNetOfReserves", 489524000);
  const workInProcess = fact("us-gaap:InventoryWorkInProcessNetOfReserves", 115696000);
  const finishedGoods = fact("us-gaap:InventoryFinishedGoodsNetOfReserves", 754536000);
  const currentInventory = fact("us-gaap:InventoryNet", 1084384000);
  const noncurrentInventory = fact("us-gaap:InventoryNoncurrent", 275372000);
  if (rawMaterials + workInProcess + finishedGoods !== currentInventory + noncurrentInventory)
    throw new Error("Original full current/noncurrent inventory reconciliation failed");
  return { existingNameplateWatts: 21e9, plannedAdditionalWatts: 4e9, producedWatts2024: 15.5e9,
    soldWatts2024: 14.1e9, guidedSoldWatts2025: 19e9, guidedProductionRange2025: [18e9, 19e9],
    remainingFacilityInvestment2025: .7e9, capexRange2025: [1.3e9, 1.5e9], rawMaterials,
    workInProcess, finishedGoods, currentInventory, noncurrentInventory, cashPaidObservation: false };
}
export const paidCapacityExperiment = {
  version: "fslr-paid-spare-capacity-post-credit-1", qualifiedOriginalIssuers: 0,
  policyEligibilityVerified: false, originalV4BoundsWidened: false,
  rationale: [
    "FY2024 source says 21 GW installed, 4 GW planned, remaining US-facility investment $0.7bn expected throughout 2025 within total $1.3-1.5bn capex outlook. Completion/payment within the already frozen $1.4bn FY2025 funding bridge is a prospective condition, NOT an observed paid fact.",
    "Test 21 GW installed-only and 25 GW conditional-completion ceilings. 19 GW is forward shipment-guidance midpoint, not FY2024 actual shipments or guaranteed demand. Production equals annual sales from 2026; no future finished-module inventory draw or increase is assumed.",
    "Existing nominal PP&E/D&A/growth reinvestment, debt/rollover/interest and 2025 stub remain fully funded as frozen. No extra plant is assumed below paid ceiling, no new capacity above ceiling, no technology/yield improvement or free abatement. Nominal terminal growth is ASP/cost/replacement inflation, with flat real terminal output.",
    "Scale every core CASH operating cost with added units, keeping book D&A fixed to already-paid assets. This gives NO fixed-cash-overhead leverage. Separate downside reserves an extra source D&A dollar per incremental unit as cash wear expense; neither variant claims observed marginal costs.",
    "Finished-goods real stock stays constant. Added throughput funds source raw/WIP-equivalent inventory and an equally source-anchored finished-goods-value CASH liquidity reserve, not fictitious extra finished units. Entire source noncurrent inventory is separately price-index funded, including first-year catch-up; no inventory stock release.",
    "No new customer advances fund incremental units. Original baseline advance path remains conditional. AR/payables/minimum cash/other-current-asset-equivalent reserve scale with activity; all selected cash and added buffers remain reserved, without interest or terminal distribution.",
    "Keep source-law credit schedule separately or value ALL post-stub credit recognition/cash at zero as downside, with any forecast opening credit receivable unreleased. Neither case certifies post-2025 law/FEOC. Added global units receive NO additional US-eligible credits.",
    "Core startup normalization, termination/ancillary reserves and ramp costs remain exactly the original baseline variants. Cash tax is the original 21% positive core-pretax sensitivity, not new tax guidance.",
    "Negative cash is explicit prospective pro-rata existing-owner funding, not a zero floor or invented future share issuance. Actual FY2024 negative FCFE rejects actual-to-year-five CAGR in every member; no operating root or g_CAT inferred.",
  ],
};
export const paidFadeWeight = (t: number) => t <= 5 ? 1 : Math.max(0, (15 - t) / 10);
export function paidCapacityBound(startWatts: number, maximumWatts: number) {
  if (!(startWatts > 0 && maximumWatts >= startWatts)) throw new Error("Source physical capacity envelope invalid");
  let lo = 0, hi = .2;
  const end = (r: number) => Array.from({ length: 15 }, (_, i) => 1 + r * paidFadeWeight(i + 1)).reduce((p, f) => p * f, startWatts);
  if (end(hi) < maximumWatts) throw new Error("Source bound not enclosed");
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (end(mid) > maximumWatts) hi = mid; else lo = mid; }
  return lo * (1 - 1e-10);
}
export interface PaidCapacityOptions {
  availableWatts: number;
  unitGrowthPerturbation: number;
  cashCostMode: "all-cash-cost-variable" | "additional-da-wear-reserve";
  creditMode: "inherited-source-law" | "all-post-stub-credit-value-zero";
}
export function buildPaidCapacityCase(input: OriginalIssuerInputs, sources: PaidCapacitySources, baseline: any, options: PaidCapacityOptions) {
  const x = baseline.engineInput, o = input.reconciliation.normalized;
  if (x.symbol !== "FSLR" || x.currency !== "USD" || ![.025, .0325, .04].includes(x.terminalGrowth))
    throw new Error("Original USD FSLR five/fade/terminal basis required");
  if (options.availableWatts !== sources.existingNameplateWatts &&
    options.availableWatts !== sources.existingNameplateWatts + sources.plannedAdditionalWatts)
    throw new Error("Outside original source capacity ceilings");
  if (!(options.unitGrowthPerturbation >= 0 && options.unitGrowthPerturbation <= paidCapacityBound(sources.guidedSoldWatts2025, options.availableWatts)))
    throw new Error("Real unit perturbation exceeds frozen source bound");
  const initial = baseline.funding[0], midpointCapex = (sources.capexRange2025[0] + sources.capexRange2025[1]) / 2;
  if (initial.cashPpe !== midpointCapex || initial.cashPpe < sources.remainingFacilityInvestment2025 ||
    Math.abs(initial.openingPpe + initial.cashPpe - initial.fixedDepreciation - initial.closingPpe) > .02)
    throw new Error("Original 2025 paid-capital funding bridge absent");
  const original = [...baseline.ledger.years, ...baseline.ledger.continuationYears, baseline.ledger.terminalYear];
  if (original.length !== 16 || original.some((r: any, i: number) => r.year !== 2026 + i))
    throw new Error("Original five/fade/terminal rows incomplete");
  const baseWcSource = input.inventory + input.otherCurrentAssets + input.minimumCash - input.operatingPayables - input.customerAdvances;
  let ar = original[0].openingReceivables, wc = baseWcSource * baseline.activity[0].nonCausalNominalRevenue / o.revenue;
  let noncurrentInventory = sources.noncurrentInventory, multiplier = 1;
  let totalPositiveCommonFunding = 0;
  const rows = original.map((b: any, i: number) => {
    const f = baseline.funding[i + 1], t = i + 1, index = b.revenue / o.revenue;
    multiplier *= 1 + options.unitGrowthPerturbation * paidFadeWeight(t);
    const watts = sources.guidedSoldWatts2025 * multiplier;
    if (watts > options.availableWatts) throw new Error("Source paid-capacity ceiling exceeded");
    const revenue = b.revenue * multiplier;
    const cashOperatingCostBase = b.revenue - b.operatingProfitBeforeClimate - b.depreciation;
    if (!(cashOperatingCostBase > 0)) throw new Error("Source core cash operating cost not positive");
    const wearReserve = options.cashCostMode === "additional-da-wear-reserve" ? b.depreciation * (multiplier - 1) : 0;
    const cashOperatingCost = cashOperatingCostBase * multiplier + wearReserve;
    const coreProfit = revenue - cashOperatingCost - b.depreciation;
    const otherOperatingCash = b.otherOperatingCash * multiplier;
    const recognizedPolicyCredit = options.creditMode === "inherited-source-law" ? b.recognizedPolicyCredit : 0;
    const cashPolicyCredit = options.creditMode === "inherited-source-law" ? b.cashPolicyCredit : 0;
    const openingAr = ar, openingWc = wc, openingNoncurrentInventory = noncurrentInventory;
    ar = b.closingReceivables * multiplier;
    const incrementalThroughputInventory = (sources.rawMaterials + sources.workInProcess) * index * (multiplier - 1);
    const incrementalFinishedGoodsLiquidityReserve = sources.finishedGoods * index * (multiplier - 1);
    // No incremental customer advances and no fictitious finished-module stock.
    wc = baseWcSource * index +
      (input.otherCurrentAssets + input.minimumCash - input.operatingPayables) * index * (multiplier - 1) +
      incrementalThroughputInventory + incrementalFinishedGoodsLiquidityReserve;
    noncurrentInventory = sources.noncurrentInventory * index;
    const receivablesIncrease = ar - openingAr, currentAndReserveWcIncrease = wc - openingWc;
    const noncurrentInventoryFunding = noncurrentInventory - openingNoncurrentInventory;
    const otherWcIncrease = currentAndReserveWcIncrease + noncurrentInventoryFunding;
    const cashTax = .21 * Math.max(0, coreProfit - b.interestPaid + otherOperatingCash);
    const operatingCashFlow = coreProfit + b.depreciation + b.otherNonCash + otherOperatingCash + cashPolicyCredit -
      receivablesIncrease - otherWcIncrease - b.interestPaid - cashTax;
    const capitalSpend = b.capitalSpend;
    const fcfe = operatingCashFlow - capitalSpend + b.debtProceeds - b.debtRepayments - b.nonCommonCashClaims;
    if (fcfe < 0) totalPositiveCommonFunding -= fcfe;
    if (Math.abs(f.openingPpe + f.cashPpe - f.fixedDepreciation - f.closingPpe) > .02 ||
      Math.abs(f.openingDebt + b.debtProceeds - b.debtRepayments - f.closingDebt) > .02)
      throw new Error("Paid plant/debt reinvestment reconciliation failed");
    return { year: b.year, cashFlowDate: b.cashFlowDate, revenue, unitMultiplier: multiplier,
      soldWatts: watts, producedWattsAssumed: watts, nameplateWattsConditional: options.availableWatts,
      physicalUtilization: watts / options.availableWatts, priceAspUsdPerWatt: revenue / watts,
      cashOperatingCost, wearReserve, coreProfit, depreciation: b.depreciation, otherOperatingCash,
      recognizedPolicyCredit, cashPolicyCredit, openingReceivables: openingAr, closingReceivables: ar, receivablesIncrease,
      openingOtherWorkingCapital: openingWc + openingNoncurrentInventory,
      closingOtherWorkingCapital: wc + noncurrentInventory, otherWorkingCapitalIncrease: otherWcIncrease,
      currentAndReserveWcIncrease,
      incrementalThroughputInventory, incrementalFinishedGoodsLiquidityReserve,
      openingNoncurrentInventory, closingNoncurrentInventory: noncurrentInventory, noncurrentInventoryFunding,
      interestPaid: b.interestPaid, cashTax, operatingProfit: coreProfit + recognizedPolicyCredit,
      operatingCashFlow, originalCapitalSpend: b.capitalSpend, capitalSpend, openingPpe: f.openingPpe,
      closingPpe: f.closingPpe, cashPpe: f.cashPpe, openingDebt: f.openingDebt, closingDebt: f.closingDebt,
      debtProceeds: b.debtProceeds, debtRepayments: b.debtRepayments, nonCommonCashClaims: b.nonCommonCashClaims,
      minimumCash: input.minimumCash * index * multiplier, incrementalCustomerAdvances: 0,
      noncurrentInventoryCashClassification: "Operating inventory funding included once in other WC; NOT PP&E", fcfe };
  });
  const g = x.terminalGrowth;
  for (const key of ["revenue", "cashOperatingCost", "coreProfit", "depreciation", "cashTax", "interestPaid",
    "receivablesIncrease", "otherWorkingCapitalIncrease", "noncurrentInventoryFunding", "capitalSpend", "fcfe"])
    if (Math.abs((rows[15] as any)[key] - (rows[14] as any)[key] * (1 + g)) > .02)
      throw new Error(`Terminal cash/replacement funding is not steady at original growth: ${key}`);
  if (rows.some(r => r.year >= 2034 && (r.recognizedPolicyCredit !== 0 || r.cashPolicyCredit !== 0)))
    throw new Error("Post-credit terminal incorrectly retains policy cash");
  const time = (d: string) => (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const stubPv = x.stub.cashFlows.reduce((sum: number, r: any) => sum + r.fcfe / (1 + x.discountRate) ** time(r.date), 0);
  const formalSignedCashSum = stubPv + rows.slice(0, 15).reduce((sum, r) => sum + r.fcfe /
    (1 + x.discountRate) ** time(r.cashFlowDate), 0) + rows[15].fcfe / (x.discountRate - g) /
    (1 + x.discountRate) ** time(rows[14].cashFlowDate);
  const terminalFunded = rows[15].fcfe > 0;
  return { rows, stubPv, formalSignedCashSum, forwardWholeEquity: terminalFunded && formalSignedCashSum > 0 ? formalSignedCashSum : null,
    status: !terminalFunded ? "rejected-nonpositive-post-credit-terminal" : formalSignedCashSum <= 0 ?
      "rejected-nonpositive-common-funded-value" : "conditional-paid-capacity-post-credit-cash",
    terminalFunded, terminalPolicyCash: rows[15].cashPolicyCredit, totalPositiveCommonFunding,
    actualFcfeGrowth: x.baseFcfe <= 0 ? { status: "rejected-nonpositive-actual-baseline", fiveForecastStepCagr: null } :
      rows[4].fcfe <= 0 ? { status: "rejected-nonpositive-year-five", fiveForecastStepCagr: null } :
        { status: "conditional-five-forecast-steps-not-six-calendar-years", fiveForecastStepCagr: (rows[4].fcfe / x.baseFcfe) ** .2 - 1 },
    source2025Funding: { ...initial, remainingFacilityBudgetIncludedNotAddedAgain: sources.remainingFacilityInvestment2025,
      paidStatus: "conditional-completion/payment-not-observed" },
    legacyForecastCreditReceivableUnreleased: options.creditMode === "all-post-stub-credit-value-zero" ?
      original[0].cashPolicyCredit * .25 : 0,
    originalStubUnchanged: true, additionalEligibleUsCredit: 0, policyEligibilityVerified: false,
    initialExcessCashRelease: 0, terminalReserveRelease: 0, reverseScoringPerformed: false, qualifiedOriginalIssuers: 0 };
}

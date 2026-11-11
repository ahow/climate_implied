export type RemittanceSourceFact = { id: string; tag: string; context: string; value: number };
export type NeeRemittanceFacts = {
  bindings: RemittanceSourceFact[];
  consolidatedAffiliateCash: number;
  reportedCreditSupportExposure: number;
  guaranteeFairValueNotCash: number;
  thirdPartySweepPayable: number;
  currentRelatedReceivable: number;
  noncurrentRelatedReceivable: number;
  serviceFeeIncomeNotCashReceipt: number;
  financedJointVentureDistribution: number;
  financedJointVentureNciDerecognitionNotCash: number;
  xplrDistributionSuspendedIndefinitely: true;
  xplrShareOfConsolidatedAffiliateCash: null;
  financedDistributionOverlapWithCfoAffiliateCash: null;
};
const plain = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ").trim();
export function extractNeeRemittanceFacts(html: string): NeeRemittanceFacts {
  const text = plain(html), bindings: RemittanceSourceFact[] = [];
  const get = (id: string, tag: string, context: string) => {
    const m = Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/gi))
      .find(x => x[1].includes(`id="${id}"`));
    if (!m || !m[1].includes(`name="${tag}"`) || !m[1].includes(`contextRef="${context}"`) ||
        !m[1].includes('unitRef="usd"')) throw new Error(`Missing exact actual remittance fact ${id}/${context}/${tag}`);
    const scale = Number(/scale="([^"]+)"/.exec(m[1])?.[1]);
    const value = Number(plain(m[2]).replace(/,/g,"")) * 10 ** scale * (m[1].includes('sign="-"') ? -1 : 1);
    if (!Number.isFinite(value) || ![6,9].includes(scale)) throw new Error(`Invalid source units ${id}`);
    bindings.push({ id, tag, context, value });
    return value;
  };
  for (const assertion of [
    "In January 2025, XPLR announced a strategic repositioning, including suspension of the distribution to common unitholders for an indefinite period",
    "52.6 % noncontrolling interest in XPLR",
    "accounts for its ownership interest in XPLR as an equity method investment",
    "cash sweep amounts (due to XPLR and its subsidiaries)",
    "with maturity dates ranging from 2025 to 2059",
    "Upon the projects in the renewable assets joint venture obtaining financing in the fourth quarter of 2024",
  ]) if (!text.includes(assertion)) throw new Error(`Missing primary event/boundary: ${assertion}`);
  return {
    bindings,
    consolidatedAffiliateCash: get("f-341","us-gaap:EquityMethodInvestmentDividendsOrDistributions","c-1"),
    reportedCreditSupportExposure: get("f-2057","us-gaap:GuaranteeObligationsCurrentCarryingValue","c-404"),
    guaranteeFairValueNotCash: get("f-2058","us-gaap:GuaranteesFairValueDisclosure","c-404"),
    thirdPartySweepPayable: get("f-2048","us-gaap:AccountsPayableOtherCurrentAndNoncurrent","c-397"),
    currentRelatedReceivable: get("f-2053","us-gaap:OtherReceivables","c-402"),
    noncurrentRelatedReceivable: get("f-2055","us-gaap:OtherAssetsNoncurrent","c-402"),
    serviceFeeIncomeNotCashReceipt: get("f-2050","us-gaap:InterestAndFeeIncomeOtherLoans","c-399"),
    financedJointVentureDistribution: get("f-1142","us-gaap:EquityMethodInvestmentDividendsOrDistributions","c-153"),
    financedJointVentureNciDerecognitionNotCash: get("f-1139","us-gaap:NoncontrollingInterestDecreaseFromDeconsolidation","c-151"),
    xplrDistributionSuspendedIndefinitely: true, xplrShareOfConsolidatedAffiliateCash: null,
    financedDistributionOverlapWithCfoAffiliateCash: null,
  };
}

/** Partial-identification arithmetic only: never silently assert the project distribution is in CFO. */
export function remittanceIdentification(f: NeeRemittanceFacts) {
  if (!(f.consolidatedAffiliateCash >= 0) || !(f.financedJointVentureDistribution >= 0))
    throw new Error("Nonnegative observed cash required");
  return {
    suspendedAffiliateAmountInConsolidatedCash: { lower: 0, upper: f.consolidatedAffiliateCash, observed: null },
    financedDistributionAmountInConsolidatedCash: { lower: 0,
      upper: Math.min(f.consolidatedAffiliateCash, f.financedJointVentureDistribution), observed: null },
    unionOfAtRiskHistoricAffiliateCash: { lower: 0, upper: f.consolidatedAffiliateCash, observed: null },
    recurrentCashNotPubliclyIdentified: true,
    // An accounting ownership percentage is NOT used to multiply cash.
    ownershipPercentUsedForCash: false,
  };
}

export const neeRemittanceExperiment = {
  version: "nee-remittance-counterparty-1",
  rationale: [
    "January2025 XPLR suspension is an actual source event; ALL affiliate cash zero is an adverse FORWARD condition, not a statement all $811m was XPLR or all other investees suspended.",
    "A distinct five-wind/three-solar JV financing led to $386m cash distribution. Its inclusion/classification within consolidated operating affiliate cash is UNKNOWN. Never subtract it or the $844m NCI derecognition a second time.",
    "No NEE equity-method ownership percentage allocates consolidated project cash/tax credits. XPLR52.6% is a noncontrolling equity-method interest, NOT consolidated project NCI cash or a revenue share.",
    "Rebuild cash tax from the same source operating cash and zero affiliate remittances, then all WC/capital/interest/debt/non-common cash. No FCFE multiplier is renamed physical activity growth, and no source price/volume/CCS tariff is fabricated.",
    "Credit-support exposure is reported approximately $1.3bn across guarantees/indemnities/LCs/surety bonds, maturities2025-2059. A one-time2026 restricted cash provision of that scale is a conditional liquidity policy, NOT an observed guarantee call, exact legal maximum, future expense or issuer commitment.",
    "Cash provision is held nominally, earns zero and has no terminal release. It is not also paid as a second guarantee call; existing non-common payment reserves are untouched. The provision can be deliberately conservative if existing reserves also cover these obligations.",
    "Recorded $58m guarantee fair value is not another cash payment. $127m cash-sweep payable belongs to XPLR, is not excess cash and is not deducted again. $159m current/$128m noncurrent receivables have no assumed liquidation recovery or new cash writeoff. $18m fee income is not authenticated paid fee cash and no new cash fee is added.",
    "Retain the original2025 signed cash stub, opening stocks, source operating cash-return and capital plan, fully funded replacement/nuclear fuel/AFUDC/working reserves, source leverage/rollover, 5yr+10yr fade, requested2.5/3.25/4% nominal terminal and10% equity discount. Negative common calls remain negative PV.",
    "Source-calibrated operating cash productivity, no-terminal-policy condition, current law/FEOC caveats, gross non-DMI unknowns and revised-history date remain inherited explicit conditions, not cured by the remittance stress.",
  ],
} as const;

export type RemittanceRow = {
  year: number; priceIndex: number; nominalGrowth: number;
  grossOperatingCash: number; affiliateCash: number; interest: number;
  fixedDa: number[]; nuclearAmortization: number; cashTax: number; policyCash: number;
  increaseWorkingFunding: number; capitalSpend: number;
  debtProceeds: number; debtRepayments: number; dmiCashClaim: number; otherConditionalReserve: number;
  taxableCashProfitProxy: number; fcfe: number; commonCall: number;
  cashReserve: number;
};
export type RemittanceBaseline = {
  options: { terminalGrowth: number };
  rows: RemittanceRow[];
  originalStubUnchanged: { cashFlows: { date: string; fcfe: number }[] };
  qualifiedOriginalIssuers: number;
};
export type RemittanceOption = { reservePolicy: "no-extra-guarantee-cash-provision" | "reported-exposure-scale-cash-provision" };

export function buildNeeRemittanceCase(f: NeeRemittanceFacts, baseline: RemittanceBaseline,
  option: RemittanceOption, reference: { referenceDate: string; discountRate: number; actualBaseFcfe: number }) {
  const g = baseline.options.terminalGrowth;
  if (baseline.rows.length !== 16 || baseline.rows[0].year !== 2026 || baseline.rows[15].year !== 2041 ||
      ![.025,.0325,.04].includes(g) || !(reference.discountRate > g) || !(reference.actualBaseFcfe > 0) ||
      !Number.isFinite(Date.parse(reference.referenceDate))) throw new Error("Original timeline/terminal/base mismatch");
  const provision = option.reservePolicy === "reported-exposure-scale-cash-provision" ?
    f.reportedCreditSupportExposure : 0;
  const rows = baseline.rows.map((b, i) => {
    if (b.year !== 2026+i || Math.abs(b.affiliateCash - f.consolidatedAffiliateCash*b.priceIndex) > .01)
      throw new Error("Stored baseline affiliate cash/source scale changed");
    const affiliateCash = 0;
    const taxableCashProfitProxy = b.grossOperatingCash - b.fixedDa.reduce((s,x)=>s+x,0) -
      b.nuclearAmortization + affiliateCash - b.interest;
    const cashTax = .21 * Math.max(0,taxableCashProfitProxy);
    const cashProvisionFunding = i===0 ? provision : 0;
    const fcfe = b.grossOperatingCash + affiliateCash - b.interest - cashTax + b.policyCash -
      b.increaseWorkingFunding - b.capitalSpend + b.debtProceeds - b.debtRepayments -
      b.dmiCashClaim - b.otherConditionalReserve - cashProvisionFunding;
    return { ...b, affiliateCash, taxableCashProfitProxy, cashTax, fcfe, commonCall: Math.max(0,-fcfe),
      cashProvisionFunding, incrementalRestrictedCashHeld: provision,
      totalCashReserveIncludingExtraProvision: b.cashReserve+provision,
      removedConditionalAffiliateCash: b.affiliateCash, taxSavingVersusStoredConditionalCase: b.cashTax-cashTax,
      extraGuaranteeExpenseOrCall: 0, extraReceivableWriteoffCash: 0, cashSweepRelease: 0 };
  });
  const discount = (date: string) => (1+reference.discountRate) **
    (-(Date.parse(date)-Date.parse(reference.referenceDate))/31557600000);
  const stubPv = baseline.originalStubUnchanged.cashFlows.reduce((s,c)=>s+c.fcfe*discount(c.date),0);
  const explicitPv = rows.slice(0,15).reduce((s,r)=>s+r.fcfe*discount(`${r.year}-12-31`),0);
  const terminalFcfe = rows[15].fcfe;
  const terminalPv = terminalFcfe/(reference.discountRate-g)*discount("2040-12-31");
  const signedPlanPv = stubPv+explicitPv+terminalPv;
  if (![stubPv,explicitPv,terminalPv,signedPlanPv].every(Number.isFinite)) throw new Error("Nonfinite remittance valuation");
  const fifth = rows[4].fcfe;
  return { version: neeRemittanceExperiment.version, option, terminalGrowth:g, rows,
    originalStubUnchanged: baseline.originalStubUnchanged, stubPv, explicitPv, terminalPv, terminalFcfe, signedPlanPv,
    forwardWholeEquity: terminalFcfe>0 && signedPlanPv>0 ? signedPlanPv : null,
    status: terminalFcfe<=0 ? "refused-nonpositive-terminal" : signedPlanPv<=0 ?
      "refused-nonpositive-funded-plan-pv" : "conditional-zero-affiliate-cash-stress-only",
    provisionAmount:provision, actualGuaranteeCallsObserved:null,
    totalCommonCalls:rows.reduce((s,r)=>s+r.commonCall,0),
    actualFcfe5YearGrowth:fifth>0 ? (fifth/reference.actualBaseFcfe)**.2-1 : null,
    growthRejection:fifth<=0 ? "nonpositive-year-five-common-cash" : null,
    identifiedProjectLlcWaterfall:false, qualifiedOriginalIssuers:0, qualifiedOriginalPairs:0,
    reverseScoringPerformed:false, observedAllAffiliateCashSuspension:false,
  };
}

/** Explicit construction: no private record spread, market fields, per-case exports or source HTML. */
export function publicNeeRemittanceSummary(cases: { terminalFcfe: number; signedPlanPv: number;
  forwardWholeEquity: number|null; totalCommonCalls: number; provisionAmount:number }[]) {
  if (!cases.length || cases.some(c=>![c.terminalFcfe,c.signedPlanPv,c.totalCommonCalls,c.provisionAmount].every(Number.isFinite)))
    throw new Error("Finite nonempty derived cases required");
  const range = (values:number[]) => [Math.min(...values),Math.max(...values)];
  return { version:neeRemittanceExperiment.version, calculationCases:cases.length, futureCashRows:cases.length*16,
    positiveTerminalCases:cases.filter(c=>c.terminalFcfe>0).length,
    positiveConditionalValueCases:cases.filter(c=>c.forwardWholeEquity!==null).length,
    refusedFundedPlanCases:cases.filter(c=>c.terminalFcfe>0 && c.forwardWholeEquity===null).length,
    terminalCashRangeUsd:range(cases.map(c=>c.terminalFcfe)), signedPlanPvRangeUsd:range(cases.map(c=>c.signedPlanPv)),
    requiredCommonCallsRangeUsd:range(cases.map(c=>c.totalCommonCalls)),
    cashProvisionRangeUsd:range(cases.map(c=>c.provisionAmount)),
    qualifiedOriginalIssuers:0, qualifiedOriginalPairs:0, legalWaterfallIdentified:false,
    conditionalModelNotObservedForecast:true, marketReferenceOrPriceDataIncluded:false };
}

/** Grant-scope reconciliation, not an issuer valuation or a grant-cash forecast. */
export function grantPlainText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}

/** Exact entity/period/dimension/unit selection. Never selects a value to fit a bridge. */
export function extractFslrGrantScope(html: string) {
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/g))
    .map(m => [m[1], m[2]]));
  const facts = Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/gi));
  function fact(name: string, year: number, instant: boolean, member?: string) {
    const values = facts.filter(m => {
      const attr = (n: string) => m[1].match(new RegExp(`\\b${n}="([^"]+)"`))?.[1];
      const c = contexts.get(attr("contextRef") ?? "") ?? "";
      return attr("name") === name && attr("unitRef") === "usd" &&
        /<xbrli:identifier\b[^>]*>0001274494<\/xbrli:identifier>/.test(c) &&
        (member ? c.includes(`>${member}</xbrldi:explicitMember>`) : !c.includes("<xbrli:segment>")) &&
        (instant ? c.includes(`<xbrli:instant>${year}-12-31</xbrli:instant>`) :
          c.includes(`<xbrli:startDate>${year}-01-01</xbrli:startDate>`) &&
          c.includes(`<xbrli:endDate>${year}-12-31</xbrli:endDate>`));
    }).map(m => {
      const v = /fixed-zero/.test(m[1]) ? 0 : Number(grantPlainText(m[2]).replace(/,/g, "").trim());
      return v * 10 ** Number(m[1].match(/\bscale="([^"]+)"/)?.[1] ?? 0) *
        (m[1].includes('sign="-"') ? -1 : 1);
    });
    const unique = Array.from(new Set(values));
    if (unique.length !== 1 || !Number.isFinite(unique[0])) throw new Error(`Authentic unique source fact required: ${name}/${year}/${member ?? "consolidated"}`);
    return unique[0];
  }
  const text = grantPlainText(html);
  const specific = Array.from(text.matchAll(/During the year ended December 31, 2024, we recognized \$\s*([\d,.]+) million of Section 45X credits as a reduction to [“"]Cost of sales[.””"]+/g))
    .map(m => Number(m[1].replace(/,/g, "")) * 1e6);
  if (new Set(specific).size !== 1 || !Number.isFinite(specific[0])) throw new Error("Specific FY2024 MD&A45X disclosure absent/ambiguous");
  if (!text.includes("Supplemental disclosure of noncash investing and financing activities:") ||
    !text.includes("Proceeds to be received from asset-based government grants"))
    throw new Error("Noncash supplemental classification not authenticated");
  const benefit = (year: number) => ({
    ppe: fact("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", year, true, "us-gaap:PropertyPlantAndEquipmentMember"),
    otherAssets: fact("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", year, true, "us-gaap:OtherAssetsMember")
  });
  return {
    version: "fslr-grant-scope-1", fiscalYear: 2024, currency: "USD",
    reportedSpecific45xCostSalesUsd: specific[0],
    income: {
      costSales: fact("us-gaap:GovernmentAssistanceAmount", 2024, false, "us-gaap:CostOfSalesMember"),
      research: fact("us-gaap:GovernmentAssistanceAmount", 2024, false, "fslr:ResearchAndDevelopmentMember"),
      startup: fact("us-gaap:GovernmentAssistanceAmount", 2024, false, "fslr:ProductionStartUpMember")
    },
    cfoGrantAdjustment: -fact("fslr:IncreaseDecreaseInGovernmentGrantsReceivable", 2024, false),
    openingGrantReceivables: fact("us-gaap:GrantsReceivableCurrent", 2023, true) + fact("us-gaap:GrantsReceivableNoncurrent", 2023, true),
    closingGrantReceivables: fact("us-gaap:GrantsReceivableCurrent", 2024, true) + fact("us-gaap:GrantsReceivableNoncurrent", 2024, true),
    assetBenefits: { opening: benefit(2023), closing: benefit(2024) },
    // These native facts use ANNUAL DURATION contexts, not receivable instant contexts.
    noncashSupplement: {
      prior: fact("fslr:ProceedsToBeReceivedFromAssetBasedGovernmentGrants", 2023, false),
      current: fact("fslr:ProceedsToBeReceivedFromAssetBasedGovernmentGrants", 2024, false)
    }
  };
}

export function reconcileFslrGrantScope(source: ReturnType<typeof extractFslrGrantScope>, receipts: { fiserv: number; visa: number }) {
  const values = [source.reportedSpecific45xCostSalesUsd, ...Object.values(source.income),
    source.cfoGrantAdjustment, source.openingGrantReceivables, source.closingGrantReceivables,
    ...Object.values(source.assetBenefits.opening), ...Object.values(source.assetBenefits.closing),
    ...Object.values(source.noncashSupplement), ...Object.values(receipts)];
  if (source.fiscalYear !== 2024 || source.currency !== "USD" || values.some(v => !Number.isFinite(v) || v < 0))
    throw new Error("Finite nonnegative authentic source measures and FY2024/USD required");
  const allIncome = Object.values(source.income).reduce((s, v) => s + v, 0), selectedCash = receipts.fiserv + receipts.visa;
  const incomeScopeDifference = allIncome - source.reportedSpecific45xCostSalesUsd;
  const mixedScopeResidual = source.reportedSpecific45xCostSalesUsd + source.cfoGrantAdjustment - selectedCash;
  const originalResidual = allIncome + source.cfoGrantAdjustment - selectedCash;
  const bookDecrease = source.openingGrantReceivables - source.closingGrantReceivables;
  const originalBookCfoResidual = source.cfoGrantAdjustment - bookDecrease;
  const assetBenefitChange = Object.values(source.assetBenefits.closing).reduce((s, v) => s + v, 0) -
    Object.values(source.assetBenefits.opening).reduce((s, v) => s + v, 0);
  const noncashSupplementDifference = source.noncashSupplement.current - source.noncashSupplement.prior;
  if (incomeScopeDifference + mixedScopeResidual !== originalResidual) throw new Error("Income-scope cash identity failed");
  return {
    version: source.version, reportedSpecific45xCostSalesUsd: source.reportedSpecific45xCostSalesUsd,
    allIncomeGrantBenefitsUsd: allIncome, selectedCashUsd: selectedCash,
    costSalesScopeDifferenceUsd: source.income.costSales - source.reportedSpecific45xCostSalesUsd,
    incomeScopeDifferenceUsd: incomeScopeDifference, deliberatelyMixedScopeResidualUsd: mixedScopeResidual,
    priorUnallocatedResidualUsd: originalResidual, exactIncomeScopeIdentityResidualUsd: 0,
    priorBookCfoResidualUsd: originalBookCfoResidual, assetBenefitStockChangeUsd: assetBenefitChange,
    bookCfoMinusAssetBenefitChangeUsd: originalBookCfoResidual - assetBenefitChange,
    noncashSupplementCurrentUsd: source.noncashSupplement.current,
    noncashSupplementDifferenceUsd: noncashSupplementDifference,
    bookCfoMinusNoncashSupplementDifferenceUsd: originalBookCfoResidual - noncashSupplementDifference,
    specific45xNarrativeRoundingBoundUsd: 50000,
    mixedScopeResidualIncludingTwoReceiptRoundingBoundUsd: 150000,
    cashAdjustmentAppliedUsd: 0, observedOtherGrantCashUsd: null, exactVisaQ12025ReceiptDay: null,
    assetSupplementTreatedAsInstantReceivable: false, assetBenefitTreatedAsReceivable: false,
    unallocatedResidualFullyResolved: false, fullGrantReceivableCashRollforwardCertified: false,
    currentCompanyEligibilityCertified: false, qualifiedOriginalIssuers: 0,
    interpretation: "Scope identity only: all-income minus MD&A45X is NOT certified other-program cash. GrantCFO is all-program, not a45X-only adjustment. Asset-benefit stock and annual-duration noncash supplement are different measures; their near agreement does not prove receipt balances, cash, FX or zero.",
    missing: ["Programme-level gross/net45Xrecognition-to-receivable rollforward including credit-sale carrying adjustments",
      "Other-income grant receivable/cash/noncash/FX movements by programme",
      "Instant asset-based receivable and actual grant settlement/certification dates; annual-duration supplement is not automatically a stock"]
  };
}

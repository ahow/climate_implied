/** New source measurements only. Does not import any frozen issuer valuation engine. */
export function attachmentPlain(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
}
export function attachmentInventory(data: any, cik: string, accessionWithoutDashes: string) {
  if (data?.directory?.name !== `/Archives/edgar/data/${cik}/${accessionWithoutDashes}` || !Array.isArray(data.directory.item))
    throw new Error("Exact authenticated accession inventory required");
  const names: string[] = data.directory.item.map((x: any) => x.name);
  if (names.some(n => typeof n !== "string" || !/^[\w.-]+$/.test(n)) || new Set(names).size !== names.length)
    throw new Error("Unsafe/duplicate attachment names");
  return { accessionWithoutDashes, listedFiles: names.length,
    spreadsheetNames: names.filter(n => /\.xls[xmb]?$/i.test(n)),
    separatelyIrrNamedFiles: names.filter(n => /irr|financial.?model/i.test(n)),
    filenamesAloneCertifyIrrModel: false };
}
export function workbookMeasurements(book: { worksheets: { name: string; eachRow: Function }[] }) {
  let formulaCells = 0, xirrFormulaCells = 0;
  for (const sheet of book.worksheets) sheet.eachRow((row: any) => row.eachCell((cell: any) => {
    if (cell.value && typeof cell.value === "object" && typeof cell.value.formula === "string") {
      formulaCells++; if (/\bXIRR\s*\(/i.test(cell.value.formula)) xirrFormulaCells++;
    }
  }));
  return { worksheetCount: book.worksheets.length, worksheetNames: book.worksheets.map(s => s.name),
    formulaCells, xirrFormulaCells, namedIrrModelSheets: book.worksheets.map(s => s.name).filter(n => /IRR|Exhibit\s*B|Financial.Model/i.test(n)),
    noXirrFormulaAloneProvesAbsence: false };
}
export function nativeAttachmentReader(html: string, cik: string) {
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/g))
    .map(m => [m[1], m[2]]));
  const facts = Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/g));
  return (name: string, end: string, start?: string, member?: string) => {
    const values = facts.filter(m => {
      const attr = (key: string) => m[1].match(new RegExp(`\\b${key}="([^"]+)"`))?.[1];
      const c = contexts.get(attr("contextRef") ?? "") ?? "";
      return attr("name") === name && attr("unitRef") === "usd" &&
        new RegExp(`<xbrli:identifier\\b[^>]*>${cik}</xbrli:identifier>`).test(c) &&
        (member ? (c.includes(`>${member}</xbrldi:explicitMember>`) ||
          (c.includes('<xbrldi:typedMember dimension="us-gaap:StatementOfIncomeLocationBalanceAxis">') &&
            c.includes(`<us-gaap:QName.domain>${member}</us-gaap:QName.domain>`))) : !c.includes("<xbrli:segment>")) &&
        (start ? c.includes(`<xbrli:startDate>${start}</xbrli:startDate>`) && c.includes(`<xbrli:endDate>${end}</xbrli:endDate>`) :
          c.includes(`<xbrli:instant>${end}</xbrli:instant>`));
    }).map(m => (/fixed-zero/.test(m[1]) ? 0 : Number(attachmentPlain(m[2]).trim().replace(/,/g, ""))) *
      10 ** Number(m[1].match(/scale="([^"]+)"/)?.[1] ?? 0) * (m[1].includes('sign="-"') ? -1 : 1));
    const unique = Array.from(new Set(values));
    if (unique.length !== 1 || !Number.isFinite(unique[0])) throw new Error(`Unique native source/entity/period/dimension/USD fact required: ${name}/${end}`);
    return unique[0];
  };
}
export function extractFslrAnnualInterimGrants(annualHtml: string, interimHtml: string) {
  const a = nativeAttachmentReader(annualHtml, "0001274494"), q = nativeAttachmentReader(interimHtml, "0001274494");
  const annual = (name: string, member?: string) => a(name, "2025-12-31", "2025-01-01", member);
  const interim = (name: string, member?: string) => q(name, "2026-06-30", "2026-01-01", member);
  const t = attachmentPlain(interimHtml);
  if (!t.includes("the first of which was received in July 2026") ||
    !t.includes("We adopted this standard on a modified prospective basis effective January 1, 2026") ||
    !t.includes("There were no amounts recognized during the six months ended June 30, 2026 related to government grants accounted for using the cost accumulation approach"))
    throw new Error("Actual new interim receipt/ASC832/recognition-period clauses required");
  const specific = attachmentPlain(annualHtml).match(/During the year ended December 31, 2025, we recognized \$\s*([\d.]+) billion of Section 45X credits/);
  if (!specific) throw new Error("Specific annual MD&A45Xmeasure absent");
  return {
    annual2025: { cfo: annual("us-gaap:NetCashProvidedByUsedInOperatingActivities"),
      incomeGrants: [
        annual("us-gaap:GovernmentAssistanceAmount", "us-gaap:CostOfSalesMember"),
        annual("us-gaap:GovernmentAssistanceAmount", "us-gaap:SellingGeneralAndAdministrativeExpensesMember"),
        annual("us-gaap:GovernmentAssistanceAmount", "fslr:ResearchAndDevelopmentMember"),
        annual("us-gaap:GovernmentAssistanceAmount", "fslr:ProductionStartUpMember")],
      grantCfoEffect: -annual("fslr:IncreaseDecreaseInGovernmentGrantsReceivable"),
      openingGrantReceivables: a("us-gaap:GrantsReceivableCurrent", "2024-12-31") + a("us-gaap:GrantsReceivableNoncurrent", "2024-12-31"),
      closingGrantReceivables: a("us-gaap:GrantsReceivableCurrent", "2025-12-31") + a("us-gaap:GrantsReceivableNoncurrent", "2025-12-31"),
      specific45xNarrative: Number(specific[1]) * 1e9, specific45xNarrativeRoundingBound: 50e6 },
    interim2026h1: { cfo: interim("us-gaap:NetCashProvidedByUsedInOperatingActivities"),
      incomeGrants: [interim("us-gaap:GovernmentAssistanceOperatingIncome", "us-gaap:CostOfGoodsAndServicesSold"),
        interim("us-gaap:GovernmentAssistanceOperatingIncome", "us-gaap:SellingGeneralAndAdministrativeExpense"),
        interim("us-gaap:GovernmentAssistanceOperatingIncome", "us-gaap:ResearchAndDevelopmentExpense")],
      grantCfoEffect: -interim("fslr:IncreaseDecreaseInGovernmentGrantsReceivable"),
      closingGrantReceivables: q("us-gaap:GrantsReceivableCurrent", "2026-06-30") + q("us-gaap:GrantsReceivableNoncurrent", "2026-06-30"),
      treasury2024OriginRefund: interim("fslr:GovernmentAssistanceRefundsReceived"),
      indiaFirstReceiptMonth: "2026-07", indiaFirstReceiptCashUsd: null,
      indiaReceiptBelongsToSixMonthCashPeriod: false, recognitionFramework: "ASC832-modified-prospective-2026-01-01" }
  };
}
export function reconcileFslrAnnualInterimGrants(s: ReturnType<typeof extractFslrAnnualInterimGrants>,
  selectedCash: { annual2025: number; interim2026h1: number }) {
  if (Object.values(selectedCash).some(v => !Number.isFinite(v) || v < 0)) throw new Error("Authenticated selected credit cash required");
  const a = s.annual2025, q = s.interim2026h1;
  const aIncome = a.incomeGrants.reduce((x, y) => x + y, 0), qIncome = q.incomeGrants.reduce((x, y) => x + y, 0);
  return {
    annual2025: { cfoUsd: a.cfo, allIncomeGrantBenefitsUsd: aIncome, identifiedSelectedCreditCashUsd: selectedCash.annual2025,
      cfoLessSelectedCreditCashUsd: a.cfo - selectedCash.annual2025,
      grantRecognitionCfoLessSelectedCashResidualUsd: aIncome + a.grantCfoEffect - selectedCash.annual2025,
      bookCfoResidualUsd: a.grantCfoEffect - (a.openingGrantReceivables - a.closingGrantReceivables),
      specific45xNarrativeUsd: a.specific45xNarrative,
      allIncomeLessCoarse45xNarrativeUsd: aIncome - a.specific45xNarrative,
      coarse45xScopeDifferenceIsCertifiedOtherGrants: false, specific45xNarrativeRoundingBoundUsd: a.specific45xNarrativeRoundingBound },
    interim2026h1: { cfoUsd: q.cfo, allIncomeGrantBenefitsUsd: qIncome, identifiedSelectedCreditCashUsd: selectedCash.interim2026h1,
      grantRecognitionCfoLessSelectedCashResidualUsd: qIncome + q.grantCfoEffect - selectedCash.interim2026h1,
      bookCfoResidualUsd: q.grantCfoEffect - (a.closingGrantReceivables - q.closingGrantReceivables),
      indiaFirstReceiptMonth: q.indiaFirstReceiptMonth, indiaFirstReceiptCashUsd: null,
      firstIndiaReceiptIsAfterJune30CashPeriod: true },
    amountAppliedToOriginal32CashRowsUsd: 0, original32RowsChanged: false,
    fullProgrammeCashRollforwardIdentified: false, currentCompany45xEligibilityCertified: false,
    interpretation: "All-program grant/CFOdiagnostics, not grant-free recurring FCFE or audited45X-only rollforwards. JulyIndiareceipt is a subsequent-period actual month, amount undisclosed here; never add1/6of a stock/recognition balance. ASC832tag/presentation changes explicitly selected, no missing-tag zero fallback."
  };
}
export function extractXplr2025Funding(html: string) {
  const read = nativeAttachmentReader(html, "0001603145"), get = (name: string, member?: string) => read(name, "2025-12-31", "2025-01-01", member);
  const text = attachmentPlain(html);
  const renewal = text.match(/In April 2025, XPLR exercised its buyout right and purchased the remaining outstanding Class B noncontrolling membership interests in XPLR Renewables II for approximately \$\s*([\d,.]+) million/);
  const pipelines = text.match(/remaining outstanding Class B membership interests in XPLR Pipelines for approximately \$\s*([\d,.]+) million/);
  if (!renewal || !pipelines) throw new Error("Actual dated remaining-unit buyout clauses absent");
  const member = "xplr:NoncontrollingOwnershipInterestsInXPLROpCoTexasPipelineAndSilverStateMember";
  return {
    cfo: get("us-gaap:NetCashProvidedByUsedInOperatingActivities"), investingCash: get("us-gaap:NetCashProvidedByUsedInInvestingActivities"),
    financingCash: get("us-gaap:NetCashProvidedByUsedInFinancingActivities"),
    commonProceeds: get("us-gaap:ProceedsFromIssuanceOfCommonStock"), debtProceeds: get("us-gaap:ProceedsFromIssuanceOfLongTermDebt"),
    debtRepayments: get("us-gaap:RepaymentsOfOtherLongTermDebt"), debtFees: get("us-gaap:PaymentsOfFinancingCosts"),
    partnerContributions: get("us-gaap:ProceedsFromPartnershipContribution"), partnerDistributions: get("us-gaap:PaymentsOfCapitalDistribution"),
    classBPayments: get("xplr:PaymentsToSubsidiaryInvestor"), classBBuyouts: get("us-gaap:PaymentsToMinorityShareholders"),
    classBProceeds: get("us-gaap:ProceedsFromMinorityShareholders"),
    dmiSaleProceeds: get("xplr:ProceedsOnSaleOfDifferentialMembershipInterests"),
    dmiProceeds: get("us-gaap:ProceedsFromSaleOfInterestInPartnershipUnit"),
    dmiPayments: get("xplr:PaymentstoInterestinPartnershipUnit"), dmiBuyouts: get("xplr:PaymentsToDifferentialMembershipInvestors"),
    otherFinancing: get("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities"),
    cashChange: get("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect"),
    neeCategoryDistributions: get("xplr:RelatedPartyDistributions", member),
    neeCategoryContributionsEquityMovement: get("xplr:RelatedPartyContributions", member),
    renewablesIiBuyoutCashNarrative: Number(renewal[1].replace(/,/g, "")) * 1e6,
    pipelinesBuyoutCashNarrative: Number(pipelines[1].replace(/,/g, "")) * 1e6,
    renewablesIiRemainingExternalUnitsBoughtMonth: "2025-04"
  };
}
export function reconcileXplr2025Funding(s: ReturnType<typeof extractXplr2025Funding>) {
  const rebuilt = s.commonProceeds + s.debtProceeds - s.debtRepayments - s.debtFees + s.partnerContributions - s.partnerDistributions -
    s.classBPayments - s.classBBuyouts + s.classBProceeds + s.dmiSaleProceeds + s.dmiProceeds - s.dmiPayments - s.dmiBuyouts + s.otherFinancing;
  const financingResidual = rebuilt - s.financingCash, cashResidual = s.cfo + s.investingCash + s.financingCash - s.cashChange;
  const buyoutResidual = s.renewablesIiBuyoutCashNarrative + s.pipelinesBuyoutCashNarrative - s.classBBuyouts;
  if ([financingResidual, cashResidual, buyoutResidual].some(v => !Number.isFinite(v) || v !== 0))
    throw new Error("Actual aggregate financing/cash/buyout sources do not reconcile");
  return {
    actualRenewablesIiRemainingBuyoutUsd: s.renewablesIiBuyoutCashNarrative, actualPipelinesRemainingBuyoutUsd: s.pipelinesBuyoutCashNarrative,
    actualClassBBuyoutFinancingCashUsd: s.classBBuyouts, rebuiltFinancingCashUsd: rebuilt,
    actualCfoUsd: s.cfo, actualInvestingCashUsd: s.investingCash, actualCashChangeUsd: s.cashChange,
    netDebtAfterFeesUsd: s.debtProceeds - s.debtRepayments - s.debtFees,
    netDebtAfterFeesLessClassBBuyoutsUsd: s.debtProceeds - s.debtRepayments - s.debtFees - s.classBBuyouts,
    financingResidualUsd: financingResidual, cashResidualUsd: cashResidual, reportedBuyoutPartitionResidualUsd: buyoutResidual,
    neeCategoryDistributions2025Usd: s.neeCategoryDistributions, neeCategoryContributionEquityMovement2025Usd: s.neeCategoryContributionsEquityMovement,
    renewablesIiAllRemainingExternalUnitsBoughtMonth: s.renewablesIiRemainingExternalUnitsBoughtMonth,
    oldConditionalClaim965And1882Preserved: true,
    actualLlcAvailableCashUsd: null, actualProjectIrr: null, neeCommonCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "Source actual April2025remaining-unit buyout changes ownership premise, but931m acquisition cash and aggregate1150m buyout financing are not omitted. Financing sources fungible: no transaction-specific debt earmarking or common-equity attribution. Corporate739mCFO is NOT LLCAvailableCash. Old30%-holding96.5%/18.82%claim remains a separately frozen counterfactual, not actual post-buyout cash allocation."
  };
}

import { attachmentPlain, nativeAttachmentReader } from "./issuerAttachmentGrantInputs";
export function extractFslrAsc832Quarter(html: string) {
  const text = attachmentPlain(html);
  const clause = text.match(/During the three and nine months ended September 30, 2026, we recognized \$\s*([\d.]+) million of government grants using the cost accumulation approach/);
  if (!clause || !text.includes("manufacturing facilities in Alabama") ||
    !text.includes("were recorded as a reduction to “Property, plant and equipment, net”"))
    throw new Error("Alabama recognition period/location/asset-basis source required");
  const n = nativeAttachmentReader(html, "0001274494");
  const names = ["us-gaap:CostOfGoodsAndServicesSold", "us-gaap:SellingGeneralAndAdministrativeExpense",
    "us-gaap:ResearchAndDevelopmentExpense", "fslr:ProductionStartUpExpense"];
  const q = names.map(member => n("us-gaap:GovernmentAssistanceOperatingIncome", "2026-09-30", "2026-07-01", member));
  const y = names.map(member => n("us-gaap:GovernmentAssistanceOperatingIncome", "2026-09-30", "2026-01-01", member));
  const recognition = Number(clause[1]) * 1e6;
  const nativeAwardInstant = n("us-gaap:GovernmentAssistanceAwardAmount", "2026-09-30");
  if (recognition !== nativeAwardInstant) throw new Error("Recognition note/instant award-tag crosscheck differs");
  return {
    quarterExpenseBenefitsUsd: q, nineMonthExpenseBenefitsUsd: y,
    alabamaQuarterAssetRecognitionFromNoteUsd: recognition, alabamaNineMonthAssetRecognitionFromNoteUsd: recognition,
    nativeAwardInstantTagUsd: nativeAwardInstant, awardInstantTagAloneDefinesRecognitionPeriod: false,
    nineMonthGrantCfoEffectUsd: -n("fslr:IncreaseDecreaseInGovernmentGrantsReceivable", "2026-09-30", "2026-01-01"),
    closingAllGrantReceivablesUsd: n("us-gaap:GrantsReceivableCurrent", "2026-09-30") + n("us-gaap:GrantsReceivableNoncurrent", "2026-09-30"),
    nineMonthNoncashProceedsToBeReceivedSupplementUsd: n("fslr:ProceedsToBeReceivedFromAssetBasedGovernmentGrants", "2026-09-30", "2026-01-01"),
    quarterNineMonthAssetRecognitionCashUsd: null, indiaJulyCashAmountUsd: null
  };
}
export function reconcileFslrAsc832Quarter(s: ReturnType<typeof extractFslrAsc832Quarter>, prior: {
  firstHalfExpenseBenefitsUsd: number[]; firstHalfGrantCfoEffectUsd: number; firstHalfClosingAllGrantReceivablesUsd: number;
  openingAllGrantReceivablesUsd: number; selectedPriorCreditCashCollectedFirstHalfUsd: number; indiaFirstReceiptMonth: string;
}) {
  if (prior.firstHalfExpenseBenefitsUsd.length !== 3 || s.quarterExpenseBenefitsUsd.length !== 4 || s.nineMonthExpenseBenefitsUsd.length !== 4)
    throw new Error("Exact reported expense-axis rows required; no missing-tag zero fallback");
  const residuals = prior.firstHalfExpenseBenefitsUsd.map((v, i) => s.nineMonthExpenseBenefitsUsd[i] - s.quarterExpenseBenefitsUsd[i] - v);
  if (residuals.some(v => v !== 0)) throw new Error("Reported half/quarter/YTD recognition axes do not reconcile");
  const startupDerivedH1 = s.nineMonthExpenseBenefitsUsd[3] - s.quarterExpenseBenefitsUsd[3];
  const sum = (v: number[]) => v.reduce((x, y) => x + y, 0), quarter = sum(s.quarterExpenseBenefitsUsd), nine = sum(s.nineMonthExpenseBenefitsUsd);
  const half = sum(prior.firstHalfExpenseBenefitsUsd) + startupDerivedH1;
  const quarterCfo = s.nineMonthGrantCfoEffectUsd - prior.firstHalfGrantCfoEffectUsd;
  return {
    alabamaQuarterAssetGrantRecognitionUsd: s.alabamaQuarterAssetRecognitionFromNoteUsd,
    alabamaNineMonthAssetGrantRecognitionUsd: s.alabamaNineMonthAssetRecognitionFromNoteUsd,
    alabamaDerivedFirstHalfAssetGrantRecognitionUsd: s.alabamaNineMonthAssetRecognitionFromNoteUsd - s.alabamaQuarterAssetRecognitionFromNoteUsd,
    alabamaAssetGrantObservedCashUsd: null,
    allProgrammeQuarterIncomeBenefitsUsd: quarter, allProgrammeNineMonthIncomeBenefitsUsd: nine,
    allProgrammeFirstHalfBenefitsWithDerivedStartupUsd: half, derivedFirstHalfStartupBenefitsUsd: startupDerivedH1,
    firstHalfStartupIsDerivedNotMissingFactZero: true,
    expenseAxisReconciliationResidualsUsd: residuals, allExpenseAxisReconciliationResidualUsd: nine - half - quarter,
    nineMonthRecognitionCfoLessOnlyKnownPriorCreditCashResidualUsd: nine + s.nineMonthGrantCfoEffectUsd - prior.selectedPriorCreditCashCollectedFirstHalfUsd,
    quarterRecognitionCfoUnallocatedResidualUsd: quarter + quarterCfo,
    nineMonthBookCfoResidualUsd: s.nineMonthGrantCfoEffectUsd - (prior.openingAllGrantReceivablesUsd - s.closingAllGrantReceivablesUsd),
    quarterBookCfoResidualUsd: quarterCfo - (prior.firstHalfClosingAllGrantReceivablesUsd - s.closingAllGrantReceivablesUsd),
    nineMonthNoncashProceedsToBeReceivedSupplementUsd: s.nineMonthNoncashProceedsToBeReceivedSupplementUsd,
    indiaFirstReceiptMonthPreserved: prior.indiaFirstReceiptMonth, indiaJulyCashAmountUsd: null,
    original32CashRowsChanged: false, amountAddedToOriginalCashRowsUsd: 0, actualEligibleUsComponentWatts: null,
    currentCompany45xEligibilityCertified: false, qualifiedOriginalIssuers: 0,
    boundary: "Quarter/YTD expense-axis recognition reconciliation, NOT a programme cash rollforward.6.1m is Alabama PP&Ecost-basis reduction, not observed grant cash; instant AwardAmount tag alone cannot supply recognition duration. First-halfstartup derives from YTDminusquarter, never missing-tag zero. IndiaJulyactualmonth remains from earlier H1note; amount/day/classification undisclosed in this inspected Q3note. Do not turn noncash supplement/book changes or unallocated residuals into India receipts,45Xeligiblewatts or cash additions."
  };
}

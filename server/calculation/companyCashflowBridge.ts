import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { buildFplSolarCases, calculateFplSolarCohort, fplChannelEvidence } from "./companyConditionalCases";

/**
 * Incremental, conditional asset economics only. These bounds are deliberately
 * analyst stress limits, NOT observations, fitted confidence bounds or guidance.
 * No default economic input is silently substituted for missing evidence.
 */
const cashSpec = z.object({
  annualOmUsdPerKw: z.number().finite().min(0).max(100),
  annualDebtRate: z.number().finite().min(0).max(0.2),
  cashTaxRate: z.number().finite().min(0).max(0.5),
  collectionDeferredFraction: z.number().finite().min(0).max(1),
}).strict();

export const fplCashAssumptions = Object.freeze({
  version: "fpl-incremental-cash-bridge-1",
  knowledgeCutoff: "2026-11-10T04:29:45.000Z",
  economicInputsStatus: "analyst hypothetical stress inputs; not evidenced estimates",
  conventions: Object.freeze([
    "Nominal USD 2027–2031; no inflation/escalation, incremental FPL cohort, not consolidated NEE.",
    "O&M is paid annually for all installed kW even if recovery is denied.",
    "Revenue recognition equals hypothetical approved cost-of-service requirement; no claim of actual billing entitlement.",
    "Admitted O&M and average debt return are recovered only while cohort recovery is active.",
    "Allowed equity earnings are grossed up by assumed cash tax; book depreciation equals tax depreciation; no loss refunds or carryforward benefit.",
    "No ITC/PTC, ADIT, AFUDC or customer sharing modelled: exclusion boundary, not evidence of zero entitlement.",
    "Debt drawn at commissioning January 1, 2027; principal amortizes at year-end over the same 30-year book life; average annual debt sets interest.",
    "Revenue deferred from collection is collected the following year; no bad debt; opening receivables zero; closing 2031 receivables are not liquidated.",
    "Other working capital, non-operating income, attribution and other cash adjustments excluded from this incremental boundary; no issuer zero-fill.",
    "No terminal value, no growth/CAGR from negative initial cohort cash flow, no arbitrary discount rate, no emissions or climate-only attribution inferred.",
  ]),
  members: Object.freeze([
    Object.freeze({ id: "lower-cost-prompt-collection", annualOmUsdPerKw: 10, annualDebtRate: 0.04, cashTaxRate: 0.20, collectionDeferredFraction: 0 }),
    Object.freeze({ id: "higher-cost-delayed-collection", annualOmUsdPerKw: 30, annualDebtRate: 0.08, cashTaxRate: 0.30, collectionDeferredFraction: 0.25 }),
  ]),
  rationale: "Two transparent what-if points: triple O&M, double debt cost, ten percentage points more cash tax and quarter-year-equivalent receivables stress. Not calibrated, not asserted to bracket outcomes, not assigned probabilities.",
});

export function calculateFplCashBridge(
  solarInputs: unknown,
  cashInputs: unknown,
) {
  // Validate/recalculate asset rows rather than trusting a caller-supplied ledger.
  const solar = calculateFplSolarCohort(solarInputs);
  const x = cashSpec.parse(cashInputs);
  const initialDebt = solar.capex * (1 - solar.inputs.equityRatio);
  const annualPrincipal = initialDebt / solar.inputs.bookLifeYears;
  let receivables = 0;
  const years = solar.years.map((asset, i) => {
    const openingDebt = initialDebt - annualPrincipal * i;
    const closingDebt = openingDebt - annualPrincipal;
    const interest = (openingDebt + closingDebt) / 2 * x.annualDebtRate;
    const cashOm = solar.inputs.solarMw * 1_000 * x.annualOmUsdPerKw;
    const recoveryFraction = asset.recoveryActive ? solar.inputs.admittedNetRateBaseFraction : 0;
    const omRecovery = cashOm * recoveryFraction;
    const debtReturnRecovery = interest * recoveryFraction;
    const taxGrossUp = asset.allowedEquityEarnings * x.cashTaxRate / (1 - x.cashTaxRate);
    const revenue = asset.partialCapitalRevenueRequirement + omRecovery + debtReturnRecovery + taxGrossUp;
    const openingReceivables = receivables;
    receivables = revenue * x.collectionDeferredFraction;
    const increaseWorkingCapital = receivables - openingReceivables;
    const cashCollections = revenue - increaseWorkingCapital;
    const operatingProfit = revenue - cashOm - asset.depreciation;
    const preTaxIncome = operatingProfit - interest;
    const cashTax = Math.max(0, preTaxIncome) * x.cashTaxRate;
    const netIncome = preTaxIncome - cashTax;
    const debtDraw = i === 0 ? initialDebt : 0;
    const netBorrowing = debtDraw - annualPrincipal;
    const operatingCashFlow = cashCollections - cashOm - interest - cashTax;
    const fcfe = netIncome + asset.depreciation - asset.capitalSpend - increaseWorkingCapital + netBorrowing;
    const cashRouteFcfe = operatingCashFlow - asset.capitalSpend + netBorrowing;
    const row = {
      year: asset.year, revenue, omRecovery, debtReturnRecovery, taxGrossUp,
      allowedEquityEarnings: asset.allowedEquityEarnings,
      openingReceivables, closingReceivables: receivables, cashCollections,
      cashOm, operatingProfit, operatingMargin: revenue === 0 ? null : operatingProfit / revenue,
      depreciation: asset.depreciation, interest, preTaxIncome, cashTax, netIncome,
      capex: asset.capitalSpend, increaseWorkingCapital, openingDebt, closingDebt,
      debtDraw, principalRepayment: annualPrincipal, netBorrowing, operatingCashFlow,
      fcfe, cashRouteFcfe, reconciliationResidual: fcfe - cashRouteFcfe,
    };
    if (Object.values(row).some(v => typeof v === "number" && !Number.isFinite(v)))
      throw new Error("Nonfinite incremental cash bridge");
    if (Math.abs(row.reconciliationResidual) > 0.00001)
      throw new Error("FCFE reconciliation failed");
    return row;
  });
  return {
    status: "conditional-incremental-FPL-FCFE-not-issuer-forecast",
    definition: { basis: "FCFE", currency: "USD", nominal: true, horizonYears: 5, firstYear: solar.inputs.firstYear },
    inputs: { solar: solar.inputs, cash: x },
    inputHash: contentHash({ solar: solar.inputs, cash: x, conventions: fplCashAssumptions }),
    evidenceHash: contentHash(fplChannelEvidence), years,
    cumulativeFcfe: years.reduce((s, y) => s + y.fcfe, 0),
    issuerFcfe: null, issuerGrowth: null, productionEligible: false, probabilityWeights: null,
    valuationBoundary: "Same nominal USD FCFE algebra as companyProjection; incremental five-year flows only. Not a total equity valuation or FCFF/WACC series.",
  };
}

export function buildFplCashCases() {
  return {
    assumptions: fplCashAssumptions, assumptionHash: contentHash(fplCashAssumptions),
    evidence: fplChannelEvidence,
    members: buildFplSolarCases().members.flatMap(solar =>
      fplCashAssumptions.members.map(({ id, ...cash }) => ({
        id: `${solar.id}/${id}`, ...calculateFplCashBridge(solar.inputs, cash),
      }))),
    incrementalIssuerChannelsWithCashBridge: 1, fullCompanyCaseCount: 0,
  };
}

import { z } from "zod";
import { contentHash } from "../calculation/analysisManifest";

const number = z.number().finite();
const common = z.object({
  symbol: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.literal("FY"), reportedCurrency: z.string().regex(/^[A-Z]{3}$/),
});
const incomeSchema = common.extend({
  revenue: number.positive(), operatingIncome: number, incomeBeforeTax: number,
  incomeTaxExpense: number, interestExpense: number.nonnegative(), netIncome: number,
});
const cashSchema = common.extend({
  netIncome: number, depreciationAndAmortization: number.nonnegative(),
  operatingCashFlow: number, capitalExpenditure: number.max(0),
  netDebtIssuance: number, changeInWorkingCapital: number,
});

/** Explicit current-provider accounting bridge, NOT an approved company model.
 * Provider cash-flow working-capital change is its signed cash contribution;
 * the engine uses the opposite sign: an increase in working capital is a use.
 * Residuals are disclosed, not silently treated as sustainable recurring cash.
 */
export function reconcileCompanyBaseline(incomeInput: unknown, cashInput: unknown) {
  const income = incomeSchema.parse(incomeInput), cash = cashSchema.parse(cashInput);
  for (const key of ["symbol", "date", "period", "reportedCurrency"] as const)
    if (income[key] !== cash[key]) throw new Error(`Statement ${key} mismatch`);
  const netIncomeBeforeAttribution = income.incomeBeforeTax - income.incomeTaxExpense;
  const incomeAttributionAdjustment = cash.netIncome - netIncomeBeforeAttribution;
  const nonOperatingIncome = income.incomeBeforeTax - income.operatingIncome + income.interestExpense;
  const increaseWorkingCapital = -cash.changeInWorkingCapital;
  const otherCashAdjustments = cash.operatingCashFlow - cash.netIncome -
    cash.depreciationAndAmortization + increaseWorkingCapital;
  const capex = -cash.capitalExpenditure;
  const fcfe = cash.operatingCashFlow - capex + cash.netDebtIssuance;
  const rebuiltCash = netIncomeBeforeAttribution + incomeAttributionAdjustment +
    cash.depreciationAndAmortization - increaseWorkingCapital + otherCashAdjustments;
  const tolerance = Math.max(1, Math.abs(cash.operatingCashFlow)) * 1e-12;
  if (Math.abs(rebuiltCash - cash.operatingCashFlow) > tolerance ||
      ![fcfe, rebuiltCash, nonOperatingIncome, otherCashAdjustments].every(Number.isFinite))
    throw new Error("Operating cash-flow bridge does not reconcile");
  const effectiveTaxRate = income.incomeBeforeTax > 0
    ? income.incomeTaxExpense / income.incomeBeforeTax : null;
  return {
    symbol: income.symbol, period: income.date, currency: income.reportedCurrency,
    inputHash: contentHash({ income, cash }), baseRevenue: income.revenue, baseFcfe: fcfe,
    operatingMargin: income.operatingIncome / income.revenue, interest: income.interestExpense,
    effectiveTaxRate, depreciation: cash.depreciationAndAmortization, capex,
    increaseWorkingCapital, netBorrowing: cash.netDebtIssuance,
    nonOperatingIncome, incomeAttributionAdjustment, otherCashAdjustments,
    statementNetIncomeDifference: income.netIncome - cash.netIncome,
    operatingCashFlow: cash.operatingCashFlow, rebuiltCash,
    cashFlowReconciliationResidual: rebuiltCash - cash.operatingCashFlow,
    positiveFcfe: fcfe > 0,
    taxRateUsable: effectiveTaxRate !== null && effectiveTaxRate >= 0 && effectiveTaxRate <= 1,
    status: "accounting-bridge-not-approved" as const,
    historicalBasis: "revised-history", productionEligible: false,
    reviewRequired: [
      "Verify cash-flow working-capital sign against the issuer statement.",
      "Reconcile net-income attribution and non-operating items to issuer disclosures.",
      "Decompose other cash adjustments; a balancing residual is not evidence of recurrence.",
      "Net borrowing is financing, not operating growth; do not extrapolate it implicitly.",
      "Independent identity, cash-flow ownership, source vintages and carbon boundaries remain separate.",
    ],
  };
}

import { z } from "zod";
import { contentHash } from "./analysisManifest";

/** Standalone, private conditional experiment. Not a production forecast or empirical fit. */
const provenance = z.object({
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  observedAt: z.string().datetime(),
  frozenAt: z.string().datetime(),
  firstYear: z.number().int().min(2027),
}).strict();

export const fslrFiveYearAssumptions = Object.freeze({
  version: "fslr-whole-issuer-conditional-1",
  sales: 5.05e9, grossProfitIncludingCredit: 2.5e9,
  operatingExpenses: 622.5e6, recognizedCredit: 2.145e9, capex: .9e9,
  depreciation: 529.216e6, interestExpense: 44.131e6,
  interestIncome: 81.762e6, fxExpense: 38.569e6, otherExpense: 15.013e6,
  openingDebt: 498.572e6, annualRollover: 215.979e6,
  cashTaxRate: .20, equityDiscountRate: .10,
  baseCollectionDays: 30, stressCollectionDays: 60, creditCollectionLag: .25,
  baseCreditRetention: 1, stressCreditRetention: .5,
  rationale: [
    "Sales, gross profit, operating expenses, credit and capex are arithmetic midpoints of 2026 issuer guidance; their joint occurrence is an analyst assumption, not joint issuer guidance.",
    "Repeat these nominal levels for all five prospective years: deliberately no growth or inflation extrapolation, not management guidance for those years.",
    "D&A, interest income/expense, FX and other expense are frozen at reported FY2025 levels. D&A is the only noncash addback; all other expenses are conservatively treated as cash-equivalent, including compensation.",
    "20% cash tax, no deferred-tax or loss-refund benefit: a conditional round-number sensitivity, not an estimate of future jurisdictional taxes.",
    "30 versus 60 customer collection days isolates one additional month of customer funding; opening receivables equal the base steady-state assumption, not a reported future opening balance.",
    "Credit recognition is already in gross profit. Stress removes half once; remaining credits are monetized at face value with a quarter-year receivable. No transfer discount or law-change date asserted.",
    "Opening credit receivable is base credit times quarter-year lag. Other inventory/payables/advances/grants and operating balances are held constant, explicitly implying zero changes, not asserted to be zero balances.",
    "Debt balance starts at reported FY2025 current plus long-term debt; each year the reported current portion is refinanced in equal amount. Constant debt/interest, no net new borrowing; not a prediction of contractual maturities.",
    "Interest income is frozen rather than reinvested; FCFE is available for distribution, not added to a cash balance. No acquisitions, business disposals or other investing; securities trades are treasury reallocations excluded from operating FCFE.",
    "10% cost of equity is a transparent valuation sensitivity, not fitted beta or an approved discount rate. Finite five-year PV only; no terminal value, market-cap gap or whole equity price claim.",
    "Policy channel is manufacturing-credit retention, not tariffs, CAT coefficients, abatement, probabilities or Scope3 attribution. No claim of empirical climate causality.",
  ],
});

export function buildFslrIssuerFiveYear(input: unknown) {
  const p = provenance.parse(input);
  if (Date.parse(p.observedAt) > Date.parse(p.frozenAt)) throw new Error("Source observed after freeze");
  if (p.firstYear <= new Date(p.frozenAt).getUTCFullYear()) throw new Error("Horizon must be prospective");
  const a = fslrFiveYearAssumptions;
  const members = [
    { id: "base", retention: a.baseCreditRetention, collectionDays: a.baseCollectionDays },
    { id: "stress", retention: a.stressCreditRetention, collectionDays: a.stressCollectionDays },
  ].map(scenario => {
    let ar = a.sales * a.baseCollectionDays / 365;
    let creditReceivable = a.recognizedCredit * a.creditCollectionLag;
    const years = Array.from({ length: 5 }, (_, i) => {
      const openingReceivables = ar, openingCreditReceivable = creditReceivable;
      const recognizedCredit = a.recognizedCredit * scenario.retention;
      ar = a.sales * scenario.collectionDays / 365;
      creditReceivable = recognizedCredit * a.creditCollectionLag;
      const customerWorkingCapitalIncrease = ar - openingReceivables;
      const creditWorkingCapitalIncrease = creditReceivable - openingCreditReceivable;
      const workingCapitalIncrease = customerWorkingCapitalIncrease + creditWorkingCapitalIncrease;
      const grossProfit = a.grossProfitIncludingCredit - a.recognizedCredit + recognizedCredit;
      const operatingIncome = grossProfit - a.operatingExpenses;
      const pretaxIncome = operatingIncome + a.interestIncome - a.interestExpense - a.fxExpense - a.otherExpense;
      const cashTax = Math.max(0, pretaxIncome) * a.cashTaxRate;
      const netIncome = pretaxIncome - cashTax;
      const customerCollections = a.sales - customerWorkingCapitalIncrease;
      const creditCollections = recognizedCredit - creditWorkingCapitalIncrease;
      // Credits reduce reported cost of sales; reverse that benefit before deriving cash cost.
      const operatingCashCosts = a.sales - (grossProfit - recognizedCredit) + a.operatingExpenses - a.depreciation;
      const operatingCashFlow = customerCollections + creditCollections - operatingCashCosts
        + a.interestIncome - a.interestExpense - a.fxExpense - a.otherExpense - cashTax;
      const netBorrowing = a.annualRollover - a.annualRollover;
      const fcfe = operatingCashFlow - a.capex + netBorrowing;
      const earningsRouteFcfe = netIncome + a.depreciation - workingCapitalIncrease - a.capex + netBorrowing;
      const reconciliationResidual = fcfe - earningsRouteFcfe;
      if (Math.abs(reconciliationResidual) > .00001) throw new Error("FCFE reconciliation failed");
      return {
        year: p.firstYear + i, revenue: a.sales, grossProfit, operatingIncome,
        operatingMargin: operatingIncome / a.sales, recognizedCredit,
        openingReceivables, closingReceivables: ar, customerCollections,
        openingCreditReceivable, closingCreditReceivable: creditReceivable, creditCollections,
        customerWorkingCapitalIncrease, creditWorkingCapitalIncrease, workingCapitalIncrease,
        otherWorkingCapitalIncrease: 0, operatingCashCosts, depreciation: a.depreciation,
        interestIncome: a.interestIncome, interestExpense: a.interestExpense,
        fxExpense: a.fxExpense, otherExpense: a.otherExpense,
        pretaxIncome, cashTax, netIncome, operatingCashFlow, capex: a.capex,
        openingDebt: a.openingDebt, debtDraw: a.annualRollover,
        principalRepayment: a.annualRollover, closingDebt: a.openingDebt, netBorrowing,
        fcfe, earningsRouteFcfe, reconciliationResidual,
        discountedFcfe: fcfe / (1 + a.equityDiscountRate) ** (i + 1),
      };
    });
    return { ...scenario, years, fiveYearFcfePv: years.reduce((sum, y) => sum + y.discountedFcfe, 0) };
  });
  return {
    issuer: "First Solar, Inc.", isin: "US3364331070",
    status: "executed-conditional-whole-issuer-boundary-owner-review-pending",
    definition: { basis: "FCFE", currency: "USD", nominal: true, firstYear: p.firstYear, horizon: 5,
      discountBasis: "cost-of-equity", terminalValue: null },
    provenance: p, assumptions: a, assumptionHash: contentHash(a), inputHash: contentHash({ p, a }),
    members, stressMinusBaseFiveYearPv: members[1].fiveYearFcfePv - members[0].fiveYearFcfePv,
    ownerApproved: false, scienceAccepted: false, productionEligible: false,
    completeApprovedIssuerCases: 0,
    technicalReadiness: "Two executable reconciled five-year conditional issuer FCFE paths and like-for-like finite-horizon PVs; not a full equity valuation.",
    remainingGaps: [
      "Owner review of identity, source extraction, fiscal boundary and all frozen assumptions.",
      "No independently verified filing archive: retained public issuer earnings release is unaudited; no filing-only readiness claim.",
      "Future opening working capital/debt and realizable tax/credit timing require evidence; steady-state initialization is conditional.",
      "Market-cap/terminal-value pairing missing; original full equity valuation gap remains.",
      "NEE/FPL incremental and XOM CCS partials cannot be called consolidated issuer cases; three-issuer target remains unmet.",
    ],
  };
}

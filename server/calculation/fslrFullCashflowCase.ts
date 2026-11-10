import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { calculateCompanyFullCashflowCase } from "./companyFullCashflowCase";
import { fslrFiveYearAssumptions } from "./issuerConditionalFiveYear";

const provenance = z.object({
  sourceHash: z.string().regex(/^[a-f0-9]{64}$/), sourceCapturedAt: z.string().datetime(),
  policySourceHash: z.string().regex(/^[a-f0-9]{64}$/), policyCapturedAt: z.string().datetime(),
  frozenAt: z.string().datetime(), firstYear: z.number().int().min(2027),
}).strict();

/** Build and persist this document BEFORE invoking the calculation below.
 * Observed amounts and scenario choices are deliberately separate. */
export function freezeFslrFullCashflowAssumptions(input: unknown) {
  const p = provenance.parse(input);
  if (Date.parse(p.sourceCapturedAt) > Date.parse(p.frozenAt)) throw new Error("Source captured after freeze");
  if (Date.parse(p.policyCapturedAt) > Date.parse(p.frozenAt)) throw new Error("Policy source captured after freeze");
  if (p.firstYear <= Number(p.frozenAt.slice(0, 4))) throw new Error("Prospective horizon required");
  const a = fslrFiveYearAssumptions;
  const base = { creditRetention: 1, creditReceivableYears: .25, workingCapitalHistory: 2025,
    cashTaxRate: .20, capex: .9e9, debtPolicy: "refinance-current-portion" };
  const stress = { creditRetention: .5, creditReceivableYears: .5, workingCapitalHistory: 2024,
    cashTaxRate: .30, capex: 1e9, debtPolicy: "run-off-without-new-debt" };
  const scenarios = [
    { id: "base", ...base, cashCreditHaircut: 0 },
    { id: "combined-policy-liquidity-reinvestment-financing-stress", ...stress, cashCreditHaircut: 0 },
    { id: "half-credit-only", ...base, creditRetention: .5, cashCreditHaircut: 0 },
    { id: "no-new-credit-only", ...base, creditRetention: 0, cashCreditHaircut: 0 },
    { id: "credit-collection-lag-only", ...base, creditReceivableYears: .5, cashCreditHaircut: 0 },
    { id: "historical-higher-working-capital-ratios-only", ...base, workingCapitalHistory: 2024, cashCreditHaircut: 0 },
    { id: "cash-tax-30pct-only", ...base, cashTaxRate: .30, cashCreditHaircut: 0 },
    { id: "capex-high-guidance-only", ...base, capex: 1e9, cashCreditHaircut: 0 },
    { id: "debt-runoff-only", ...base, debtPolicy: "run-off-without-new-debt", cashCreditHaircut: 0 },
    { id: "credit-transfer-5pct-haircut-only", ...base, cashCreditHaircut: .05 },
  ];
  return {
    version: "fslr-primary-guidance-full-cash-schedule-4", provenance: p,
    reported: {
      currency: "USD", originalStatementUnit: "USD thousands, multiplied by 1000",
      revenue2025: 5_219_376e3, revenue2024: 4_206_289e3,
      tradeReceivables2025: 1_294_040e3, tradeReceivables2024: 1_261_049e3,
      inventory2025: (736_734 + 237_462) * 1000,
      inventory2024: (1_084_384 + 275_372) * 1000,
      ppe2025: 5_675_794e3, incomeBeforeTax2025: 1_580_913e3, incomeTaxExpense2025: 52_684e3,
      operatingCashFlow2025: 2_057_105e3, capex2025: 869_875e3,
      debtProceeds2025: 370_470e3, debtRepayments2025: 473_363e3,
      depreciation2025: a.depreciation, interestExpense2025: a.interestExpense,
      interestIncome2025: a.interestIncome, fxExpense2025: a.fxExpense, otherExpense2025: a.otherExpense,
      debtCurrent2025: a.annualRollover, debtLongTerm2025: 282_593e3,
    },
    guidance2026: { volumeSoldGw: [17, 18.2], sales: [4.9e9, 5.2e9],
      grossProfitIncludingCredit: [2.4e9, 2.6e9], operatingExpenses: [610e6, 635e6],
      recognizedCredit: [2.1e9, 2.19e9], capex: [.8e9, 1e9] },
    annualNominalAnchor: { volumeSoldGw: 17.6, sales: a.sales,
      grossProfitIncludingCredit: a.grossProfitIncludingCredit, recognizedCredit: a.recognizedCredit,
      operatingExpenses: a.operatingExpenses, capex: a.capex },
    policyPhaseDown: { through2029: 1, calendar2030: .75, calendar2031: .5,
      calendar2032: .25, after2032: 0,
      source: "2024 final Treasury/IRS rule, Federal Register 2024-24840, 26 CFR 1.45X-1(c)(1); primary issuer FY2024 report separately confirms phase-down beginning 2030",
      qualification: "Solar component schedule, not critical-mineral exception; assume continued eligible domestic production and no additional restriction/amendment. Not a complete prospective legal eligibility opinion." },
    base, stress, scenarios,
    rationale: [
      "Volume 17.6 GW and financial anchors are arithmetic midpoints of disclosed 2026 guidance, not a joint issuer forecast. Hold those nominal operating levels for 2027–2031: constant throughput/mix/pricing and no unsupported demand growth.",
      "Aggregate sales per sold watt is an analyst revenue-allocation proxy, not an observed contract ASP. No Scope 3 savings or avoided emissions assigned to shipments.",
      "45X policy-retention scenarios hold physical sales fixed to isolate manufacturing-credit exposure; do not invent a climate-to-sales elasticity or assign all worldwide shipments US-credit eligibility.",
      "Apply sourced statutory solar-component phase-down to the frozen eligible-credit anchor: 100% through 2029, 75% in 2030, 50% in 2031. Stress retention multiplies that legal schedule rather than silently assuming perpetual full credits. The first experimental v2 omitted this phase-down; v3 supersedes it without erasing retained v2 results.",
      "Pre-credit operating profit equals guidance gross profit minus included credit minus operating expenses. Do not add recognized credit to gross profit a second time.",
      "Base trade receivables/sales and inventory/sales use reported 2025 closing balances. Stress uses higher reported 2024 stock-to-sales ratios. These are labelled constant-ratio funding assumptions, not measured collection days, causal coefficients or operating-efficiency forecasts.",
      "Opening 2027 customer receivables and inventory are normalized to the base ratios at the guidance sales anchor, an explicit hypothetical 2026 bridge, NOT observed 2026 balances. Stress stock increases consume cash once.",
      "Opening hypothetical 45X receivable equals one quarter of base recognized credit; base closing is one quarter and stress closing half a year of retained credit. Prior earned receivables remain collectible; retention affects new credits only. These cash lags are analyst sensitivities, not issuer payment terms.",
      "Credit cash equals recognized credit minus change in the separately tracked hypothetical credit receivable. Other working capital excludes both this credit receivable and trade receivables. No reported government-grant balance is misclassified as all-45X.",
      "Non-inventory operating assets/payables/accruals/customer advances/grants/recycling liabilities are held at constant balances, explicitly zero CHANGES, not assertions of absent obligations. Acquisitions/disposals and non-common distributions are assumed absent, not observed future zeros.",
      "20% base and 30% stress cash tax on positive model pretax income are frozen round-number sensitivities, not extrapolated GAAP effective or observed cash tax rates. No loss refunds, deferred-tax asset or separate deduction for credits inferred.",
      "Reported 2025 D&A is repeated as an explicit book-charge proxy. Guidance capex is repeated annually, including expansion and maintenance together; no unsupported maintenance-capex split or terminal sustainability claim.",
      "FY2025 debt establishes only the historical anchor. Base refinances the reported current portion annually; stress repays up to that amount each year without new borrowing. These are financing policies, not a claim about contractual future maturities.",
      "Base cash interest proxies reported net interest expense. Stress scales that amount by opening debt / historical closing debt, a labelled constant-interest-per-debt approximation, NOT an observed coupon/yield; no current provider beta or fitted rate used.",
      "Interest income, FX expense and other expense are repeated at FY2025 levels and treated as cash equivalents. D&A is the only noncash addback: share compensation and residual noncash gains are not automatically deemed recurring cash benefits.",
      "Face-value credit cash is conditional: the source explicitly warns transfer discounts/timing are uncertain. A separately reported 5% cash-transfer haircut sensitivity gives no tax deduction and is not an observed coefficient.",
      "No perpetual terminal, Gordon change or arbitrary continuation chosen. Repeated growth-capex/depreciation and 45X retention do not establish sustainable post-2031 FCFE. Cash schedules can execute while whole-equity pairing remains withheld.",
      "No probabilities, owner/scientific approval or investable forecast claim. Original FSLR experiment and original three-case acceptance criteria remain unchanged.",
      "Version 4 explicitly persists all ten scenario parameter records before calculation, including zero-new-credit and 5% haircut one-factor sensitivities; economics and statutory phase-down are unchanged from version 3.",
    ],
    terminalModel: null,
  };
}

export function calculateFslrFrozenFullCashflow(frozen: ReturnType<typeof freezeFslrFullCashflowAssumptions>) {
  // Reconstruct the exact allowed frozen document; tampered choices require a new
  // version/freeze, not in-place result-driven parameter changes.
  if (contentHash(frozen) !== contentHash(freezeFslrFullCashflowAssumptions(frozen.provenance)))
    throw new Error("Frozen assumption document differs from versioned specification");
  const r = frozen.reported, a = frozen.annualNominalAnchor, p = frozen.provenance;
  const baseArRatio = r.tradeReceivables2025 / r.revenue2025;
  const baseInventoryRatio = r.inventory2025 / r.revenue2025;
  const stressArRatio = r.tradeReceivables2024 / r.revenue2024;
  const stressInventoryRatio = r.inventory2024 / r.revenue2024;
  const openingDebtAnchor = r.debtCurrent2025 + r.debtLongTerm2025;
  const preCreditMargin = (a.grossProfitIncludingCredit - a.recognizedCredit - a.operatingExpenses) / a.sales;
  const sourceIds = ["fslr-primary-results-2025-guidance-2026", "fslr-frozen-full-cash-4", "primary-45x-phase-down-rule"];
  const cases = frozen.scenarios.map(s => {
    let ar = a.sales * baseArRatio, inventory = a.sales * baseInventoryRatio;
    let creditReceivable = a.recognizedCredit * frozen.base.creditReceivableYears;
    let debt = openingDebtAnchor, ppe = r.ppe2025;
    const diagnostics: any[] = [];
    const years = Array.from({ length: 5 }, (_, i) => {
      const year = p.firstYear + i, openingReceivables = ar, openingInventory = inventory;
      const openingCreditReceivable = creditReceivable, openingDebt = debt, openingPpe = ppe;
      ar = a.sales * (s.workingCapitalHistory === 2024 ? stressArRatio : baseArRatio);
      inventory = a.sales * (s.workingCapitalHistory === 2024 ? stressInventoryRatio : baseInventoryRatio);
      const phaseDown = year <= 2029 ? frozen.policyPhaseDown.through2029 :
        year === 2030 ? frozen.policyPhaseDown.calendar2030 :
        year === 2031 ? frozen.policyPhaseDown.calendar2031 :
        year === 2032 ? frozen.policyPhaseDown.calendar2032 : frozen.policyPhaseDown.after2032;
      const recognizedPolicyCredit = a.recognizedCredit * phaseDown * s.creditRetention;
      creditReceivable = recognizedPolicyCredit * s.creditReceivableYears;
      const grossCreditCash = recognizedPolicyCredit - (creditReceivable - openingCreditReceivable);
      if (grossCreditCash < 0) throw new Error("Negative credit collection requires an explicit funding/repayment model");
      const cashPolicyCredit = grossCreditCash * (1 - s.cashCreditHaircut);
      const debtRepayments = Math.min(r.debtCurrent2025, openingDebt);
      const debtProceeds = s.debtPolicy === "refinance-current-portion" ? debtRepayments : 0;
      debt = openingDebt + debtProceeds - debtRepayments;
      const interestPaid = r.interestExpense2025 * openingDebt / openingDebtAnchor;
      const otherOperatingCash = r.interestIncome2025 - r.fxExpense2025 - r.otherExpense2025;
      const pretaxIncome = a.sales * preCreditMargin + recognizedPolicyCredit - interestPaid + otherOperatingCash;
      const cashTax = Math.max(0, pretaxIncome) * s.cashTaxRate;
      ppe = openingPpe + s.capex - r.depreciation2025;
      diagnostics.push({ year, soldGw: a.volumeSoldGw, activityGrowth: 0,
        aggregateRevenuePerSoldWattProxy: a.sales / (a.volumeSoldGw * 1e9),
        openingInventory, closingInventory: inventory, inventoryWorkingCapitalIncrease: inventory - openingInventory,
        openingCreditReceivable, closingCreditReceivable: creditReceivable,
        creditWorkingCapitalIncrease: creditReceivable - openingCreditReceivable,
        grossCreditCash, transferDiscountCash: grossCreditCash - cashPolicyCredit,
        openingDebt, debtProceeds, debtRepayments, closingDebt: debt, interestPaid,
        openingPpe, closingPpe: ppe, pretaxIncome, cashTax,
        statutoryCreditPhaseDown: phaseDown, recognizedCreditRetention: s.creditRetention });
      return { year, cashFlowDate: `${year}-12-31`, evidenceIds: sourceIds,
        nonClimateRevenue: a.sales, climateRevenue: 0,
        operatingMarginBeforeClimateCostsAndCredits: preCreditMargin,
        climateOperatingCost: 0, recognizedPolicyCredit, cashPolicyCredit,
        depreciation: r.depreciation2025, otherNonCash: 0,
        openingReceivables, closingReceivables: ar,
        increaseOtherOperatingWorkingCapital: inventory - openingInventory,
        interestPaid, cashTax, otherOperatingCash, capitalSpend: s.capex,
        debtProceeds, debtRepayments, nonCommonCashClaims: 0 };
    });
    const engineInput = {
      symbol: "FSLR", cik: "0001274494", security: "Common stock, $0.001 par value", currency: "USD",
      referenceDate: p.frozenAt.slice(0, 10), frozenAt: p.frozenAt, firstYear: p.firstYear,
      baseFcfe: r.operatingCashFlow2025 - r.capex2025 + r.debtProceeds2025 - r.debtRepayments2025,
      evidence: [
        { id: sourceIds[0], kind: "primary-disclosure", rationale: "Primary issuer unaudited FY2025 release and explicit 2026 guidance, not a five-year filing forecast",
          availableAt: p.sourceCapturedAt, sha256: p.sourceHash },
        { id: sourceIds[1], kind: "frozen-analyst-assumption", rationale: frozen.rationale.join("\n"),
          availableAt: p.frozenAt, sha256: contentHash(frozen) },
        { id: sourceIds[2], kind: "primary-disclosure", rationale: frozen.policyPhaseDown.source + "; " + frozen.policyPhaseDown.qualification,
          availableAt: p.policyCapturedAt, sha256: p.policySourceHash },
      ], years, boundary: "whole-issuer-common-equity",
      unresolvedAccountingClaims: [] as string[],
    };
    const ledger = calculateCompanyFullCashflowCase(engineInput);
    const reconciliations = ledger.years.map((y, i) => {
      const d = diagnostics[i];
      const earningsRouteFcfe = d.pretaxIncome - y.cashTax + y.depreciation -
        y.receivablesIncrease - d.creditWorkingCapitalIncrease - d.transferDiscountCash -
        y.increaseOtherOperatingWorkingCapital - y.capitalSpend + y.debtProceeds - y.debtRepayments;
      const residual = y.fcfe - earningsRouteFcfe;
      if (Math.abs(residual) > 1e-5) throw new Error("Source-backed full-engine cash/earnings reconciliation failed");
      return { year: y.year, earningsRouteFcfe, cashRouteFcfe: y.fcfe, residual };
    });
    return { id: s.id, assumptions: s, engineInput, ledger, diagnostics, reconciliations,
      cumulativeFiveYearFcfe: ledger.years.reduce((sum, y) => sum + y.fcfe, 0) };
  });
  return { issuer: "First Solar, Inc.", assumptionVersion: frozen.version, frozenAssumptionHash: contentHash(frozen),
    referenceDate: p.frozenAt.slice(0, 10), firstYear: p.firstYear, horizonYears: 5,
    ratios: { baseArRatio, baseInventoryRatio, stressArRatio, stressInventoryRatio, preCreditMargin },
    cases, cashSchedulesExecuted: cases.length, annualRowsExecuted: cases.length * 5,
    terminalValue: null, actualMarketPairs: 0, completeApprovedIssuerCases: 0,
    productionEligible: false, ownerApproved: false, scienceAccepted: false,
    scope: "Actual primary-input-backed, frozen conditional issuer-wide five-year cash schedules; scenario choices are not observed future coefficients.",
    remainingGaps: [
      "Primary FY2025 release is unaudited; filed annual-note extraction and prospective balance/maturity/tax jurisdiction review remain.",
      "Source explicitly withholds GAAP net-income guidance: uncertain share compensation, transfer discounts, contingencies and tax accounting cannot be forecast with reasonable certainty.",
      "Guidance omits standalone 45X receivable terms, credit transfer discounts and domestic eligible-production/shipment allocation; cash-lag/haircut/retention are labelled sensitivities, not filled as observed.",
      "Future customer terms, inventory needs, advance-payment roll-forward and all other operating balances are conditional stock assumptions, not audited 2026 opening balances.",
      "Repeated total capex and constant D&A do not identify maintenance reinvestment, post-2031 policy benefits or sustainable terminal FCFE; terminal is withheld.",
      "Existing November 9 quote predates this new assumption freeze and has no same-date primary exact common shares. No backdating or whole-equity market comparison performed.",
      "NEE and XOM consolidated cash schedules remain separate unfinished cases; unchanged target remains 0/3 complete.",
    ] };
}

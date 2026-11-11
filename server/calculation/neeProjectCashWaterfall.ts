/** A NEW conditional cash-return experiment, not a project IRR or the frozen v3 EPS proxy. */
export type NeeClaim = { tag: string; context: string; id: string; value: number };
export type NeeFacts = {
  claims: NeeClaim[];
  nee: Record<string, number>;
  fpl: Record<string, number>;
  budgets: { fpl: number[]; other: number[]; fplAfudc: number[]; otherAfudc: number[] };
  narrative: { dmiOpening: number; dmiClosing: number; hlbv: number;
    windMw: number; solarMw: number; storageMw: number; historicOtherReserve: number;
    neerNetMw: number; neerUSNetMw: number; neerCanadaNetMw: number; windOperatedMw: number; windNetMw: number };
};
const clean = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function extractNeeWaterfallFacts(html: string): NeeFacts {
  const text = clean(html), claims: NeeClaim[] = [];
  const get = (tag: string, context: string) => {
    const matches = Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/gi))
      .filter(m => new RegExp(`name="${tag}"`).test(m[1]) && m[1].includes(`contextRef="${context}"`));
    if (!matches.length) throw new Error(`Missing actual NEE primary ${tag}/${context}`);
    const values = matches.map(m => {
      if (!m[1].includes('unitRef="usd"') || !m[1].includes('scale="6"'))
        throw new Error(`Wrong source units ${tag}/${context}`);
      const n = clean(m[2]).replace(/,/g, "");
      const v = n === "&#8212;" ? 0 : Number(n);
      if (!Number.isFinite(v)) throw new Error(`Invalid numeric fact ${tag}/${context}`);
      return v * 1e6 * (m[1].includes('sign="-"') ? -1 : 1);
    });
    if (values.some(v => v !== values[0])) throw new Error(`Conflicting primary fact ${tag}/${context}`);
    claims.push({ tag, context, id: /id="([^"]+)"/.exec(matches[0][1])![1], value: values[0] });
    return values[0];
  };
  const bind = (duration: string, instant: string) => {
    const d = (t: string) => get(t, duration), i = (t: string) => get(t, instant);
    return {
      cfo: d("us-gaap:NetCashProvidedByUsedInOperatingActivities"),
      investing: d("us-gaap:NetCashProvidedByUsedInInvestingActivities"),
      financing: d("us-gaap:NetCashProvidedByUsedInFinancingActivities"),
      interest: d("us-gaap:InterestPaidNet"), cashTax: d("nee:IncomeTaxesPaidReceivedNet"),
      // iXBRL concept signs are not cash signs: an increase in assets USES cash.
      wcCurrentAssets: -d("us-gaap:IncreaseDecreaseInOtherCurrentAssets"),
      wcNoncurrentAssets: -d("us-gaap:IncreaseDecreaseInOtherNoncurrentAssets"),
      wcCurrentLiabilities: d("us-gaap:IncreaseDecreaseInOtherCurrentLiabilities"),
      wcNoncurrentLiabilities: d("us-gaap:IncreaseDecreaseInOtherNoncurrentLiabilities"),
      costRecovery: -d("nee:CostRecoveryClausesAndFranchiseFees"),
      storm: -d("us-gaap:IncreaseDecreaseInRecoverablePropertyDamageCosts"),
      da: d("us-gaap:DepreciationAndAmortization"),
      nuclearAmortization: d("nee:NuclearFuelAndOtherAmortization"),
      fuel: d("us-gaap:PaymentsForProceedsFromNuclearFuel"),
      ppe: i(duration === "c-2" ? "us-gaap:PublicUtilitiesPropertyPlantAndEquipmentNet" :
        "us-gaap:PropertyPlantAndEquipmentNet"),
      ltProceeds: d("us-gaap:ProceedsFromIssuanceOfLongTermDebt"),
      ltRepayments: d("us-gaap:RepaymentsOfLongTermDebt"),
      cp: d("us-gaap:ProceedsFromRepaymentsOfCommercialPaper"),
      stProceeds: d("us-gaap:ProceedsFromOtherShortTermDebt"),
      stRepayments: d("us-gaap:RepaymentsOfOtherShortTermDebt"),
      otherFinancing: d("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities"),
    };
  };
  const nee = { ...bind("c-1", "c-13"),
    longDebt: get("us-gaap:LongTermDebtNoncurrent", "c-13"),
    dmiInflow: get("nee:SaleOfDifferentialMembershipInterests", "c-1"),
    dmiPayment: get("nee:PaymentsToDifferentialMembershipInvestors", "c-1"),
    swept: get("us-gaap:ProceedsFromRepaymentsOfRelatedPartyDebt", "c-1"),
    commonIssued: get("us-gaap:ProceedsFromIssuanceOfCommonStock", "c-1"),
    commonDividends: get("us-gaap:PaymentsOfDividends", "c-1"),
    affiliateCash: get("us-gaap:EquityMethodInvestmentDividendsOrDistributions", "c-1"),
    policyCash: get("nee:ProceedsFromSaleOfRenewableEnergyTaxCredits", "c-1"),
    fx: get("us-gaap:EffectOfExchangeRateOnCashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents", "c-1"),
    cashChange: get("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect", "c-1"),
  };
  const fpl = { ...bind("c-2", "c-63"),
    parentContribution: get("us-gaap:ProceedsFromContributionsFromParent", "c-2"),
    parentDividend: get("us-gaap:PaymentsOfDividends", "c-2"),
    cashChange: get("us-gaap:CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsPeriodIncreaseDecreaseIncludingExchangeRateEffect", "c-2") };
  // Narrative facts are asserted locally against their exact disclosed table rows; USD millions.
  const assertions = [
    "Total $ 8,425 $ 10,520 $ 9,905 $ 10,170 $ 10,585 $ 49,605",
    "Total $ 11,045 $ 7,485 $ 3,840 $ 1,470 $ 1,195 $ 25,035",
    "approximately $ 9,062 million and $ 8,857 million",
    "approximately $ 1,329 million, $ 1,135 million and $ 987 million",
    "approximately 2,228 MW", "approximately 8,205 MW", "approximately 4,265 MW",
    "primarily to the third-party investors until they receive a targeted return",
    "should not follow the respective ownership percentages",
    "first ten years of commercial operation",
    "Includes AFUDC of approximately $ 115 million, $ 170 million, $ 180 million, $ 175 million and $ 160 million",
    "Includes AFUDC of approximately $ 80 million, $ 80 million, $ 75 million, $ 110 million and $ 140 million",
    "Includes AFUDC of approximately $ 10 million, $ 10 million, $ 20 million, $ 10 million and $ 10 million",
    "approximately 32,890 MW of net generating capacity across 41 states and 520 MW of net generating capacity in 4 Canadian provinces",
    "operated a total generating capacity of approximately 26,335 MW, including capacity associated with noncontrolling and joint venture interests",
    "ownership interests in a total net generating capacity of approximately 20,977 MW",
    "FPL's primary source of operating revenues is from its retail customer base",
  ];
  for (const assertion of assertions) if (!text.includes(assertion)) throw new Error(`Missing source narrative ${assertion}`);
  const historicOtherReserve = Math.max(-nee.otherFinancing,
    -get("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities", "c-11"),
    -get("us-gaap:ProceedsFromPaymentsForOtherFinancingActivities", "c-12"));
  return { claims, nee, fpl,
    budgets: { fpl: [8425,10520,9905,10170,10585].map(v => v * 1e6),
      other: [11045,7485,3840,1470,1195].map(v => v * 1e6),
      fplAfudc: [195,250,255,285,300].map(v => v * 1e6),
      otherAfudc: [10,10,20,10,10].map(v => v * 1e6) },
    narrative: { dmiOpening: 8857e6, dmiClosing: 9062e6, hlbv: 1329e6,
      windMw: 2228, solarMw: 8205, storageMw: 4265, historicOtherReserve,
      neerNetMw: 33410, neerUSNetMw: 32890, neerCanadaNetMw: 520, windOperatedMw: 26335, windNetMw: 20977 } };
}

export function neeHistoricalWaterfall(f: NeeFacts) {
  const n = f.nee, p = f.fpl;
  const debt = (x: Record<string, number>) => x.ltProceeds - x.ltRepayments + x.cp + x.stProceeds - x.stRepayments;
  const neeFinancing = debt(n) + n.dmiInflow + n.dmiPayment + n.swept + n.commonIssued -
    n.commonDividends + n.otherFinancing;
  const fplFinancing = debt(p) + p.parentContribution - p.parentDividend + p.otherFinancing;
  const netParentCash = p.parentDividend - p.parentContribution;
  const fplCashBeforeParent = p.cfo + p.investing + debt(p) + p.otherFinancing;
  const consolidatedBeforeCommon = n.cfo + n.investing + debt(n) + n.dmiInflow + n.dmiPayment +
    n.swept + n.otherFinancing;
  return { neeFinancing, fplFinancing, neeFinancingResidual: neeFinancing - n.financing,
    fplFinancingResidual: fplFinancing - p.financing,
    neeCashResidual: n.cfo + n.investing + neeFinancing + n.fx - n.cashChange,
    fplCashResidual: fplCashBeforeParent - netParentCash - p.cashChange,
    netParentCash, fplCashBeforeParent, consolidatedBeforeCommon,
    beforeNewDmiFunding: consolidatedBeforeCommon - n.dmiInflow,
    knownDmiGrossInflow: n.dmiInflow, knownDmiGrossPayment: -n.dmiPayment,
    dmiBookResidualNotCash: f.narrative.dmiClosing - f.narrative.dmiOpening -
      n.dmiInflow - n.dmiPayment + f.narrative.hlbv,
    unknownOtherGrossInflow: null, unknownOtherGrossOutflow: null };
}

/** Remove actual cash tax INCLUDING transferred-credit cash before adding any forecast credit.
 *  Noncash HLBV/net-income allocations never enter this cash-return normalization. */
export function neeCashReturnAnchors(f: NeeFacts) {
  const normalize = (x: Record<string, number>) => x.cfo + x.interest + x.cashTax -
    (x.wcCurrentAssets + x.wcNoncurrentAssets + x.wcCurrentLiabilities + x.wcNoncurrentLiabilities) -
    x.costRecovery - x.storm;
  const consolidated = normalize(f.nee) - f.nee.affiliateCash;
  const fpl = normalize(f.fpl), other = consolidated - fpl;
  return { consolidated, fpl, other, fplCashYield: fpl / f.fpl.ppe,
    otherCashYield: other / (f.nee.ppe - f.fpl.ppe) };
}

export const neeWaterfallExperiment = {
  version: "nee-component-cash-waterfall-1-funding-guard",
  qualification: 0,
  rationale: [
    "Use observed FY2024 FPL and consolidated-minus-FPL residual pre-interest/pre-tax cash returns on closing paid net PP&E. This is NOT NEER-only project IRR, marginal project guidance, regulatory ROE or an EPS-to-EBIT adapter.",
    "Subtract source operating-WC movements and exceptional fuel-clause/storm cash effects; remove affiliate dividends before calibrating operating cash yield. Actual signed cash tax is added back ONCE, removing historical refundable/transfer benefits; no historical credit is subtracted a second time.",
    "Source-calibrated cash yields are frozen FORWARD CONDITIONS. Cash yield on all opening capital versus delayed incremental-above-nominal capital until approved 2025-2029 budget completion is calculated; neither is a future observation or a bound on all possible commissioning.",
    "No blanket climate revenue bucket: Florida-regulated generation/network FPL is distinct from non-FPL mixed wind/solar/storage/nuclear/gas/transmission/corporate residual. Note15 approved wind/solar/storage MW are activity locators, not additive generation, observed commissioning, tariff or credit-allocation keys.",
    "NEER source net generation 32,890MW US/520MW Canada is operating geography, NOT headquarters, common-cash ownership or US credit-eligible share. Wind 26,335MW operated includes NCI/JV interests versus 20,977MW net ownership. Do not weight consolidated policy cash, taxes or cash returns by these incompatible capacity denominators.",
    "Each component funds at least total fixed plus nuclear-and-other amortization plus requested nominal growth times opening capital; nuclear fuel CASH is inside this total, never added twice. Use greater approved budget less disclosed AFUDC within FY2025-2029. Extra maintenance/growth cash ABOVE approved estimates is charged explicitly, not asserted approved.",
    "Source Note7 net PP&E includes nuclear fuel. NEW paid-capital-equivalent book therefore includes cash fuel less reported nuclear-fuel-AND-OTHER amortization, unlike prior v3 fixed-only book proxy. All reported nuclear-and-other amortization is conservatively charged against this equivalent stock; do not assert a pure fuel net carrying series. FY2025 book-only correction is disclosed; original cash stub/debt is untouched and any leverage/reserve catch-up is paid/raised in 2026. Independent-power budget is fully funded as capital equivalent, not asserted all GAAP PP&E versus joint-venture investment.",
    "AFUDC cash classification guard: source budget AFUDC is not certified all equity/noncash. Retain its deduction from operating earning-capital proxy, but hold ALL disclosed AFUDC in a separate zero-return cash reserve, not distributable cash. Fund 2025 legacy maximum plus current 2026 allocation in 2026 and each subsequent approved allocation once; existing reserve grows with nominal funding prices and is never released. This is deliberately conservative cash provisioning, not observed paid interest, contract liability or actual reserve policy.",
    "Continue source effective fixed D&A/net PP&E, carrying debt/net PP&E and cash-interest/debt; gross source maturities roll at par with both sides shown. No actual permanent refinancing commitment asserted.",
    "Working assets/payables and minimum cash scale with paid net PP&E, not a fabricated revenue/energy volume forecast. Positive cash-reserve growth consumes common cash; no excess-cash release, initial debt subtraction or liquidation windfall.",
    "No future DMI proceeds, new NCI capital, disposal proceeds, common issuance or swept related-party funding. DMI cash claim repeats FY2024 gross $740m indexed; other non-common reserve is full largest FY2022-2024 net-other-financing outflow $653m indexed. These are conditional cash reserves, NOT identified contractual gross NCI distributions.",
    "Unidentified offsetting gross other-financing inflow is an explicit UNKNOWN, never observed zero. Conditional floor takes no extra hidden gross claim; analytical terminal and total-plan break-even annual-indexed claim headrooms are reported. No finite public bound or complete legal waterfall is certified.",
    "Separate policy mode repeats no more than actual FY2024 $1.304bn transfer cash through 2029, retires uniformly over source ten-year PTC horizon to 2039; stress removes all future policy cash. This is a labelled cohort/ITC/PTC mixture assumption, not existing contract, project eligibility, current-law or FEOC certification.",
    "Note1 transfer proceeds are in cash tax: adding back signed historical cash tax removes them before forward policy cash. Other tax benefits, incremental new renewable cohorts, nuclear PTC cash, US/Canadian incentive awards and carbon prices are not separately forecast; zero incremental booking is a downside condition, not observed absence or verified ineligibility.",
    "21% positive cash-taxable-profit sensitivity after fixed/nuclear amortization and cash interest, affiliate dividends included once; it is not jurisdictional tax guidance. Ten percent USD common cost of equity remains original fixed sensitivity.",
    "Original signed 2025 dated stub, actual positive historical common-FCFE $169m, USD, security, dated actual shares/price retained. Full new cash paths begin 2026, five years plus ten-year fade and 2041 sustainable nominal terminal. Common owners prospectively meet signed negative cash calls pro rata; no guaranteed financing or future share count invented.",
  ],
} as const;

export type NeeWaterfallOptions = {
  terminalGrowth: number;
  operatingMode: "opening-capital-yield" | "budget-completion-delay";
  policyMode: "retained-cohort-runoff" | "zero-future-policy-cash";
};
export type NeeFundingInput = {
  debt: number; netPpe: number; inventory: number; otherCurrentAssets: number;
  minimumCash: number; operatingPayables: number; customerAdvances: number;
  maturities2025To2029: number[];
  reconciliation: { normalized: { receivables: number; corporateCapex: number; fundNet: number;
    otherInvesting: number; annualRollover: number } };
};

export function buildNeeWaterfall(f: NeeFacts, input: NeeFundingInput, options: NeeWaterfallOptions,
  original: { referenceDate: string; baseFcfe: number; costOfEquity: number;
    opening2026WorkingFunding: number; opening2026Debt: number;
    stub: { cashFlows: { date: string; fcfe: number }[] } }) {
  const { terminalGrowth: g } = options;
  if (![.025,.0325,.04].includes(g) || !Number.isFinite(original.costOfEquity) ||
      original.costOfEquity <= g || !(original.baseFcfe > 0) ||
      !Number.isFinite(original.opening2026WorkingFunding) || !Number.isFinite(original.opening2026Debt))
    throw new Error("Original positive-base/range/discount requirement");
  const anchors = neeCashReturnAnchors(f), o = input.reconciliation.normalized;
  if (Math.abs(input.netPpe - f.nee.ppe) > .01) throw new Error("Wrong consolidated capital basis");
  const basePpe = [f.fpl.ppe, f.nee.ppe - f.fpl.ppe];
  const yields = [anchors.fplCashYield, anchors.otherCashYield];
  const daRates = [f.fpl.da / basePpe[0], (f.nee.da - f.fpl.da) / basePpe[1]];
  const leverage = input.debt / input.netPpe, cashInterestRate = f.nee.interest / input.debt;
  const baseWc = o.receivables + input.inventory + input.otherCurrentAssets + input.minimumCash -
    input.operatingPayables - input.customerAdvances;
  let ppe = basePpe.slice(), debt = input.debt, wc = baseWc, priceIndex = 1;
  let afudcCashClassificationReserve = 0;
  const rows = [];
  for (let year = 2025; year <= 2041; year++) {
    const fade = Math.max(0, Math.min(10, year - 2030)) / 10;
    const nominalGrowth = .0325 + (g - .0325) * fade, priorIndex = priceIndex;
    priceIndex *= 1 + nominalGrowth;
    // Preserve every original 2025 cash payment: fund any reserve-policy catch-up in 2026.
    if (year === 2026) wc = original.opening2026WorkingFunding;
    const openingPpe = ppe.slice(), openingDebt = debt, openingWc = wc;
    const fuel = f.nee.fuel * priceIndex;
    const componentFuel = [f.fpl.fuel / f.nee.fuel * fuel, (f.nee.fuel - f.fpl.fuel) / f.nee.fuel * fuel];
    const fixedDa = ppe.map((p, i) => p * daRates[i]);
    const componentNuclearAndOtherAmortization = [f.fpl.nuclearAmortization * priceIndex,
      (f.nee.nuclearAmortization - f.fpl.nuclearAmortization) * priceIndex];
    const minimumReplacementGrowth = ppe.map((p, i) => fixedDa[i] +
      componentNuclearAndOtherAmortization[i] + nominalGrowth * p - componentFuel[i]);
    const budgets = year <= 2029 ? [f.budgets.fpl[year - 2025] - f.budgets.fplAfudc[year - 2025] - componentFuel[0],
      f.budgets.other[year - 2025] - f.budgets.otherAfudc[year - 2025] - componentFuel[1] + o.corporateCapex * priceIndex] :
      minimumReplacementGrowth;
    const capitalPpe = budgets.map((b, i) => Math.max(b, minimumReplacementGrowth[i]));
    const extraAboveBudget = year <= 2029 ? capitalPpe.reduce((s, p, i) => s + p - budgets[i], 0) : 0;
    const earningPpe = openingPpe.map((p, i) => options.operatingMode === "budget-completion-delay" && year <= 2029 ?
      Math.min(p, basePpe[i] * priorIndex) : p);
    const operatingCashBeforeInterestTax = earningPpe.map((p, i) => p * yields[i]);
    const affiliateCash = f.nee.affiliateCash * priceIndex;
    const interest = openingDebt * cashInterestRate;
    const nuclearAmortization = f.nee.nuclearAmortization * priceIndex;
    const grossOperatingCash = operatingCashBeforeInterestTax.reduce((a, b) => a + b, 0);
    const taxableCashProfitProxy = grossOperatingCash - fixedDa[0] - fixedDa[1] - nuclearAmortization +
      affiliateCash - interest;
    const cashTax = .21 * Math.max(0, taxableCashProfitProxy);
    const policyCash = options.policyMode === "retained-cohort-runoff" ?
      f.nee.policyCash * (year <= 2029 ? 1 : Math.max(0, (2039 - year) / 10)) : 0;
    ppe = openingPpe.map((p, i) => p + capitalPpe[i] + componentFuel[i] -
      fixedDa[i] - componentNuclearAndOtherAmortization[i]);
    const totalClosingPpe = ppe[0] + ppe[1];
    debt = year === 2025 ? original.opening2026Debt : leverage * totalClosingPpe;
    const netBorrowing = debt - openingDebt;
    const roll = year <= 2029 ? input.maturities2025To2029[year - 2025] +
      input.debt - f.nee.longDebt - input.maturities2025To2029[0] : o.annualRollover / input.debt * openingDebt;
    const debtProceeds = roll + Math.max(0, netBorrowing), debtRepayments = roll + Math.max(0, -netBorrowing);
    if (year === 2026) afudcCashClassificationReserve =
      (f.budgets.fplAfudc[0] + f.budgets.otherAfudc[0]) * (1 + nominalGrowth);
    else if (year > 2026) afudcCashClassificationReserve *= 1 + nominalGrowth;
    if (year >= 2026 && year <= 2029)
      afudcCashClassificationReserve += f.budgets.fplAfudc[year - 2025] + f.budgets.otherAfudc[year - 2025];
    wc = baseWc * totalClosingPpe / input.netPpe + afudcCashClassificationReserve;
    const increaseWorkingFunding = wc - openingWc;
    const dmiCashClaim = -f.nee.dmiPayment * priceIndex;
    const otherConditionalReserve = f.narrative.historicOtherReserve * priceIndex;
    const otherInvesting = (o.fundNet + o.otherInvesting) * priceIndex;
    const capitalSpend = capitalPpe[0] + capitalPpe[1] + fuel + otherInvesting;
    const fcfe = grossOperatingCash + affiliateCash - interest - cashTax + policyCash -
      increaseWorkingFunding - capitalSpend + debtProceeds - debtRepayments - dmiCashClaim - otherConditionalReserve;
    rows.push({ year, nominalGrowth, priceIndex, openingPpe, closingPpe: ppe.slice(), earningPpe,
      fixedDa, minimumReplacementGrowth, capitalPpe, extraAboveBudget, fuel, componentFuel, componentNuclearAndOtherAmortization,
      nuclearAmortization, operatingCashBeforeInterestTax, grossOperatingCash, affiliateCash,
      openingDebt, closingDebt: debt, roll, debtProceeds, debtRepayments, netBorrowing, interest,
      taxableCashProfitProxy, cashTax, policyCash, openingWc, closingWc: wc, increaseWorkingFunding,
      dmiCashClaim, otherConditionalReserve, unknownExtraGrossNoncommonClaim: null,
      afudcCashClassificationReserve,
      otherInvesting, capitalSpend, fcfe, commonCall: Math.max(0, -fcfe),
      cashReserve: input.minimumCash * totalClosingPpe / input.netPpe + afudcCashClassificationReserve });
  }
  const future = rows.filter(r => r.year >= 2026), terminal = future[15];
  const time = (date: string) => (Date.parse(date) - Date.parse(original.referenceDate)) / (365.25 * 86400000);
  const discount = (date: string) => (1 + original.costOfEquity) ** -time(date);
  const stubPv = original.stub.cashFlows.reduce((s, c) => s + c.fcfe * discount(c.date), 0);
  const explicitPv = future.slice(0,15).reduce((s, r) => s + r.fcfe * discount(`${r.year}-12-31`), 0);
  const terminalPv = terminal.fcfe / (original.costOfEquity - g) * discount("2040-12-31");
  const formalSignedPlanPv = stubPv + explicitPv + terminalPv;
  const claimPvPer2024Dollar = future.slice(0,15).reduce((s, r) => s + r.priceIndex * discount(`${r.year}-12-31`), 0) +
    terminal.priceIndex / (original.costOfEquity - g) * discount("2040-12-31");
  const fifth = future[4].fcfe;
  return { version: neeWaterfallExperiment.version, options, anchors, rows: future,
    opening2025Bridge: { year: 2025, openingPpe: rows[0].openingPpe, closingPpe: rows[0].closingPpe,
      fixedDa: rows[0].fixedDa, capitalPpe: rows[0].capitalPpe, fuel: rows[0].fuel,
      nuclearAndOtherAmortization: rows[0].nuclearAmortization,
      fuelAmortizationBookCorrectionToOldFixedOnlyProxy: rows[0].fuel - rows[0].nuclearAmortization,
      closingDebt: rows[0].closingDebt, cashPolicyChangeFundedStarting2026: true },
    originalStubUnchanged: original.stub, stubPv, explicitPv, terminalPv,
    terminalFcfe: terminal.fcfe, formalSignedPlanPv,
    forwardWholeEquity: terminal.fcfe > 0 && formalSignedPlanPv > 0 ? formalSignedPlanPv : null,
    status: terminal.fcfe <= 0 ? "refused-nonpositive-terminal" :
      formalSignedPlanPv <= 0 ? "refused-nonpositive-funded-plan-pv" : "conditional-net-reserve-floor-only",
    terminalExtraGrossClaimHeadroom2024Usd: terminal.fcfe / terminal.priceIndex,
    fundedPlanExtraGrossClaimHeadroom2024Usd: formalSignedPlanPv / claimPvPer2024Dollar,
    claimPvPer2024Dollar, unboundedUnidentifiedGrossNoncommonCash: true,
    actualFcfe5YearGrowth: fifth > 0 ? (fifth / original.baseFcfe) ** .2 - 1 : null,
    growthRejection: fifth <= 0 ? "nonpositive-year-five-common-cash" : null,
    futureCommonCalls: future.reduce((s, r) => s + r.commonCall, 0),
    extraCashAboveApprovedBudgets: future.reduce((s, r) => s + r.extraAboveBudget, 0),
    qualifiedOriginalIssuers: 0, reverseScoringPerformed: false,
  };
}

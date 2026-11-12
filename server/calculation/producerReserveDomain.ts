/** Forward domain is declared independently of the target and must be frozen before solving.
 * None of these choices is an issuer forecast, fitted distribution, or market identification.
 */
export const producerReserveDomain = {
  version: "closed-reserve-conditional-v1",
  decline: [0, 0.08] as const,
  horizonYears: 100,
  timing: "annual year-end, first modeled year 2025; no stub",
  initialAnnualProductionBasis: "1355 million boe, 2024 consolidated reserve depletion; not available-for-sale volumes",
  productionRule: "min(opening stock,1355*(1-decline)^(year-1))",
  replacements: 0,
  reserveRevisionsPurchasesDisposals: 0,
  capitalAllocation: "closed proved pool only; disclosed future development cost allocated pro rata to reserve units produced",
  revenueDeck: "disclosed SEC standardized future cash inflows / closing proved reserves; fixed USD per boe basket, NOT FY realized price deck",
  costDeck: "disclosed future production costs (includes abandonment) and future development and income taxes / closing reserves",
  workingCapital: "zero initial and terminal working capital and zero annual change, CONDITIONAL; actual segment WC unavailable",
  financing: "unlevered asset cash flows; no debt allocation, interest, borrowing, cash addition or NCI deduction",
  terminal: "zero salvage for remaining reserves at year100; no perpetual/Gordon value or unproved replacement value",
  nominalBasis: "constant disclosed SEC price/cost dollar amounts; fixed-dollar timing diagnostic, no inflation escalation",
  discountRate: 0.10,
  sensitivityDiscountRates: [0.08, 0.10, 0.12],
  sensitivityRevenueMultipliers: [0.9, 1, 1.1],
  sensitivityCostMultipliers: [0.9, 1, 1.1],
  uncertainty: "one-factor deterministic sensitivities, NOT probability ranges or identification",
  tolerances: { valueUsdMillion: 0.000001, decline: 1e-12, maxIterations: 100 },
} as const;

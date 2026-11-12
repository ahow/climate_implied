import { createHash } from "node:crypto";
import type { ProducerReserveReport, ProducerReserveSolve, ProducerReserveYear, ProducerReplacementPlan } from "../../shared/producerReserveSchema";
import { producerReserveDomain as domain } from "./producerReserveDomain";
import { producerReserveFacts as facts, producerReserveSource as source, producerReserveEvidenceLocators } from "./producerReserveEvidence";

export const producerReserveHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const producerReserveDomainHash = producerReserveHash(domain);
// Semantic fingerprint, not a claim that this is a source-code-byte hash.
const modelSpecification = {
  version: 1, physical: "Rt=Rt-1-Qt; Qt=min(Rt-1,Q0*(1-d)^(t-1)); additions=0",
  revenue: "Qt*SEC_future_inflows/R0*revenueMultiplier",
  cash: "FCFFconditional=Qt*(inflows*m-productionCosts*c-development*c-incomeTaxes)/R0-dWC",
  tax: "fixed disclosed cash tax per reserve unit, not a marginal tax rate or price-responsive fiscal model",
  value: "sum(FCFFconditional/(1+r)^t); end-year; terminal=0",
  replacement: "independent existing/replacement cohorts; start-year explicit additions; requested incremental production capped by replacement stock; replacement capex charged once by annual plan; inversion unavailable",
  inversion: "strict monotonicity certificate for positive constant unit cash margin and no replacements; bisection on prior domain; reject other mappings",
};
export type ProducerReserveScenario = { discountRate: number; revenueMultiplier: number; costMultiplier: number };
const baseScenario: ProducerReserveScenario = { discountRate: domain.discountRate, revenueMultiplier: 1, costMultiplier: 1 };

export function calculateProducerReservePath(decline: number, scenario: ProducerReserveScenario = baseScenario) {
  if (!Number.isFinite(decline) || decline < domain.decline[0] || decline > domain.decline[1])
    throw new Error("Decline outside frozen conditional domain");
  if (![scenario.discountRate, scenario.revenueMultiplier, scenario.costMultiplier].every(Number.isFinite) ||
      scenario.discountRate <= 0 || scenario.revenueMultiplier <= 0 || scenario.costMultiplier <= 0)
    throw new Error("Invalid scenario; positive finite discount rate and deck multipliers required");
  const s = facts.standardized;
  let remaining: number = facts.reserves.closing;
  const annualRows: ProducerReserveYear[] = [];
  for (let t = 1; t <= domain.horizonYears; t++) {
    const openingReserves = remaining;
    const production = Math.min(remaining, -facts.reserves.production * (1 - decline) ** (t - 1));
    remaining = Math.max(0, remaining - production);
    const fraction = production / facts.reserves.closing;
    const revenue = fraction * s.revenue * scenario.revenueMultiplier;
    const productionCostsIncludingAbandonment = fraction * s.productionCosts * scenario.costMultiplier;
    const developmentCapex = fraction * s.development * scenario.costMultiplier;
    const cashTaxes = fraction * s.incomeTaxes;
    const deltaWorkingCapital = 0; // Explicit domain assumption, never an observed zero.
    const unleveredCashFlow = revenue - productionCostsIncludingAbandonment - developmentCapex - cashTaxes - deltaWorkingCapital;
    annualRows.push({ year: 2024 + t, openingReserves, production, replacement: 0, closingReserves: remaining,
      revenue, productionCostsIncludingAbandonment, developmentCapex, cashTaxes, deltaWorkingCapital,
      unleveredCashFlow, discountedCashFlow: unleveredCashFlow / (1 + scenario.discountRate) ** t });
  }
  return { value: annualRows.reduce((sum, row) => sum + row.discountedCashFlow, 0), annualRows,
    remainingReserves: remaining };
}

/** Optional explicit replacement forward model. It does not invent a cost per historical
 * reserve addition. Existing pool development is charged only on existing-pool production;
 * replacement development/acquisition cash is charged ONLY in its separate annual plan.
 * All future replacement economics remain explicitly conditional, not issuer observations.
 */
export function calculateProducerReplacementPath(decline: number, plan: ProducerReplacementPlan,
  scenario: ProducerReserveScenario = baseScenario) {
  if (plan.basis !== "explicit-conditional-not-observed" ||
      plan.moneyBasis !== "same fixed-dollar USD million as reserve diagnostic" || !plan.label.trim())
    throw new Error("Explicit conditional replacement basis and compatible units required");
  if (!Array.isArray(plan.annual) || plan.annual.length !== domain.horizonYears)
    throw new Error("Replacement plan must explicitly cover all 100 years, including zero years");
  const base = calculateProducerReservePath(decline, scenario);
  let replacementStock = 0;
  const annualRows = base.annualRows.map((existing, index) => {
    const p = plan.annual[index];
    if (p.year !== existing.year || !p.evidenceOrConditionalJustification.trim() ||
        ![p.additionsMillionBoe, p.requestedIncrementalProductionMillionBoe, p.replacementCashCapexUsdMillion,
          p.revenuePerBoe, p.operatingAndProductionTaxCostPerBoe, p.cashIncomeTaxPerBoe].every(x => Number.isFinite(x) && x >= 0) ||
        !Number.isFinite(p.deltaWorkingCapitalUsdMillion))
      throw new Error(`Invalid or unsupported replacement-year contract at ${existing.year}`);
    const openingReplacementReserves = replacementStock;
    replacementStock += p.additionsMillionBoe; // Explicit start-year additions.
    const replacementProduction = Math.min(replacementStock, p.requestedIncrementalProductionMillionBoe);
    replacementStock -= replacementProduction;
    const replacementRevenue = replacementProduction * p.revenuePerBoe * scenario.revenueMultiplier;
    const replacementOperatingAndProductionTaxes = replacementProduction * p.operatingAndProductionTaxCostPerBoe * scenario.costMultiplier;
    const replacementIncomeTaxes = replacementProduction * p.cashIncomeTaxPerBoe;
    // Replacement capital budget is not existing-pool development and is never charged twice.
    const replacementCapex = p.replacementCashCapexUsdMillion * scenario.costMultiplier;
    const replacementFcff = replacementRevenue - replacementOperatingAndProductionTaxes -
      replacementIncomeTaxes - replacementCapex - p.deltaWorkingCapitalUsdMillion;
    const unleveredCashFlow = existing.unleveredCashFlow + replacementFcff;
    return { ...existing, openingExistingReserves: existing.openingReserves,
      existingProduction: existing.production, closingExistingReserves: existing.closingReserves,
      openingReplacementReserves, replacementAdditions: p.additionsMillionBoe,
      replacementProduction, closingReplacementReserves: replacementStock,
      totalOpeningReserves: existing.openingReserves + openingReplacementReserves,
      totalClosingReserves: existing.closingReserves + replacementStock,
      totalProduction: existing.production + replacementProduction,
      replacementRevenue, replacementOperatingAndProductionTaxes, replacementIncomeTaxes,
      replacementCapex, replacementDeltaWorkingCapital: p.deltaWorkingCapitalUsdMillion,
      replacementFcff, unleveredCashFlow,
      discountedCashFlow: unleveredCashFlow / (1 + scenario.discountRate) ** (index + 1) };
  });
  return { label: plan.label, basis: plan.basis, annualRows,
    value: annualRows.reduce((sum, row) => sum + row.discountedCashFlow, 0),
    remainingExistingReserves: base.remainingReserves, remainingReplacementReserves: replacementStock,
    terminalValue: 0, identification: "Forward conditional calculation only; replacement inversion not certified" };
}

export function solveProducerReplacementDecline(): ProducerReserveSolve {
  return { status: "nonidentified", decline: null, residualUsdMillion: null, roots: [], iterations: 0,
    domainHash: producerReserveDomainHash,
    reason: "Replacement additions, incremental production and cash-capital timing add unconstrained dimensions. No certified uniqueness mapping; forward replacement model available but inversion refused." };
}

/** Analytic uniqueness gate. General/custom valuation functions are intentionally not admitted.
 * Positive fixed per-unit margin, r>0, zero replacement and reserve cap imply strictly lower
 * discounted receipts for d2>d1: cumulative production is no larger at any date, strictly smaller
 * at t=2, and discount weights strictly decrease. Zero/negative margin is not this certificate.
 */
export function solveProducerReserveDecline(
  target: number | null, scenario: ProducerReserveScenario = baseScenario,
  basis: "consolidated-reserve-pv10" | "whole-equity" = "consolidated-reserve-pv10",
): ProducerReserveSolve {
  const refusal = (status: ProducerReserveSolve["status"], reason: string): ProducerReserveSolve =>
    ({ status, decline: null, residualUsdMillion: null, roots: [], reason, iterations: 0, domainHash: producerReserveDomainHash });
  if (basis !== "consolidated-reserve-pv10")
    return refusal("unsupported-basis", "Whole-equity/market-cap allocation, debt, NCI and non-producing businesses are not identified.");
  if (target === null || !Number.isFinite(target) || target <= 0)
    return refusal("nonidentified", "No compatible positive finite reserve-interest valuation target.");
  const s = facts.standardized;
  const margin = s.revenue * scenario.revenueMultiplier - (s.productionCosts + s.development) * scenario.costMultiplier - s.incomeTaxes;
  if (![scenario.discountRate, scenario.revenueMultiplier, scenario.costMultiplier].every(Number.isFinite) ||
      scenario.discountRate <= 0 || scenario.revenueMultiplier <= 0 || scenario.costMultiplier <= 0 || margin <= 0 ||
      facts.reserves.closing <= 2 * -facts.reserves.production)
    return refusal("nonidentified", "Positive-margin/positive-discount monotonicity certificate not satisfied; no root search performed.");
  let low: number = domain.decline[0], high: number = domain.decline[1];
  const lowValue = calculateProducerReservePath(low, scenario).value;
  const highValue = calculateProducerReservePath(high, scenario).value;
  if (target > lowValue + domain.tolerances.valueUsdMillion || target < highValue - domain.tolerances.valueUsdMillion)
    return refusal("no-root", "Target lies outside frozen-domain value range; no extrapolation or post-solve domain widening.");
  let decline = low, residual = lowValue - target, iterations = 0;
  if (Math.abs(residual) > domain.tolerances.valueUsdMillion) {
    for (; iterations < domain.tolerances.maxIterations; iterations++) {
      decline = (low + high) / 2;
      residual = calculateProducerReservePath(decline, scenario).value - target;
      if (Math.abs(residual) <= domain.tolerances.valueUsdMillion) break;
      if (residual > 0) low = decline; else high = decline;
    }
  }
  if (Math.abs(residual) > domain.tolerances.valueUsdMillion)
    return refusal("nonidentified", "Solver failed frozen numerical residual tolerance.");
  return { status: "unique-conditional-root", decline, residualUsdMillion: residual, roots: [decline],
    reason: "Unique ONLY within frozen positive-margin closed-reserve mapping; diagnostic model-equivalent depletion, not market-implied decline.",
    iterations, domainHash: producerReserveDomainHash };
}

/** Generic candidate-set gate for outside validators. A grid cannot certify uniqueness.
 * The production solver above uses its analytic certificate, not sampled sign changes.
 */
export function qualifyProducerReserveCandidates(roots: number[], uniquenessCertified: boolean): ProducerReserveSolve {
  const unique = Array.from(new Set(roots));
  const invalid = unique.some(x => !Number.isFinite(x) || x < domain.decline[0] || x > domain.decline[1]);
  const status = invalid || !uniquenessCertified ? "nonidentified" : unique.length === 0 ? "no-root" :
    unique.length > 1 ? "multiple-roots" : "nonidentified";
  return { status, decline: null, roots: invalid ? [] : unique, residualUsdMillion: null,
    reason: "External candidates never confer acceptance; multiple/no roots or absent analytic identification are refused.",
    iterations: 0, domainHash: producerReserveDomainHash };
}

export function buildPublicProducerReserveReport(): ProducerReserveReport {
  const r = facts.reserves, s = facts.standardized, o = facts.operations;
  const baseResult = solveProducerReserveDecline(s.pv10);
  const path = baseResult.decline === null ? null : calculateProducerReservePath(baseResult.decline);
  const commodityRows = facts.commodity.map(c => ({
    ...c, annualVolume: c.dailyVolume * 366 / 1000,
    annualVolumeUnit: c.product === "gas" ? "billion cubic feet" : "million bbl",
    // million cubic feet/day * USD/thousand cubic feet /1000 -> USD million/day.
    productionTimesRealizedPriceUsdMillion: c.dailyVolume * 366 / 1000 * c.price,
  }));
  const dailyEquivalent = facts.commodity.reduce((sum, c) => sum + (c.product === "gas" ? c.dailyVolume / 6 : c.dailyVolume), 0);
  const soldVolumeProxy = dailyEquivalent * 366 / 1000;
  const revenueProxy = commodityRows.reduce((sum, c) => sum + c.productionTimesRealizedPriceUsdMillion, 0);
  const variants: [string, ProducerReserveScenario][] = [
    ...domain.sensitivityDiscountRates.map(discountRate => [`discount-${discountRate}`, { ...baseScenario, discountRate }] as [string, ProducerReserveScenario]),
    ...domain.sensitivityRevenueMultipliers.filter(x => x !== 1).map(revenueMultiplier => [`revenue-${revenueMultiplier}`, { ...baseScenario, revenueMultiplier }] as [string, ProducerReserveScenario]),
    ...domain.sensitivityCostMultipliers.filter(x => x !== 1).map(costMultiplier => [`cost-${costMultiplier}`, { ...baseScenario, costMultiplier }] as [string, ProducerReserveScenario]),
  ];
  return {
    schemaVersion: "producer-reserve-v1", id: "xom-fy2024-consolidated-proved-reserve-diagnostic",
    title: "XOM disclosed proved-reserve depletion diagnostic",
    label: "Conditional diagnostic model-equivalent depletion — NOT market-implied production decline",
    status: "conditional-diagnostic-only", entity: source.entity, valuationDate: "2024-12-31",
    calculationBasis: "Consolidated-subsidiary proved producing reserve interest INCLUDING NCI, excluding equity affiliates; fixed-dollar SEC standardized cash-flow basket",
    moneyUnit: "USD million", physicalUnit: "million boe", marketEquityTarget: null, marketImpliedDecline: null, fcfe: null,
    ownerApproved: false, scienceAccepted: false, threeCaseAcceptance: false,
    sourceRegister: producerReserveEvidenceLocators.map(locator => ({ ...source, ...locator })),
    assumptionRegister: Object.entries(domain).map(([id, value]) => ({
      id, value: typeof value === "number" || typeof value === "string" ? value : JSON.stringify(value),
      status: "conditional-not-observed",
      justification: id === "decline" ? "HEURISTIC conditional non-growth 0–8% domain, NOT an empirically estimated production decline. Annual reserve depletion / closing stock = approximately 7.99% provides a stock/flow timescale only, NOT a decline estimator or empirical coverage interval." :
        id === "horizonYears" ? "Finite 100-year truncation with zero residual value; remaining stock explicitly reported, not silently exhausted." :
        "Explicit restricted experiment choice frozen independently of target; not an observed forward economic fact.",
    })),
    historical: {
      reserves: r, organicAdditions: r.extensionsDiscoveries + r.improvedRecovery,
      organicReplacementRatioExcludingRevisionsAndAcquisitions: (r.extensionsDiscoveries + r.improvedRecovery) / -r.production,
      replacementIncludingRevisionsExcludingAcquisitions: (r.extensionsDiscoveries + r.improvedRecovery + r.revisions) / -r.production,
      acquisitionsSeparate: r.purchases, disposalsSeparate: r.sales,
      operations: o, costsIncurredNotCashCapex: facts.costsIncurred, commodityRows,
      dailySoldEquivalentThousandBoe: dailyEquivalent, annualSoldVolumeProxyMillionBoe: soldVolumeProxy,
      annualReserveDepletionMillionBoe: -r.production, soldVolumeMinusReserveDepletion: soldVolumeProxy + r.production,
      commodityProductionPriceProxyUsdMillion: revenueProxy, proxyMinusReportedProducingRevenueUsdMillion: revenueProxy - o.revenue,
      commodityBridgeCaveat: "Production final-products-sold differs from reserve depletion (gas available for sale vs withdrawals); prices use sales quantities as divisor, include geographic/product mix and rounding. Proxy is NOT observed sales or a forced reconciliation. Never used as denominator for reserve PV10 model.",
    },
    target: { valueUsdMillion: s.pv10, basis: "Actual disclosed standardized PV10, not market value or equity",
      scope: source.scope, sourceId: "standardized", disclosedFutureCashFlows: s,
      reproducesIssuerSchedule: false,
      limitation: "Cash totals are authentic; conditional pro-rata timing does NOT reproduce issuer development/production/tax schedule. SEC first-day-of-month 12-month price deck differs from FY realized prices." },
    baseResult, annualRows: path?.annualRows ?? [],
    sensitivityRows: variants.map(([id, scenario]) => ({ id, ...scenario,
      valueAtZeroDecline: calculateProducerReservePath(domain.decline[0], scenario).value,
      valueAtMaximumDecline: calculateProducerReservePath(domain.decline[1], scenario).value,
      result: solveProducerReserveDecline(s.pv10, scenario) })),
    refusalRows: [
      solveProducerReserveDecline(null), solveProducerReserveDecline(s.pv10, baseScenario, "whole-equity"),
      qualifyProducerReserveCandidates([0.01, 0.05], true), qualifyProducerReserveCandidates([], true),
      qualifyProducerReserveCandidates([0.02], false),
    ],
    reconciliation: {
      reserveRollforwardResidualMillionBoe: r.opening + r.revisions + r.improvedRecovery + r.purchases + r.sales + r.extensionsDiscoveries + r.production - r.closing,
      standardizedCashResidualUsdMillion: s.revenue - s.productionCosts - s.development - s.incomeTaxes - s.netCash,
      standardizedDiscountResidualUsdMillion: s.netCash - s.discountEffect - s.pv10,
      producingIncomeResidualUsdMillion: o.revenue - o.productionCosts - o.exploration - o.depreciationDepletion - o.productionTaxes - o.incomeTaxes - o.earnings,
      revenueResidualUsdMillion: o.thirdParty + o.transfers - o.revenue,
      costsIncurredResidualUsdMillion: facts.costsIncurred.provedAcquisitions + facts.costsIncurred.unprovedAcquisitions +
        facts.costsIncurred.exploration + facts.costsIncurred.development - facts.costsIncurred.total,
      remainingReservesMillionBoe: path?.remainingReserves ?? null,
      pvResidualUsdMillion: path ? path.value - s.pv10 : null,
      gasConversion: "6 billion cubic feet = 1 million boe for ALL reserve and production comparisons",
      cashFlowDefinition: "Conditional unlevered reserve FCFF = sales cash - production/abandonment cash - development capital cash - income tax cash - deltaWC. No DD subtraction; no interest; no borrowing. Not actual corporate FCFF or FCFE.",
      depletionTreatment: "Physical depletion reduces stock once; accounting DD is noncash, never an extra reserve-model cash deduction.",
      reinvestmentTreatment: "Future development occurs once via standardized development costs; FY2024 costs incurred are historical diagnostics, NOT an additional cash-capex deduction. No cost inferred per reserve addition.",
      workingCapitalTreatment: "Forward deltaWC=0 is explicit conditional assumption; no OCF input or duplicate WC deduction.",
      financingTreatment: "No enterprise-to-equity bridge; no debt subtraction, cash addition, or FCFE inference. Reported reserve interest includes NCI.",
      stockTreatment: "Purchases, organic extensions, revisions, sales and production are separate. Forward closed pool has zero replacement; historical acquired reserves are not endogenous organic replacement.",
    },
    sourceGaps: [
      "No independently supported upstream market valuation allocation; no market-implied decline or whole-equity inference.",
      "Issuer annual production/development/tax timing by reserve cohort absent; uniform per-boe allocation is conditional.",
      "Marginal commodity tax/royalty response and product/geographic reserve mix absent; sensitivities hold tax per boe fixed.",
      "Actual segment cash capex, working capital, financing, NCI/common-equity bridge unavailable; FCFE refused.",
      "Unproved reserves, future discoveries, replacement reinvestment and non-producing/LNG/transport/downstream/chemical businesses excluded.",
      "Source-qualified accounting transcription pending independent authenticity/authorization, not issuer-accepted validation. Mirror retained; SEC acceptance timestamp not verified. No historical availability or prospective freeze claimed.",
      "No CCS tonnes, emissions factors, climate attribution, FaIR scenario or global expansion inferred.",
    ],
    replacementContract: {
      availableFunction: "calculateProducerReplacementPath(decline, plan, scenario)",
      inversionFunction: "solveProducerReplacementDecline()",
      inputType: "ProducerReplacementPlan in shared/producerReserveSchema.ts",
      requirements: "Explicit same-dollar 100-year additions, incremental production, capex, sales/cost/tax per boe and deltaWC plan, with justification each year; all replacement assumptions labeled conditional",
      accounting: "Separate existing and replacement stocks; additions at start-year, production capped by each stock; existing development only on old-pool production; replacement capital deducted only via annual replacement budget",
      observedReplacementCostPerAddition: null, actualReplacementPlan: null,
      sourceGap: "FY2024 acquisitions/revisions/extensions and costs incurred do not identify future replacement cash cost or production timing; no actual replacement economics fabricated",
      diagnosticDefault: "Zero replacement closed pool ONLY; finite unextracted residual remains explicitly reported",
    },
    hashes: { parent: source.pdfSha256, source: source.textSha256, material: producerReserveHash(facts),
      model: producerReserveHash(modelSpecification), domain: producerReserveDomainHash },
    preservation: [
      "Independent of CCS; no ticker join, self-approval, historical backdating or three-case acceptance.",
      "All 14 FaIR pins and frozen studies untouched.",
      "Existing Gordon-primary, 5-year forecast/10-year original fade, terminal 2.5–4%, and stub conventions untouched; not applicable to this finite reserve-interest diagnostic.",
    ],
    privateValidationRequired: [
      "Verify retained PDF/text hashes and original table scope, row values, document date and extraction locators.",
      "Independently authenticate source; PDF mirror byte integrity alone is not authority or redistribution permission.",
      "Verify pre-solve domain freeze receipt and semantic/source-code hashes; no post-solve widening.",
      "Independently recalculate stocks, cash-flow identities, unit conversion, residual, monotonicity proof and sensitivity refusals.",
      "No owner/scientific approval or whole-equity/three-case acceptance conferred by tests or this public report.",
    ],
  };
}

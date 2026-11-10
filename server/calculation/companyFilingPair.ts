import { z } from "zod";
import { cashFlowValue, reverseCashFlowGrowth } from "./cashFlowValuation";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const date = z.string().date();
export const filingFactsSchema = z.object({
  symbol: z.string().min(1), issuer: z.string().min(1), security: z.string().min(1),
  cik: z.string().regex(/^\d{10}$/), currency: z.literal("USD"),
  fiscalEnd: date, documentDate: date, observedAt: z.string().datetime(),
  sourceUrl: z.string().url(), sourceHash: hash, textHash: hash,
  operatingCashFlow: z.number().finite(), capitalSpend: z.number().finite().nonnegative(),
  debtProceeds: z.number().finite().nonnegative(), debtRepayments: z.number().finite().nonnegative(),
  accountingCaveats: z.array(z.string()),
}).strict();
export const marketReferenceSchema = z.object({
  symbol: z.string(), cik: z.string(), security: z.string(), currency: z.literal("USD"),
  referenceDate: date, priceDate: date, sharesDate: date,
  price: z.number().finite().positive(), shares: z.number().finite().positive(),
  sourceUrl: z.string().url(), sourceHash: hash, observedAt: z.string().datetime(),
  usageAuthorization: z.string().min(1),
  sharesBasis: z.literal("total-common-outstanding-not-diluted-or-float"),
}).strict();

/** Private diagnostic adapter; never substitutes a finite-horizon PV for whole equity. */
export function buildCompanyFilingPair(factsInput: unknown, marketInput?: unknown) {
  const facts = filingFactsSchema.parse(factsInput);
  const baseFcfe = facts.operatingCashFlow - facts.capitalSpend + facts.debtProceeds - facts.debtRepayments;
  const common = {
    facts, baseFcfe,
    bridge: {
      definition: "Reported CFO minus identified capital spending plus cash debt proceeds minus cash debt repayments",
      workingCapitalDeductedAgain: false, manufacturingCreditsAddedAgain: false,
      debtSubtractedFromEquityAgain: false, cashAddedToEquity: 0,
      cashTreatment: "No separate cash add-on: reported CFO includes interest income; unrestricted excess cash not independently established.",
      financingTreatment: "Historical cash debt financing only; not total financing cash flow or future debt capacity.",
    },
    productionEligible: false, ownerApproved: false, scienceAccepted: false,
  };
  const gaps = [...facts.accountingCaveats];
  if (baseFcfe <= 0) gaps.push("Non-positive historical FCFE: existing solver refuses; requires independently supported recovery/reinvestment model.");
  if (marketInput === undefined) gaps.push("Missing authorized, hash-retained total-common share count and price on the same explicit reference date. Filing non-affiliate float and later shares cannot be combined; undated provider market cap is insufficient.");
  if (marketInput === undefined) return { ...common, status: "blocked" as const, gaps, pairs: [] };
  const market = marketReferenceSchema.parse(marketInput);
  for (const key of ["symbol", "cik", "security", "currency"] as const)
    if (market[key] !== facts[key]) throw new Error(`Market/filing identity mismatch: ${key}`);
  if (market.referenceDate !== market.priceDate || market.referenceDate !== market.sharesDate)
    throw new Error("Price and total-common shares must share reference date");
  if (market.referenceDate < facts.documentDate || market.referenceDate < facts.fiscalEnd)
    throw new Error("Market reference predates filing; no backdated information set");
  if (gaps.length) return { ...common, market, status: "blocked" as const, gaps, pairs: [] };
  // Existing, pre-existing diagnostic protocol, not arbitrary new terminal selection.
  const pairs = [.06, .08, .10].flatMap(discountRate => [.01, .02, .03].map(terminalGrowth => {
    const input = {
      baseCashFlow: baseFcfe, marketCap: market.price * market.shares,
      discountRate, terminalGrowth, basis: "FCFE", discountBasis: "cost-of-equity",
      businessType: "non-financial", cashFlowCurrency: facts.currency,
      valuationCurrency: market.currency, minimumGrowth: -.5, maximumGrowth: .5,
    };
    const implied = reverseCashFlowGrowth(input);
    const forward = cashFlowValue({ ...input, stageOneGrowth: 0 });
    let repricingError: number | null = null;
    if (implied.status === "conditional-solution") {
      const replay = cashFlowValue({ ...input, stageOneGrowth: implied.growth });
      if (replay.status !== "conditional-value") throw new Error("Implied replay failed");
      repricingError = Math.abs(replay.equityValue / input.marketCap - 1);
      if (repricingError > 1e-8) throw new Error("Implied repricing tolerance failed");
    }
    return { discountRate, terminalGrowth, forward, implied, repricingError };
  }));
  return { ...common, market, status: "executed-diagnostic-only" as const, gaps, pairs,
    horizon: "Five annual growth years, ten-year linear growth fade, perpetual terminal at end of year 15; identical in both directions.",
    assumptions: "Existing Company_Valuation_Sensitivity_Protocol rate grid. Zero initial forward growth is a frozen flat-cash diagnostic, not management guidance or a justified operating forecast. Historical financing/reinvestment repeated conditionally.",
    completeIssuerCases: 0,
  };
}

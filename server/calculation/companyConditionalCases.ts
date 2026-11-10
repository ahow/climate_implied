import { z } from "zod";
import { contentHash } from "./analysisManifest";

export const fplChannelEvidence = [
  {
    id: "fpsc-staff-2025-11-14", publishedDate: "2025-11-14",
    url: "https://www.floridapsc.com/pscfiles/library/filings/2025/15095-2025/15095-2025.pdf",
    sha256: "1da7878a9f678e665e1261e17b99a3a1b544d0e428a2c2787a241dba1d6ec98d",
    locator: "Pages 2–3: 10.95% ROE and 59.60% investor-source equity ratio; page 6: settlement adds 1,192 MW solar in 2027, with future economic/resource-need tests.",
  },
  {
    id: "fpl-earnings-script-2026-01-27", publishedDate: "2026-01-27",
    url: "https://www.investor.nexteraenergy.com/~/media/Files/N/NEE-IR/reports-and-fillings/quarterly-earnings/2025/Q4%202025/Final%20Q4%202025%20Earnings%20Script%20vF.pdf",
    sha256: "ef52b5e14d192e1ef545b84acfe7ec241982630cd88c21d8640fb2f8954e39b6",
    locator: "Page 4: adopted four-year agreement midpoint ROE 10.95%, range 9.95–11.95%, equity ratio 59.6%.",
  },
  {
    id: "fpsc-reconsideration-2026-04-27", publishedDate: "2026-04-27",
    url: "https://www.floridapsc.com/pscfiles/library/filings/2026/02414-2026/02414-2026.pdf",
    sha256: "22131a280c064b4ff55757523908c9e6fdfd4df1fa78fc6e93bc4082e66b5efc",
    locator: "Pages 1–2 confirm November 20 approval; page 14 leaves docket open during Supreme Court appeals. Not an unconditional final project recovery approval.",
  },
  {
    id: "eia-2024-construction-costs", publishedDate: "2026-07-06",
    url: "https://www.eia.gov/electricity/generatorcosts/",
    sha256: "900debd095b5a59493bbb57a6ef479ae2f905a18a52d68e454bfa1bac9b3f46c",
    locator: "2024 construction-cost table: photovoltaic capacity-weighted $1,865/kW; notes: AC capacity, >=1MW facilities, incentives excluded. National cost, NOT FPL cost.",
  },
  {
    id: "fpl-2025-public-cash-flow", publishedDate: "2026-01-27",
    url: "https://www.investor.nexteraenergy.com/~/media/Files/N/NEE-IR/reports-and-fillings/quarterly-earnings/2025/Q4%202025/2026-0127%20NEEQ42025News%20Release%20vF.pdf",
    sha256: "bcb63c7307645b65be80a75f67e3429aa3530273565e39496487366d73d06e5d",
    locator: "Page 11, full original public PDF: FY2025 FPL cash flow column, USD millions, preliminary/unaudited. Retained markdown was truncated before these rows.",
  },
] as const;

/** Public issuer statement rows; never provider data or a recurring forecast. */
export const fplPublicCashBaseline = Object.freeze({
  fiscalYear: 2025, currency: "USD", sourceId: "fpl-2025-public-cash-flow",
  operatingCashFlow: 8_533e6, capitalExpenditure: 8_719e6, nuclearFuelPurchases: 216e6,
  depreciationAndAmortization: 3_778e6,
  currentAssetCashChange: -319e6, currentLiabilityCashChange: 59e6,
  noncurrentAssetCashChange: -199e6, noncurrentLiabilityCashChange: -22e6,
  longTermDebtIssued: 3_785e6, longTermDebtRetired: 1_821e6,
  commercialPaperChange: -300e6, parentDistributions: 1_100e6,
});

export const fplSolarAssumptions = Object.freeze({
  version: "fpl-2027-solar-cohort-1",
  knowledgeCutoff: "2026-11-10T04:29:45.000Z",
  sourceCheckDate: "2026-11-10",
  firstYear: 2027, solarMw: 1_192, nationalHistoricalCostUsdPerKw: 1_865,
  equityRatio: 0.596, allowedRoe: 0.1095,
  // Analyst choices, deliberately separate from the sourced facts above:
  assumedBookLifeYears: 30,
  assumptions: Object.freeze([
    "Treat proposed solar MW as AC for this conditional case; verify project filings before adoption.",
    "Transfer national 2024 PV cost to FPL 2027 with zero escalation: a transparent cost proxy, not a bid, Florida estimate or measured future nominal cost.",
    "One 2027 cohort only; no additional 2028–2031 builds included, not an assumption that FPL stops building.",
    "All cohort capex paid and commissioned January 1, 2027; no construction work in progress, AFUDC or timing claims.",
    "30-year straight-line book depreciation, zero salvage: analyst convention, not FPL approved depreciation schedule.",
    "Hypothetical investor funding split matches regulatory equity ratio. Not actual borrowing or parent equity guidance.",
    "Full-rate-base case excludes unknown ADIT, ITC and other rate-base deductions; 75% admission case tests deductions/disallowance without assigning invented tax credits.",
    "No fixed O&M, debt return, cash tax, working capital or credit flows fabricated; calculated capital-recovery components are not the full revenue requirement or FCFE.",
  ]),
});

const solarSpec = z.object({
  firstYear: z.number().int().min(2027).max(2096),
  solarMw: z.number().positive().finite(), costUsdPerKw: z.number().positive().finite(),
  equityRatio: z.number().min(0).max(1), allowedRoe: z.number().min(0).max(1),
  bookLifeYears: z.number().finite().min(5).max(100),
  admittedNetRateBaseFraction: z.number().min(0).max(1),
  recoveryLagYears: z.number().int().min(0).max(5),
  continueTermsAfter2029: z.boolean(),
}).strict();

/** Incremental solar asset ledger, deliberately NOT the whole-company engine. */
export function calculateFplSolarCohort(input: unknown) {
  const x = solarSpec.parse(input);
  const capex = x.solarMw * 1_000 * x.costUsdPerKw;
  const annualDepreciation = capex / x.bookLifeYears;
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = x.firstYear + i;
    const openingNetPlant = capex - annualDepreciation * i;
    const closingNetPlant = openingNetPlant - annualDepreciation;
    const averageNetPlant = (openingNetPlant + closingNetPlant) / 2;
    const recoveryActive = i >= x.recoveryLagYears && (year <= 2029 || x.continueTermsAfter2029);
    const admittedAverageRateBase = recoveryActive ? averageNetPlant * x.admittedNetRateBaseFraction : 0;
    const allowedEquityEarnings = admittedAverageRateBase * x.equityRatio * x.allowedRoe;
    const depreciationRecoveryComponent = recoveryActive ? annualDepreciation * x.admittedNetRateBaseFraction : 0;
    const capitalSpend = i === 0 ? capex : 0;
    return {
      year, capitalSpend, openingNetPlant, closingNetPlant, averageNetPlant,
      depreciation: annualDepreciation, recoveryActive, admittedAverageRateBase,
      allowedEquityEarnings, depreciationRecoveryComponent,
      partialCapitalRevenueRequirement: allowedEquityEarnings + depreciationRecoveryComponent,
      assumedNewDebtFunding: capitalSpend * (1 - x.equityRatio),
      assumedNewEquityFunding: capitalSpend * x.equityRatio,
    };
  });
  if (years.some(y => Object.values(y).some(v => typeof v === "number" && !Number.isFinite(v))))
    throw new Error("Nonfinite solar asset ledger");
  return {
    status: "conditional-solar-capital-recovery-ledger-not-full-FCFE",
    symbol: "NEE", operatingEntity: "FPL", geography: "Florida", currency: "USD",
    inputHash: contentHash(x), inputs: x, capex, years,
    cumulativeAllowedEquityEarnings: years.reduce((s, y) => s + y.allowedEquityEarnings, 0),
    cumulativeCapitalRecoveryComponents: years.reduce((s, y) => s + y.partialCapitalRevenueRequirement, 0),
    comparisonWithPublic2025FplCapex: capex / fplPublicCashBaseline.capitalExpenditure,
    productionEligible: false, approval: "none",
    scope: "Solar-specific SoBRA mechanism; conditional gross investor-financed asset model, not climate-policy causation or guaranteed recovery.",
    post2029Treatment: x.continueTermsAfter2029
      ? "Analyst assumes renewal of same terms for 2030–2031; current agreement does not establish this."
      : "Stress excludes recovery after 2029, not a prediction of legal entitlement termination.",
    omittedCashInputs: ["O&M", "debt interest/return", "cash/deferred taxes", "ITC/PTC and customer sharing", "working capital", "repayments", "AFUDC", "other company activities"],
  };
}

export function buildFplSolarCases() {
  const a = fplSolarAssumptions;
  const common = { firstYear: a.firstYear, solarMw: a.solarMw,
    costUsdPerKw: a.nationalHistoricalCostUsdPerKw, equityRatio: a.equityRatio,
    allowedRoe: a.allowedRoe, bookLifeYears: a.assumedBookLifeYears };
  return {
    evidence: fplChannelEvidence, assumptions: a, assumptionHash: contentHash(a),
    publicCashBaseline: fplPublicCashBaseline,
    baselineDiagnostics: {
      currentOperatingAssetLiabilityCashContribution: fplPublicCashBaseline.currentAssetCashChange + fplPublicCashBaseline.currentLiabilityCashChange,
      allReportedOperatingAssetLiabilityCashContribution: fplPublicCashBaseline.currentAssetCashChange + fplPublicCashBaseline.currentLiabilityCashChange +
        fplPublicCashBaseline.noncurrentAssetCashChange + fplPublicCashBaseline.noncurrentLiabilityCashChange,
      netListedDebtFunding: fplPublicCashBaseline.longTermDebtIssued - fplPublicCashBaseline.longTermDebtRetired + fplPublicCashBaseline.commercialPaperChange,
      cashAfterCapexAndNuclearFuelBeforeFinancing: fplPublicCashBaseline.operatingCashFlow - fplPublicCashBaseline.capitalExpenditure - fplPublicCashBaseline.nuclearFuelPurchases,
      treatment: "Historical public statement arithmetic only; not forecast FCFE, not repeated in solar projection.",
    },
    members: [
      { id: "timely-full-admission-renewal", admittedNetRateBaseFraction: 1, recoveryLagYears: 0, continueTermsAfter2029: true },
      { id: "one-year-lag-75pct-admission-renewal", admittedNetRateBaseFraction: 0.75, recoveryLagYears: 1, continueTermsAfter2029: true },
      { id: "no-post2029-recovery-stress", admittedNetRateBaseFraction: 1, recoveryLagYears: 0, continueTermsAfter2029: false },
    ].map(({ id, ...scenario }) => ({ id, ...calculateFplSolarCohort({ ...common, ...scenario }) })),
    probabilityWeights: null, productionEligible: false,
  };
}

/**
 * A project operating channel, not a substitute for companyProjection.
 * Contracted third-party CO2 throughput is neither issuer Scope 1 abatement nor
 * operating revenue until contract pricing and revenue recognition are supplied.
 */
const fiveFractions = z.array(z.number().finite().min(0).max(1)).length(5);
const specification = z.object({
  sourceTextHash: z.string().regex(/^[a-f0-9]{64}$/),
  availableAt: z.string().datetime(),
  knowledgeCutoff: z.string().datetime(),
  firstYear: z.number().int().min(2027).max(2096),
  contractedAnnualTonnes: z.number().finite().positive(),
  members: z.array(z.object({
    id: z.string().min(1),
    annualContractDeliveryFraction: fiveFractions,
    rationale: z.string().min(1),
  }).strict()).min(2),
}).strict();

export const ccsDeliveryAssumptions = Object.freeze([
  Object.freeze({
    id: "policy-or-permit-failure",
    annualContractDeliveryFraction: Object.freeze([0, 0, 0, 0, 0]),
    rationale: "Zero delivery stress: source explicitly conditions projects on permits, investment and supportive policy. Not a prediction of contract cancellation.",
  }),
  Object.freeze({
    id: "staged-execution",
    annualContractDeliveryFraction: Object.freeze([0.25, 0.5, 0.75, 1, 1]),
    rationale: "Analyst sensitivity in equal quarter-contract increments, bounded by disclosed contracted capacity. Timing is not issuer guidance or a fitted commissioning model.",
  }),
  Object.freeze({
    id: "full-contract-delivery",
    annualContractDeliveryFraction: Object.freeze([1, 1, 1, 1, 1]),
    rationale: "Upper contract-utilization stress, excluding new awards. Does not claim that all contracts are operational or that disclosed capacity is a guaranteed maximum for the business.",
  }),
]);

export function calculateCcsOperatingChannel(input: unknown) {
  const x = specification.parse(input);
  if (Date.parse(x.availableAt) > Date.parse(x.knowledgeCutoff))
    throw new Error("Evidence unavailable at knowledge cutoff");
  if (x.firstYear <= new Date(x.knowledgeCutoff).getUTCFullYear())
    throw new Error("Prospective annual window must start after knowledge-cutoff year");
  if (new Set(x.members.map(m => m.id)).size !== x.members.length)
    throw new Error("Duplicate sensitivity identity");
  const members = [...x.members].sort((a, b) => a.id.localeCompare(b.id)).map(m => {
    const years = m.annualContractDeliveryFraction.map((fraction, i) => {
      const deliveredTonnes = x.contractedAnnualTonnes * fraction;
      return {
        year: x.firstYear + i, deliveredTonnes,
        // A derivative with respect to an unknown fee/cost, not an assumed $1 fee.
        revenueSensitivityUsdPerUsdPerTonne: deliveredTonnes,
        variableCostSensitivityUsdPerUsdPerTonne: -deliveredTonnes,
      };
    });
    return { id: m.id, rationale: m.rationale, years,
      totalDeliveredTonnes: years.reduce((sum, y) => sum + y.deliveredTonnes, 0) };
  });
  return {
    status: "conditional-climate-operating-channel-not-company-projection" as const,
    symbol: "XOM", boundary: "third-party contracted CCS, US Gulf Coast",
    inputHash: contentHash({ ...x, members: [...x.members].sort((a, b) => a.id.localeCompare(b.id)) }),
    members, probabilityWeights: null, productionEligible: false,
    approval: "none", scientificValidation: "not performed",
    issuerFcfe: null, issuerGrowth: null, avoidedEmissions: null,
    limitations: [
      "Approximately 9 million contracted tonnes/year is a dated issuer claim, not measured injection.",
      "Sensitivity members are analyst boundary conditions, not draws from a joint distribution.",
      "Fees, variable costs, fixed costs, ownership and annual project investment are unknown; no profit or FCFE is inferred.",
      "No 45Q credit is assigned to ExxonMobil; entitlement and contractual sharing are unknown.",
      "No issuer emissions are reduced by third-party captured tonnes; leakage, counterfactual emissions and capture energy are not modelled.",
      "No extrapolation of the corporate constant-price cash-flow plan into climate-attributable growth.",
    ],
  };
}

/** Public source facts and exact requirements, without private provider payloads. */
export const issuerCaseDecisions = [
  {
    symbol: "NEE", status: "executable-conditional-incremental-solar-FCFE-full-company-blocked",
    mechanism: "Solar/storage construction can change asset base and allowed utility revenue; contracted renewable generation can change NEER sales.",
    rejectedMappings: [
      "30 GW mixed generation/storage backlog is not solar generation, annual commissioning, revenue or climate-caused demand.",
      "FPL 2% typical residential bill growth is not total utility revenue growth.",
      "Adjusted EPS growth is not FCFE growth; backlog includes hyperscaler demand and nuclear.",
    ],
    missingInputs: [
      "Annual 2027–2031 FPL and NEER operating-geography/sector revenue weights including corporate eliminations.",
      "Technology-specific commissioned MW and in-service dates; storage MW/MWh separate from generation; capacity factor/curtailment for generation.",
      "FPL approved order: recoverable rate base, allowed return, depreciation, tax, rate timing and cost-recovery treatment; NEER owned-share PPA tariffs and escalators.",
      "Reconciled nominal USD starting FCFE and annual interest, depreciation, capex, working capital, borrowing, tax, non-operating income, attribution and other cash adjustments.",
      "Dated scope 1/2/3 tonnes with boundary/units; five annual intensity paths; jurisdiction-specific liable fractions and electricity pass-through.",
      "History/peer-supported margin bounds and annual margins; explicit climate-policy counterfactual distinct from ordinary demand.",
    ],
  },
  {
    symbol: "XOM", status: "executable-partial-CCS-channel-full-company-blocked",
    mechanism: "Policy/permitting-contingent contracted third-party CCS delivery changes transport/storage service activity.",
    rejectedMappings: [
      "$35 billion corporate cash-flow growth excludes working capital/other and uses constant prices/margins; not FCFE or climate-attributable growth.",
      "$20 billion lower-emission investment covers multiple businesses; it cannot all be charged to CCS or spread equally over five years.",
      "Contracted CO2 volumes are not injected volumes, guaranteed revenue, direct carbon-tax liability or net avoided emissions.",
    ],
    missingInputs: [
      "Project/customer-specific contract start dates, minimum volumes, delivered tonnes, owned share, cancellations and recognition terms.",
      "Annual nominal USD service fee, tariff escalation, capture/transport/storage allocation and variable/fixed operating costs.",
      "Annual attributable CCS capex, depreciation, working capital, financing, cash tax, tax-credit ownership/sharing and incremental cash adjustments.",
      "Reconciled positive starting issuer FCFE and all non-CCS segment/geography exposures with annual 2027–2031 activity/margins/cash bridges.",
      "Issuer-scope emissions inventory/intensity paths, liability and pass-through; prove third-party CCS does not duplicate issuer abatement.",
      "Same-horizon nominal USD FCFE valuation pair and evidence-supported joint uncertainty before growth distribution claims.",
    ],
  },
  {
    symbol: "CAT", status: "blocked-full-company-case",
    mechanism: "Only separately identified transition equipment orders or policy-caused end-market demand could justify a climate operating channel.",
    rejectedMappings: [
      "Power Generation quarterly sales growth and data-center demand are not evidence of climate-policy causation.",
      "Retail dealer reports are not audited issuer revenue or an annual order-to-revenue bridge.",
      "Product-use Scope 3 tonnes are not a direct issuer carbon charge.",
    ],
    missingInputs: [
      "Dated product/customer order classification separating transition-related equipment from ordinary data-center, oil/gas and construction demand.",
      "Explicit policy/technology counterfactual and annual order conversion, cancellation, owned revenue and regional end-market shares.",
      "Non-financial machinery scope separated from Financial Products with reconciled starting FCFE and attribution.",
      "Annual 2027–2031 regional activity, evidence-supported margins, tax, interest, depreciation, capex, working capital, financing and all cash adjustments.",
      "Scoped emissions in tonnes, intensity pathways, direct policy liability and electricity pass-through; no Scope 3 double count.",
    ],
  },
] as const;

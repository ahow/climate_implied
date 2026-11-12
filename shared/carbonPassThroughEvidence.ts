import { z } from "zod";

const text = z.string().trim().min(1);
const period = z.object({ start: z.string().regex(/^\d{4}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}$/) }).strict()
  .refine(p => p.start <= p.end, "Reversed observation period");
export const carbonPassThroughEvidenceSchema = z.object({
  id: text, sourceId: text, locator: text,
  sector: text, product: text, jurisdiction: text, regime: text,
  observedPeriod: period, frequency: text, market: text,
  channel: z.enum(["wholesale-electricity-price-formation", "direct-product-price-recovery"]),
  definition: text, denominator: text, estimator: text,
  metric: z.enum(["cost-pass-through-ratio", "log-price-elasticity"]),
  reported: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("point"), value: z.number().finite(), interval: z.null() }).strict(),
    z.object({ kind: z.literal("point-with-bootstrap-span"), value: z.number().finite(),
      interval: z.object({ lower: z.number().finite(), upper: z.number().finite(), interpretation: text }).strict() }).strict(),
    z.object({ kind: z.literal("lower-bound-only"), lower: z.number().finite(), interval: z.null() }).strict(),
  ]),
  uncertainty: text, limitations: z.array(text).min(1),
}).strict().superRefine((x, ctx) => {
  if (x.reported.kind === "point-with-bootstrap-span" && x.reported.interval.lower > x.reported.interval.upper)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Reversed reported span" });
});
export type CarbonPassThroughEvidence = z.infer<typeof carbonPassThroughEvidenceSchema>;

export const carbonPassThroughSourceSchema = z.object({
  id: text, title: text, authors: text, publisher: text,
  url: z.string().url().startsWith("https://"), publication: text,
  publicationPrecision: z.enum(["month", "day"]), version: text,
  retrievedAt: z.string().datetime(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  hashBasis: z.literal("original-public-pdf-bytes"),
  provenance: z.literal("original-public-research"),
  rights: text, retained: z.literal("metadata-and-paraphrased-facts-only"),
}).strict();
export type CarbonPassThroughSource = z.infer<typeof carbonPassThroughSourceSchema>;

/** Public-safe bibliographic metadata and small factual transcriptions, not raw papers. */
export const carbonPassThroughSources: readonly CarbonPassThroughSource[] = [
  {
    id: "sijm-neuhoff-chen-2006", title: "CO2 cost pass through and windfall profits in the power sector",
    authors: "Jos Sijm; Karsten Neuhoff; Yihsu Chen", publisher: "University of Cambridge EPRG / CWPE",
    url: "https://www.jbs.cam.ac.uk/wp-content/uploads/2023/12/eprg-wp0617.pdf",
    publication: "2006-05", publicationPrecision: "month",
    version: "CWPE0639/EPRG0617 cover May2006; body dated19June2006; preliminary working paper, not final journal edition",
    retrievedAt: "2026-11-11T23:50:46.478Z",
    sha256: "ddcca6fed60097daae8818d2fd104b0dbbae69269c07db0e3aff344466dbd04e",
    hashBasis: "original-public-pdf-bytes", provenance: "original-public-research",
    rights: "Public university-hosted working paper; no open redistribution licence established. Link, metadata and small factual paraphrases only; raw PDF stays outside repository.",
    retained: "metadata-and-paraphrased-facts-only",
  },
  {
    id: "ce-delft-oeko-2015", title: "Ex-post investigation of cost pass-through in the EU ETS: An analysis for six sectors",
    authors: "CE Delft and Oeko-Institut", publisher: "Publications Office of the European Union; commissioned by European Commission DG Climate Action",
    url: "https://ce.nl/wp-content/uploads/2021/03/7D94_CE_Delft_Ex-post_investigation_cost_pass-through_EU_ETS_Final.pdf",
    publication: "2015-11", publicationPrecision: "month", version: "November2015 final report; authors' views, not Commission endorsement",
    retrievedAt: "2026-11-11T23:50:47.122Z",
    sha256: "5beb61786c3991427351ca91c169fa4ffa4f09dc437ba5a86f771fadc43f7c64",
    hashBasis: "original-public-pdf-bytes", provenance: "original-public-research",
    rights: "Legal notice: copyright European Union2015; reproduction authorised provided source acknowledged. Only metadata and factual paraphrases retained.",
    retained: "metadata-and-paraphrased-facts-only",
  },
];

const powerRows = [
  ["DE", "peak", "coal40%", 1.17, .97, 1.17],
  ["DE", "off-peak", "coal40%", .60, .60, .71],
  ["NL", "peak", "gas42%", .78, .64, .81],
  ["NL", "off-peak", "coal40%", .80, .69, .80],
] as const;
const power: CarbonPassThroughEvidence[] = powerRows.map(([jurisdiction, load, fuel, value, lower, upper]) => ({
  id: `sijm-2006-${jurisdiction}-${load}`, sourceId: "sijm-neuhoff-chen-2006",
  locator: "printed pp13–14, Table1; section3 equations1–3 and footnotes8–9",
  sector: "power-generation", product: `year-ahead-2006-electricity-${load}`, jurisdiction, regime: "EU-ETS-phase1",
  observedPeriod: { start: "2005-01", end: "2005-12" }, frequency: "daily forward quotes",
  market: "wholesale year-ahead electricity contracts for delivery2006",
  channel: "wholesale-electricity-price-formation",
  definition: "Power-price change per marginal generator CO2 opportunity-cost change, holding fuel pass-through at unity; not own-emission cash recovery.",
  denominator: `Marginal ${fuel} generation CO2 opportunity cost per MWh; coal0.85/gas0.48 tCO2/MWh`,
  estimator: "OLS dark/spark-spread level regression; serial-correlation/noncointegration caveats; six restricted samples omitting two-month blocks",
  metric: "cost-pass-through-ratio",
  reported: { kind: "point-with-bootstrap-span", value, interval: { lower, upper,
    interpretation: "Reported min/max across six two-month omitted samples; paper says about80% confidence collectively. Not a conventional95% CI or causal bound." } },
  uncertainty: "Descriptive bootstrap sensitivity span, not a calibrated probability distribution; abstract60–100% is not Table1's full range.",
  limitations: [
    "Coal marginal-unit assumption can bias German peak estimate upward when gas sets price;117% is retained, not clipped.",
    "Early EU ETS; other scarcity, fuel and market-power effects may remain. No transport to regulated US tariffs or later regimes without new evidence.",
    "Market price formation is not issuer profit/FCFE or electricity customer's downstream cost recovery; allocation and inframarginal carbon intensity matter.",
  ],
}));
const petrol: CarbonPassThroughEvidence[] = ([
  ["BE", .95], ["DE", .80], ["FR", 1], ["IT", .80],
] as const).map(([jurisdiction, value]) => ({
  id: `ce2015-petrol-${jurisdiction}`, sourceId: "ce-delft-oeko-2015",
  locator: "printed p73 Table10 (sample note); p76 Table12; pp74–75 denominator cautions; p66 price definitions",
  sector: "petroleum-refining", product: "petrol", jurisdiction, regime: "EU-ETS-phase2-3",
  observedPeriod: { start: "2008-01", end: "2013-02" }, frequency: "monthly",
  market: "pre-tax product price series; not issuer-specific sales or pump tax recovery",
  channel: "direct-product-price-recovery",
  definition: "Indicative product-price carbon-cost pass-through ratio derived from log-price ARDL CO2 coefficient and allocated product emissions cost share; not the log coefficient itself.",
  denominator: "Allocated refinery CO2 cost per product; joint-product allocation and emissions intensity introduce additional uncertainty.",
  estimator: "Log cost-price ARDL selected after unit-root/cointegration/residual tests; Table10 CO2 coefficients BE.015/DE.013/FR.016/IT.013, not95/80/100/80% coefficients.",
  metric: "cost-pass-through-ratio",
  reported: { kind: "point", value, interval: null },
  uncertainty: "No numerical country-ratio confidence interval reported in Table12; indicative point, not a causal range. One-sided10% significance criterion, including DE p=.096; no invented interval.",
  limitations: [
    "Table10 explicitly says Jan2008–Feb2013 monthly, NOT generic report2005–2014 or weekly diesel2008–Feb2015.",
    "Not measured issuer cash collection, profit retention, net income, or global upstream/CCS incidence.",
    "Report did not investigate consequent market-share loss or profitability. Product cost allocation and contemporaneous controls may affect estimates.",
  ],
}));
export const carbonPassThroughEvidence: readonly CarbonPassThroughEvidence[] = [
  ...power, ...petrol,
  {
    ...petrol[1], id: "ce2015-diesel-DE-not-significant", product: "diesel",
    locator: "printed pp72–73 Table9; p76 Table12",
    observedPeriod: { start: "2008-01", end: "2015-02" }, frequency: "weekly",
    definition: "German diesel CO2 log-price coefficient=.012; one-sided p=.325; report does not calculate a pass-through ratio for this insignificant result.",
    reported: { kind: "point", value: .012, interval: null },
    denominator: "Log-price elasticity, NOT a cost-recovery fraction; no ratio reported.",
    metric: "log-price-elasticity",
    estimator: "Log cost-price ARDL, weekly diesel series, Table9; not the monthly petrol regression.",
    uncertainty: "Insignificance is not evidence of zero recovery. Context-only, ineligible for binding.",
    channel: "direct-product-price-recovery",
    limitations: ["No ratio; never bind .012 as1.2% recovery or impute zero."],
  },
  {
    ...petrol[2], id: "ce2015-diesel-FR-above100", product: "diesel",
    locator: "printed pp72–73 Table9; pp74–76 section4.2.8/Table12",
    observedPeriod: { start: "2008-01", end: "2015-02" }, frequency: "weekly",
    reported: { kind: "lower-bound-only", lower: 1, interval: null },
    estimator: "Log cost-price ARDL, weekly diesel series, Table9; allocated emissions-cost translation in section4.2.8.",
    definition: "French diesel indicative ratio >100%; CO2 log coefficient .037, p rounded .000. No exact ratio or numerical confidence endpoints reported in Table12.",
    uncertainty: "Report states France diesel above100% including confidence bounds, without numerical bounds here; do not invent an upper endpoint.",
    limitations: ["Cannot be represented as a0–1 same-cost recovery fraction. No clipping or negative cash-drag/profit inference.", "Joint-product cost allocation and intensity are material; does not establish XOM company recovery."],
  },
];

export const carbonPassThroughRemainingInputs = {
  NEE: [
    "Actual project/cohort marginal returns, legal AvailableCash/reserve priorities, current units, owner distributions and operating-affiliate CFO subset; historical gross/category cash is not common-owner FCFE.",
    "FPL/NEER annual operating-geography and product revenue weights plus eliminations; regulated versus merchant exposure.",
    "Effective FPL rate order, actual carbon-cost eligibility, collection lag, true-up, customer refund and allocation; historical EU wholesale ratios cannot replace these.",
    "Owned generation/commissioning, scoped intensity/liable tonnes net allowances and contracted PPA/tariff recovery, with no Scope2 duplicate.",
    "Five-year margins, capex, working capital, taxes, financing, positive starting FCFE and compatible nominal valuation inputs.",
  ],
  FSLR: [
    "Actual eligible US watts by component/channel and period, current45X/FEOC/MACR/deemed-sale eligibility and programme-specific cash/receivable rollforward; global produced/sold watts and revenue shares cannot substitute.",
    "Commissioning/completion, paid versus spare capacity, customer tariffs, production costs and marginal funded returns, replacement wear and post-credit terminal cash; legacy48paths and new source-cohort integration remain separate.",
    "India asset-subsidy installment amount/day/statement classification and remaining grant cash schedule, unallocated book/CFO residuals; no inferred cash from cost-basis recognition.",
    "Site/product/jurisdiction direct incremental carbon cost and contract recovery; none of the admitted power/refinery price papers establishes solar-module manufacturer's recovery or collected FCFE.",
  ],
  XOM: [
    "Refinery/site/product/jurisdiction emissions, liable share, permits, free allocation/banks/purchases and incremental paid cost, exact product sales and owned share.",
    "Price-versus-cost denominator reconciliation and actual customer recovery/collection lag; EU petrol literature is not UK2027–2031 or global upstream/CCS evidence.",
    "CCS customer/project start, fee/escalation, minimum delivery, cost/capex, tax-credit ownership and share; no new identifiable contract attempted.",
    "Non-CCS annual activity and nominal cash bridge, intensity, working capital, financing, taxes, margin bounds, positive starting FCFE and matched valuation.",
  ],
} as const;

/** Original S12 operating-corpus industrial candidate, not a current NEE/FSLR/XOM case. */
export const carbonPassThroughOriginalIndustrialInputs = {
  CAT: [
    "Transition-attributable orders with causal counterfactual separate from ordinary data-centre/oil/gas demand; segment/geography conversion and cancellations.",
    "Machinery/Energy product direct carbon liability and contract recovery; none of the inspected power/refinery literature estimates machinery recovery.",
    "Financial Products separation, five-year margins/intensity/capex/working-capital/financing/tax bridge and compatible nominal valuation.",
    "Product-use Scope3 is not direct issuer liability; no upstream electricity-price coefficient may be used as downstream machinery recovery.",
  ],
} as const;

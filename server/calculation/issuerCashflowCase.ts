import { contentHash } from "./analysisManifest";

type Identity = { symbol: string; cik: string; security: string; fiscalEnd: string };
type IxFact = { name: string; context: string; unit: string; id: string; value: number };
const attr = (text: string, key: string) => text.match(new RegExp(`\\b${key}="([^"]*)"`))?.[1] ?? "";
const plain = (text: string) => text.replace(/<[^>]*>/g, "").replace(/&#160;|&nbsp;/g, " ").trim();

/** Deliberately narrow retained SEC iXBRL review, not a new data collector.
 * Context, CIK, duration, units, class and exact shares are independently checked.
 * Rounded financial disclosures retain their reported precision. */
export function authenticatePrimaryIssuerCashflow(html: string, identity: Identity) {
  const contexts = new Map<string, string>();
  for (const match of Array.from(html.matchAll(/<xbrli:context\b([^>]+)>([\s\S]*?)<\/xbrli:context>/g)))
    contexts.set(attr(match[1], "id"), match[2]);
  const isIssuer = (context: string) => contexts.get(context)?.includes(`>${identity.cik}</xbrli:identifier>`) === true;
  const isYear = (context: string) => isIssuer(context) &&
    contexts.get(context)!.includes(`<xbrli:startDate>${identity.fiscalEnd.slice(0, 4)}-01-01</xbrli:startDate>`) &&
    contexts.get(context)!.includes(`<xbrli:endDate>${identity.fiscalEnd}</xbrli:endDate>`) &&
    !contexts.get(context)!.includes("<xbrli:segment>");
  const facts: IxFact[] = [];
  for (const m of Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/g))) {
    const raw = plain(m[2]), zero = attr(m[1], "format").endsWith("fixed-zero");
    if (!zero && !/^\d[\d,.]*$/.test(raw)) continue;
    const value = (zero ? 0 : Number(raw.replaceAll(",", ""))) *
      10 ** Number(attr(m[1], "scale") || 0) * (attr(m[1], "sign") === "-" ? -1 : 1);
    if (Number.isFinite(value)) facts.push({ name: attr(m[1], "name"), context: attr(m[1], "contextRef"),
      unit: attr(m[1], "unitRef"), id: attr(m[1], "id"), value });
  }
  const usd = new Set(Array.from(html.matchAll(/<xbrli:unit\b([^>]+)>([\s\S]*?)<\/xbrli:unit>/g))
    .filter(m => /<xbrli:measure>iso4217:USD<\/xbrli:measure>/.test(m[2]) &&
      !m[2].includes("<xbrli:divide>")).map(m => attr(m[1], "id")));
  const read = (name: string, options: { annual?: boolean; expected?: number } = {}) => {
    const matches = facts.filter(f => f.name === name && isIssuer(f.context) &&
      (options.annual === false || isYear(f.context)) &&
      (name === "dei:EntityCommonStockSharesOutstanding" ? f.unit === "shares" : usd.has(f.unit)) &&
      (options.expected === undefined || f.value === options.expected));
    if (!matches.length || new Set(matches.map(f => f.value)).size !== 1)
      throw new Error(`Missing/ambiguous primary issuer/unit/context claim: ${name}`);
    return matches[0];
  };
  const strings = Array.from(html.matchAll(/<ix:nonNumeric\b([^>]+)>([\s\S]*?)<\/ix:nonNumeric>/g))
    .map(m => ({ name: attr(m[1], "name"), context: attr(m[1], "contextRef"), value: plain(m[2]) }));
  const symbol = strings.find(f => f.name === "dei:TradingSymbol" && f.value === identity.symbol && isIssuer(f.context));
  if (!symbol || !strings.some(f => f.name === "dei:Security12bTitle" &&
    f.context === symbol.context && f.value === identity.security))
    throw new Error("Primary registered ticker/common security class mismatch");
  const exchange = strings.find(f => f.name === "dei:SecurityExchangeName" && f.context === symbol.context)?.value;
  if (!exchange) throw new Error("Primary listed exchange absent");
  const publicFloat = read("dei:EntityPublicFloat", { annual: false });
  const annual = (name: string) => read(name).value;
  return { read, annual, facts, exchange, publicFloat,
    primaryFinancialCurrency: "USD" as const,
    marketCurrencyBasis: "SEC cover public common-equity market value has ISO4217:USD unit; cover binds the registered common class, ticker and US exchange. Corroborate provider profile USD; not inferred from share par value.",
    identityApproved: false as const };
}

export type IssuerCashflowObservation = {
  identity: Identity; referenceDate: string; frozenAt: string;
  sourceHash: string; availableAt: string;
  historicalBaseFcfe: number; revenue: number; operatingIncome: number;
  depreciation: number; interest: number; policyCredit: number;
  capex: number; otherInvesting: number; nonCommonClaims: number;
  otherCash: number; stubLiabilitySettlement: number; gaps: string[];
};

/** Explicit, separately versioned conditional run-rate experiment.
 * All forward levels, zero changes, stub interpolation and reinvestment are
 * analyst assumptions. No model parameter is fit to the market price. */
export function buildIssuerCashflowScenario(o: IssuerCashflowObservation, stress: boolean) {
  const id = `${o.identity.symbol}-${stress ? "collection-stress" : "maintenance"}-fy2024-v1`;
  const firstYear = Number(o.referenceDate.slice(0, 4)) + 1;
  const rationale = [
    "Revised-history conditional experiment, NOT a historical point-in-time prediction. Actual freeze follows FY2024 publication and historical quote.",
    "FY2024 source levels are held nominally flat; no 2025/2026 filing replaces FY2024 and no future operating observations asserted. FSLR consolidated solar business revenue occupies the climate-business bucket without any abatement or causal attribution; NEE/XOM climate revenue is not separately inferred.",
    "Remove all identified FY2024 manufacturing credits from accrual operating income; no recognized or cash policy credits in any forecast, stub or terminal. No tariffs or CCS price inferred.",
    "Maintenance reinvestment equals reported depreciation plus separately identified other investing. This is a sensitivity benchmark, NOT engineering evidence of adequate replacement capital.",
    "No net borrowing: zero debt proceeds and repayments conditionally replace historical financing, not an assertion about contractual maturities. No cash or debt added/subtracted from FCFE value a second time.",
    "Cash tax is 20% of positive pre-tax operating cash-equivalent income; no historical tax refund repeated, loss refunds, interest income, asset sales, or securities treasury trades.",
    "Other noncash addbacks are zero (cash-equivalent compensation treatment); frozen other cash costs remain separately charged. No future acquisitions, differential membership inflows, or new non-common interests.",
    "Opening trade receivables are a 30-day steady-state assumption, not an observed opening balance. Other operating WC changes are zero under flat activity; balances not asserted zero.",
    stress ? "One 15-day collection delay enters in first full annual year only; subsequent years hold the stressed 45-day balance. No repeated deduction of the same receivables build." :
      "Collections stay at 30 days; unchanged trade receivables imply no cash WC deduction.",
    "Stub uses the base normalized annual cash rate times remaining calendar days/365.25, settles disclosed noncash PP&E liability once when applicable, and pays on year-end. Interpolation/settlement are frozen assumptions, not observed interim cash.",
    "Ten continuation operating years and one terminal operating year are separately explicit. Flat revenue, depreciation, reinvestment, taxes, WC, financing and non-common claims support zero terminal nominal growth.",
    "10% nominal USD equity discount rate is a round sensitivity, not estimated beta or an approved required return. Fixed zero nominal terminal growth avoids unsupported perpetual growth.",
    "No outcome, subsequent return, approval, probability, causal climate inference or production eligibility follows from this conditional arithmetic.",
  ];
  const assumptionHash = contentHash({ version: "issuer-fy2024-maintenance-1", o, stress, rationale });
  const evidence = [
    { id: "primary-fy2024", kind: "primary-disclosure", availableAt: o.availableAt,
      sha256: o.sourceHash, rationale: "Selected FY2024 primary SEC filing; numeric extraction separately authenticated" },
    { id: "frozen-scenario", kind: "frozen-analyst-assumption", availableAt: o.frozenAt,
      sha256: assumptionHash, rationale: rationale.join("\n") },
  ];
  const revenue = o.revenue, profit = o.operatingIncome - o.policyCredit;
  const tax = Math.max(0, profit - o.interest + o.otherCash) * .20;
  const reinvestment = o.depreciation + o.otherInvesting;
  let receivables = revenue * 30 / 365;
  const row = (year: number) => {
    const openingReceivables = receivables;
    receivables = revenue * (stress ? 45 : 30) / 365;
    return { year, cashFlowDate: `${year}-12-31`, evidenceIds: ["primary-fy2024", "frozen-scenario"],
      nonClimateRevenue: o.identity.symbol === "FSLR" ? 0 : revenue,
      climateRevenue: o.identity.symbol === "FSLR" ? revenue : 0,
      operatingMarginBeforeClimateCostsAndCredits: profit / revenue,
      climateOperatingCost: 0, recognizedPolicyCredit: 0, cashPolicyCredit: 0,
      depreciation: o.depreciation, otherNonCash: 0, openingReceivables, closingReceivables: receivables,
      increaseOtherOperatingWorkingCapital: 0, interestPaid: o.interest, cashTax: tax,
      otherOperatingCash: o.otherCash, capitalSpend: reinvestment, debtProceeds: 0, debtRepayments: 0,
      nonCommonCashClaims: o.nonCommonClaims };
  };
  const years = Array.from({ length: 5 }, (_, i) => row(firstYear + i));
  const continuation = { years: Array.from({ length: 10 }, (_, i) => row(firstYear + 5 + i)),
    terminalYear: row(firstYear + 15), rationale: rationale[10] };
  const annualBaseCash = profit + o.depreciation - o.interest - tax + o.otherCash -
    reinvestment - o.nonCommonClaims;
  const stubDays = (Date.parse(`${firstYear}-01-01T00:00:00Z`) -
    Date.parse(`${o.referenceDate}T00:00:00Z`)) / 86400000 - 1;
  const input = { ...o.identity, fiscalEnd: undefined, currency: "USD", referenceDate: o.referenceDate,
    frozenAt: o.frozenAt, firstYear, baseFcfe: o.historicalBaseFcfe,
    evidence, years, boundary: "whole-issuer-common-equity",
    unresolvedAccountingClaims: o.gaps, discountRate: .10, terminalGrowth: 0,
    continuationGrowthAtYear5: 0, terminalEvidenceIds: ["frozen-scenario"],
    informationContext: { mode: "revised-history-conditional", modelAsOf: `${o.referenceDate}T21:00:00.000Z`,
      informationCutoff: o.frozenAt },
    stub: { cashBasis: "FCFE-whole-issuer-common-equity", currency: "USD",
      throughDate: `${firstYear - 1}-12-31`, rationale: rationale[9],
      completenessEvidenceIds: ["frozen-scenario"],
      cashFlows: [{ date: `${firstYear - 1}-12-31`,
        fcfe: annualBaseCash * stubDays / 365.25 - o.stubLiabilitySettlement,
        evidenceIds: ["frozen-scenario"] }] },
    continuation };
  // fiscalEnd describes the observed basis, not an engine specification key.
  const { fiscalEnd: _fiscalEnd, ...engineInput } = input;
  return { id, version: "issuer-fy2024-maintenance-1", rationale, assumptionHash,
    observation: o, engineInput };
}

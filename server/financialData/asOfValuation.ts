import { z } from "zod";
import { reverseCashFlowGrowth } from "../calculation/cashFlowValuation";

/**
 * Builds D8 comparison rows under docs/AsOf_Valuation_Prediction_Protocol.md
 * (including amendment A1). Revised-history statements; never approves inputs.
 */
const statement = z.object({
  date: z.string().date(), filingDate: z.string().date(), period: z.literal("FY"),
  reportedCurrency: z.string().regex(/^[A-Z]{3}$/),
  operatingCashFlow: z.number().finite(), capitalExpenditure: z.number().finite().max(0),
  netDebtIssuance: z.number().finite(),
}).passthrough();
const income = z.object({ date: z.string().date(), filingDate: z.string().date(),
  period: z.literal("FY"), netIncome: z.number().finite() }).passthrough();
const observation = z.object({ date: z.string(), totalReturnIndex: z.number().finite().nullable(),
  marketCap: z.number().finite().nullable(), netProfit: z.number().finite().nullable() }).passthrough();

export const ASOF_PROTOCOL = {
  costOfEquity: 0.08, terminalGrowth: 0.03, minimumGrowth: -0.5, maximumGrowth: 0.5,
  originMonthDay: "07-31", originYears: [2017, 2018, 2019, 2020, 2021, 2022],
  boundaryRatio: [0.5, 2.0] as const, marketCapScale: 1e6,
};

export type Exclusion = { companyId: string; origin: string; reason: string };
const day = (iso: string) => iso.slice(0, 10);
const fcfe = (s: z.infer<typeof statement>) => s.operatingCashFlow + s.capitalExpenditure + s.netDebtIssuance;
const shiftYears = (date: string, years: number) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

export function buildAsOfRows(input: {
  companyId: string; profileCurrency: string;
  cashFlows: unknown; incomes: unknown; observations: unknown;
}) {
  const cfs = z.array(statement).parse(input.cashFlows);
  const incs = z.array(income).parse(input.incomes);
  const obs = z.array(observation).parse(input.observations)
    .map(o => ({ ...o, day: day(o.date) })).sort((a, b) => a.day.localeCompare(b.day));
  if (new Set(cfs.map(s => s.date)).size !== cfs.length) throw new Error("Duplicate fiscal statements");
  const rows: Record<string, unknown>[] = [];
  const exclusions: Exclusion[] = [];
  for (const year of ASOF_PROTOCOL.originYears) {
    const origin = `${year}-${ASOF_PROTOCOL.originMonthDay}`;
    const exclude = (reason: string) => exclusions.push({ companyId: input.companyId, origin, reason });
    const point = [...obs].reverse().find(o => o.day <= origin && o.day.startsWith(`${year}-07`));
    if (!point) { exclude("No July workbook observation"); continue; }
    // Publication lag: only statements filed strictly before the observation.
    const base = cfs.filter(s => s.filingDate < point.day).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!base) { exclude("No statement filed before origin"); continue; }
    if (base.reportedCurrency !== "USD" || input.profileCurrency !== "USD") { exclude("Non-USD currency; no FX"); continue; }
    const baseIncome = incs.find(i => i.date === base.date && i.filingDate < point.day);
    if (!baseIncome) { exclude("No matching income statement filed before origin"); continue; }
    if (point.marketCap == null || !(point.marketCap > 0)) { exclude("Missing workbook market cap"); continue; }
    const marketCap = point.marketCap * ASOF_PROTOCOL.marketCapScale;
    if (point.netProfit != null && point.netProfit > 0 && baseIncome.netIncome > 0) {
      const ratio = point.netProfit * ASOF_PROTOCOL.marketCapScale / baseIncome.netIncome;
      if (ratio < ASOF_PROTOCOL.boundaryRatio[0] || ratio > ASOF_PROTOCOL.boundaryRatio[1]) {
        exclude(`Unit/boundary mismatch (workbook/provider profit ratio ${ratio.toFixed(2)})`); continue;
      }
    }
    // Outcome endpoints FY t+1 and FY t+4: never inputs.
    const start = cfs.find(s => s.date === shiftYears(base.date, 1));
    const end = cfs.find(s => s.date === shiftYears(base.date, 4));
    let actual: number | null = null, outcomeAvailableAt: string | null = null;
    if (!start || !end) exclude("Missing exact FY t+1 or FY t+4 endpoint");
    else if (start.reportedCurrency !== "USD" || end.reportedCurrency !== "USD") exclude("Outcome currency changed");
    else if (fcfe(start) <= 0 || fcfe(end) <= 0) exclude("Non-positive outcome FCFE; CAGR unidentified");
    // The unchanged D8 gate requires availability at least three years after the
    // origin label; an earlier filing is excluded, never relabelled.
    else if (end.filingDate < shiftYears(origin, 3)) exclude("Outcome filed before origin + 3 years; D8 maturity rule");
    else { actual = (fcfe(end) / fcfe(start)) ** (1 / 3) - 1; outcomeAvailableAt = end.filingDate; }
    let gordon: number | null = null;
    if (baseIncome.netIncome > 0) gordon = ASOF_PROTOCOL.costOfEquity - baseIncome.netIncome / marketCap;
    else exclude("Gordon unavailable: non-positive earnings");
    let dcf: number | null = null;
    const solved = reverseCashFlowGrowth({ baseCashFlow: fcfe(base), marketCap,
      discountRate: ASOF_PROTOCOL.costOfEquity, terminalGrowth: ASOF_PROTOCOL.terminalGrowth,
      basis: "FCFE", discountBasis: "cost-of-equity", businessType: "non-financial",
      cashFlowCurrency: "USD", valuationCurrency: "USD",
      minimumGrowth: ASOF_PROTOCOL.minimumGrowth, maximumGrowth: ASOF_PROTOCOL.maximumGrowth });
    if (solved.status === "conditional-solution") {
      if (Math.abs((solved as { relativeRepricingError: number }).relativeRepricingError) >= 1e-8)
        throw new Error("Reverse DCF repricing error exceeds tolerance");
      dcf = (solved as { growth: number }).growth;
    } else exclude(`DCF unavailable: ${(solved as { reason: string }).reason}`);
    const later = obs.find(o => o.day > point.day && o.day.startsWith(`${year + 1}-07`));
    let validationReturn: number | null = null;
    if (later?.totalReturnIndex && point.totalReturnIndex && point.totalReturnIndex > 0)
      validationReturn = later.totalReturnIndex / point.totalReturnIndex - 1;
    else exclude("Missing 12-month validation return");
    rows.push({ companyId: input.companyId, origin,
      outcomeAvailableAt: outcomeAvailableAt ?? shiftYears(origin, 3),
      cashFlowHorizonYears: 3, cashFlowBasis: "FCFE", currency: "USD",
      actualCashFlowGrowth: actual, gordonCashFlowGrowth: gordon, dcfCashFlowGrowth: dcf,
      gordonSignal: gordon, dcfSignal: dcf, validationReturn,
      informationDate: point.day, baseFiscalDate: base.date, baseFilingDate: base.filingDate });
  }
  return { rows, exclusions };
}

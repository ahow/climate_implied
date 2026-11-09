import { z } from "zod";
const statement = z.object({
  date: z.string().date(), symbol: z.string().min(1), period: z.literal("FY"),
  reportedCurrency: z.string().regex(/^[A-Z]{3}$/),
  operatingCashFlow: z.number().finite(), capitalExpenditure: z.number().finite().max(0),
  netDebtIssuance: z.number().finite(),
});

/** Historical outcome construction, not an as-of prediction input. */
export function completedCashFlowOutcomes(input: unknown) {
  const rows = z.array(statement).parse(input).sort((a, b) => a.date.localeCompare(b.date));
  if (new Set(rows.map(r => r.date)).size !== rows.length) throw new Error("Duplicate fiscal year endpoint");
  if (new Set(rows.map(r => r.symbol)).size > 1) throw new Error("Mixed issuer statements");
  const results = rows.map(start => {
    const targetYear = Number(start.date.slice(0, 4)) + 3;
    const targetDate = `${targetYear}${start.date.slice(4)}`;
    const end = rows.find(row => row.date === targetDate);
    const base = start.operatingCashFlow + start.capitalExpenditure + start.netDebtIssuance;
    if (!end) return { origin: start.date, targetDate, status: "unavailable" as const,
      reason: "Missing exact three-year fiscal endpoint" };
    if (start.reportedCurrency !== end.reportedCurrency)
      return { origin: start.date, targetDate, status: "unavailable" as const, reason: "Currency changed; no implicit FX" };
    const final = end.operatingCashFlow + end.capitalExpenditure + end.netDebtIssuance;
    if (base <= 0 || final <= 0) return { origin: start.date, targetDate, status: "unavailable" as const,
      reason: "Non-positive starting or ending FCFE; CAGR unidentified" };
    return { origin: start.date, targetDate, status: "completed-outcome" as const,
      currency: start.reportedCurrency, baseFcfe: base, finalFcfe: final,
      threeYearCagr: (final / base) ** (1 / 3) - 1 };
  });
  return { basis: "FCFE", historyBasis: "revised-history", results,
    limitation: "Exact fiscal endpoints only. Publication availability, ownership, debt and cash-flow classifications still require review.",
    identityApproved: false, predictionInputsAvailable: false };
}

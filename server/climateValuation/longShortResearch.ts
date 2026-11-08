import { z } from "zod";
const schema = z.object({
  rows: z.array(z.object({
    date: z.string().date(), id: z.string().min(1), sector: z.string().min(1),
    score: z.number().finite(), nextReturn: z.number().finite().min(-1),
    borrowAvailable: z.boolean(),
  })).min(2).max(10000),
  costBps: z.number().finite().min(0).max(100),
  annualBorrowRate: z.number().finite().min(0).max(2),
  annualFinancingRate: z.number().finite().min(0).max(1),
  quantile: z.number().positive().max(.5),
});
export function longShortResearch(input: unknown) {
  const p = schema.parse(input);
  const keys = p.rows.map(r => `${r.date}:${r.id}`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate holding/date");
  const dates = Array.from(new Set(p.rows.map(r => r.date))).sort();
  const month = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  if (dates.some((date, i) => i > 0 && month(date) - month(dates[i - 1]) !== 1))
    throw new Error("Consecutive monthly return periods required");
  let wealth = 1, peak = 1;
  let drift = new Map<string, number>();
  const series = [];
  for (const date of dates) {
    const rows = p.rows.filter(r => r.date === date);
    const groups = Array.from(new Set(rows.map(r => r.sector))).map(sector => {
      const group = rows.filter(r => r.sector === sector).sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
      if (group.length < 2 || group[0].score === group[group.length - 1].score) return null;
      const count = Math.max(1, Math.floor(group.length * p.quantile));
      const short = group.slice(0, count).filter(r => r.borrowAvailable);
      const long = group.slice(-count);
      return short.length ? { short, long } : null;
    }).filter((g): g is NonNullable<typeof g> => !!g);
    if (!groups.length) throw new Error("No sector has distinct signals and an available short basket");
    const weights = new Map<string, number>();
    for (const group of groups) {
      group.long.forEach(r => weights.set(r.id, 1 / groups.length / group.long.length));
      group.short.forEach(r => weights.set(r.id, -1 / groups.length / group.short.length));
    }
    const ids = new Set([...Array.from(weights.keys()), ...Array.from(drift.keys())]);
    const tradedNotional = Array.from(ids).reduce((sum, id) => sum + Math.abs((weights.get(id) ?? 0) - (drift.get(id) ?? 0)), 0);
    const returns = new Map(rows.map(r => [r.id, r.nextReturn]));
    const grossReturn = Array.from(weights).reduce((sum, [id, weight]) => sum + weight * returns.get(id)!, 0);
    const shortExposure = Array.from(weights.values()).reduce((s, w) => s + Math.max(0, -w), 0);
    const longExposure = Array.from(weights.values()).reduce((s, w) => s + Math.max(0, w), 0);
    const tradingCost = tradedNotional * p.costBps / 10000;
    const borrowCost = shortExposure * p.annualBorrowRate / 12;
    const financingCost = longExposure * p.annualFinancingRate / 12;
    const netReturn = grossReturn - tradingCost - borrowCost - financingCost;
    wealth *= Math.max(0, 1 + netReturn);
    peak = Math.max(peak, wealth);
    series.push({ date, grossReturn, netReturn, tradingCost, borrowCost, financingCost, tradedNotional,
      grossExposure: shortExposure + longExposure, netExposure: longExposure - shortExposure,
      wealth, drawdown: wealth / peak - 1, holdings: Array.from(weights).map(([id, weight]) => ({ id, weight })) });
    if (netReturn <= -1) break;
    drift = new Map(Array.from(weights).map(([id, weight]) => [id, weight * (1 + returns.get(id)!) / (1 + netReturn)]));
  }
  return { series, investable: false, pointInTimeCertified: false, survivorshipFree: false,
    label: "hypothetical-long-short-research-portfolio", historyBasis: "submitted-revised-history",
    assumptions: ["Total returns include dividends; short dividend liability is therefore included, not deducted twice.",
      "One-way traded notional is sum of absolute position-weight changes; no factor of one-half.",
      "Annual borrow and financing assumptions accrue in equal monthly fractions.",
      "Short collateral earns no interest; full long exposure incurs the supplied financing rate.",
      "Borrow availability is supplied, not independently verified; transaction costs do not establish capacity.",
      "Missing next-month constituents are closed at the next rebalance without a separately verified liquidation price."] };
}

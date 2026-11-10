/** Independent return-quality arithmetic. Does not authenticate providers,
 * approve identities or establish scientific/portfolio efficacy. */
export type ReturnIndexObservation = { isin: string; date: string; value: number | null };
export type ReturnSample = { isin: string; from: string; to: string; start: number; end: number };
export function sampleReturnObservations(observations: ReturnIndexObservation[], end: string, size: number, seed: number) {
  if (!Number.isInteger(size) || size <= 0 || !Number.isInteger(seed)) throw new Error("Invalid frozen sampling settings");
  const groups = new Map<string, ReturnIndexObservation[]>();
  const keys = new Set<string>();
  for (const r of observations) {
    if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(r.isin) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
        !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0, 10) !== r.date)
      throw new Error("Invalid source identity/date");
    const key = `${r.isin}:${r.date}`;
    if (keys.has(key)) throw new Error("Duplicate source observation");
    keys.add(key);
    if (r.date > end || r.value === null) continue;
    const list = groups.get(r.isin) ?? []; list.push(r); groups.set(r.isin, list);
  }
  const population: ReturnSample[] = [];
  for (const isin of Array.from(groups.keys()).sort()) {
    const list = groups.get(isin)!.sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < list.length; i++) population.push({ isin, from: list[i - 1].date, to: list[i].date,
      start: list[i - 1].value!, end: list[i].value! });
  }
  if (population.length < size) throw new Error("Full population smaller than frozen sample");
  const shuffled = [...population]; let state = seed >>> 0;
  for (let i = shuffled.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = Math.floor(state / 4294967296 * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { populationCount: population.length, sample: shuffled.slice(0, size) };
}
export type DailyReturnInput = {
  date: string; close: number; splitRatio: number; cashDividend: number;
  shareBasis: "post-split-ex-date" | "unknown";
};
export function compareReturnObservation(sample: ReturnSample, days: DailyReturnInput[],
  thresholds: { numericalAbsoluteReturn: number; materialAbsoluteReturn: number }) {
  if (![thresholds.numericalAbsoluteReturn, thresholds.materialAbsoluteReturn].every(x => Number.isFinite(x) && x > 0) ||
      thresholds.materialAbsoluteReturn < thresholds.numericalAbsoluteReturn) throw new Error("Invalid frozen thresholds");
  if (![sample.start, sample.end].every(x => Number.isFinite(x) && x > 0))
    return { status: "invalid-index" as const };
  if (days.length < 2 || days[0].date !== sample.from || days.at(-1)!.date !== sample.to)
    return { status: "unavailable" as const, reason: "Exact closing boundaries missing; no nearest-date substitution" };
  let shares = 1;
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    if (!Number.isFinite(Date.parse(d.date)) || new Date(d.date).toISOString().slice(0, 10) !== d.date ||
        (i && d.date <= days[i - 1].date) || !Number.isFinite(d.close) || d.close <= 0 ||
        !Number.isFinite(d.splitRatio) || d.splitRatio <= 0 || !Number.isFinite(d.cashDividend) || d.cashDividend < 0)
      throw new Error("Invalid, duplicate or unordered price/action records");
    if (i === 0) continue; // Start at closing level: same-day actions already embedded.
    if (d.shareBasis === "unknown" && (d.cashDividend !== 0 || d.splitRatio !== 1))
      return { status: "unavailable" as const, reason: "Unresolved dividend/split share basis" };
    shares *= d.splitRatio * (1 + d.cashDividend / d.close);
  }
  const indexReturn = sample.end / sample.start - 1;
  const providerReturn = shares * days.at(-1)!.close / days[0].close - 1;
  if (![indexReturn, providerReturn].every(Number.isFinite)) throw new Error("Nonfinite return arithmetic");
  const absoluteDifference = Math.abs(indexReturn - providerReturn);
  return { status: "computed" as const, indexReturn, providerReturn, absoluteDifference,
    numericalBreak: absoluteDifference > thresholds.numericalAbsoluteReturn,
    materialBreak: absoluteDifference > thresholds.materialAbsoluteReturn };
}

import { todayIso, type AdapterContext, type FetchedValue, type SourceAdapter } from "./types";
import type { IndicatorKey } from "../indicatorRegistry";

/**
 * Derived adapter — runs LAST so it can use values produced by the API and
 * web-search adapters earlier in the same run (via ctx.fetchedSoFar), falling
 * back to curated values where a fresh input is unavailable.
 */
export const derivedAdapter: SourceAdapter = {
  id: "derived",
  keys: [
    "carbonIntensityKgPerGDP",
    "remainingBudget15C_Gt",
    "renewableGrowthRate",
    "evGrowthRate",
  ],
  async fetch(ctx: AdapterContext): Promise<FetchedValue[]> {
    const out: FetchedValue[] = [];
    const asOfDate = todayIso();
    const fetched = ctx.fetchedSoFar;

    // Carbon intensity (kg CO2 / $) = fossil CO2 (Gt) / GDP ($tn), matching the
    // curated definition. Use freshly fetched CO2 and GDP where available.
    const co2 = fetched.get("fossilCO2GtPerYear");
    const gdp = fetched.get("gdpTrillionUSD");
    if (co2 && gdp && gdp.value > 0) {
      const year = Math.min(co2.year, gdp.year);
      out.push({
        indicatorKey: "carbonIntensityKgPerGDP",
        year,
        value: Math.round((co2.value / gdp.value) * 1000) / 1000,
        source: "Derived (fossil CO2 / GDP)",
        asOfDate,
        method: "derived",
        rawContext: `${co2.value} Gt / ${gdp.value} $tn`,
      });
    }

    // Remaining 1.5C budget = latest curated budget minus one year of emissions.
    // Informational only (does not drive projections per methodology).
    if (co2) {
      const budgetBase = ctx.curated("remainingBudget15C_Gt");
      if (budgetBase !== undefined) {
        out.push({
          indicatorKey: "remainingBudget15C_Gt",
          year: co2.year,
          value: Math.max(0, Math.round(budgetBase - co2.value)),
          source: "Derived (IPCC budget − latest emissions)",
          asOfDate,
          method: "derived",
          rawContext: `${budgetBase} Gt − ${co2.value} Gt emitted`,
        });
      }
    }

    // Growth rates derived from web-search levels vs the prior curated year.
    derivedGrowth(ctx, out, "renewableCapacityGW", "renewableGrowthRate", asOfDate, 3);
    derivedGrowth(ctx, out, "evSalesSharePct", "evGrowthRate", asOfDate, 2);

    return out;
  },
};

function derivedGrowth(
  ctx: AdapterContext,
  out: FetchedValue[],
  levelKey: IndicatorKey,
  growthKey: IndicatorKey,
  asOfDate: string,
  decimals: number
): void {
  const level = ctx.fetchedSoFar.get(levelKey);
  if (!level) return;
  // Year-over-year growth must compare against the PRIOR year's level, not the
  // latest curated value. Using the latest curated level (often >= the fetched
  // year) produces a spurious negative growth rate.
  const prevYear = level.year - 1;
  const prev = ctx.curated(levelKey, prevYear);
  if (prev === undefined || prev <= 0) return;
  const growth = level.value / prev - 1;
  const factor = Math.pow(10, decimals);
  out.push({
    indicatorKey: growthKey,
    year: level.year,
    value: Math.round(growth * factor) / factor,
    source: "Derived (year-over-year)",
    asOfDate,
    method: "derived",
    rawContext: `(${level.value} ${level.year} / ${prev} ${prevYear}) − 1`,
  });
}

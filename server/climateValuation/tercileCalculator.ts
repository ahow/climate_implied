import type { CvTimeSeries } from "@shared/schema";
import { calculateCarbonIntensity, assignTerciles, groupTimeSeriesByDate, loadCompaniesAndTimeSeries } from "./sharedUtils";

export interface TercileResult {
  date: string;
  topTercileAvgPE: number;
  bottomTercileAvgPE: number;
  premium: number;
  topCount: number;
  bottomCount: number;
  topTotalMarketCap: number;
  topTotalProfit: number;
  bottomTotalMarketCap: number;
  bottomTotalProfit: number;
}

export async function computeTercilesOnTheFly(
  method: "absolute" | "sector_relative",
  includeScope3: boolean
): Promise<TercileResult[]> {
  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(true);

  const companySectors = new Map<number, string | null>(allCompanies.map((c) => [c.id, c.sector]));

  const timeSeriesByDate = groupTimeSeriesByDate(allTimeSeries);

  const results: TercileResult[] = [];
  const dateEntries = Array.from(timeSeriesByDate.entries());

  for (const [dateKey, tsForDate] of dateEntries) {
    const intensities = tsForDate.map((ts: CvTimeSeries) => ({
      companyId: ts.companyId,
      intensity: calculateCarbonIntensity(
        ts.scope1Emissions, ts.scope2Emissions, ts.scope3Emissions, ts.marketCap, includeScope3
      ),
    }));

    let assignments: Map<number, "bottom" | "middle" | "top" | null>;

    if (method === "absolute") {
      assignments = assignTerciles(intensities);
    } else {
      assignments = new Map<number, "bottom" | "middle" | "top" | null>();
      const sectorGroups = new Map<string, Array<{ companyId: number; intensity: number | null }>>();
      for (const item of intensities) {
        const sector = companySectors.get(item.companyId);
        if (!sector) continue;
        if (!sectorGroups.has(sector)) sectorGroups.set(sector, []);
        sectorGroups.get(sector)!.push(item);
      }
      const sectorEntries = Array.from(sectorGroups.values());
      for (const sectorItems of sectorEntries) {
        const sectorAssignments = assignTerciles(sectorItems);
        sectorAssignments.forEach((v, k) => assignments.set(k, v));
      }
    }

    const topRecords = tsForDate.filter((ts: CvTimeSeries) =>
      assignments.get(ts.companyId) === "top" &&
      ts.marketCap != null && ts.marketCap > 0 &&
      ts.netProfit != null && ts.netProfit > 0
    );
    const bottomRecords = tsForDate.filter((ts: CvTimeSeries) =>
      assignments.get(ts.companyId) === "bottom" &&
      ts.marketCap != null && ts.marketCap > 0 &&
      ts.netProfit != null && ts.netProfit > 0
    );

    if (topRecords.length > 0 && bottomRecords.length > 0) {
      const topTotalMarketCap = topRecords.reduce((sum: number, ts: CvTimeSeries) => sum + (ts.marketCap || 0), 0);
      const topTotalProfit = topRecords.reduce((sum: number, ts: CvTimeSeries) => sum + (ts.netProfit || 0), 0);
      const bottomTotalMarketCap = bottomRecords.reduce((sum: number, ts: CvTimeSeries) => sum + (ts.marketCap || 0), 0);
      const bottomTotalProfit = bottomRecords.reduce((sum: number, ts: CvTimeSeries) => sum + (ts.netProfit || 0), 0);

      const topAggregatePE = topTotalProfit > 0 ? topTotalMarketCap / topTotalProfit : 0;
      const bottomAggregatePE = bottomTotalProfit > 0 ? bottomTotalMarketCap / bottomTotalProfit : 0;

      results.push({
        date: dateKey,
        topTercileAvgPE: topAggregatePE,
        bottomTercileAvgPE: bottomAggregatePE,
        premium: topAggregatePE > 0 ? ((bottomAggregatePE - topAggregatePE) / topAggregatePE) * 100 : 0,
        topCount: topRecords.length,
        bottomCount: bottomRecords.length,
        topTotalMarketCap,
        topTotalProfit,
        bottomTotalMarketCap,
        bottomTotalProfit,
      });
    }
  }

  results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return results;
}

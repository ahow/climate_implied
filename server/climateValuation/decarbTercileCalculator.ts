import { impliedGrowthFromPE, growthDifferentialToDecarbRate, convertAll } from "./decarbConversion";
import type { CvCompany, CvTimeSeries } from "@shared/schema";
import {
  computeAnnualDecarbRate,
  groupTimeSeriesByDate,
  loadCompaniesAndTimeSeries,
  filterCompaniesByGeography,
  getPeerGroupKey,
  type ScoringMethod,
} from "./sharedUtils";

export interface DecarbTercileResult {
  date: Date;
  bestTercilePE: number;
  worstTercilePE: number;
  bestTercileAvgDecarbRate: number;
  worstTercileAvgDecarbRate: number;
  bestTercileCompanyCount: number;
  worstTercileCompanyCount: number;
  bestTercileMarketCap: number;
  worstTercileMarketCap: number;
  bestTercileProfit: number;
  worstTercileProfit: number;
  bestImpliedGrowth: number;
  worstImpliedGrowth: number;
  growthPremium: number;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
}

function assignDecarbTerciles(
  companies: CvCompany[],
  method: ScoringMethod
): { best: Set<number>; worst: Set<number>; rateMap: Map<number, number> } {
  const rateMap = new Map<number, number>();
  const companyRates: Array<{ id: number; rate: number; group: string }> = [];

  for (const c of companies) {
    const rate = computeAnnualDecarbRate(c.emissionTarget2050);
    if (rate !== null) {
      rateMap.set(c.id, rate);
      companyRates.push({ id: c.id, rate, group: getPeerGroupKey(c, method) });
    }
  }

  const best = new Set<number>();
  const worst = new Set<number>();

  if (method === "absolute") {
    const sorted = [...companyRates].sort((a, b) => a.rate - b.rate);
    const tercileSize = Math.floor(sorted.length / 3);

    for (let i = 0; i < tercileSize; i++) {
      worst.add(sorted[i].id);
    }
    for (let i = sorted.length - tercileSize; i < sorted.length; i++) {
      best.add(sorted[i].id);
    }
  } else {
    const byGroup = new Map<string, Array<{ id: number; rate: number }>>();
    for (const cr of companyRates) {
      const group = cr.group || "__ungrouped__";
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group)!.push({ id: cr.id, rate: cr.rate });
    }

    for (const groupCompanies of Array.from(byGroup.values())) {
      if (groupCompanies.length < 3) continue;
      const sorted = [...groupCompanies].sort((a, b) => a.rate - b.rate);
      const tercileSize = Math.floor(sorted.length / 3);

      for (let i = 0; i < tercileSize; i++) {
        worst.add(sorted[i].id);
      }
      for (let i = sorted.length - tercileSize; i < sorted.length; i++) {
        best.add(sorted[i].id);
      }
    }
  }

  return { best, worst, rateMap };
}

export async function calculateDecarbTerciles(
  method: ScoringMethod,
  costOfEquity: number = 0.08,
  geography?: string
): Promise<DecarbTercileResult[]> {
  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(true);

  const filteredCompanies = filterCompaniesByGeography(allCompanies, geography);
  const companyIdSet = new Set(filteredCompanies.map(c => c.id));
  const filteredTimeSeries = allTimeSeries.filter(ts => companyIdSet.has(ts.companyId));

  if (filteredTimeSeries.length === 0) return [];

  const { best, worst, rateMap } = assignDecarbTerciles(filteredCompanies, method);

  console.log(`[DecarbTerciles] Method: ${method}, Best tercile: ${best.size} companies, Worst tercile: ${worst.size} companies`);

  if (best.size === 0 || worst.size === 0) return [];

  const bestRates = Array.from(best).map(id => rateMap.get(id) || 0);
  const worstRates = Array.from(worst).map(id => rateMap.get(id) || 0);
  const avgBestRate = bestRates.reduce((s, v) => s + v, 0) / bestRates.length;
  const avgWorstRate = worstRates.reduce((s, v) => s + v, 0) / worstRates.length;
  console.log(`[DecarbTerciles] Best avg decarb rate: ${avgBestRate.toFixed(2)}%, Worst avg decarb rate: ${avgWorstRate.toFixed(2)}%`);

  const timeSeriesByDate = groupTimeSeriesByDate(filteredTimeSeries);

  const results: DecarbTercileResult[] = [];

  for (const [dateKey, tsForDate] of Array.from(timeSeriesByDate.entries())) {
    const date = new Date(dateKey);

    const bestRecords = tsForDate.filter(ts =>
      best.has(ts.companyId) &&
      ts.marketCap != null && ts.marketCap > 0 &&
      ts.netProfit != null
    );
    const worstRecords = tsForDate.filter(ts =>
      worst.has(ts.companyId) &&
      ts.marketCap != null && ts.marketCap > 0 &&
      ts.netProfit != null
    );

    if (bestRecords.length === 0 || worstRecords.length === 0) continue;

    const bestTotalMC = bestRecords.reduce((s, ts) => s + ts.marketCap!, 0);
    const bestTotalProfit = bestRecords.reduce((s, ts) => s + ts.netProfit!, 0);
    const worstTotalMC = worstRecords.reduce((s, ts) => s + ts.marketCap!, 0);
    const worstTotalProfit = worstRecords.reduce((s, ts) => s + ts.netProfit!, 0);

    if (bestTotalProfit <= 0 || worstTotalProfit <= 0) continue;

    const bestPE = bestTotalMC / bestTotalProfit;
    const worstPE = worstTotalMC / worstTotalProfit;

    const bestCompanyRates = bestRecords.map(ts => rateMap.get(ts.companyId) || 0);
    const worstCompanyRates = worstRecords.map(ts => rateMap.get(ts.companyId) || 0);
    const bestAvgRate = bestCompanyRates.reduce((s, v) => s + v, 0) / bestCompanyRates.length;
    const worstAvgRate = worstCompanyRates.reduce((s, v) => s + v, 0) / worstCompanyRates.length;

    const bestGrowth = impliedGrowthFromPE(bestPE, costOfEquity);
    const worstGrowth = impliedGrowthFromPE(worstPE, costOfEquity);
    const growthPremium = bestGrowth - worstGrowth;

    const impliedDecarbRate = growthDifferentialToDecarbRate(bestGrowth, worstGrowth);
    const conversion = convertAll(impliedDecarbRate);

    results.push({
      date,
      bestTercilePE: Math.round(bestPE * 100) / 100,
      worstTercilePE: Math.round(worstPE * 100) / 100,
      bestTercileAvgDecarbRate: Math.round(bestAvgRate * 100) / 100,
      worstTercileAvgDecarbRate: Math.round(worstAvgRate * 100) / 100,
      bestTercileCompanyCount: bestRecords.length,
      worstTercileCompanyCount: worstRecords.length,
      bestTercileMarketCap: bestTotalMC,
      worstTercileMarketCap: worstTotalMC,
      bestTercileProfit: bestTotalProfit,
      worstTercileProfit: worstTotalProfit,
      bestImpliedGrowth: Math.round(bestGrowth * 10000) / 10000,
      worstImpliedGrowth: Math.round(worstGrowth * 10000) / 10000,
      growthPremium: Math.round(growthPremium * 10000) / 10000,
      impliedDecarbRate: Math.round(impliedDecarbRate * 100) / 100,
      impliedCarbonPrice: conversion.impliedCarbonPrice,
      impliedTemperature: conversion.impliedTemperature,
    });
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (results.length > 0) {
    const latest = results[results.length - 1];
    console.log(`[DecarbTerciles] Latest date: ${latest.date.toISOString()}`);
    console.log(`  Best tercile: PE=${latest.bestTercilePE}x, avg decarb=${latest.bestTercileAvgDecarbRate}%, ${latest.bestTercileCompanyCount} companies`);
    console.log(`  Worst tercile: PE=${latest.worstTercilePE}x, avg decarb=${latest.worstTercileAvgDecarbRate}%, ${latest.worstTercileCompanyCount} companies`);
  }

  return results;
}

import type { CvTimeSeries } from "@shared/schema";
import { impliedGrowthFromPE, growthDifferentialToDecarbRate, convertAll } from "./decarbConversion";
import { loadCompaniesAndTimeSeries, groupTimeSeriesByDate, filterCompaniesByGeography } from "./sharedUtils";

export interface SDGGrowthResult {
  date: Date;
  cleanPE: number;
  dirtyPE: number;
  cleanGrowth: number;
  dirtyGrowth: number;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  cleanCount: number;
  dirtyCount: number;
  cleanMarketCap: number;
  dirtyMarketCap: number;
  cleanProfit: number;
  dirtyProfit: number;
}

export async function calculateSDGGrowthDifferential(
  costOfEquity: number = 0.08,
  geography?: string
): Promise<SDGGrowthResult[]> {
  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(false);

  const filteredCompanies = filterCompaniesByGeography(allCompanies, geography);
  const companyIdSet = new Set(filteredCompanies.map(c => c.id));
  const filteredTimeSeries = allTimeSeries.filter(ts => companyIdSet.has(ts.companyId));

  if (filteredTimeSeries.length === 0) return [];

  const cleanCompanyIds = new Set<number>();
  const dirtyCompanyIds = new Set<number>();

  for (const c of filteredCompanies) {
    if (c.sdgAlignmentScore !== null && c.sdgAlignmentScore !== undefined) {
      if (c.sdgAlignmentScore > 0) {
        cleanCompanyIds.add(c.id);
      } else {
        dirtyCompanyIds.add(c.id);
      }
    }
  }

  console.log(`[SDGGrowth] Clean companies: ${cleanCompanyIds.size}, Dirty companies: ${dirtyCompanyIds.size}`);

  if (cleanCompanyIds.size === 0 || dirtyCompanyIds.size === 0) return [];

  const timeSeriesByDate = groupTimeSeriesByDate(filteredTimeSeries);

  const results: SDGGrowthResult[] = [];

  for (const [dateKey, tsForDate] of Array.from(timeSeriesByDate.entries())) {
    const date = new Date(dateKey);

    const cleanRecords = tsForDate.filter(ts =>
      cleanCompanyIds.has(ts.companyId) &&
      ts.marketCap != null && ts.marketCap > 0 &&
      ts.netProfit != null
    );
    const dirtyRecords = tsForDate.filter(ts =>
      dirtyCompanyIds.has(ts.companyId) &&
      ts.marketCap != null && ts.marketCap > 0 &&
      ts.netProfit != null
    );

    if (cleanRecords.length === 0 || dirtyRecords.length === 0) continue;

    const cleanTotalMC = cleanRecords.reduce((s, ts) => s + ts.marketCap!, 0);
    const cleanTotalProfit = cleanRecords.reduce((s, ts) => s + ts.netProfit!, 0);
    const dirtyTotalMC = dirtyRecords.reduce((s, ts) => s + ts.marketCap!, 0);
    const dirtyTotalProfit = dirtyRecords.reduce((s, ts) => s + ts.netProfit!, 0);

    if (cleanTotalProfit <= 0 || dirtyTotalProfit <= 0) continue;

    const cleanPE = cleanTotalMC / cleanTotalProfit;
    const dirtyPE = dirtyTotalMC / dirtyTotalProfit;

    const cleanGrowth = impliedGrowthFromPE(cleanPE, costOfEquity);
    const dirtyGrowth = impliedGrowthFromPE(dirtyPE, costOfEquity);

    const impliedDecarbRate = growthDifferentialToDecarbRate(cleanGrowth, dirtyGrowth);
    const conversion = convertAll(impliedDecarbRate);

    results.push({
      date,
      cleanPE: Math.round(cleanPE * 100) / 100,
      dirtyPE: Math.round(dirtyPE * 100) / 100,
      cleanGrowth: Math.round(cleanGrowth * 10000) / 10000,
      dirtyGrowth: Math.round(dirtyGrowth * 10000) / 10000,
      impliedDecarbRate: Math.round(impliedDecarbRate * 100) / 100,
      impliedCarbonPrice: conversion.impliedCarbonPrice,
      impliedTemperature: conversion.impliedTemperature,
      cleanCount: cleanRecords.length,
      dirtyCount: dirtyRecords.length,
      cleanMarketCap: cleanTotalMC,
      dirtyMarketCap: dirtyTotalMC,
      cleanProfit: cleanTotalProfit,
      dirtyProfit: dirtyTotalProfit,
    });
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (results.length > 0) {
    const mid = results[Math.floor(results.length / 2)];
    console.log(`[SDGGrowth] Sample mid-date result:`);
    console.log(`  Clean: PE=${mid.cleanPE}x, growth=${(mid.cleanGrowth * 100).toFixed(2)}%, ${mid.cleanCount} companies`);
    console.log(`  Dirty: PE=${mid.dirtyPE}x, growth=${(mid.dirtyGrowth * 100).toFixed(2)}%, ${mid.dirtyCount} companies`);
    console.log(`  Implied decarb rate: ${mid.impliedDecarbRate}%/yr`);
    console.log(`  Implied temperature: ${mid.impliedTemperature}°C`);
    console.log(`  Implied carbon price: $${mid.impliedCarbonPrice}/tonne`);
  }

  return results;
}

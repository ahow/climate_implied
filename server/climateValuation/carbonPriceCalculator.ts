import { db } from "../db";
import { cvCarbonPriceCache } from "@shared/schema";
import type { InsertCvCarbonPriceCache, CvCarbonPriceCache, CvTimeSeries, CvCompany } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { impliedGrowthFromPE, growthDifferentialToDecarbRate, convertAll } from "./decarbConversion";
import { calculateCarbonIntensity, assignTerciles, groupTimeSeriesByDate, filterCompaniesByGeography, loadCompaniesAndTimeSeries } from "./sharedUtils";

export type InferenceMethod = "carbon_intensity" | "climate_revenue" | "decarbonization_ambition";

export interface CarbonPriceResult {
  date: Date;
  topTercileEmissions: number;
  topTercileProfit: number;
  topTercileMarketCap: number;
  topTercilePeRatio: number;
  topTercileCompanyCount: number;
  bottomTercileEmissions: number;
  bottomTercileProfit: number;
  bottomTercileMarketCap: number;
  bottomTercilePeRatio: number;
  bottomTercileCompanyCount: number;
  impliedCarbonPrice: number;
  impliedDecarbRate: number;
  impliedTemperature: number;
  inferenceMethod: string;
  highGroupLabel: string;
  lowGroupLabel: string;
}

function winsorizeArray(values: number[], percentile: number): number[] {
  if (values.length === 0) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const lowerIdx = Math.floor(values.length * percentile / 100);
  const upperIdx = Math.floor(values.length * (100 - percentile) / 100) - 1;
  const lowerBound = sorted[Math.max(0, lowerIdx)];
  const upperBound = sorted[Math.min(sorted.length - 1, upperIdx)];
  return values.map(v => Math.max(lowerBound, Math.min(upperBound, v)));
}


function assignGroupByClimateRevenue(
  companies: CvCompany[]
): Map<number, "high_risk" | "low_risk" | null> {
  const assignments = new Map<number, "high_risk" | "low_risk" | null>();
  for (const c of companies) {
    if (c.sdgAlignmentScore !== null && c.sdgAlignmentScore !== undefined) {
      assignments.set(c.id, c.sdgAlignmentScore > 0 ? "low_risk" : "high_risk");
    } else {
      assignments.set(c.id, null);
    }
  }
  return assignments;
}

function assignGroupByDecarbAmbition(
  companies: CvCompany[]
): Map<number, "high_risk" | "low_risk" | null> {
  const validTargets = companies
    .filter(c => c.emissionTarget2050 !== null && c.emissionTarget2050 !== undefined)
    .map(c => ({ id: c.id, target: c.emissionTarget2050! }));

  if (validTargets.length === 0) {
    return new Map(companies.map(c => [c.id, null]));
  }

  const sorted = [...validTargets].sort((a, b) => a.target - b.target);
  const medianIdx = Math.floor(sorted.length / 2);
  const median = sorted[medianIdx].target;

  const assignments = new Map<number, "high_risk" | "low_risk" | null>();
  for (const c of companies) {
    if (c.emissionTarget2050 !== null && c.emissionTarget2050 !== undefined) {
      assignments.set(c.id, c.emissionTarget2050 <= median ? "low_risk" : "high_risk");
    } else {
      assignments.set(c.id, "high_risk");
    }
  }
  return assignments;
}

function computeGroupAggregates(
  records: CvTimeSeries[],
  includeScope3: boolean,
  winsorize: boolean,
  winsorizePercentile: number
): { totalMarketCap: number; totalProfit: number; totalEmissions: number; peRatio: number; count: number } {
  const validRecords = records.filter((ts: CvTimeSeries) =>
    ts.marketCap != null && ts.netProfit != null &&
    (ts.scope1Emissions != null || ts.scope2Emissions != null)
  );

  if (validRecords.length === 0) {
    return { totalMarketCap: 0, totalProfit: 0, totalEmissions: 0, peRatio: 0, count: 0 };
  }

  let marketCaps = validRecords.map((ts: CvTimeSeries) => ts.marketCap!);
  let profits = validRecords.map((ts: CvTimeSeries) => ts.netProfit!);
  let emissions = validRecords.map((ts: CvTimeSeries) => {
    const s1 = ts.scope1Emissions || 0;
    const s2 = ts.scope2Emissions || 0;
    const s3 = includeScope3 ? (ts.scope3Emissions || 0) : 0;
    return s1 + s2 + s3;
  });

  if (winsorize && marketCaps.length > 10) {
    marketCaps = winsorizeArray(marketCaps, winsorizePercentile);
    profits = winsorizeArray(profits, winsorizePercentile);
    emissions = winsorizeArray(emissions, winsorizePercentile);
  }

  const totalMarketCap = marketCaps.reduce((sum: number, v: number) => sum + v, 0);
  const totalProfit = profits.reduce((sum: number, v: number) => sum + v, 0);
  const totalEmissions = emissions.reduce((sum: number, v: number) => sum + v, 0);
  const peRatio = totalProfit > 0 ? totalMarketCap / totalProfit : 0;

  return { totalMarketCap, totalProfit, totalEmissions, peRatio, count: validRecords.length };
}

export async function calculateTotalBasedCarbonPrice(
  uploadId: number,
  method: "absolute" | "sector_relative",
  includeScope3: boolean,
  winsorize: boolean,
  winsorizePercentile: number,
  inferenceMethod: InferenceMethod = "carbon_intensity",
  geography?: string
): Promise<CarbonPriceResult[]> {
  const cacheMethod = `${method}_${inferenceMethod}`;

  const groupLabels = getGroupLabels(inferenceMethod);

  if (!geography) {
    const cached = await db
      .select()
      .from(cvCarbonPriceCache)
      .where(
        and(
          eq(cvCarbonPriceCache.uploadId, uploadId),
          eq(cvCarbonPriceCache.method, cacheMethod),
          eq(cvCarbonPriceCache.includeScope3, includeScope3),
          eq(cvCarbonPriceCache.winsorize, winsorize),
          eq(cvCarbonPriceCache.winsorizePercentile, winsorizePercentile)
        )
      );

    if (cached.length > 0) {
      console.log(`[CarbonPrice] Using cached results (${cached.length} dates) for ${cacheMethod}`);
      return cached.map((row: CvCarbonPriceCache) => {
        const dirtyPE = row.topTercilePeRatio || 0;
        const cleanPE = row.bottomTercilePeRatio || 0;
        const cleanGrowth = impliedGrowthFromPE(cleanPE, 0.08);
        const dirtyGrowth = impliedGrowthFromPE(dirtyPE, 0.08);
        const decarbRate = growthDifferentialToDecarbRate(cleanGrowth, dirtyGrowth);
        const conversion = convertAll(decarbRate);
        return {
          date: row.date,
          topTercileEmissions: row.topTercileEmissions || 0,
          topTercileProfit: row.topTercileProfit || 0,
          topTercileMarketCap: row.topTercileMarketCap || 0,
          topTercilePeRatio: dirtyPE,
          topTercileCompanyCount: row.topTercileCompanyCount || 0,
          bottomTercileEmissions: row.bottomTercileEmissions || 0,
          bottomTercileProfit: row.bottomTercileProfit || 0,
          bottomTercileMarketCap: row.bottomTercileMarketCap || 0,
          bottomTercilePeRatio: cleanPE,
          bottomTercileCompanyCount: row.bottomTercileCompanyCount || 0,
          impliedCarbonPrice: row.impliedCarbonPrice || 0,
          impliedDecarbRate: Math.round(decarbRate * 100) / 100,
          impliedTemperature: conversion.impliedTemperature,
          inferenceMethod,
          ...groupLabels,
        };
      });
    }
  }

  console.log(`[CarbonPrice] Computing on-the-fly for ${cacheMethod}...`);

  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(true);

  const filteredCompanies = filterCompaniesByGeography(allCompanies, geography);
  const companyIdSet = new Set(filteredCompanies.map(c => c.id));
  const filteredTimeSeries = allTimeSeries.filter(ts => companyIdSet.has(ts.companyId));

  if (filteredTimeSeries.length === 0) return [];

  const companySectors = new Map<number, string | null>(filteredCompanies.map((c: CvCompany) => [c.id, c.sector]));

  let staticGroupAssignments: Map<number, "high_risk" | "low_risk" | null> | null = null;
  if (inferenceMethod === "climate_revenue") {
    staticGroupAssignments = assignGroupByClimateRevenue(filteredCompanies);
    const highCount = Array.from(staticGroupAssignments.values()).filter(v => v === "high_risk").length;
    const lowCount = Array.from(staticGroupAssignments.values()).filter(v => v === "low_risk").length;
    console.log(`[CarbonPrice] Climate Revenue grouping: ${highCount} high-risk, ${lowCount} low-risk`);
  } else if (inferenceMethod === "decarbonization_ambition") {
    staticGroupAssignments = assignGroupByDecarbAmbition(filteredCompanies);
    const highCount = Array.from(staticGroupAssignments.values()).filter(v => v === "high_risk").length;
    const lowCount = Array.from(staticGroupAssignments.values()).filter(v => v === "low_risk").length;
    console.log(`[CarbonPrice] Decarbonization Ambition grouping: ${highCount} high-risk, ${lowCount} low-risk`);
  }

  const timeSeriesByDate = groupTimeSeriesByDate(filteredTimeSeries);

  const results: CarbonPriceResult[] = [];
  const cacheRecords: Array<InsertCvCarbonPriceCache> = [];
  const dateEntries = Array.from(timeSeriesByDate.entries());

  for (const [dateKey, tsForDate] of dateEntries) {
    const date = new Date(dateKey);

    let highRiskRecords: CvTimeSeries[];
    let lowRiskRecords: CvTimeSeries[];

    if (staticGroupAssignments) {
      highRiskRecords = tsForDate.filter((ts: CvTimeSeries) => staticGroupAssignments!.get(ts.companyId) === "high_risk");
      lowRiskRecords = tsForDate.filter((ts: CvTimeSeries) => staticGroupAssignments!.get(ts.companyId) === "low_risk");
    } else {
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
        for (const sectorItems of Array.from(sectorGroups.values())) {
          const sectorAssignments = assignTerciles(sectorItems);
          sectorAssignments.forEach((v, k) => assignments.set(k, v));
        }
      }

      highRiskRecords = tsForDate.filter((ts: CvTimeSeries) => assignments.get(ts.companyId) === "top");
      lowRiskRecords = tsForDate.filter((ts: CvTimeSeries) => assignments.get(ts.companyId) === "bottom");
    }

    const highAgg = computeGroupAggregates(highRiskRecords, includeScope3, winsorize, winsorizePercentile);
    const lowAgg = computeGroupAggregates(lowRiskRecords, includeScope3, winsorize, winsorizePercentile);

    if (highAgg.count === 0 || lowAgg.count === 0) continue;
    if (highAgg.totalEmissions <= 0 || lowAgg.peRatio <= 0) continue;

    const adjustedHighProfit = highAgg.totalMarketCap / lowAgg.peRatio;
    const profitDifference = highAgg.totalProfit - adjustedHighProfit;
    const impliedCarbonPrice = (profitDifference / highAgg.totalEmissions) * 1_000_000;

    const cleanGrowth = impliedGrowthFromPE(lowAgg.peRatio, 0.08);
    const dirtyGrowth = impliedGrowthFromPE(highAgg.peRatio, 0.08);
    const decarbRate = growthDifferentialToDecarbRate(cleanGrowth, dirtyGrowth);
    const conversion = convertAll(decarbRate);

    const result: CarbonPriceResult = {
      date,
      topTercileEmissions: highAgg.totalEmissions,
      topTercileProfit: highAgg.totalProfit,
      topTercileMarketCap: highAgg.totalMarketCap,
      topTercilePeRatio: highAgg.peRatio,
      topTercileCompanyCount: highAgg.count,
      bottomTercileEmissions: lowAgg.totalEmissions,
      bottomTercileProfit: lowAgg.totalProfit,
      bottomTercileMarketCap: lowAgg.totalMarketCap,
      bottomTercilePeRatio: lowAgg.peRatio,
      bottomTercileCompanyCount: lowAgg.count,
      impliedCarbonPrice,
      impliedDecarbRate: Math.round(decarbRate * 100) / 100,
      impliedTemperature: conversion.impliedTemperature,
      inferenceMethod,
      ...groupLabels,
    };

    results.push(result);

    cacheRecords.push({
      uploadId,
      date,
      method: cacheMethod,
      includeScope3,
      winsorize,
      winsorizePercentile,
      topTercileEmissions: highAgg.totalEmissions,
      topTercileProfit: highAgg.totalProfit,
      topTercileMarketCap: highAgg.totalMarketCap,
      topTercilePeRatio: highAgg.peRatio,
      topTercileCompanyCount: highAgg.count,
      bottomTercileEmissions: lowAgg.totalEmissions,
      bottomTercileProfit: lowAgg.totalProfit,
      bottomTercileMarketCap: lowAgg.totalMarketCap,
      bottomTercilePeRatio: lowAgg.peRatio,
      bottomTercileCompanyCount: lowAgg.count,
      impliedCarbonPrice,
    } as InsertCvCarbonPriceCache);
  }

  if (!geography && cacheRecords.length > 0) {
    console.log(`[CarbonPrice] Caching ${cacheRecords.length} results for ${cacheMethod}...`);
    const chunkSize = 100;
    for (let i = 0; i < cacheRecords.length; i += chunkSize) {
      const chunk = cacheRecords.slice(i, i + chunkSize) as InsertCvCarbonPriceCache[];
      await db.insert(cvCarbonPriceCache).values(chunk);
    }
  }

  if (results.length > 0) {
    const sample = results[Math.floor(results.length / 2)];
    console.log(`[CarbonPrice] Sample (mid-date) for ${cacheMethod}:`);
    console.log(`  High-risk group: ${sample.topTercileCompanyCount} companies`);
    console.log(`    Total Market Cap: ${(sample.topTercileMarketCap).toLocaleString()} (millions)`);
    console.log(`    Total Net Profit: ${(sample.topTercileProfit).toLocaleString()} (millions)`);
    console.log(`    Total Emissions:  ${(sample.topTercileEmissions).toLocaleString()} (tonnes)`);
    console.log(`    Aggregate P/E:    ${sample.topTercilePeRatio.toFixed(2)}x`);
    console.log(`  Low-risk group: ${sample.bottomTercileCompanyCount} companies`);
    console.log(`    Total Market Cap: ${(sample.bottomTercileMarketCap).toLocaleString()} (millions)`);
    console.log(`    Total Net Profit: ${(sample.bottomTercileProfit).toLocaleString()} (millions)`);
    console.log(`    Total Emissions:  ${(sample.bottomTercileEmissions).toLocaleString()} (tonnes)`);
    console.log(`    Aggregate P/E:    ${sample.bottomTercilePeRatio.toFixed(2)}x`);
    console.log(`  Implied Carbon Price: $${sample.impliedCarbonPrice.toFixed(2)}/tonne`);
  }

  return results;
}

function getGroupLabels(inferenceMethod: InferenceMethod): { highGroupLabel: string; lowGroupLabel: string } {
  switch (inferenceMethod) {
    case "climate_revenue":
      return { highGroupLabel: "Non-Climate-Aligned", lowGroupLabel: "Climate-Aligned Revenue" };
    case "decarbonization_ambition":
      return { highGroupLabel: "Weak/No Targets", lowGroupLabel: "Ambitious Targets" };
    case "carbon_intensity":
    default:
      return { highGroupLabel: "Most Carbon-Intensive", lowGroupLabel: "Cleanest" };
  }
}

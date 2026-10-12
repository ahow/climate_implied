import type { CvCompany, CvTimeSeries } from "@shared/schema";
import { impliedGrowthFromPE } from "./decarbConversion";
import { calculateSDGGrowthDifferential } from "./sdgGrowthCalculator";
import type { ScoringMethod } from "./sharedUtils";
import {
  getPeerGroupKey,
  filterCompaniesByGeography,
  getLatestTimeSeriesPerCompany,
  loadCompaniesAndTimeSeries,
} from "./sharedUtils";
export type { ScoringMethod } from "./sharedUtils";

export interface CompanyDecarbGap {
  companyId: number;
  companyName: string;
  sector: string | null;
  subSector: string | null;
  industry: string | null;
  pe: number;
  impliedGrowth: number;
  peerMedianGrowth: number;
  impliedDecarbRate: number;
  gap: number;
  score: number;
}

export interface DecarbGapSummary {
  projectedRate: number;
  medianImpliedRate: number;
  meanImpliedRate: number;
  companyCount: number;
  positiveSignalCount: number;
  negativeSignalCount: number;
  distribution: Array<{ bucket: string; count: number; midpoint: number }>;
  topCompanies: CompanyDecarbGap[];
  bottomCompanies: CompanyDecarbGap[];
}

export interface DecarbGapTimePoint {
  date: string;
  projectedRate: number;
  medianImpliedRate: number;
  meanImpliedRate: number;
  p25ImpliedRate: number;
  p75ImpliedRate: number;
  companyCount: number;
}


function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computePerCompanyImpliedDecarbRates(
  companies: CvCompany[],
  latestTSByCompany: Map<number, CvTimeSeries>,
  method: ScoringMethod,
  costOfEquity: number = 0.08
): Array<{ companyId: number; impliedGrowth: number; peerMedianGrowth: number; impliedDecarbRate: number; pe: number }> {
  const companyGrowths: Array<{ companyId: number; impliedGrowth: number; pe: number; peerKey: string }> = [];

  for (const c of companies) {
    const ts = latestTSByCompany.get(c.id);
    if (!ts) continue;

    let pe: number | null = null;
    if (ts.priceEarnings && ts.priceEarnings > 0) {
      pe = ts.priceEarnings;
    } else if (ts.marketCap && ts.netProfit && ts.netProfit > 0) {
      pe = ts.marketCap / ts.netProfit;
    }
    if (!pe || pe <= 0 || pe > 500) continue;

    const impliedGrowth = impliedGrowthFromPE(pe, costOfEquity);
    const peerKey = getPeerGroupKey(c, method);
    companyGrowths.push({ companyId: c.id, impliedGrowth, pe, peerKey });
  }

  const peerGroups = new Map<string, number[]>();
  for (const cg of companyGrowths) {
    if (!peerGroups.has(cg.peerKey)) peerGroups.set(cg.peerKey, []);
    peerGroups.get(cg.peerKey)!.push(cg.impliedGrowth);
  }

  const peerMedians = new Map<string, number>();
  for (const [key, growths] of Array.from(peerGroups.entries())) {
    const sorted = [...growths].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    peerMedians.set(key, sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]);
  }

  return companyGrowths.map(cg => {
    const peerMedianGrowth = peerMedians.get(cg.peerKey) || 0;
    const impliedDecarbRate = (cg.impliedGrowth - peerMedianGrowth) * 100;
    return {
      companyId: cg.companyId,
      impliedGrowth: cg.impliedGrowth,
      peerMedianGrowth,
      impliedDecarbRate,
      pe: cg.pe,
    };
  });
}

export function computeDecarbGapScores(
  companies: CvCompany[],
  latestTSByCompany: Map<number, CvTimeSeries>,
  projectedRate: number,
  method: ScoringMethod,
  costOfEquity: number = 0.08
): Map<number, number> {
  const perCompany = computePerCompanyImpliedDecarbRates(companies, latestTSByCompany, method, costOfEquity);

  const gaps = perCompany.map(c => ({
    companyId: c.companyId,
    gap: projectedRate - c.impliedDecarbRate,
  }));

  const peerGroups = new Map<string, Array<{ companyId: number; gap: number }>>();
  const companyMap = new Map<number, CvCompany>();
  for (const c of companies) companyMap.set(c.id, c);

  for (const g of gaps) {
    const company = companyMap.get(g.companyId);
    if (!company) continue;
    const peerKey = getPeerGroupKey(company, method);
    if (!peerGroups.has(peerKey)) peerGroups.set(peerKey, []);
    peerGroups.get(peerKey)!.push(g);
  }

  const scores = new Map<number, number>();

  for (const [, peerGaps] of Array.from(peerGroups.entries())) {
    if (peerGaps.length < 2) {
      for (const pg of peerGaps) scores.set(pg.companyId, 0);
      continue;
    }

    peerGaps.sort((a: { companyId: number; gap: number }, b: { companyId: number; gap: number }) => a.gap - b.gap);
    const n = peerGaps.length;
    for (let i = 0; i < n; i++) {
      const pctile = i / (n - 1);
      const score = (pctile - 0.5) * 2;
      scores.set(peerGaps[i].companyId, score);
    }
  }

  return scores;
}

export async function calculateDecarbGapSummary(
  projectedRate: number,
  method: ScoringMethod,
  costOfEquity: number = 0.08,
  geography?: string
): Promise<DecarbGapSummary> {
  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(false);

  const filteredCompanies = filterCompaniesByGeography(allCompanies, geography);
  const companyIds = new Set(filteredCompanies.map(c => c.id));

  const latestTSByCompany = getLatestTimeSeriesPerCompany(allTimeSeries, companyIds);

  const perCompany = computePerCompanyImpliedDecarbRates(filteredCompanies, latestTSByCompany, method, costOfEquity);
  const companyMap = new Map<number, CvCompany>();
  for (const c of filteredCompanies) companyMap.set(c.id, c);

  if (perCompany.length === 0) {
    return {
      projectedRate,
      medianImpliedRate: 0,
      meanImpliedRate: 0,
      companyCount: 0,
      positiveSignalCount: 0,
      negativeSignalCount: 0,
      distribution: [],
      topCompanies: [],
      bottomCompanies: [],
    };
  }

  const sdgResults = await calculateSDGGrowthDifferential(costOfEquity, geography);
  let marketImpliedRate = 0;
  if (sdgResults.length > 0) {
    const latest = sdgResults[sdgResults.length - 1];
    marketImpliedRate = latest.impliedDecarbRate;
  }
  const median = marketImpliedRate;
  const mean = marketImpliedRate;

  const gapsWithDetails: CompanyDecarbGap[] = perCompany.map(c => {
    const company = companyMap.get(c.companyId);
    const gap = projectedRate - c.impliedDecarbRate;
    return {
      companyId: c.companyId,
      companyName: company?.name || "Unknown",
      sector: company?.sector || null,
      subSector: company?.subSector || null,
      industry: company?.industry || null,
      pe: Math.round(c.pe * 100) / 100,
      impliedGrowth: Math.round(c.impliedGrowth * 10000) / 10000,
      peerMedianGrowth: Math.round(c.peerMedianGrowth * 10000) / 10000,
      impliedDecarbRate: Math.round(c.impliedDecarbRate * 100) / 100,
      gap: Math.round(gap * 100) / 100,
      score: 0,
    };
  });

  const scores = computeDecarbGapScores(filteredCompanies, latestTSByCompany, projectedRate, method, costOfEquity);
  for (const g of gapsWithDetails) {
    g.score = Math.round((scores.get(g.companyId) || 0) * 1000) / 1000;
  }

  const positiveSignalCount = gapsWithDetails.filter(g => g.gap > 0).length;
  const negativeSignalCount = gapsWithDetails.filter(g => g.gap < 0).length;

  const bucketEdges = [-5, -3, -2, -1, -0.5, 0, 0.5, 1, 2, 3, 5];
  const bucketLabels = ["<-5%", "-5 to -3%", "-3 to -2%", "-2 to -1%", "-1 to -0.5%", "-0.5 to 0%", "0 to 0.5%", "0.5 to 1%", "1 to 2%", "2 to 3%", "3 to 5%", ">5%"];
  const bucketCounts = new Array(bucketLabels.length).fill(0);

  for (const g of gapsWithDetails) {
    let placed = false;
    for (let i = 0; i < bucketEdges.length; i++) {
      if (g.gap < bucketEdges[i]) {
        bucketCounts[i]++;
        placed = true;
        break;
      }
    }
    if (!placed) bucketCounts[bucketLabels.length - 1]++;
  }

  const distribution = bucketLabels.map((label, i) => {
    let midpoint: number;
    if (i === 0) midpoint = -6;
    else if (i === bucketLabels.length - 1) midpoint = 6;
    else midpoint = (bucketEdges[i - 1] + bucketEdges[i]) / 2;
    return { bucket: label, count: bucketCounts[i], midpoint };
  });

  const sortedByGap = [...gapsWithDetails].sort((a, b) => b.gap - a.gap);
  const topCompanies = sortedByGap.slice(0, 10);
  const bottomCompanies = sortedByGap.slice(-10).reverse();

  return {
    projectedRate: Math.round(projectedRate * 100) / 100,
    medianImpliedRate: Math.round(median * 100) / 100,
    meanImpliedRate: Math.round(mean * 100) / 100,
    companyCount: perCompany.length,
    positiveSignalCount,
    negativeSignalCount,
    distribution,
    topCompanies,
    bottomCompanies,
  };
}

export async function calculateDecarbGapTimeSeries(
  projectedRate: number,
  method: ScoringMethod,
  costOfEquity: number = 0.08,
  geography?: string
): Promise<DecarbGapTimePoint[]> {
  const sdgResults = await calculateSDGGrowthDifferential(costOfEquity, geography);

  if (sdgResults.length === 0) return [];

  const impliedRates = sdgResults.map(r => r.impliedDecarbRate);
  const sortedRates = [...impliedRates].sort((a, b) => a - b);
  const p25 = percentile(sortedRates, 25);
  const p75 = percentile(sortedRates, 75);

  return sdgResults.map(r => ({
    date: r.date.toISOString().slice(0, 10),
    projectedRate: Math.round(projectedRate * 100) / 100,
    medianImpliedRate: Math.round(r.impliedDecarbRate * 100) / 100,
    meanImpliedRate: Math.round(r.impliedDecarbRate * 100) / 100,
    p25ImpliedRate: Math.round(p25 * 100) / 100,
    p75ImpliedRate: Math.round(p75 * 100) / 100,
    companyCount: r.cleanCount + r.dirtyCount,
  }));
}

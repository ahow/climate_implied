import type { CvTimeSeries } from "@shared/schema";
import { convertAll } from "./decarbConversion";
import { computeAnnualDecarbRate, groupTimeSeriesByDate, loadCompaniesAndTimeSeries } from "./sharedUtils";

const BAND_EDGES = [0, 1, 2, 3, 4, 5, 7, 10];
const BAND_LABELS = ["0%", "0-1%", "1-2%", "2-3%", "3-4%", "4-5%", "5-7%", "7-10%", "10%+"];

export interface DecarbBandResult {
  date: Date;
  bands: BandData[];
  peakBand: string;
  peakBandMidpoint: number;
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  weightedAvgDecarbRate: number;
}

export interface BandData {
  label: string;
  midpoint: number;
  pe: number;
  companyCount: number;
  totalMarketCap: number;
  totalProfit: number;
}

function getBandIndex(annualRatePercent: number): number {
  for (let i = 0; i < BAND_EDGES.length; i++) {
    if (annualRatePercent < BAND_EDGES[i]) {
      return Math.max(0, i - 1);
    }
  }
  return BAND_LABELS.length - 1;
}

function getBandMidpoint(bandIndex: number): number {
  if (bandIndex === 0) return 0;
  if (bandIndex >= BAND_LABELS.length - 1) return 12;
  const lower = BAND_EDGES[bandIndex];
  const upper = bandIndex + 1 < BAND_EDGES.length ? BAND_EDGES[bandIndex + 1] : BAND_EDGES[BAND_EDGES.length - 1] + 3;
  return (lower + upper) / 2;
}

export async function calculateDecarbBands(): Promise<DecarbBandResult[]> {
  const { companies: allCompanies, timeSeries: allTimeSeries } = await loadCompaniesAndTimeSeries(false);

  if (allTimeSeries.length === 0) return [];

  const companyBands = new Map<number, number>();
  let companiesWithTargets = 0;
  let companiesWithoutTargets = 0;
  for (const c of allCompanies) {
    const annualRate = computeAnnualDecarbRate(c.emissionTarget2050);
    if (annualRate === null) {
      companiesWithoutTargets++;
      continue;
    }
    const bandIdx = getBandIndex(annualRate);
    companyBands.set(c.id, bandIdx);
    companiesWithTargets++;
  }

  console.log(`[DecarbBands] Companies with targets: ${companiesWithTargets}, without: ${companiesWithoutTargets}`);

  const bandDistribution = new Map<number, number>();
  for (const bandIdx of Array.from(companyBands.values())) {
    bandDistribution.set(bandIdx, (bandDistribution.get(bandIdx) || 0) + 1);
  }
  console.log(`[DecarbBands] Company distribution across bands:`);
  for (let i = 0; i < BAND_LABELS.length; i++) {
    const count = bandDistribution.get(i) || 0;
    if (count > 0) console.log(`  ${BAND_LABELS[i]}: ${count} companies`);
  }

  if (companiesWithTargets === 0) {
    console.log(`[DecarbBands] No companies with emission targets found`);
    return [];
  }

  const timeSeriesByDate = groupTimeSeriesByDate(allTimeSeries);

  const results: DecarbBandResult[] = [];

  for (const [dateKey, tsForDate] of Array.from(timeSeriesByDate.entries())) {
    const date = new Date(dateKey);

    const bandRecords = new Map<number, CvTimeSeries[]>();
    for (let i = 0; i < BAND_LABELS.length; i++) {
      bandRecords.set(i, []);
    }

    for (const ts of tsForDate) {
      const bandIdx = companyBands.get(ts.companyId);
      if (bandIdx !== undefined && ts.marketCap != null && ts.netProfit != null) {
        bandRecords.get(bandIdx)!.push(ts);
      }
    }

    const bands: BandData[] = [];
    let peakPE = -Infinity;
    let peakBandIdx = 0;

    for (let i = 0; i < BAND_LABELS.length; i++) {
      const records = bandRecords.get(i) || [];
      const validRecords = records.filter(ts => ts.marketCap! > 0);

      if (validRecords.length === 0) {
        bands.push({
          label: BAND_LABELS[i],
          midpoint: getBandMidpoint(i),
          pe: 0,
          companyCount: 0,
          totalMarketCap: 0,
          totalProfit: 0,
        });
        continue;
      }

      const totalMC = validRecords.reduce((s, ts) => s + ts.marketCap!, 0);
      const totalProfit = validRecords.reduce((s, ts) => s + ts.netProfit!, 0);
      const pe = totalProfit > 0 ? totalMC / totalProfit : 0;

      bands.push({
        label: BAND_LABELS[i],
        midpoint: getBandMidpoint(i),
        pe: Math.round(pe * 100) / 100,
        companyCount: validRecords.length,
        totalMarketCap: totalMC,
        totalProfit: totalProfit,
      });

      if (pe > peakPE && validRecords.length >= 3) {
        peakPE = pe;
        peakBandIdx = i;
      }
    }

    if (peakPE <= 0) continue;

    const peakMidpoint = getBandMidpoint(peakBandIdx);
    const conversion = convertAll(peakMidpoint);

    let peWeightedSum = 0;
    let peWeightTotal = 0;
    for (const b of bands) {
      if (b.pe > 0 && b.companyCount > 0) {
        peWeightedSum += b.midpoint * b.pe;
        peWeightTotal += b.pe;
      }
    }
    const weightedAvgDecarbRate = peWeightTotal > 0 ? peWeightedSum / peWeightTotal : 0;

    results.push({
      date,
      bands,
      peakBand: BAND_LABELS[peakBandIdx],
      peakBandMidpoint: peakMidpoint,
      impliedDecarbRate: peakMidpoint,
      impliedCarbonPrice: conversion.impliedCarbonPrice,
      impliedTemperature: conversion.impliedTemperature,
      weightedAvgDecarbRate: Math.round(weightedAvgDecarbRate * 1000) / 1000,
    });
  }

  results.sort((a, b) => a.date.getTime() - b.date.getTime());

  if (results.length > 0) {
    const mid = results[Math.floor(results.length / 2)];
    console.log(`[DecarbBands] Sample mid-date result:`);
    console.log(`  Peak band: ${mid.peakBand} (midpoint ${mid.peakBandMidpoint}%)`);
    console.log(`  Implied decarb rate: ${mid.impliedDecarbRate}%/yr`);
    console.log(`  Implied temperature: ${mid.impliedTemperature}°C`);
    console.log(`  Implied carbon price: $${mid.impliedCarbonPrice}/tonne`);
    console.log(`  Band P/E values:`);
    for (const b of mid.bands) {
      if (b.companyCount > 0) {
        console.log(`    ${b.label}: PE=${b.pe}x, ${b.companyCount} companies`);
      }
    }
  }

  return results;
}

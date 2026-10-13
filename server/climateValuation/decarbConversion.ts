import { LEGACY_FINANCE } from "../../shared/calculationContract";
const TCRE_BASE = LEGACY_FINANCE.tcreCPerGt;
const BASELINE_WARMING = LEGACY_FINANCE.warmingOffsetC;
const CURRENT_ANNUAL_EMISSIONS_GT = LEGACY_FINANCE.annualEmissionsGt;
const PROJECTION_END_YEAR = LEGACY_FINANCE.endYear;
const BASE_YEAR = LEGACY_FINANCE.baselineYear;
const CARBON_PRICE_HORIZON_YEARS = LEGACY_FINANCE.carbonPriceHorizonYears;

const CARBON_PRICE_LOOKUP: Array<{ price: number; reduction: number }> = [
  { price: 0, reduction: 0 },
  { price: 10, reduction: 4 },
  { price: 25, reduction: 8 },
  { price: 50, reduction: 16 },
  { price: 75, reduction: 23 },
  { price: 100, reduction: 29 },
  { price: 150, reduction: 38 },
  { price: 200, reduction: 45 },
  { price: 300, reduction: 55 },
  { price: 500, reduction: 65 },
];

export interface DecarbConversionResult {
  impliedDecarbRate: number;
  impliedCarbonPrice: number;
  impliedTemperature: number;
  cumulativeEmissionsGt: number;
  netZeroYear: number | null;
}

export function decarbRateToTemperature(annualDecarbRatePercent: number): { temperature: number; cumulativeEmissionsGt: number } {
  const rate = annualDecarbRatePercent / 100;
  let cumulativeEmissions = 0;
  for (let y = 0; y <= PROJECTION_END_YEAR - BASE_YEAR; y++) {
    const yearEmissions = CURRENT_ANNUAL_EMISSIONS_GT * Math.pow(1 - rate, y);
    cumulativeEmissions += Math.max(0, yearEmissions);
  }
  const temperature = BASELINE_WARMING + cumulativeEmissions * TCRE_BASE;
  return { temperature: Math.round(temperature * 100) / 100, cumulativeEmissionsGt: Math.round(cumulativeEmissions) };
}

function annualRateToCumulativeReduction(annualRatePercent: number): number {
  const r = annualRatePercent / 100;
  return (1 - Math.pow(1 - r, CARBON_PRICE_HORIZON_YEARS)) * 100;
}

function interpolateLookup(cumulativeReduction: number): number {
  const table = CARBON_PRICE_LOOKUP;

  if (cumulativeReduction <= 0) {
    const slope = table[1].price / table[1].reduction;
    return cumulativeReduction * slope;
  }

  const maxReduction = table[table.length - 1].reduction;
  if (cumulativeReduction >= maxReduction) {
    return table[table.length - 1].price;
  }

  for (let i = 0; i < table.length - 1; i++) {
    if (cumulativeReduction >= table[i].reduction && cumulativeReduction <= table[i + 1].reduction) {
      const frac = (cumulativeReduction - table[i].reduction) / (table[i + 1].reduction - table[i].reduction);
      return table[i].price + frac * (table[i + 1].price - table[i].price);
    }
  }

  return table[table.length - 1].price;
}

export function decarbRateToCarbonPrice(annualDecarbRatePercent: number): number {
  const cumulativeReduction = annualRateToCumulativeReduction(annualDecarbRatePercent);
  const price = interpolateLookup(cumulativeReduction);
  return Math.round(price * 100) / 100;
}

export function decarbRateToNetZeroYear(annualDecarbRatePercent: number): number | null {
  const rate = annualDecarbRatePercent / 100;
  if (rate <= 0) return null;
  const threshold = LEGACY_FINANCE.nearZeroFraction;
  const yearsToNetZero = Math.log(threshold) / Math.log(1 - rate);
  const netZeroYear = Math.round(BASE_YEAR + yearsToNetZero);
  if (netZeroYear > 2200) return null;
  return netZeroYear;
}

export function impliedGrowthFromPE(pe: number, costOfEquity: number): number {
  if (pe <= 0) return 0;
  const earningsYield = 1 / pe;
  return costOfEquity - earningsYield;
}

export function growthDifferentialToDecarbRate(
  cleanGrowth: number,
  dirtyGrowth: number
): number {
  const differential = cleanGrowth - dirtyGrowth;
  return differential * 100;
}

export function convertAll(annualDecarbRatePercent: number): DecarbConversionResult {
  const { temperature, cumulativeEmissionsGt } = decarbRateToTemperature(annualDecarbRatePercent);
  const impliedCarbonPrice = decarbRateToCarbonPrice(annualDecarbRatePercent);
  const netZeroYear = decarbRateToNetZeroYear(annualDecarbRatePercent);
  return {
    impliedDecarbRate: annualDecarbRatePercent,
    impliedCarbonPrice,
    impliedTemperature: temperature,
    cumulativeEmissionsGt,
    netZeroYear,
  };
}

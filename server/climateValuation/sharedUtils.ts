import { db } from "../db";
import { cvCompanies, cvTimeSeries } from "@shared/schema";
import type { CvCompany, CvTimeSeries } from "@shared/schema";
import { orderCalculationRows } from "../../shared/calculationContract";
import { carryForwardEmissions } from "./emissionsCarryForward";

export type ScoringMethod = "absolute" | "sector_relative" | "sub_sector_relative" | "industry_relative";

export function calculateCarbonIntensity(
  scope1: number | null,
  scope2: number | null,
  scope3: number | null,
  marketCap: number | null,
  includeScope3: boolean
): number | null {
  if (!marketCap || marketCap <= 0) return null;
  const scope1Val = scope1 || 0;
  const scope2Val = scope2 || 0;
  const scope3Val = includeScope3 ? (scope3 || 0) : 0;
  const totalEmissions = scope1Val + scope2Val + scope3Val;
  if (totalEmissions === 0) return null;
  return totalEmissions / marketCap;
}

export function assignTerciles(
  intensities: Array<{ companyId: number; intensity: number | null }>
): Map<number, "bottom" | "middle" | "top" | null> {
  const validIntensities = intensities
    .filter(item => item.intensity !== null)
    .map(item => ({ companyId: item.companyId, intensity: item.intensity! }));

  if (validIntensities.length === 0) {
    return new Map(intensities.map(item => [item.companyId, null]));
  }

  validIntensities.sort((a, b) => a.intensity - b.intensity);
  const tercileSize = Math.floor(validIntensities.length / 3);
  const assignments = new Map<number, "bottom" | "middle" | "top" | null>();

  for (let i = 0; i < tercileSize; i++) {
    assignments.set(validIntensities[i].companyId, "bottom");
  }
  for (let i = validIntensities.length - tercileSize; i < validIntensities.length; i++) {
    assignments.set(validIntensities[i].companyId, "top");
  }
  for (let i = tercileSize; i < validIntensities.length - tercileSize; i++) {
    assignments.set(validIntensities[i].companyId, "middle");
  }

  for (const item of intensities) {
    if (!assignments.has(item.companyId)) {
      assignments.set(item.companyId, null);
    }
  }

  return assignments;
}

export function filterCompaniesByGeography(companies: CvCompany[], geography?: string): CvCompany[] {
  if (!geography || geography === "all") return companies;
  const geoUpper = geography.toUpperCase();
  return companies.filter(c => c.geography?.toUpperCase() === geoUpper);
}

export function groupTimeSeriesByDate(timeSeries: CvTimeSeries[]): Map<string, CvTimeSeries[]> {
  const byDate = new Map<string, CvTimeSeries[]>();
  for (const ts of timeSeries) {
    const dateKey = ts.date!.toISOString();
    if (!byDate.has(dateKey)) byDate.set(dateKey, []);
    byDate.get(dateKey)!.push(ts);
  }
  return byDate;
}

export function getLatestTimeSeriesPerCompany(
  timeSeries: CvTimeSeries[],
  companyIds?: Set<number>,
): Map<number, CvTimeSeries> {
  const latest = new Map<number, CvTimeSeries>();
  for (const ts of timeSeries) {
    if (companyIds && !companyIds.has(ts.companyId)) continue;
    const existing = latest.get(ts.companyId);
    if (!existing || (ts.date && existing.date && ts.date > existing.date)) {
      latest.set(ts.companyId, ts);
    }
  }
  return latest;
}

export function computeAnnualDecarbRate(emissionTarget2050: number | null, baseYear: number = 2024): number | null {
  if (emissionTarget2050 === null || emissionTarget2050 === undefined) return null;

  let targetReduction = Math.abs(emissionTarget2050);
  const yearsToTarget = 2050 - baseYear;
  if (yearsToTarget <= 0) return null;

  if (targetReduction <= 0) return 0;
  if (targetReduction >= 1) targetReduction = 0.99;

  const annualRate = 1 - Math.pow(1 - targetReduction, 1 / yearsToTarget);
  return annualRate * 100;
}

export function getPeerGroupKey(company: CvCompany, method: ScoringMethod): string {
  switch (method) {
    case "sector_relative":
      return company.sector || "__ungrouped__";
    case "sub_sector_relative":
      return company.subSector || "__ungrouped__";
    case "industry_relative":
      return company.industry || "__ungrouped__";
    case "absolute":
    default:
      return "__all__";
  }
}

export async function loadCompaniesAndTimeSeries(applyCarryForward: boolean = true): Promise<{
  companies: CvCompany[];
  timeSeries: CvTimeSeries[];
}> {
  const companies = (await db.select().from(cvCompanies)).sort((a, b) => a.id - b.id);
  const rawTimeSeries = orderCalculationRows(await db.select().from(cvTimeSeries));
  const timeSeries = applyCarryForward ? carryForwardEmissions(rawTimeSeries) : rawTimeSeries;
  return { companies, timeSeries };
}

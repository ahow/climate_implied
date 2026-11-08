import { db } from "../db";
import { cvCompanies, cvTimeSeries } from "@shared/schema";
import type { CvCompany, CvTimeSeries } from "@shared/schema";
import { orderCalculationRows } from "../../shared/calculationContract";
import { carryForwardEmissions } from "./emissionsCarryForward";
import { loadSnapshot, snapshotContext } from "../snapshots/store";

export type ScoringMethod = "absolute" | "sector_relative" | "sub_sector_relative" | "industry_relative";

export function calculateCarbonIntensity(
  scope1: number | null,
  scope2: number | null,
  scope3: number | null,
  marketCap: number | null,
  includeScope3: boolean
): number | null {
  if (!marketCap || !Number.isFinite(marketCap) || marketCap <= 0) return null;
  const required = includeScope3 ? [scope1, scope2, scope3] : [scope1, scope2];
  if (required.some(v => v == null || !Number.isFinite(v) || v < 0)) return null;
  const scope1Val = scope1!;
  const scope2Val = scope2!;
  const scope3Val = includeScope3 ? scope3! : 0;
  const totalEmissions = scope1Val + scope2Val + scope3Val;
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

export function computeAnnualDecarbRate(emissionTarget2050: number | null, baseYear?: number): number | null {
  // TARGET_SUMMARY_CUM_CHANGE_2050 is a signed change, not an absolute reduction.
  // The workbook has no target base-year/boundary metadata: do not assume 2024.
  if (emissionTarget2050 == null || !Number.isFinite(emissionTarget2050) ||
      baseYear === undefined || !Number.isInteger(baseYear) ||
      emissionTarget2050 <= -1) return null;
  const yearsToTarget = 2050 - baseYear;
  if (yearsToTarget <= 0) return null;
  const annualRate = 1 - Math.pow(1 + emissionTarget2050, 1 / yearsToTarget);
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
  const header = snapshotContext.getStore();
  const captured = header ? await loadSnapshot(header) : await db.transaction(async tx => ({
    companies: await tx.select().from(cvCompanies),
    timeSeries: await tx.select().from(cvTimeSeries),
  }), { isolationLevel: "repeatable read", accessMode: "read only" });
  const companies = captured.companies.sort((a, b) => a.id - b.id);
  const rawTimeSeries = orderCalculationRows(captured.timeSeries);
  const timeSeries = applyCarryForward ? carryForwardEmissions(rawTimeSeries) : rawTimeSeries;
  return { companies, timeSeries };
}

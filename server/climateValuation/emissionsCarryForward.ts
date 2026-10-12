import type { CvTimeSeries } from "@shared/schema";

export type ImputedScope = "scope1" | "scope2" | "scope3";

export type CvTimeSeriesWithImputation = CvTimeSeries & {
  isImputed?: boolean;
  imputedScopes?: ImputedScope[];
  emissionsAsOf?: Date | null;
};

export interface ImputationStats {
  totalRecords: number;
  imputedRecords: number;
  imputedFraction: number;
  imputedByScope: Record<ImputedScope, number>;
}

export function carryForwardEmissions(
  allTimeSeries: CvTimeSeries[]
): CvTimeSeriesWithImputation[] {
  const byCompany = new Map<number, CvTimeSeries[]>();
  for (const ts of allTimeSeries) {
    if (!byCompany.has(ts.companyId)) byCompany.set(ts.companyId, []);
    byCompany.get(ts.companyId)!.push(ts);
  }

  const result: CvTimeSeriesWithImputation[] = [];

  const companyEntries = Array.from(byCompany.values());
  for (const records of companyEntries) {
    records.sort((a: CvTimeSeries, b: CvTimeSeries) => (a.date!.getTime() - b.date!.getTime()));

    let lastScope1: number | null = null;
    let lastScope2: number | null = null;
    let lastScope3: number | null = null;
    let lastScopeDate: Date | null = null;

    for (const ts of records) {
      const hadAnyObserved =
        (ts.scope1Emissions !== null && ts.scope1Emissions !== undefined) ||
        (ts.scope2Emissions !== null && ts.scope2Emissions !== undefined) ||
        (ts.scope3Emissions !== null && ts.scope3Emissions !== undefined);

      if (ts.scope1Emissions !== null && ts.scope1Emissions !== undefined) {
        lastScope1 = ts.scope1Emissions;
      }
      if (ts.scope2Emissions !== null && ts.scope2Emissions !== undefined) {
        lastScope2 = ts.scope2Emissions;
      }
      if (ts.scope3Emissions !== null && ts.scope3Emissions !== undefined) {
        lastScope3 = ts.scope3Emissions;
      }
      if (hadAnyObserved && ts.date) {
        lastScopeDate = ts.date;
      }

      const filled: CvTimeSeriesWithImputation = { ...ts };
      const imputedScopes: ImputedScope[] = [];

      if ((filled.scope1Emissions === null || filled.scope1Emissions === undefined) && lastScope1 !== null) {
        filled.scope1Emissions = lastScope1;
        imputedScopes.push("scope1");
      }
      if ((filled.scope2Emissions === null || filled.scope2Emissions === undefined) && lastScope2 !== null) {
        filled.scope2Emissions = lastScope2;
        imputedScopes.push("scope2");
      }
      if ((filled.scope3Emissions === null || filled.scope3Emissions === undefined) && lastScope3 !== null) {
        filled.scope3Emissions = lastScope3;
        imputedScopes.push("scope3");
      }

      if (imputedScopes.length > 0) {
        filled.isImputed = true;
        filled.imputedScopes = imputedScopes;
        filled.emissionsAsOf = lastScopeDate;
      } else {
        filled.isImputed = false;
        filled.emissionsAsOf = ts.date ?? null;
      }

      result.push(filled);
    }
  }

  return result;
}

export function computeImputationStats(
  records: CvTimeSeriesWithImputation[]
): ImputationStats {
  const imputedByScope: Record<ImputedScope, number> = {
    scope1: 0,
    scope2: 0,
    scope3: 0,
  };
  let imputedRecords = 0;

  for (const r of records) {
    if (r.isImputed) {
      imputedRecords++;
      for (const scope of r.imputedScopes ?? []) {
        imputedByScope[scope]++;
      }
    }
  }

  const totalRecords = records.length;
  return {
    totalRecords,
    imputedRecords,
    imputedFraction: totalRecords > 0 ? imputedRecords / totalRecords : 0,
    imputedByScope,
  };
}

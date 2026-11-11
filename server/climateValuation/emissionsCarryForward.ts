import type { CvTimeSeries } from "@shared/schema";
import { validSourceCell, type WorkbookSourceCell, type WorkbookSourceMetadata } from "./workbookMissingness";

export type ImputedScope = "scope1" | "scope2" | "scope3";

export interface ImputedCell {
  scope: ImputedScope;
  method: "last-observation-carried-forward";
  original: WorkbookSourceCell;
  donor: WorkbookSourceCell;
  donorObservationDate: string;
  value: number;
}
export type CvTimeSeriesWithImputation = CvTimeSeries & WorkbookSourceMetadata & {
  isImputed?: boolean;
  imputedScopes?: ImputedScope[];
  emissionsAsOf?: Date | null;
  imputedCells?: ImputedCell[];
  imputationRefusals?: { scope: ImputedScope; reason: string }[];
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

    const donors = new Map<ImputedScope, { value: number; source?: WorkbookSourceCell; date: Date }>();
    for (const ts of records) {
      if ((ts as CvTimeSeriesWithImputation).isImputed || (ts as CvTimeSeriesWithImputation).imputedCells?.length)
        throw new Error("Carry-forward requires original unfilled input rows, not previously imputed outputs");
      const filled: CvTimeSeriesWithImputation = { ...ts, imputedCells: [], imputationRefusals: [] };
      const imputedScopes: ImputedScope[] = [];
      for (const [scope, field] of [
        ["scope1", "scope1Emissions"], ["scope2", "scope2Emissions"], ["scope3", "scope3Emissions"],
      ] as const) {
        const value = ts[field], original = (ts as CvTimeSeriesWithImputation).sourceCells?.[field];
        if (value != null) {
          if (!Number.isFinite(value)) throw new Error(`Nonfinite observed ${field}; company ${ts.companyId}`);
          donors.set(scope, { value, source: original, date: ts.date });
          continue;
        }
        const donor = donors.get(scope);
        if (!donor) continue;
        if (!validSourceCell(original, "blank", null) || !validSourceCell(donor.source, "observed", donor.value) ||
            original.sourceId !== donor.source.sourceId) {
          filled.imputationRefusals!.push({ scope, reason: "Original blank and observed donor source-cell identities unavailable or inconsistent; no untraceable infill" });
          continue;
        }
        filled[field] = donor.value;
        imputedScopes.push(scope);
        filled.imputedCells!.push({
          scope, method: "last-observation-carried-forward", original: { ...original },
          donor: { ...donor.source }, donorObservationDate: donor.date.toISOString(), value: donor.value,
        });
      }
      if (imputedScopes.length > 0) {
        filled.isImputed = true;
        filled.imputedScopes = imputedScopes;
        filled.emissionsAsOf = new Date(Math.min(...filled.imputedCells!.map(cell => new Date(cell.donorObservationDate).getTime())));
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

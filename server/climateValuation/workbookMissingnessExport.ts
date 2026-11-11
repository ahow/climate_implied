import XLSX from "xlsx";
import type { CvTimeSeries } from "../../shared/schema";
import { validSourceCell, type NumericSourceField, type WorkbookSourceMetadata } from "./workbookMissingness";
import type { CvTimeSeriesWithImputation } from "./emissionsCarryForward";
import { unpackDataset, type DatasetChunk } from "../snapshots/contract";
import { contentHash } from "../calculation/analysisManifest";

/** Lossless engineering audit export; not an issuer approval or model promotion. */
export function exportWorkbookMissingness(input: {
  snapshotId: string;
  sourceId: string;
  immutableInput: { id: string; chunks: DatasetChunk[] };
  original: (CvTimeSeries & WorkbookSourceMetadata)[];
  calculated: CvTimeSeriesWithImputation[];
  calculationRows: Record<string, unknown>[];
}) {
  if (input.snapshotId !== input.immutableInput.id) throw new Error("Export immutable input identity mismatch");
  const immutable = unpackDataset(input.immutableInput.id, input.immutableInput.chunks);
  const fields: NumericSourceField[] = ["totalReturnIndex", "marketCap", "priceEarnings", "netProfit", "scope1Emissions", "scope2Emissions", "scope3Emissions"];
  const key = (row: CvTimeSeries) => `${row.companyId}:${row.date.toISOString()}`;
  const originals = new Map(input.original.map(row => [key(row), row]));
  const immutableRows = new Map(immutable.timeSeries.map(row => [key(row), row as CvTimeSeries & WorkbookSourceMetadata]));
  for (const original of input.original) {
    const retained = immutableRows.get(key(original));
    if (!retained || fields.some(field => retained[field] !== original[field]) ||
        contentHash(retained.sourceCells ?? {}) !== contentHash(original.sourceCells ?? {}) ||
        contentHash(retained.derivations ?? {}) !== contentHash(original.derivations ?? {}))
      throw new Error("Export original values/source cells conflict with immutable input");
  }
  const sourceRows: Record<string, unknown>[] = [], infills: Record<string, unknown>[] = [], refusals: Record<string, unknown>[] = [], derivations: Record<string, unknown>[] = [];
  for (const row of input.calculated) {
    const original = originals.get(key(row));
    if (!original) throw new Error("Calculated output has no immutable original row");
    for (const field of fields) {
      const source = original.sourceCells?.[field];
      if (source && (source.sourceId !== input.sourceId || !validSourceCell(source, source.state === "unavailable" ? "unavailable" : original[field] == null ? "blank" : "observed", original[field])))
        throw new Error("Source-cell identity/value conflicts with immutable input");
      sourceRows.push({
        companyId: row.companyId, observationDate: row.date.toISOString(), field,
        sourceId: source?.sourceId ?? null, sheet: source?.sheet ?? null, cell: source?.cell ?? null,
        sourceObservationDate: source?.observationDate ?? null,
        sourceState: source?.state ?? (original.derivations?.[field] ? "derived-no-source-cell" : "source-cell-identity-unavailable"),
        sourceValue: source?.originalValue ?? null,
        method: original.derivations?.[field]?.method ?? (source?.state === "unavailable" ? "provider-NA-not-observed-or-blank" : source ? "source-cell-read" : "source-cell-unavailable"),
        originalValue: original[field], calculatedValue: row[field],
      });
    }
    if ((row.imputedCells?.length ?? 0) !== (row.imputedScopes?.length ?? 0) ||
        !!row.isImputed !== !!row.imputedCells?.length) throw new Error("Untraceable imputed output refused");
    for (const fill of row.imputedCells ?? []) {
      const field = `${fill.scope}Emissions` as NumericSourceField;
      const donorRow = originals.get(`${row.companyId}:${fill.donorObservationDate}`);
      if (original[field] != null || !validSourceCell(fill.original, "blank", null) ||
          !validSourceCell(fill.donor, "observed", fill.value) || fill.original.sourceId !== input.sourceId ||
          fill.donor.sourceId !== input.sourceId || row[field] !== fill.value ||
          JSON.stringify(fill.original) !== JSON.stringify(original.sourceCells?.[field]) ||
          donorRow?.[field] !== fill.value ||
          JSON.stringify(donorRow?.sourceCells?.[field]) !== JSON.stringify(fill.donor))
        throw new Error("Infill does not identify its actual original blank and observed donor");
      infills.push({
        companyId: row.companyId, observationDate: row.date.toISOString(), field,
        value: fill.value, method: fill.method, sourceId: fill.original.sourceId,
        originalSheet: fill.original.sheet, originalCell: fill.original.cell, originalValue: null,
        donorSheet: fill.donor.sheet, donorCell: fill.donor.cell,
        donorValue: fill.donor.originalValue, donorObservationDate: fill.donorObservationDate,
      });
    }
    for (const refusal of row.imputationRefusals ?? [])
      refusals.push({ companyId: row.companyId, observationDate: row.date.toISOString(), ...refusal });
    for (const [field, derivation] of Object.entries(original.derivations ?? {}))
      derivations.push({
        companyId: row.companyId, observationDate: row.date.toISOString(), field,
        method: derivation.method, originalSourceCell: null, inputs: JSON.stringify(derivation.inputs),
      });
  }
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of [
    ["Identity", [{ sourceId: input.sourceId, snapshotId: input.snapshotId, status: "isolated-engineering-missingness-audit; not scientific or issuer approval", missingness: "Blank remains null; unsupported tokens refused; every infill requires original blank and donor source cells" }]],
    ["SourceCells", sourceRows], ["InfilledCells", infills], ["Refusals", refusals], ["Derivations", derivations],
    ["Calculation", input.calculationRows],
  ] as const) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([...rows]), name);
  return { bytes: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer, sourceRows, infills, refusals };
}

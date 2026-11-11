import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type XLSX from "xlsx";

export interface WorkbookSourceCell {
  sourceId: string;
  sheet: string;
  cell: string;
  state: "blank" | "observed" | "unavailable";
  originalValue: number | null;
  missingness?: "provider-NA";
  observationDate?: string;
}
export type NumericSourceField = "totalReturnIndex" | "marketCap" | "priceEarnings" |
  "netProfit" | "scope1Emissions" | "scope2Emissions" | "scope3Emissions";
export type WorkbookSourceCells = Partial<Record<NumericSourceField, WorkbookSourceCell>>;
export interface WorkbookSourceMetadata {
  sourceCells?: WorkbookSourceCells;
  derivations?: Record<string, { method: string; inputs: WorkbookSourceCell[]; originalSourceCell: null }>;
}
export async function workbookSourceId(path: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}
export function numericSourceCell(sourceId: string, sheet: string, cell: string, value: number | null): WorkbookSourceCell {
  return { sourceId, sheet, cell, state: value === null ? "blank" : "observed", originalValue: value };
}
export function unavailableSourceCell(sourceId: string, sheet: string, cell: string): WorkbookSourceCell {
  return { sourceId, sheet, cell, state: "unavailable", originalValue: null, missingness: "provider-NA" };
}
/** Unsupported qualifiers are refused, not interpreted as zero, a bound or a blank. */
export function readWorkbookNumeric(sourceId: string, sheet: string, address: string, cell?: XLSX.CellObject) {
  const value = cell?.v;
  const fail = () => { throw new Error(`Unsupported numeric source cell ${sourceId}:${sheet}!${address}; explicit token/qualifier review required`); };
  // Retained financial workbook convention: exact NA means no supplied value.
  // It is neither an original blank nor an observed zero, and cannot be infilled.
  if (typeof value === "string" && value.trim() === "NA" && ["MV", "PE", "Profit", "RI"].includes(sheet))
    return { value: null, source: unavailableSourceCell(sourceId, sheet, address) };
  if (cell?.t === "e" || cell?.f && value == null) return fail();
  if (value == null || typeof value === "string" && value.trim() === "")
    return { value: null, source: numericSourceCell(sourceId, sheet, address, null) };
  if (typeof value !== "number" && typeof value !== "string") return fail();
  if (typeof value === "string" && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return fail();
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isFinite(parsed)) return fail();
  return { value: parsed, source: numericSourceCell(sourceId, sheet, address, parsed) };
}
export function validSourceCell(cell: WorkbookSourceCell | undefined, state: WorkbookSourceCell["state"], value: number | null): cell is WorkbookSourceCell {
  if (state !== "observed" ? value !== null : typeof value !== "number" || !Number.isFinite(value)) return false;
  if (state === "unavailable" && (cell?.missingness !== "provider-NA" || !["MV", "PE", "Profit", "RI"].includes(cell?.sheet ?? ""))) return false;
  return !!cell && /^[a-f0-9]{64}$/.test(cell.sourceId) && !!cell.sheet &&
    /^[A-Z]+[1-9]\d*$/.test(cell.cell) && cell.state === state && cell.originalValue === value;
}

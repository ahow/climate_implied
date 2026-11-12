import type * as Workbook from "xlsx";
import { consumerCanonicalJson } from "../../../shared/derivedConsumer";
import { derivedConsumerSheetBindings } from "../../../shared/derivedConsumerSemantics";
import { bindNestedOutput, bindExportColumns } from "../../../shared/outputFieldSemantics";
import type { derivedConsumerIdentity } from "./producer-download";

type Identity = NonNullable<Awaited<ReturnType<typeof derivedConsumerIdentity>>>;
async function hash(value: unknown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(consumerCanonicalJson(value)));
  return Array.from(new Uint8Array(digest)).map(x => x.toString(16).padStart(2, "0")).join("");
}
/** Supplemental sheets are exact captured consumer metadata, not additional
 * native producer outputs. No claim that dictionary prose existed historically.
 * The lineage sheet excludes itself to avoid a circular cell-hash assertion. */
export async function appendDerivedConsumerWorkbookLineage(
  XLSX: typeof Workbook, book: Workbook.WorkBook, identity: Identity | null,
) {
  if (!identity) return null;
  if (book.SheetNames.includes("Derived lineage")) throw new Error("Reserved derived lineage worksheet name");
  const sheets = await Promise.all(book.SheetNames.map(async (name, index) => {
    const cells = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, defval: null, raw: true });
    return { name, index, cellsHash: await hash(cells),
      role: index === 0 ? "Derived parent observation rows" : "Captured consumer metadata, not native producer rows",
      derivation: index === 0 ? identity.derivationHash : "central-download-writer-metadata-1",
      units: index === 0 ? identity.derivation.units : "Metadata cells; native units only where explicitly declared",
      order: "Exact worksheet and row/column order as captured; no sorting or deduplication" };
  }));
  const lineage = { ...identity, sheets,
    sheetsHashMethod: "SHA-256 canonical finite JSON of decoded header:1 raw worksheet cells with defval:null; lineage sheet excluded",
    captureBoundary: "Prospective browser-generated workbook. Parent server proof is inherited only through the consumed response and closed derivation. No browser signature, historical original workbook recovery or operator approval." };
  bindNestedOutput("derivedConsumer", lineage);
  const rows = Object.entries(lineage).map(([Field, value]) => ({ Field, Value: JSON.stringify(value) }));
  bindExportColumns(rows, derivedConsumerSheetBindings);
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Derived lineage");
  return lineage;
}

/** Read actual exported bytes, never regenerate a claimed old original. A
 * caller compares returned identity with its trusted response-derived capture;
 * hashes alone are not publication authorization or a signature. */
export async function verifyDerivedConsumerWorkbook(
  XLSX: typeof Workbook, bytes: Uint8Array, expected: NonNullable<Awaited<ReturnType<typeof appendDerivedConsumerWorkbookLineage>>>,
) {
  const book = XLSX.read(bytes, { type: "array" });
  if (consumerCanonicalJson(book.SheetNames) !== consumerCanonicalJson([...expected.sheets.map(sheet => sheet.name), "Derived lineage"]))
    throw new Error("Derived workbook sheet order conflicts");
  const lineageCells = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets["Derived lineage"],
    { header: 1, defval: null, raw: true });
  const expectedCells = [["Field", "Value"],
    ...Object.entries(expected).map(([Field, value]) => [Field, JSON.stringify(value)])];
  if (consumerCanonicalJson(lineageCells) !== consumerCanonicalJson(expectedCells))
    throw new Error("Derived workbook lineage cells conflict");
  const decoded = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Derived lineage"])
    .map(row => [row.Field, JSON.parse(row.Value)]));
  if (consumerCanonicalJson(decoded) !== consumerCanonicalJson(expected))
    throw new Error("Derived workbook lineage conflicts");
  for (const sheet of expected.sheets) {
    const cells = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet.name], { header: 1, defval: null, raw: true });
    if (await hash(cells) !== sheet.cellsHash) throw new Error("Derived workbook cells conflict");
  }
  return { book, lineage: decoded };
}

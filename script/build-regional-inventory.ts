/** Pinned source reconstruction; never promote or invent regional land-use shares. */
import XLSX from "xlsx";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import inventory from "../server/calculation/data/inventory2024.json";
import { aggregateRegionalInventory, reconcileRegionalInventory } from "../server/calculation/regionalInventory";
import { contentHash } from "../server/calculation/analysisManifest";

const rows: { country: string; sector: string; gas: string; nativeMt: number }[] = [];
const quality: Record<string, { missing: number; signedAdjustments: number }> = {};
for (const group of ["CO2", "CH4", "N2O", "F-gases"]) {
  const file = `EDGAR_${group}_1970_2024.xlsx`;
  const response = await fetch(`https://raw.githubusercontent.com/ClimateIndicator/GHG-Emissions-Assessment/${inventory.sourceRevision}/sources/EDGAR/${file}`);
  if (!response.ok) throw new Error(`Source unavailable: ${file}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const expected = (inventory.sourceHashes as Record<string, string>)[file];
  if (createHash("sha256").update(buffer).digest("hex") !== expected) throw new Error(`Source changed: ${file}`);
  const book = XLSX.read(buffer);
  const sheet = book.Sheets["IPCC 2006"];
  if (!sheet || XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 })[4]?.[1] !== "Gg")
    throw new Error(`Native unit mismatch: ${file}`);
  quality[file] = { missing: 0, signedAdjustments: 0 };
  for (const row of XLSX.utils.sheet_to_json<any>(sheet, { range: 9 })) {
    if (group === "CO2" && row.fossil_bio !== "fossil") continue;
    if (String(row.Substance).startsWith("HCFC")) continue;
    if (row.Y_2024 == null || row.Y_2024 === "") { quality[file].missing++; continue; }
    const value = Number(row.Y_2024);
    if (!Number.isFinite(value)) throw new Error("Invalid inventory observation");
    if (value < 0) quality[file].signedAdjustments++;
    rows.push({ country: String(row.Country_code_A3), sector: String(row.ipcc_code_2006_for_standard_report),
      gas: String(row.Substance), nativeMt: value / 1000 });
  }
}
const cells = aggregateRegionalInventory(rows);
const factor = inventory.reporting.components["CO2-FFI"] * 1000 / inventory.allocation.edgarCo2Mt;
for (const cell of cells) if (cell.gas === "CO2") cell.nativeMt *= factor;
const reconciliation = reconcileRegionalInventory(cells, inventory.cells.filter(c => c.sector !== "LULUCF"));
if (!reconciliation.passed) throw new Error(`Regional fossil/non-CO2 accounting mismatch: ${JSON.stringify(reconciliation)}`);
const totals: Record<string, number> = {};
for (const cell of cells) {
  const source = inventory.cells.find(c => c.gas === cell.gas && c.sector === cell.sector);
  if (!source) throw new Error("Unknown native gas/sector");
  totals[cell.region] = (totals[cell.region] ?? 0) + cell.nativeMt * source.gwp100 / 1000;
}
const report = {
  version: "regional-inventory-1", year: 2024, sourceHashes: inventory.sourceHashes,
  evidenceState: "Model-assisted estimate", claim: "GCB global fossil CO2 allocated with EDGAR country/sector weights",
  quality, cells, regionalGtCO2e: totals, reconciliation,
  landUse: { status: "unavailable-regional-allocation", globalGtCO2: inventory.reporting.components["CO2-LULUCF"],
    reason: "The pinned baseline contains global net land-use CO2 only; assigning it to regions requires an additional reconciled source." },
  productionEligible: false,
};
await mkdir("generated-artifacts/regional-inventory", { recursive: true });
await writeFile("generated-artifacts/regional-inventory/inventory.json", JSON.stringify({ id: contentHash(report), ...report }, null, 2));
console.log(JSON.stringify({ id: contentHash(report), regions: totals, cells: cells.length,
  nativeAccounting: reconciliation.passed, landUse: report.landUse, productionEligible: false }, null, 2));

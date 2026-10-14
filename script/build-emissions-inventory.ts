/**
 * Explicit, manual source preparation, not a change to the approval scheduler.
 * Large upstream workbooks are read in memory. Only the compact aggregate is exported.
 */
import XLSX from "xlsx";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const revision = "e81bb760b66ab182f9052d8d4218d42a97acbd75";
const base = `https://raw.githubusercontent.com/ClimateIndicator/GHG-Emissions-Assessment/${revision}/`;
async function text(url: string) {
  const r = await fetch(url); if (!r.ok) throw new Error(`${r.status}: ${url}`);
  return r.text();
}
const metricsUrl = "https://raw.githubusercontent.com/chrisroadmap/ar6/24f279260fc2d1ebd09b2bd4114f2be11859e925/data_output/7sm/metrics_supplement_cleaned.csv";
const metricsText = await text(metricsUrl);
const metricBook = XLSX.read(metricsText, { type: "string" });
const metrics = XLSX.utils.sheet_to_json<any>(metricBook.Sheets[metricBook.SheetNames[0]]);
const gasGwp = (gas: string): number => {
  if (gas === "CO2") return 1;
  if (gas === "CH4") return 27.9;
  if (gas === "N2O") return 273;
  const name = gas.replace("HFC-43-10-mee", "HFC-43-10mee");
  const special: Record<string, number> = { "c-C4F8": 10200, C6F14: 8620, C7F16: 8410, C8F18: 8260 };
  const row = metrics.find(r => r.Acronym === name || r.Formula === name || r.Formula === `n-${name}`);
  const value = special[name] ?? Number(row?.GWP100);
  if (!(value > 0)) throw new Error(`Missing AR6 GWP100: ${gas}`);
  return value;
};
const reportUrl = "https://raw.githubusercontent.com/ClimateIndicator/data/v2026.06.02/data/greenhouse_gas_emissions/greehouse_gas_emissions_co2eq.csv";
const reportText = await text(reportUrl);
const reportBook = XLSX.read(reportText, { type: "string" });
const report2024 = XLSX.utils.sheet_to_json<any>(reportBook.Sheets[reportBook.SheetNames[0]])
  .find(r => r.timebound_lower === 2024);
if (!report2024) throw new Error("Missing IGCC 2024 inventory");
const sourceHashes: Record<string, string> = {};
const omittedMissingCells: Record<string, number> = {};
const negativeSourceCells: Record<string, number> = {};
const cells: { gas: string; sector: string; nativeMt: number; gwp100: number; origin: string }[] = [];
for (const group of ["CO2", "CH4", "N2O", "F-gases"]) {
  const file = `EDGAR_${group}_1970_2024.xlsx`;
  const r = await fetch(`${base}sources/EDGAR/${file}`);
  if (!r.ok) throw new Error(`Cannot download ${file}`);
  const buffer = Buffer.from(await r.arrayBuffer());
  sourceHashes[file] = createHash("sha256").update(buffer).digest("hex");
  const book = XLSX.read(buffer);
  const sheet = book.Sheets["IPCC 2006"];
  const header = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
  if (header[4]?.[1] !== "Gg") throw new Error(`Unexpected native units: ${file}`);
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { range: 9 });
  const grouped = new Map<string, number>();
  for (const row of rows) {
    if (group === "CO2" && row.fossil_bio !== "fossil") continue;
    if (String(row.Substance).startsWith("HCFC")) continue; // Outside UNFCCC reporting boundary.
    // Match upstream sum(..., na.rm=TRUE), retain omissions as a quality flag.
    if (row.Y_2024 == null || row.Y_2024 === "") {
      omittedMissingCells[file] = (omittedMissingCells[file] ?? 0) + 1;
      continue;
    }
    const value = Number(row.Y_2024);
    if (!Number.isFinite(value)) throw new Error(`Invalid 2024 value: ${file}`);
    if (value < 0) negativeSourceCells[file] = (negativeSourceCells[file] ?? 0) + 1;
    const key = `${row.Substance}|${row.ipcc_code_2006_for_standard_report}`;
    grouped.set(key, (grouped.get(key) ?? 0) + value / 1000); // Gg -> Mt of gas
  }
  for (const [key, nativeMt] of grouped) {
    const [gas, sector] = key.split("|");
    cells.push({ gas, sector, nativeMt, gwp100: gasGwp(gas), origin: "EDGAR v2025" });
  }
}
// GCB CO2 total with EDGAR sector weights: explicit allocation, not independent observations.
const co2 = cells.filter(c => c.gas === "CO2");
const edgarCo2Mt = co2.reduce((s, c) => s + c.nativeMt, 0);
for (const c of co2) {
  c.nativeMt *= Number(report2024["CO2-FFI"]) * 1000 / edgarCo2Mt;
  c.origin = "GCB 2024 CO2-FFI total allocated with EDGAR v2025 sector weights (not a sector observation)";
}
cells.push({ gas: "CO2", sector: "LULUCF", nativeMt: Number(report2024["CO2-LULUCF"]) * 1000, gwp100: 1, origin: "GCB 2024 net land-use CO2 (BLUE/OSCAR/LUCE)" });
const totals: Record<string, number> = {};
for (const c of cells) {
  const group = c.gas === "CO2" ? (c.sector === "LULUCF" ? "CO2-LULUCF" : "CO2-FFI") : ["CH4", "N2O"].includes(c.gas) ? c.gas : "F-gases";
  totals[group] = (totals[group] ?? 0) + c.nativeMt * c.gwp100 / 1000;
}
for (const [group, target] of Object.entries({ "CO2-FFI": 38.6, "CO2-LULUCF": 4.6, CH4: 9.3, N2O: 2.6, "F-gases": 1.7 })) {
  if (Math.abs(totals[group] - target) > 0.051) throw new Error(`Reconciliation failed: ${group} ${totals[group]} vs ${target}`);
  if (Math.abs(totals[group] - Number(report2024[group])) > 1e-7) throw new Error(`Native source mismatch: ${group}`);
}
const inventory = {
  version: "igcc-2024-candidate-1", year: 2024, status: "candidate-not-promoted",
  source: "https://essd.copernicus.org/articles/18/3889/2026/", sourceRevision: revision,
  reporting: { totalGtCO2e: 56.8, uncertainty90GtCO2e: 5.5, gwp: "AR6 GWP100", components: totals },
  boundary: "WGIII update: CO2-FFI, net bookkeeping LULUCF, anthropogenic CH4/N2O, UNFCCC F-gases; excludes ODS and additional natural-fire fluxes.",
  allocation: { method: "GCB total / EDGAR fossil CO2 total; preserve EDGAR sector proportions", edgarCo2Mt },
  sourceHashes, omittedMissingCells, negativeSourceCells, metricsUrl, metricsSha256: createHash("sha256").update(metricsText).digest("hex"),
  reportUrl, reportSha256: createHash("sha256").update(reportText).digest("hex"),
  cells: cells.sort((a, b) => a.gas.localeCompare(b.gas) || a.sector.localeCompare(b.sector)),
};
mkdirSync("server/calculation/data", { recursive: true });
writeFileSync("server/calculation/data/inventory2024.json", JSON.stringify(inventory, null, 2) + "\n");
console.log({ totals, total: Object.values(totals).reduce((a, b) => a + b, 0), cells: cells.length });

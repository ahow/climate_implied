// Exact Figure 1b column mapping; do not infer units from magnitudes.
const XLSX = require("xlsx");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = "generated-artifacts/driver-calibration/eia-storage-2025.xlsx";
const bytes = fs.readFileSync(path);
const workbook = XLSX.read(bytes);
const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Figure 1b"], { header: 1 });
if (!rows.some(r => r[1] === "U.S. total net cumulative power capacity (MW)" &&
                   r[2] === "U.S. total net cumulative energy capacity (MWh)"))
  throw new Error("Unexpected EIA schema");
const data = rows.filter(r => Number.isInteger(r[0])).map(r => ({
  year: r[0], MW: r[1] ?? null, MWh: r[2] ?? null,
}));
const result = {
  source: "https://www.eia.gov/analysis/studies/electricity/batterystorage/xls/2025%20Battery%20Storage%20Figures.xlsx",
  sourceSha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  sheet: "Figure 1b", attribution: "US Energy Information Administration, March 17 2026",
  rows: data,
};
fs.writeFileSync(path.replace(".xlsx", ".json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ sourceSha256: result.sourceSha256, rows: data.length }));

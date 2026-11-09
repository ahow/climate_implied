import XLSX from "xlsx";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ADDITIONAL_GASES, auditMinorGasHistory, minorGasSensitivityHistory } from "../server/calculation/minorGasHistory";
import inventory from "../server/calculation/data/inventory2024.json";
import { contentHash } from "../server/calculation/analysisManifest";

const filename = "EDGAR_F-gases_1970_2024.xlsx";
const directory = "generated-artifacts/species-research";
const url = `https://raw.githubusercontent.com/ClimateIndicator/GHG-Emissions-Assessment/${inventory.sourceRevision}/sources/EDGAR/${filename}`;
const data = await readFile(`${directory}/${filename}`);
const sourceHash = createHash("sha256").update(data).digest("hex");
if (sourceHash !== inventory.sourceHashes[filename]) throw new Error("Pinned EDGAR history hash mismatch");
const sheet = XLSX.read(data).Sheets["IPCC 2006"];
if (XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 })[4]?.[1] !== "Gg")
  throw new Error("Native unit mismatch");
const rows = XLSX.utils.sheet_to_json<any>(sheet, { range: 9 });
const audit = auditMinorGasHistory(rows);
for (const gas of ADDITIONAL_GASES) {
  const baseline = inventory.cells.filter(c => c.gas === gas).reduce((s, c) => s + c.nativeMt, 0);
  if (Math.abs(audit.gases[gas][54].reportedSubtotalMt - baseline) > Math.max(1e-12, baseline * 1e-9))
    throw new Error("Reported 2024 subtotal differs from frozen inventory");
}
await mkdir(directory, { recursive: true });
for (const method of ["zero-missing", "carry-forward", "historical-peak-stress"] as const) {
  const history = { ...minorGasSensitivityHistory(rows, method, url), sourceHash };
  const text = JSON.stringify(history, null, 2) + "\n";
  const file = `${directory}/history-${method}-${contentHash(history)}.json`;
  try { await writeFile(file, text, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(file, "utf8") !== text) throw error;
  }
  console.log(JSON.stringify({ method, file, sourceHash, missing: Object.fromEntries(ADDITIONAL_GASES.map(g =>
    [g, audit.gases[g].filter(y => y.missingCells.length).map(y => ({ year: y.year, cells: y.missingCells }))])) }));
}

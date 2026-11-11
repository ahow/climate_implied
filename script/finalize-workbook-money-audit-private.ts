import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import XLSX from "xlsx";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private actual metadata reconciliation only");
const dir = "generated-artifacts/workbook-money-audit-v1", originalPath = `${dir}/private-audit.json`;
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
if (existsSync(`${dir}/safe-summary-qualified.json`)) throw new Error("Already finalized; no unchanged control rerun");
const original = JSON.parse(readFileSync(originalPath, "utf8")), prior = JSON.parse(readFileSync(`${dir}/safe-summary.json`, "utf8"));
if (hash(original.workbook) !== original.sourceId || hash(originalPath) !== prior.sourceMetadataHash) throw new Error("Actual workbook/private source integrity failure");
const w = XLSX.readFile(original.workbook, { sheets: ["MV", "Profit"], sheetRows: 1 });
const proof = ["MV", "Profit"].map(name => {
  const headers = (XLSX.utils.sheet_to_json<any[]>(w.Sheets[name], { header: 1 })[0] ?? []).slice(1);
  const descriptors = headers.map(h => String(h).split(" - ").slice(1).join(" - "));
  const rawStats = original.sheets.find((s: any) => s.sheet === name);
  if (rawStats.commentedCells !== 0 || Object.keys(rawStats.numberFormats).some(k => !["General", "(absent)"].includes(k)))
    throw new Error("Actual comments/formats need substantive denomination review");
  if (descriptors.some(s => /\b(?:USD|EUR|GBP|GBp|ZAc|ZAR|ILA|ILS|thousands|millions|billions|units)\b/i.test(s)))
    throw new Error("Explicit header descriptor needs substantive currency review");
  return { sheet: name, explicitCurrencyCells: 0, explicitMagnitudeCells: 0,
    unqualifiedCompanyNameUnitTokenCells: rawStats.explicitMagnitudeCells,
    why: "The word UNITS appears in two company security names, NOT monetary metadata. Money datatype suffixes/General formats/no comments declare neither currency nor magnitude. Retain raw first-pass candidate count; do not promote it to explicit magnitude." };
});
const corrected = { version: "workbook-money-audit-2", originalPrivateAuditPath: originalPath, originalPrivateAuditSha256: hash(originalPath),
  originalSourceHash: original.sourceId, originalJournalCutoff: original.capturedAt, proof,
  reason: "Conservative metadata classification correction before qualification/scoring. First-pass raw unit-token counts were company names; zero economic conversion/scoring in either version.",
  sourceValuesDatesTrueZerosUnchanged: true };
writeFileSync(`${dir}/denomination-reconciliation.json`, JSON.stringify(corrected, null, 2) + "\n", { flag: "wx" });
const safe = { ...prior, version: "workbook-money-audit-2", denominationReconciliationHash: hash(`${dir}/denomination-reconciliation.json`),
  sheets: prior.sheets.map((s: any) => ({ ...s, explicitMagnitudeCells: 0,
    unqualifiedCompanyNameUnitTokenCells: proof.find(p => p.sheet === s.sheet)!.unqualifiedCompanyNameUnitTokenCells })) };
writeFileSync(`${dir}/safe-summary-qualified.json`, JSON.stringify(safe, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(safe));

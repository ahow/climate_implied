/** Builds D8 as-of rows from retained private worked inputs; never approves data. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { contentHash } from "../server/calculation/analysisManifest";
import { buildAsOfRows, ASOF_PROTOCOL, type Exclusion } from "../server/financialData/asOfValuation";

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error("Supply retained worked-input files");
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const exclusions: Exclusion[] = [];
  const sources: Record<string, string> = {};
  for (const file of files) {
    const source = JSON.parse(await readFile(file, "utf8"));
    const p = source.payload;
    if (contentHash(p) !== source.inputHash) throw new Error(`Source hash mismatch: ${file}`);
    if (p.company.isin !== p.profile.isin || p.selection.symbol !== p.profile.symbol) throw new Error("Identity mismatch");
    const id = p.selection.symbol as string;
    if (seen.has(id)) throw new Error(`Duplicate issuer ${id}`);
    seen.add(id); sources[id] = source.inputHash;
    const built = buildAsOfRows({ companyId: id, profileCurrency: p.profile.currency,
      cashFlows: p.statements["cash-flow-statement"], incomes: p.statements["income-statement"],
      observations: p.observations });
    rows.push(...built.rows); exclusions.push(...built.exclusions);
  }
  const evaluationAsOf = new Date().toISOString().slice(0, 10);
  const strict = rows.map(({ informationDate, baseFiscalDate, baseFilingDate, ...r }) => r);
  const comparisonInput = { evidenceMode: "revised-history", evaluationAsOf, rows: strict };
  const complete = strict.filter(r => ["actualCashFlowGrowth", "gordonCashFlowGrowth", "dcfCashFlowGrowth",
    "validationReturn"].every(k => r[k] !== null) && (r.outcomeAvailableAt as string) <= evaluationAsOf);
  const byOrigin: Record<string, number> = {};
  for (const r of complete) byOrigin[r.origin as string] = (byOrigin[r.origin as string] ?? 0) + 1;
  const audit = { protocol: ASOF_PROTOCOL, sources, issuers: seen.size, rowsBuilt: rows.length,
    completeByOrigin: byOrigin, exclusions, rows, evaluationAsOf,
    historyBasis: "revised-history", identityApproved: false };
  const folder = "generated-artifacts/valuation-comparison";
  await mkdir(folder, { recursive: true });
  const inputFile = `${folder}/asof-input-${contentHash(comparisonInput)}.json`;
  await writeFile(inputFile, JSON.stringify(comparisonInput));
  const auditFile = `${folder}/asof-audit-${contentHash(audit)}.json`;
  await writeFile(auditFile, JSON.stringify(audit, null, 1));
  const reasons: Record<string, number> = {};
  for (const e of exclusions) { const k = e.reason.replace(/\(.*\)/, "(…)"); reasons[k] = (reasons[k] ?? 0) + 1; }
  console.log(JSON.stringify({ inputFile, auditFile, issuers: seen.size, rowsBuilt: rows.length,
    completeRows: complete.length, completeByOrigin: byOrigin, exclusionReasons: reasons }, null, 1));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Build failed"); process.exitCode = 1; });

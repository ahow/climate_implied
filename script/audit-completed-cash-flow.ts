import { readFile, mkdir, writeFile } from "node:fs/promises";
import { completedCashFlowOutcomes } from "../server/financialData/completedCashFlow";
import { contentHash } from "../server/calculation/analysisManifest";

async function main() {
  if (!process.argv[2]) throw new Error("Supply retained company-worked-input files");
  const cases = [];
  for (const file of process.argv.slice(2)) {
    const source = JSON.parse(await readFile(file, "utf8"));
    if (contentHash(source.payload) !== source.inputHash) throw new Error("Source hash mismatch");
    const p = source.payload;
    if (p.company.isin !== p.profile.isin || p.selection.symbol !== p.profile.symbol)
      throw new Error("Source identity mismatch");
    const outcomes = completedCashFlowOutcomes(p.statements["cash-flow-statement"]);
    cases.push({ symbol: p.selection.symbol, sourceHash: source.inputHash, ...outcomes });
  }
  const result = { cases, empiricalD8Complete: false,
    blockers: ["Historical model-specific valuation predictions and paired validation signals not assembled",
      "Only three provider-matched control companies; ten common issuers per origin required",
      "Independent identity, cash-flow classification and publication-vintage review incomplete"] };
  const folder = "generated-artifacts/valuation-comparison";
  await mkdir(folder, { recursive: true });
  const output = `${folder}/outcomes-${contentHash(result)}.json`;
  const text = JSON.stringify(result, null, 2) + "\n";
  try { await writeFile(output, text, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(output, "utf8") !== text) throw error;
  }
  console.log(JSON.stringify({ output, cases: cases.map(c => ({ symbol: c.symbol,
    supplied: c.results.length, completed: c.results.filter(r => r.status === "completed-outcome").length,
    exclusions: c.results.filter(r => r.status === "unavailable") })), blockers: result.blockers }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Audit failed"); process.exitCode = 1; });

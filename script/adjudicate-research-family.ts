import { readFile, mkdir, writeFile } from "node:fs/promises";
import { adjudicateResearchFamily } from "../server/calculation/researchFamily";
import { contentHash } from "../server/calculation/analysisManifest";

async function main() {
  if (process.argv.length !== 4) throw new Error("Supply frozen protocol JSON and scored results JSON");
  const protocol = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (!Array.isArray(protocol.specifications) || protocol.evidenceMode !== "revised-history" ||
      protocol.primaryEndpoints?.join(",") !== "evaluation-r2,signal-ic,after-cost-long-short")
    throw new Error("Explicit revised-history protocol and all three primary endpoints required");
  const results = JSON.parse(await readFile(process.argv[3], "utf8"));
  const output = adjudicateResearchFamily({ protocolId: contentHash(protocol),
    specifications: protocol.specifications, results });
  const folder = "generated-artifacts/research-family";
  await mkdir(folder, { recursive: true });
  const path = `${folder}/${contentHash(output)}.json`;
  const text = JSON.stringify(output, null, 2) + "\n";
  try { await writeFile(path, text, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(path, "utf8") !== text) throw error;
  }
  console.log(JSON.stringify({ output: path, familySize: output.familySize,
    unavailableHypotheses: output.unavailableHypotheses, specifications: output.specifications }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Adjudication failed"); process.exitCode = 1; });

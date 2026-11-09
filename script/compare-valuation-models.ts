import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { compareValuationModels } from "../server/calculation/valuationComparison";
import { contentHash } from "../server/calculation/analysisManifest";

async function main() {
  if (process.argv.length !== 3) throw new Error("Supply one comparison input JSON file");
  const supplied = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (["protocolId", "blockLength", "bootstrapReplications", "seed"].some(k => k in supplied))
    throw new Error("Protocol choices cannot be overridden");
  const protocolId = createHash("sha256").update(await readFile("docs/Valuation_Comparison_Protocol.md")).digest("hex");
  const result = compareValuationModels({ ...supplied, protocolId, blockLength: 3,
    bootstrapReplications: 2000, seed: 20261110 });
  const folder = "generated-artifacts/valuation-comparison";
  await mkdir(folder, { recursive: true });
  const output = `${folder}/${contentHash(result)}.json`;
  const text = JSON.stringify(result, null, 2) + "\n";
  try { await writeFile(output, text, { flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(output, "utf8") !== text) throw error;
  }
  console.log(JSON.stringify({ output, status: result.status, coverage: result.coverage,
    numericalGate: result.status === "evaluated" ? result.passesNumericalGate : null,
    automaticPromotionAllowed: false }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Comparison failed"); process.exitCode = 1; });

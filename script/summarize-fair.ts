import { readFile, writeFile } from "node:fs/promises";
import { summarizeEnsemble, compareEnsembles } from "../server/calculation/ensemble";
const input = process.argv[2] ?? "generated-artifacts/fair-reference/ensemble.json";
const candidate = JSON.parse(await readFile(input, "utf8"));
const summary = summarizeEnsemble(candidate);
const referencePath = process.argv[3];
const comparison = referencePath ? compareEnsembles(candidate, JSON.parse(await readFile(referencePath, "utf8"))) : null;
await writeFile("generated-artifacts/fair-reference/ensemble-summary.json", JSON.stringify({
  ...summary, comparison, independentReferenceProvenanceVerified: false,
}, null, 2));
console.log(JSON.stringify({ members: summary.members, headline: summary.headline, comparison,
  independentReferenceProvenanceVerified: false }, null, 2));

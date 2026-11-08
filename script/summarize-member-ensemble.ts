/** Offline processing of an explicit member bundle; no synthetic source fallback. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { summarizeMemberMetrics } from "../server/calculation/memberMetrics";
const source = process.argv[2];
if (!source) throw new Error("Usage: npx tsx script/summarize-member-ensemble.ts <member-bundle.json>");
const summary = summarizeMemberMetrics(JSON.parse(await readFile(source, "utf8")));
await mkdir("generated-artifacts/member-metrics", { recursive: true });
const output = `generated-artifacts/member-metrics/${summary.inputHash}.json`;
await writeFile(output, JSON.stringify(summary));
console.log(JSON.stringify({ output, inputHash: summary.inputHash, members: summary.members.length,
  temperature: summary.temperature.headline, ghgNetZero: summary.ghgNetZero,
  co2NetZero: summary.co2NetZero, physicalValidation: false }, null, 2));

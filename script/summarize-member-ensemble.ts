/** Offline processing of an explicit member bundle; no synthetic source fallback. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { summarizeMemberMetrics } from "../server/calculation/memberMetrics";
import { checkMemberConvergence } from "../server/calculation/memberConvergence";
const source = process.argv[2];
if (!source) throw new Error("Usage: npx tsx script/summarize-member-ensemble.ts <member-bundle.json>");
const bundle = JSON.parse(await readFile(source, "utf8"));
const summary = summarizeMemberMetrics(bundle);
await mkdir("generated-artifacts/member-metrics", { recursive: true });
const output = `generated-artifacts/member-metrics/${summary.inputHash}.json`;
await writeFile(output, JSON.stringify(summary));
const emissionsTolerance = process.argv[3];
if (emissionsTolerance !== undefined) {
  const indexes = new Map<string, number>(bundle.memberIds.map((id: string, i: number) => [id, i]));
  const convergence = checkMemberConvergence({
    manifestId: summary.inputHash, emissionsToleranceGtCO2e: Number(emissionsTolerance),
    members: summary.members.map(m => {
      const i = indexes.get(m.id)!;
      return { id: m.id, temperature2100C: bundle.temperature[76][i],
        emissions2050GtCO2e: bundle.ghgGtCO2e[26][i], emissions2100GtCO2e: bundle.ghgGtCO2e[76][i],
        durableGhgZero: m.durableGhgZero, durableCo2Zero: m.durableCo2Zero };
    }),
  });
  await writeFile(`generated-artifacts/member-metrics/${summary.inputHash}-convergence.json`, JSON.stringify(convergence));
}
console.log(JSON.stringify({ output, inputHash: summary.inputHash, members: summary.members.length,
  temperature: summary.temperature.headline, ghgNetZero: summary.ghgNetZero,
  co2NetZero: summary.co2NetZero, physicalValidation: false }, null, 2));

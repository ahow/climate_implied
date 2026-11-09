/**
 * npx tsx script/analyze-member-ensemble.ts input.json output.json
 * Input: {manifestId, emissionsToleranceGtCO2e, ensemble:{baseline,memberIds,
 * years,temperature,ghgGtCO2e,co2Gt}}. Tolerance must be fixed before evaluation.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeMemberEnsemble } from "../server/calculation/memberAnalysis";

const [source, target] = process.argv.slice(2);
if (!source || !target || !resolve(target).startsWith(resolve("generated-artifacts") + "/"))
  throw new Error("Supply input JSON and a new output path under generated-artifacts");
const result = analyzeMemberEnsemble(JSON.parse(await readFile(source, "utf8")));
await writeFile(target, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ target, convergence: result.convergence, productionEligible: false }));
if (result.convergence.status !== "evaluated" || !result.convergence.result.passed) process.exitCode = 2;

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { exactMemberAttribution } from "../server/calculation/memberAttribution";

const directory = resolve(process.argv[2] ?? "");
if (!directory.startsWith(resolve("generated-artifacts") + "/"))
  throw new Error("Supply a private completed coalition directory");
const provenance = JSON.parse(await readFile(`${directory}/provenance.json`, "utf8"));
if (provenance.complete !== true || provenance.productionEligible !== false)
  throw new Error("Incomplete or mislabelled control run");
const bytes = await readFile(`${directory}/coalitions.json`, "utf8");
const input = JSON.parse(bytes);
if (input.groups.length !== 6 || input.coalitions.length !== 64 || input.memberIds.length !== 841)
  throw new Error("All six-region paired climate controls required");
const result = exactMemberAttribution(input);
// Interpolate quantiles of paired member contributions, never subtract marginals.
function quantile(values: number[], q: number) {
  const sorted = [...values].sort((a, b) => a - b), at = (sorted.length - 1) * q;
  return sorted[Math.floor(at)] * (1 - at % 1) + sorted[Math.ceil(at)] * (at % 1);
}
const report = { ...result, provenance, sourceSha256: createHash("sha256").update(bytes).digest("hex"),
  regionalP10P50P90C: result.contributions.map(c => ({ region: c.group,
    values: [.1, .5, .9].map(q => quantile(c.values, q)) })),
  pairedChangeP10P50P90C: [.1, .5, .9].map(q => quantile(result.change, q)),
  productionEligible: false,
  limitation: "Constant-input accounting control against removal of inventoried regional emissions and land-use flux after 2024; neither calibrated policy attribution nor causal responsibility" };
const text = JSON.stringify(report, null, 2) + "\n";
const file = `${directory}/attribution-${createHash("sha256").update(text).digest("hex")}.json`;
try { await writeFile(file, text, { flag: "wx" }); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(file, "utf8") !== text) throw error;
}
console.log(JSON.stringify({ file, members: result.memberIds.length, maxResidual: result.maxResidual,
  pairedChangeP10P50P90C: report.pairedChangeP10P50P90C, regions: report.regionalP10P50P90C,
  productionEligible: false }, null, 2));

/**
 * npx tsx script/run-regional-ensemble.ts inventory.json joint-parameters.json output-directory
 * Joint parameters: {seed,members,parameterVersion,evidence,rows:[{id,scenarios:[{region,scenario}]}]}
 * Inputs must be supplied explicitly. No illustrative/calibrated fallback.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import { createGzip } from "node:zlib";
import { once } from "node:events";
import { finished } from "node:stream/promises";
import { resolve, join } from "node:path";
import { sampleRegionalDrivers } from "../server/calculation/regionalSampling";
import { projectRegionalMember } from "../server/calculation/regionalEngine";
import { contentHash } from "../server/calculation/analysisManifest";

const [inventoryFile, parametersFile, directory] = process.argv.slice(2);
if (!inventoryFile || !parametersFile || !directory)
  throw new Error("Supply inventory, joint parameters and a new output directory");
const allowed = resolve("generated-artifacts") + "/";
if (!resolve(directory).startsWith(allowed)) throw new Error("Generated output must stay under generated-artifacts");
const inventory = JSON.parse(await readFile(inventoryFile, "utf8"));
const parameters = JSON.parse(await readFile(parametersFile, "utf8"));
const sampling = sampleRegionalDrivers(parameters);
const parameterRows = new Map<string, any>(parameters.rows.map((r: any) => [r.id, r]));
// Refuse an existing directory: no overwrite of archived results or partial runs.
await mkdir(directory, { recursive: false });
const run = { inventoryHash: contentHash(inventory), sampling,
  claim: "conditional supplied-parameter regional emissions; not calibrated forecast",
  climateResponse: "not-run", productionEligible: false };
await writeFile(join(directory, "inputs.json"), JSON.stringify(run, null, 2), { flag: "wx" });
const gzip = createGzip(), file = createWriteStream(join(directory, "members.jsonl.gz"), { flags: "wx" });
gzip.pipe(file);
file.on("error", error => gzip.destroy(error));
const hash = createHash("sha256");
const failures: Array<{ id: string; parameterRowId: string; reason: string }> = [];
const milestones: Array<{ id: string; emissions2050GtCO2e: number; emissions2100GtCO2e: number }> = [];
try {
  for (const member of sampling.members) {
    let result: ReturnType<typeof projectRegionalMember>;
    try {
      result = projectRegionalMember({ inventoryId: run.inventoryHash, memberId: member.id,
        cells: inventory.cells, scenarios: parameterRows.get(member.parameterRowId).scenarios });
    } catch (error) {
      failures.push({ ...member, reason: error instanceof Error ? error.message : "Invalid member" });
      continue; // Rejected draws are recorded, never replaced or silently clipped.
    }
    const line = JSON.stringify(result) + "\n";
    hash.update(line);
    if (!gzip.write(line)) await once(gzip, "drain");
    milestones.push({ id: member.id, emissions2050GtCO2e: result.global[26].reportingGtCO2e,
      emissions2100GtCO2e: result.global[76].reportingGtCO2e });
  }
  gzip.end();
  await finished(file);
} catch (error) {
  gzip.destroy(); file.destroy();
  throw error;
}
const result = { ...run, requestedMembers: sampling.members.length, acceptedMembers: milestones.length,
  rejectedMembers: failures.length, failures, milestones, membersSha256: hash.digest("hex"),
  complete: failures.length === 0 };
await writeFile(join(directory, "result.json"), JSON.stringify(result, null, 2), { flag: "wx" });
console.log(JSON.stringify({ directory, accepted: milestones.length, rejected: failures.length, hash: result.membersSha256 }));
if (failures.length) process.exitCode = 2;

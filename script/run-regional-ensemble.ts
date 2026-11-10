/**
 * Registered retained driver members:
 * node --import tsx script/run-regional-ensemble.ts --mode sensitivity
 *   --registry retained-adoption-paired-1 --driver all --members 256 --seed 20261110 --output generated-artifacts/new-run
 * Registered native members (explicitly pinned local operator inputs):
 * --mode sensitivity --registry native-regional --registry-file registry.json
 *   --registry-sha256 SHA256 --inventory inventory.json --output generated-artifacts/new-run
 * Preserved unregistered comparator, only through explicit diagnostic command:
 * npx tsx script/run-regional-ensemble.ts legacy-diagnostic inventory.json joint-parameters.json output-directory
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
import { z } from "zod";
import {
  consumeRetainedAdoption, consumeRegionalParameterRegistry, driverUseSchema,
  retainedAdoptionParameterRegistry, PINNED_ADOPTION_REGISTRY,
} from "../server/calculation/driverParameterRegistry";

function outputDirectory(path: string) {
  if (!resolve(path).startsWith(resolve("generated-artifacts") + "/"))
    throw new Error("Generated output must stay under generated-artifacts");
  return path;
}
function registeredOptions(args: string[]) {
  const options: Record<string, string> = {};
  const allowed = new Set(["mode", "registry", "driver", "members", "seed", "output",
    "inventory", "registry-file", "registry-sha256"]);
  if (args.length % 2) throw new Error("Registered mode requires explicit --key value pairs");
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].slice(2);
    if (!args[i].startsWith("--") || !allowed.has(key) || options[key] !== undefined)
      throw new Error(`Unknown or duplicate registered CLI option: ${args[i]}`);
    options[key] = args[i + 1];
  }
  return {
    mode: driverUseSchema.parse(options.mode),
    registry: z.enum([PINNED_ADOPTION_REGISTRY.id, "native-regional"]).parse(options.registry),
    directory: outputDirectory(z.string().min(1).parse(options.output)),
    seed: z.coerce.number().int().min(0).max(4294967295).parse(options.seed ?? "20261110"),
    members: z.coerce.number().int().min(2).max(10000).parse(options.members ?? "256"),
    driver: options.driver ?? "all", inventory: options.inventory,
    registryFile: options["registry-file"], registrySha256: options["registry-sha256"],
  };
}
async function writeMembers(directory: string, members: unknown[]) {
  const gzip = createGzip(), file = createWriteStream(join(directory, "members.jsonl.gz"), { flags: "wx" });
  gzip.pipe(file);
  file.on("error", error => gzip.destroy(error));
  const hash = createHash("sha256");
  try {
    for (const member of members) {
      const line = JSON.stringify(member) + "\n";
      hash.update(line);
      if (!gzip.write(line)) await once(gzip, "drain");
    }
    gzip.end();
    await finished(file);
  } catch (error) { gzip.destroy(); file.destroy(); throw error; }
  return hash.digest("hex");
}
async function runRegistered(args: string[]) {
  const x = registeredOptions(args);
  if (x.registry === PINNED_ADOPTION_REGISTRY.id) {
    if (x.registryFile || x.registrySha256 || x.inventory)
      throw new Error("Retained registry accepts no caller file paths or source overrides");
    const registry = await retainedAdoptionParameterRegistry();
    const entries = x.driver === "all" ? registry.entries : registry.entries.filter(e => e.evidence.id === x.driver);
    if (!entries.length) throw new Error(`No registered Stage5 distribution for driver: ${x.driver}; central use unavailable`);
    // Resolve/gate every selected actual consumer before creating any artifacts.
    const results = [];
    for (const e of entries) results.push(await consumeRetainedAdoption({
      driverId: e.evidence.id, use: x.mode, members: x.members, seed: x.seed, years: [2024, 2030, 2050, 2100],
    }));
    await mkdir(x.directory, { recursive: false });
    const membersSha256 = await writeMembers(x.directory, results.flatMap(r => r.members.map(m => ({
      registryId: x.registry, registryHash: r.registryHash, distributionHash: r.distributionHash,
      driverId: r.driverId, years: r.years, ...m,
    }))));
    const result = { entryPoint: "script/run-regional-ensemble.ts", registryId: x.registry,
      registryHash: registry.registryHash, pinnedRegistryHash: PINNED_ADOPTION_REGISTRY.sha256,
      use: x.mode, seed: x.seed, membersPerDriver: x.members, acceptedMembers: results.length * x.members,
      actualConsumer: "consumeRetainedAdoption/logistic-generation-share",
      membersSha256, complete: true, productionEligible: false, climateResponse: "not-run",
      claim: "registered Stage5 driver sensitivity member paths; not native emissions or calibrated climate forecast",
      distributions: results.map(r => ({ driverId: r.driverId, status: r.status,
        distributionHash: r.distributionHash, outputHash: r.outputHash, years: r.years })) };
    await writeFile(join(x.directory, "result.json"), JSON.stringify(result, null, 2), { flag: "wx" });
    console.log(JSON.stringify({ directory: x.directory, ...result }));
    return;
  }
  // No real accepted six-region joint registry has been retained/pinned. Do not
  // manufacture central inputs from adoption shares or caller-provided claims.
  if (x.mode === "central")
    throw new Error("Central Stage5 native consumption unavailable: no accepted pinned real six-region joint registry");
  if (x.driver !== "all") throw new Error("Native registry consumes complete joint rows, not individual driver substitutions");
  const registryFile = z.string().min(1).parse(x.registryFile);
  const registrySha256 = z.string().regex(/^[a-f0-9]{64}$/).parse(x.registrySha256);
  const bytes = await readFile(registryFile);
  if (createHash("sha256").update(bytes).digest("hex") !== registrySha256)
    throw new Error("Pinned native registry file hash mismatch");
  const inventory = JSON.parse(await readFile(z.string().min(1).parse(x.inventory), "utf8"));
  const run = await consumeRegionalParameterRegistry({
    registry: JSON.parse(bytes.toString("utf8")), cells: inventory.cells, inventoryId: contentHash(inventory),
    seed: x.seed, members: x.members, use: x.mode,
  });
  await mkdir(x.directory, { recursive: false });
  const membersSha256 = await writeMembers(x.directory, run.members);
  const result = { ...run, members: undefined, entryPoint: "script/run-regional-ensemble.ts",
    pinnedRegistryFileSha256: registrySha256, membersSha256, acceptedMembers: run.members.length, complete: true };
  await writeFile(join(x.directory, "result.json"), JSON.stringify(result, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ directory: x.directory, registryHash: run.registryHash,
    acceptedMembers: run.members.length, membersSha256, productionEligible: false }));
}

async function runLegacy(args: string[]) {
if (args.length !== 3) throw new Error("legacy-diagnostic requires exactly three positional inputs; central/sensitivity flags are forbidden");
const [inventoryFile, parametersFile, directory] = args;
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
  use: "legacy-diagnostic",
  registryConsumption: "legacy-unregistered-supplied-parameter-diagnostic",
  centralConsumptionAllowed: false,
  registeredConsumer: "run-regional-ensemble --mode sensitivity --registry native-regional (source-verified gate)",
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
}

try {
  const args = process.argv.slice(2);
  if (args[0] === "legacy-diagnostic") await runLegacy(args.slice(1));
  else await runRegistered(args);
} catch (error) {
  console.error(JSON.stringify({ entryPoint: "script/run-regional-ensemble.ts",
    status: "rejected", error: error instanceof Error ? error.message : String(error),
    productionEligible: false }));
  process.exitCode = 1;
}

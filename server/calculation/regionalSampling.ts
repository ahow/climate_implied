import { z } from "zod";
import { SeededRandom } from "./random";
import { contentHash } from "./analysisManifest";

const schema = z.object({
  seed: z.number().int().min(0).max(4294967295),
  members: z.number().int().min(2).max(10000),
  parameterVersion: z.string().min(1), evidence: z.array(z.string().min(1)).min(1),
  rows: z.array(z.object({
    id: z.string().min(1),
    scenarios: z.array(z.object({
      region: z.string().min(1), scenario: z.record(z.unknown()),
    }).strict()).min(1).max(6),
  }).strict()).min(1).max(10000),
}).strict();

/** Resample complete joint parameter rows, never independent marginal columns.
 * Input provenance and calibration still require separate scientific assessment.
 */
export function sampleRegionalDrivers(input: unknown) {
  const x = schema.parse(input);
  const rows = x.rows.map(r => ({ ...r,
    scenarios: [...r.scenarios].sort((a, b) => a.region.localeCompare(b.region)),
  })).sort((a, b) => a.id.localeCompare(b.id));
  if (new Set(rows.map(r => r.id)).size !== rows.length ||
      rows.some(r => new Set(r.scenarios.map(s => s.region)).size !== r.scenarios.length))
    throw new Error("Unique parameter-row and regional identities required");
  const regions = rows[0].scenarios.map(s => s.region);
  if (rows.some(r => r.scenarios.length !== regions.length ||
      r.scenarios.some((s, i) => s.region !== regions[i])))
    throw new Error("Every joint parameter row must cover the same regional accounts");
  // A bootstrap row cannot silently omit a driver present in another draw.
  // Physical validation remains the projection engine's responsibility.
  for (let i = 0; i < regions.length; i++) {
    const keys = Object.keys(rows[0].scenarios[i].scenario).sort();
    if (rows.some(r => {
      const actual = Object.keys(r.scenarios[i].scenario).sort();
      return actual.length !== keys.length || actual.some((key, j) => key !== keys[j]);
    })) throw new Error(`Joint parameter rows have inconsistent driver coverage for ${regions[i]}`);
  }
  const parameterHash = contentHash({ parameterVersion: x.parameterVersion, evidence: x.evidence, rows });
  const rng = new SeededRandom(x.seed);
  const members = Array.from({ length: x.members }, (_, index) => ({
    id: `m${String(index).padStart(5, "0")}`,
    parameterRowId: rows[Math.floor(rng.next() * rows.length)].id,
  }));
  return { parameterHash, parameterVersion: x.parameterVersion, seed: x.seed, members,
    method: "uniform-bootstrap-of-complete-joint-parameter-rows",
    productionEligible: false, claim: "sampling supplied joint uncertainty; not validation of parameter evidence" };
}

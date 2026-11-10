import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { SeededRandom } from "./random";
import { projectRegionalMember } from "./regionalEngine";
import { sampleRegionalDrivers } from "./regionalSampling";
import { constantScenario } from "./emissionsCandidate";

export const driverUseSchema = z.enum(["central", "sensitivity"]);
export type DriverUse = z.infer<typeof driverUseSchema>;
export const PINNED_ADOPTION_REGISTRY = {
  id: "retained-adoption-paired-1",
  sha256: "ceb61f6fc2fcfef7700fabae8e24a03a35f1318aea446d85c9319ca4149afc83",
} as const;
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.object({ path: z.string().min(1), sha256: hash }).strict();
const evaluation = z.object({
  candidateMAE: z.number().finite().nonnegative(),
  persistenceMAE: z.number().finite().nonnegative(),
  linearMAE: z.number().finite().nonnegative(),
  metricUnit: z.string().min(1),
  trainingYears: z.array(z.number().int()).min(1),
  evaluationYears: z.array(z.number().int()).min(1),
  protocol: source,
}).strict();
const independentBasis = z.object({
  kind: z.enum(["physical", "empirical"]),
  explanation: z.string().trim().min(40),
  applicability: z.string().trim().min(20),
  independentOfFailedFit: z.literal(true),
  evidence: z.array(source).min(1),
  review: source,
}).strict();
export const parameterEvidenceSchema = z.object({
  id: z.string().min(1), version: z.string().min(1),
  status: z.enum(["calibrated", "prior", "sensitivity-only"]),
  definition: z.string().min(1), unit: z.string().min(1),
  geography: z.string().min(1),
  sources: z.array(source).min(1),
  evaluation: evaluation.optional(),
  calibrationAcceptance: source.optional(),
  independentCentralBasis: independentBasis.optional(),
  consumerPaths: z.array(z.string().min(1)).min(1).optional(),
}).strict();
export type ParameterEvidence = z.infer<typeof parameterEvidenceSchema>;

/** Status is never an override for a failed frozen comparison. A prior is not
 * calibrated, and a point-metric winner alone is not calibration acceptance. */
export function assertParameterUse(input: unknown, use: "central" | "sensitivity") {
  const p = parameterEvidenceSchema.parse(input);
  const e = p.evaluation;
  if (e && (new Set(e.trainingYears).size !== e.trainingYears.length ||
      new Set(e.evaluationYears).size !== e.evaluationYears.length ||
      e.trainingYears.some(y => e.evaluationYears.includes(y)) ||
      Math.max(...e.trainingYears) >= Math.min(...e.evaluationYears)))
    throw new Error(`Invalid frozen windows: ${p.id}`);
  const beatsBoth = e ? e.candidateMAE < Math.min(e.persistenceMAE, e.linearMAE) : false;
  if (p.status === "calibrated" && (!beatsBoth || !p.calibrationAcceptance))
    throw new Error(`Calibration requires both baselines and independent acceptance: ${p.id}`);
  if (e && !beatsBoth && p.status !== "sensitivity-only")
    throw new Error(`Failed baseline cannot be relabelled as calibrated/prior: ${p.id}`);
  if (use === "central" && !(p.status === "calibrated" || p.independentCentralBasis))
    throw new Error(`Central consumption blocked without independent physical/empirical basis: ${p.id}`);
  return p;
}

/** Verify actual retained bytes, not a truthy provenance flag. Never fetch. */
export async function verifyParameterSources(p: ParameterEvidence) {
  const references = [...p.sources, ...(p.evaluation ? [p.evaluation.protocol] : []),
    ...(p.calibrationAcceptance ? [p.calibrationAcceptance] : []),
    ...(p.independentCentralBasis ? [...p.independentCentralBasis.evidence, p.independentCentralBasis.review] : [])];
  for (const ref of references) {
    const actual = createHash("sha256").update(await readFile(ref.path)).digest("hex");
    if (actual !== ref.sha256) throw new Error(`Retained source hash mismatch: ${ref.path}`);
  }
}

export const RETAINED_ADOPTION_INPUTS = {
  report: { path: "generated-artifacts/driver-calibration/uncertainty.json",
    sha256: "6c00e7c77d5cea0cd5122e0f09916a14aeefdec5b18e2deee51cbd694adac2ed" },
  observations: { path: "generated-artifacts/driver-calibration/owid-energy-data.csv",
    sha256: "266f2e2baad7975351bc9bb4aa061d22b1da9fe4c47d51d2ac6071e01e171f76" },
  calibration: { path: "docs/Driver_Calibration_Protocol.md",
    sha256: "d136eea3cdaa11cdda978f734bef5680da9f912102ad0b91024251a8f9eb5c67" },
  uncertainty: { path: "docs/Driver_Uncertainty_Protocol.md",
    sha256: "3842cc749f8c62da75181e21c8c4c5bb87702af77c75543de0aa31359dfae0e1" },
} as const;
const adoptionRow = z.object({
  entity: z.string(), technology: z.enum(["solar_share_elec", "wind_share_elec"]),
  parameters: z.object({ saturation: z.literal(1) }).passthrough(),
  pairedBootstrapParameters: z.array(z.tuple([z.number().finite(), z.number().finite()])).length(1000),
  maePercentagePoints: z.object({
    logistic: z.number().finite().nonnegative(), persistence: z.number().finite().nonnegative(),
    linearTrend: z.number().finite().nonnegative(),
  }), beatsBothBaselines: z.boolean(), centralModelEligible: z.literal(false),
}).passthrough();
export type AdoptionDistribution = {
  evidence: ParameterEvidence;
  model: "logistic-generation-share";
  epoch: 2010; saturation: 1;
  pairedDraws: [number, number][];
  distributionHash: string;
};

/** Load the already frozen paired residual-bootstrap distributions. No fits,
 * downloads, release selection, or synthetic regional substitution occur. */
export async function retainedAdoptionParameterRegistry() {
  for (const ref of Object.values(RETAINED_ADOPTION_INPUTS)) {
    const actual = createHash("sha256").update(await readFile(ref.path)).digest("hex");
    if (actual !== ref.sha256) throw new Error(`Retained source hash mismatch: ${ref.path}`);
  }
  const report = JSON.parse(await readFile(RETAINED_ADOPTION_INPUTS.report.path, "utf8"));
  if (report.sourceSha256 !== RETAINED_ADOPTION_INPUTS.observations.sha256 ||
      report.protocolHashes?.[RETAINED_ADOPTION_INPUTS.calibration.path] !== RETAINED_ADOPTION_INPUTS.calibration.sha256 ||
      report.protocolHashes?.[RETAINED_ADOPTION_INPUTS.uncertainty.path] !== RETAINED_ADOPTION_INPUTS.uncertainty.sha256)
    throw new Error("Adoption report/source/protocol linkage mismatch");
  const rows = z.array(adoptionRow).length(10).parse(report.results);
  const entries: AdoptionDistribution[] = rows.map(r => {
    const m = r.maePercentagePoints;
    if (r.beatsBothBaselines !== (m.logistic < Math.min(m.persistence, m.linearTrend)))
      throw new Error("Frozen adoption baseline decision mismatch");
    const evidence: ParameterEvidence = {
      id: `${r.entity}:${r.technology}`, version: "retained-adoption-paired-1",
      status: "sensitivity-only",
      definition: `${r.technology}: electricity generation share, not capacity or an abatement coefficient`,
      unit: "fraction of electricity generation", geography: r.entity,
      sources: [RETAINED_ADOPTION_INPUTS.report, RETAINED_ADOPTION_INPUTS.observations, RETAINED_ADOPTION_INPUTS.uncertainty],
      evaluation: { candidateMAE: m.logistic, persistenceMAE: m.persistence, linearMAE: m.linearTrend,
        metricUnit: "percentage points", trainingYears: Array.from({ length: 9 }, (_, i) => 2010 + i),
        evaluationYears: Array.from({ length: 6 }, (_, i) => 2019 + i), protocol: RETAINED_ADOPTION_INPUTS.calibration },
    };
    const distribution = { evidence, model: "logistic-generation-share" as const,
      epoch: 2010 as const, saturation: 1 as const, pairedDraws: r.pairedBootstrapParameters };
    return { ...distribution, distributionHash: contentHash(distribution) };
  }).sort((a, b) => a.evidence.id.localeCompare(b.evidence.id));
  if (new Set(entries.map(e => e.evidence.id)).size !== 10) throw new Error("Duplicate adoption distribution");
  const registryHash = contentHash(entries);
  if (registryHash !== PINNED_ADOPTION_REGISTRY.sha256) throw new Error("Pinned adoption registry hash mismatch");
  return { version: "stage4-source-linked-1", registryHash, entries,
    productionEligible: false as const,
    limitations: ["All retained adoption distributions remain sensitivity-only, including the EU solar point winner",
      "Paired intercept/slope dependence retained; cross-technology/regional dependence not identified",
      "Generation shares cannot be silently mapped to regional capacity, EV, policy or emissions coefficients"] };
}

/** Actual Stage 5 adoption-path consumption, not a centralModelEligible flag.
 * One complete paired draw is consumed per member. This is explicitly separate
 * from native emissions: no unsupported share-to-capacity bridge is invented. */
export async function consumeRetainedAdoption(input: {
  driverId: string; seed: number; members: number; years: number[]; use: "central" | "sensitivity";
}) {
  const x = z.object({ driverId: z.string(), seed: z.number().int().min(0).max(4294967295),
    members: z.number().int().min(2).max(10000),
    years: z.array(z.number().int().min(2010).max(2100)).min(1).max(91),
    use: z.enum(["central", "sensitivity"]) }).strict().parse(input);
  if (x.years.some((y, i) => i > 0 && y <= x.years[i - 1])) throw new Error("Ordered unique years required");
  const registry = await retainedAdoptionParameterRegistry();
  const entry = registry.entries.find(e => e.evidence.id === x.driverId);
  if (!entry) throw new Error(`No retained compatible distribution: ${x.driverId}`);
  assertParameterUse(entry.evidence, x.use);
  const rng = new SeededRandom(x.seed);
  const members = Array.from({ length: x.members }, (_, i) => {
    const drawIndex = Math.floor(rng.next() * entry.pairedDraws.length);
    const [intercept, slope] = entry.pairedDraws[drawIndex];
    return { id: `m${String(i).padStart(5, "0")}`, drawIndex,
      shares: x.years.map(year => 1 / (1 + Math.exp(Math.max(-700, Math.min(700,
        -(intercept + slope * (year - entry.epoch))))))) };
  });
  const outputHash = contentHash({ years: x.years, members });
  return { registryHash: registry.registryHash, distributionHash: entry.distributionHash,
    driverId: x.driverId, status: entry.evidence.status, seed: x.seed, years: x.years, members, outputHash,
    actualConsumer: "consumeRetainedAdoption/logistic-generation-share",
    productionEligible: false, claim: "bounded sensitivity adoption paths; not emissions or a calibrated forecast" };
}

// Every scenario leaf (including optional nested measures/pathways) must have
// an evidence binding. Names are descriptive; all other leaves are parameters.
export function scenarioParameterLeaves(value: unknown, path = ""): string[] {
  if (value !== null && typeof value === "object")
    return Object.entries(value).flatMap(([key, v]) => scenarioParameterLeaves(v, path ? `${path}/${key}` : key)).sort();
  return path === "name" ? [] : [path];
}
function assertKnownScenarioParameters(scenario: Record<string, unknown>) {
  const allowed = new Set([...Object.keys(constantScenario), "nuclearGenerationTWh", "sectorPathways", "measures"]);
  if (Object.keys(scenario).some(k => !allowed.has(k)))
    throw new Error("Unknown scenario parameter has no actual engine consumer");
  for (const [sector, p] of Object.entries((scenario.sectorPathways ?? {}) as Record<string, object>)) {
    if (!["power", "transport", "industry", "buildings", "agriculture", "other", "land"].includes(sector) ||
      !p || Object.keys(p).some(k => !["annualActivityGrowth", "residualIntensityImprovement", "trendEndYear"].includes(k)))
      throw new Error("Unknown sector pathway parameter");
  }
  for (const m of (scenario.measures ?? []) as Record<string, unknown>[]) {
    if (Object.keys(m).some(k => !["id", "mechanism", "sectorCodes", "gases", "coverage",
      "implementation", "maximumReduction", "startYear", "deliveryYears", "evidence"].includes(k)))
      throw new Error("Unknown scoped measure parameter");
  }
}
const regionalRegistrySchema = z.object({
  version: z.string().min(1),
  evidence: z.array(parameterEvidenceSchema).min(1),
  bindings: z.array(z.object({
    region: z.string().min(1), path: z.string().min(1), evidenceId: z.string().min(1),
  }).strict()).min(1),
  rows: z.array(z.object({ id: z.string().min(1),
    scenarios: z.array(z.object({ region: z.string().min(1), scenario: z.record(z.unknown()) }).strict()).min(1),
  }).strict()).min(1),
}).strict();

/** Parent integration boundary for the actual native regional Stage 5 engine.
 * Joint rows are the versioned distribution. There is no independent marginal
 * resampling, unregistered scenario override, or default driver substitution. */
export async function consumeRegionalParameterRegistry(input: {
  registry: unknown; seed: number; members: number; use: "central" | "sensitivity";
  inventoryId: string; cells: unknown; endYear?: number;
}) {
  const use = z.enum(["central", "sensitivity"]).parse(input.use);
  const parsed = regionalRegistrySchema.parse(input.registry);
  const r = { ...parsed,
    evidence: [...parsed.evidence].sort((a, b) => a.id.localeCompare(b.id)),
    bindings: [...parsed.bindings].sort((a, b) => `${a.region}:${a.path}`.localeCompare(`${b.region}:${b.path}`)),
    rows: parsed.rows.map(row => ({ ...row,
      scenarios: [...row.scenarios].sort((a, b) => a.region.localeCompare(b.region)),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  };
  const evidence = new Map(r.evidence.map(e => [e.id, e]));
  if (evidence.size !== r.evidence.length) throw new Error("Unique parameter evidence identities required");
  const bindings = new Map(r.bindings.map(b => [`${b.region}:${b.path}`, b]));
  if (bindings.size !== r.bindings.length) throw new Error("Duplicate consumer bindings");
  const dimensions = r.rows[0].scenarios.flatMap(s =>
    scenarioParameterLeaves(s.scenario).map(path => `${s.region}:${path}`)).sort();
  if (dimensions.length !== bindings.size || dimensions.some(k => !bindings.has(k)))
    throw new Error("Every actual scenario parameter requires an exact consumer binding; no unused bindings");
  const usedEvidence = new Set(r.bindings.map(b => b.evidenceId));
  if (usedEvidence.size !== evidence.size) throw new Error("Unconsumed parameter evidence");
  for (const b of r.bindings) {
    const p = evidence.get(b.evidenceId);
    if (!p) throw new Error(`Unknown parameter evidence: ${b.evidenceId}`);
    if (p.geography !== b.region) throw new Error(`Incompatible parameter geography: ${b.evidenceId}`);
    if (!p.consumerPaths?.includes(b.path)) throw new Error(`Unapproved consumer parameter path: ${b.evidenceId}:${b.path}`);
    assertParameterUse(p, use);
  }
  for (const p of Array.from(evidence.values())) await verifyParameterSources(p);
  for (const row of r.rows) {
    row.scenarios.forEach(s => assertKnownScenarioParameters(s.scenario));
    const actual = row.scenarios.flatMap(s =>
      scenarioParameterLeaves(s.scenario).map(path => `${s.region}:${path}`)).sort();
    if (contentHash(actual) !== contentHash(dimensions))
      throw new Error("All joint rows must have complete identical nested driver coverage");
  }
  const registryHash = contentHash(r);
  const sampling = sampleRegionalDrivers({ seed: input.seed, members: input.members,
    parameterVersion: r.version, evidence: [registryHash], rows: r.rows });
  const rows = new Map(r.rows.map(row => [row.id, row]));
  const members = sampling.members.map(member => {
    const row = rows.get(member.parameterRowId)!;
    const result = projectRegionalMember({ inventoryId: input.inventoryId, memberId: member.id,
      cells: input.cells, scenarios: row.scenarios }, input.endYear ?? 2100);
    return { parameterRowId: row.id, consumedScenarioHash: contentHash(row.scenarios), result };
  });
  const selectedRowIds = new Set(sampling.members.map(m => m.parameterRowId));
  const consumedRows = r.rows.filter(row => selectedRowIds.has(row.id)).map(row => ({
    parameterRowId: row.id,
    parameters: r.bindings.map(b => {
      const scenario = row.scenarios.find(s => s.region === b.region)!.scenario;
      const value = b.path.split("/").reduce<unknown>((v, key) =>
        (v as Record<string, unknown>)[key], scenario);
      return { ...b, consumedValueHash: contentHash(value) };
    }),
  }));
  return { registryHash, sampling, members, consumedRows,
    consumption: r.bindings.map(b => ({ ...b, status: evidence.get(b.evidenceId)!.status,
      consumer: "projectRegionalMember/projectInventoryEmissions",
      independentlyJustifiedCentralException: use === "central" && evidence.get(b.evidenceId)!.status !== "calibrated" })),
    use, productionEligible: false,
    claim: "registered conditional native emissions; not calibrated climate or convergence acceptance" };
}

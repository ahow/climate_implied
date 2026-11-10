import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { pairedCompanyGap } from "./pairedCompanyGap";

const timestamp = z.string().datetime();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const finite = z.number().finite();
export const specificationSchema = z.object({
  model: z.string().min(1), peer: z.string().min(1), target: z.enum(["next-month", "12-month"]),
}).strict();
const artifactSchema = z.object({
  hash: digest, originUri: z.string().min(1), capturedAt: timestamp,
  availableAt: timestamp, vintage: z.enum(["original", "revised", "engineering-fixture"]),
  payload: z.unknown(),
}).strict();
const securitySchema = z.object({
  companyId: z.string().min(1), numericId: z.number().int().positive(), sector: z.string().min(1),
  marketCap: finite.positive(), informationAvailableAt: timestamp,
  pair: z.unknown(), controls: z.array(finite).length(7),
  baselineGrowth: finite, transitionDemand: finite, carbonDrag: finite, intensity: finite,
  executionPrice: finite.positive(), executionFx: finite.positive(),
  endPrice: finite.nonnegative(), endFx: finite.positive(), splitRatio: finite.positive(),
  // Cash distributions and terminal proceeds are in local currency per ORIGINAL share.
  dividends: finite.nonnegative(), terminalProceeds: finite.nonnegative(),
  lifecycle: z.enum(["continuing", "delisted", "unexplained-terminal"]),
  borrowAvailable: z.boolean().nullable(), borrowAnnualRate: finite.nonnegative().nullable(),
  assumedBorrowAnnualRate: finite.nonnegative(),
  sourceHashes: z.array(digest).min(1),
}).strict();
const periodSchema = z.object({
  specification: specificationSchema, origin: timestamp, executionAt: timestamp, endAt: timestamp,
  outcomeAvailableAt: timestamp, universeHash: digest, expectedCompanyIds: z.array(z.string().min(1)).min(2),
  securities: z.array(securitySchema),
  cashAnnualRate: finite, financingAnnualRate: finite.nonnegative(),
  factors: z.object({
    currency: z.string(), geography: z.string(), sourceHashes: z.array(digest).min(1),
    regionalDeveloped: z.array(finite).min(1), workbookUniverse: z.array(finite).min(1),
  }).strict(),
}).strict();
export const corpusSchema = z.object({
  mode: z.enum(["engineering-fixture", "revised-history", "point-in-time"]),
  dataEnd: timestamp, artifacts: z.array(artifactSchema), periods: z.array(periodSchema),
}).strict();
export type ResearchCorpus = z.infer<typeof corpusSchema>;
export type ResearchPeriod = ResearchCorpus["periods"][number];
export const specificationKey = (s: z.infer<typeof specificationSchema>) => JSON.stringify([s.model, s.peer, s.target]);

/** Offline only. Hashes bind retained payloads, not authenticity or original publication. */
export function adaptPairedResearchCorpus(input: unknown) {
  const corpus = corpusSchema.parse(input);
  const artifacts = new Map(corpus.artifacts.map(a => [a.hash, a]));
  if (artifacts.size !== corpus.artifacts.length) throw new Error("Duplicate corpus artifact");
  for (const a of Array.from(artifacts.values())) {
    if (contentHash(a.payload) !== a.hash) throw new Error("Corpus payload hash mismatch");
    if (corpus.mode !== "engineering-fixture" && a.vintage === "engineering-fixture")
      throw new Error("Fixture cannot enter historical corpus");
  }
  const keys = new Set<string>();
  const resolve = (hash: string) => {
    const artifact = artifacts.get(hash);
    if (!artifact) throw new Error(`Unresolved retained artifact ${hash}`);
    return artifact;
  };
  const periods = corpus.periods.map(p => {
    const key = `${specificationKey(p.specification)}:${p.origin}`;
    if (keys.has(key)) throw new Error("Duplicate origin/specification");
    keys.add(key);
    if (!(Date.parse(p.origin) < Date.parse(p.executionAt) && Date.parse(p.executionAt) < Date.parse(p.endAt)) ||
        Date.parse(p.outcomeAvailableAt) < Date.parse(p.endAt))
      throw new Error("Execution must be strictly after signal; outcome must be complete");
    if (new Set(p.expectedCompanyIds).size !== p.expectedCompanyIds.length ||
        new Set(p.securities.map(s => s.companyId)).size !== p.securities.length ||
        new Set(p.securities.map(s => s.numericId)).size !== p.securities.length)
      throw new Error("Duplicate universe member");
    const universe = resolve(p.universeHash);
    if (contentHash(universe.payload) !== contentHash([...p.expectedCompanyIds].sort()))
      throw new Error("Universe manifest must bind complete sorted membership");
    if (Date.parse(universe.availableAt) > Date.parse(p.origin)) throw new Error("Future universe");
    const missing = p.expectedCompanyIds.filter(id => !p.securities.some(s => s.companyId === id));
    if (p.securities.some(s => !p.expectedCompanyIds.includes(s.companyId))) throw new Error("Undeclared universe member");
    const pairs = p.securities.map(s => {
      if (Date.parse(s.informationAvailableAt) > Date.parse(p.origin)) throw new Error("Future security inputs");
      const pair = pairedCompanyGap(s.pair);
      if (pair.companyId !== s.companyId || pair.origin !== p.origin) throw new Error("Pair identity/origin mismatch");
      const raw = s.pair as { projectionManifest: string; valuationManifest: string;
        projectionDefinition: unknown; valuationDefinition: unknown;
        members: Array<{ id: string; projectedGrowth: number | null; impliedGrowth: number | null }> };
      for (const kind of ["projection", "valuation"] as const) {
        const payload = {
          companyId: s.companyId, model: p.specification.model, origin: p.origin,
          definition: raw[kind === "projection" ? "projectionDefinition" : "valuationDefinition"],
          members: raw.members.map(m => ({ id: m.id, growth: kind === "projection" ? m.projectedGrowth : m.impliedGrowth }))
            .sort((a, b) => a.id.localeCompare(b.id)),
        };
        if (contentHash(resolve(raw[kind === "projection" ? "projectionManifest" : "valuationManifest"]).payload) !== contentHash(payload))
          throw new Error("Paired values/model not bound to retained archive");
      }
      if (p.specification.peer === "sector" && pair.peer !== s.sector) throw new Error("Sector peer mismatch");
      for (const hash of [raw.projectionManifest, raw.valuationManifest, p.universeHash]) {
        const a = resolve(hash);
        if (Date.parse(a.availableAt) > Date.parse(p.origin)) throw new Error("Future origin artifact");
        if (corpus.mode === "point-in-time" &&
            (a.vintage !== "original" || Date.parse(a.capturedAt) > Date.parse(p.origin)))
          throw new Error("Point-in-time requires original retained origin archives, not current substitutions");
      }
      s.sourceHashes.forEach(resolve);
      return pair;
    });
    p.factors.sourceHashes.forEach(resolve);
    return { ...p, pairs, missing, complete: Date.parse(p.outcomeAvailableAt) <= Date.parse(corpus.dataEnd) };
  });
  return { ...corpus, periods, corpusHash: contentHash(corpus), authenticityVerified: false as const };
}

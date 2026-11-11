import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { pairedCompanyGap } from "./pairedCompanyGap";
import { sleeveMarksSchema } from "./pairedResearchSleeves";
import { eventBookSchema } from "./pairedResearchEvents";
import { portfolioStreamsSchema } from "./pairedResearchFrequency";

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
  longOnlyInputs: z.object({
    eligible: z.boolean(), liquidity: finite.nonnegative(), availableAt: timestamp,
    sourceHashes: z.array(digest).min(1),
  }).strict().optional(),
  sourceHashes: z.array(digest).min(1),
}).strict();
const periodSchema = z.object({
  specification: specificationSchema, origin: timestamp, executionAt: timestamp, endAt: timestamp,
  outcomeAvailableAt: timestamp, universeHash: digest, expectedCompanyIds: z.array(z.string().min(1)).min(2),
  trackBManifestHash: digest.nullable().optional(),
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
  sleeveMarks: sleeveMarksSchema.optional(),
  eventBooks: z.array(eventBookSchema).optional(),
  portfolioStreams: portfolioStreamsSchema.optional(),
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
  const resolveWithinCutoff = (hash: string) => {
    const a = resolve(hash);
    if (Date.parse(a.availableAt) > Date.parse(corpus.dataEnd) || Date.parse(a.capturedAt) > Date.parse(corpus.dataEnd))
      throw new Error("Artifact beyond corpus cutoff");
    return a;
  };
  // Stream receipts are optional only for the old, unbound contract. Once
  // supplied, all used monthly evidence must be retained by the cutoff, even
  // when later family inference is unavailable for a missing origin.
  if (new Set((corpus.portfolioStreams ?? []).map(s => s.id)).size !== (corpus.portfolioStreams ?? []).length)
    throw new Error("Duplicate portfolio stream");
  for (const stream of corpus.portfolioStreams ?? []) {
    stream.entries.forEach(e => resolveWithinCutoff(e.sourceHash));
    for (const m of stream.marks) {
      if (Date.parse(m.at) > Date.parse(corpus.dataEnd)) throw new Error("Future monthly sleeve mark");
      m.sleeves.forEach(s => s.sourceHashes.forEach(resolveWithinCutoff));
      if (m.reserveAccrual) resolveWithinCutoff(m.reserveAccrual.sourceHash);
    }
    for (const m of stream.months) {
      if (Date.parse(m.toAt) > Date.parse(corpus.dataEnd)) throw new Error("Future portfolio month");
      [m.sourceHash, m.factors.regionalSourceHash, m.factors.workbookSourceHash, m.factors.riskFreeSourceHash].forEach(resolveWithinCutoff);
      m.books.forEach(b => {
        resolveWithinCutoff(b.book.coverageSourceHash);
        b.book.events.forEach(e => resolveWithinCutoff(e.sourceHash));
      });
    }
  }
  for (const mark of corpus.sleeveMarks ?? []) {
    if (Date.parse(mark.at) > Date.parse(corpus.dataEnd)) throw new Error("Future sleeve mark");
    mark.sleeves.forEach(s => s.sourceHashes.forEach(resolveWithinCutoff));
    if (mark.reserveAccrual) {
      const a = resolveWithinCutoff(mark.reserveAccrual.sourceHash);
      if (Date.parse(a.availableAt) > Date.parse(mark.reserveAccrual.fromAt))
        throw new Error("Future reserve interest source");
    }
    if (corpus.mode !== "engineering-fixture") {
      for (const s of mark.sleeves) {
        const { sourceHashes, ...values } = s;
        if (!sourceHashes.some(h => contentHash(resolve(h).payload) === contentHash({ at: mark.at, ...values })))
          throw new Error("Sleeve marks not bound to retained payload");
      }
      if (mark.reserveInterest !== 0) throw new Error("Historical reserve interest requires reviewed dated cash-rate lineage");
    }
  }
  for (const book of corpus.eventBooks ?? []) {
    if (Date.parse(book.endAt) > Date.parse(corpus.dataEnd)) throw new Error("Future event book");
    resolveWithinCutoff(book.coverageSourceHash);
    book.events.forEach(e => resolveWithinCutoff(e.sourceHash));
    if (corpus.mode !== "engineering-fixture") {
      const { coverageSourceHash, ...values } = book;
      if (contentHash(resolve(coverageSourceHash).payload) !== contentHash(values))
        throw new Error("Event book not bound to retained coverage payload");
    }
  }
  const periods = corpus.periods.map(p => {
    const complete = Date.parse(p.outcomeAvailableAt) <= Date.parse(corpus.dataEnd);
    // Future/incomplete outcomes remain coverage failures, not a reason to
    // invalidate earlier dates. Every artifact USED by a complete date must
    // nevertheless be retained by the cutoff. Origin-relative gates below
    // apply to incomplete dates too, so future signal inputs never slip through.
    if (complete) {
      [p.universeHash, ...p.factors.sourceHashes, ...p.securities.flatMap(s => {
        const pair = s.pair as { projectionManifest: string; valuationManifest: string };
        return [pair.projectionManifest, pair.valuationManifest, ...s.sourceHashes,
          ...(s.longOnlyInputs?.sourceHashes ?? [])];
      })].forEach(resolveWithinCutoff);
    }
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
      if (s.longOnlyInputs) {
        if (Date.parse(s.longOnlyInputs.availableAt) > Date.parse(p.origin)) throw new Error("Future eligibility/liquidity");
        s.longOnlyInputs.sourceHashes.forEach(h => {
          const a = resolve(h);
          if (Date.parse(a.availableAt) > Date.parse(p.origin)) throw new Error("Future liquidity source");
        });
      }
      return pair;
    });
    p.factors.sourceHashes.forEach(resolve);
    return { ...p, pairs, missing, complete: Date.parse(p.outcomeAvailableAt) <= Date.parse(corpus.dataEnd) };
  });
  return { ...corpus, periods, corpusHash: contentHash(corpus), authenticityVerified: false as const };
}

/** Select from retained candidate periods only; never manufacture historical
 * origins from current issuers. Rejections are explicit and origin-specific.
 * This is contract eligibility, not independent authenticity review. */
export function assembleOriginalResearchCorpus(input: unknown) {
  const corpus = corpusSchema.parse(input);
  const accepted: ResearchPeriod[] = [];
  const rejected: Array<{ origin: string; specification: string; reason: string }> = [];
  for (const period of corpus.periods) {
    try {
      const pairHashes = period.securities.flatMap(s => {
        const raw = s.pair as { projectionManifest?: string; valuationManifest?: string };
        return [raw.projectionManifest, raw.valuationManifest];
      });
      const originHashes = [period.universeHash, ...pairHashes];
      const allHashes = [...originHashes, ...period.securities.flatMap(s => s.sourceHashes), ...period.factors.sourceHashes];
      const artifacts = corpus.artifacts.filter(a => allHashes.includes(a.hash));
      if (artifacts.some(a => a.vintage !== "original")) throw new Error("Non-original/unknown vintage");
      // Mixed non-pair source lists cannot certify which fields were known at
      // origin. Require an original retained input bundle explicitly binding them.
      for (const s of period.securities) {
        const payload = { companyId: s.companyId, origin: period.origin, marketCap: s.marketCap,
          sector: s.sector, controls: s.controls, baselineGrowth: s.baselineGrowth,
          transitionDemand: s.transitionDemand, carbonDrag: s.carbonDrag, intensity: s.intensity };
        if (!artifacts.some(a => s.sourceHashes.includes(a.hash) && a.hash === contentHash(payload) &&
            Date.parse(a.availableAt) <= Date.parse(period.origin) && Date.parse(a.capturedAt) <= Date.parse(period.origin)))
          throw new Error(`Missing original origin-bound covariates: ${s.companyId}`);
      }
      adaptPairedResearchCorpus({ mode: "point-in-time", dataEnd: corpus.dataEnd, artifacts, periods: [period] });
      accepted.push(period);
    } catch (e) {
      rejected.push({ origin: period.origin, specification: specificationKey(period.specification), reason: (e as Error).message });
    }
  }
  return { accepted, rejected, efficacy: "WITHHELD", authenticityVerified: false as const };
}

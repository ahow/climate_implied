import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { corpusSchema, specificationKey, specificationSchema } from "./pairedResearchCorpus";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const time = z.string().datetime();
const periodManifest = z.object({
  contract: z.literal("track-b-period-manifest-1"), specification: specificationSchema,
  origin: time, informationCutoff: time, stage9ManifestHash: digest,
  filings: z.array(z.object({ companyId: z.string().min(1), artifactHash: digest }).strict()),
}).strict();
const stage9Manifest = z.object({
  contract: z.literal("stage9-retrospective-lineage-1"), specification: specificationSchema,
  origin: time, informationCutoff: time,
  classification: z.enum(["retrospective-simulation-on-verified-past-inputs", "revised-history", "unverified"]),
  parameterFitThrough: time, parameterFitManifestHash: digest, inputHashes: z.array(digest).min(1),
  projectionManifestHashes: z.array(digest).min(1),
}).strict();
const fitManifest = z.object({
  contract: z.literal("stage9-parameter-fit-1"), model: z.string().min(1),
  fittedThrough: time, parametersHash: digest, inputHashes: z.array(digest).min(1),
}).strict();
const filingManifest = z.object({
  contract: z.literal("original-filing-lineage-1"), companyId: z.string().min(1),
  original: z.boolean(), restated: z.boolean(), publishedAt: time, fiscalEnd: time,
  valuationManifestHash: digest, sourceDocumentHash: digest,
}).strict();
type Gate = "period" | "stage9" | "original-filings" | "authenticity";
export type TrackBReason = { gate: Gate; code: string; companyId: string | null; artifactHash: string | null; detail: string };

/** Pure admission assessment, not another research estimator. Hashes authenticate
 * supplied bytes only. No independent review trust store exists in this engine;
 * even a complete caller-supplied manifest remains unavailable for Track B. */
export function assessTrackBAdmission(protocolInput: unknown, expectedProtocolHash: string, corpusInput: unknown) {
  const protocol = z.object({
    frozenAt: time, specifications: z.array(specificationSchema).min(1),
    expectedOrigins: z.array(time).min(1),
    trackBPolicy: z.object({ filingLagDays: z.number().int().nonnegative() }).strict().optional(),
  }).passthrough().parse(protocolInput);
  if (contentHash(protocolInput) !== expectedProtocolHash) throw new Error("Track B frozen protocol hash mismatch");
  if (new Set(protocol.specifications.map(specificationKey)).size !== protocol.specifications.length ||
    new Set(protocol.expectedOrigins.map(Date.parse)).size !== protocol.expectedOrigins.length)
    throw new Error("Duplicate Track B frozen specification/origin");
  const corpus = corpusSchema.parse(corpusInput);
  if (corpus.periods.some(p => !protocol.specifications.some(s => specificationKey(s) === specificationKey(p.specification)) ||
    !protocol.expectedOrigins.some(origin => Date.parse(origin) === Date.parse(p.origin))))
    throw new Error("Track B corpus period outside frozen specification/origin domain");
  const corpusHash = contentHash(corpus);
  const artifacts = new Map(corpus.artifacts.map(a => [a.hash, a]));
  const periods = protocol.specifications.flatMap(specification => protocol.expectedOrigins.map(origin => {
    const reasons: TrackBReason[] = [];
    const add = (gate: Gate, code: string, detail: string, companyId: string | null = null, artifactHash: string | null = null) =>
      reasons.push({ gate, code, companyId, artifactHash, detail });
    const matching = corpus.periods.filter(p => specificationKey(p.specification) === specificationKey(specification) && p.origin === origin);
    const period = matching.length === 1 ? matching[0] : null;
    let stage9ReviewHash: string | null = null;
    const filingReviewHashes = new Map<string, string>();
    const filingDocumentReviewHashes = new Map<string, string>();
    if (matching.length !== 1) add("period", matching.length ? "duplicate-period" : "missing-period",
      matching.length ? "Duplicate frozen specification/origin; no survivor selected" : "No retained period at this frozen specification/origin");
    if (corpus.mode !== "point-in-time") add("period", "not-point-in-time-corpus", `Corpus mode ${corpus.mode} cannot establish original-at-origin evidence`);
    if (Date.parse(protocol.frozenAt) >= Date.parse(origin))
      add("period", "protocol-not-frozen-before-origin", "Frozen protocol timestamp must precede this origin");
    if (!protocol.trackBPolicy) add("original-filings", "filing-lag-not-frozen", "No filing lag was declared in the hashed frozen protocol; no arbitrary lag is substituted");
    const resolve = (hash: string, gate: Gate, companyId: string | null = null) => {
      const artifact = artifacts.get(hash);
      if (!artifact) { add(gate, "missing-artifact", "Referenced retained artifact is absent", companyId, hash); return null; }
      if (corpus.artifacts.filter(a => a.hash === hash).length !== 1) {
        add(gate, "duplicate-artifact", "Duplicate hash entry cannot establish one immutable receipt", companyId, hash); return null;
      }
      let actualHash: string;
      try { actualHash = contentHash(artifact.payload); }
      catch {
        add(gate, "noncanonical-payload", "Retained payload is not explicit finite canonical JSON", companyId, hash); return null;
      }
      if (actualHash !== hash) {
        add(gate, "payload-hash-mismatch", "Retained payload differs from its referenced canonical SHA256", companyId, hash); return null;
      }
      if (artifact.vintage !== "original")
        add(gate, "non-original-artifact", `Retained vintage ${artifact.vintage} is not an original source`, companyId, hash);
      if (Date.parse(artifact.availableAt) > Date.parse(origin))
        add(gate, "artifact-after-origin", "Artifact was not available by this origin cutoff", companyId, hash);
      if (Date.parse(artifact.capturedAt) > Date.parse(origin))
        add(gate, "not-retained-at-origin", "Artifact capture was after this origin; no current substitution", companyId, hash);
      if ([artifact.capturedAt, artifact.availableAt].some(t => Date.parse(t) > Date.parse(corpus.dataEnd)))
        add(gate, "artifact-after-corpus-cutoff", "Used receipt extends beyond retained corpus cutoff", companyId, hash);
      return artifact;
    };
    if (period) {
      if (!(Date.parse(period.origin) < Date.parse(period.executionAt) && Date.parse(period.executionAt) < Date.parse(period.endAt)))
        add("period", "invalid-execution-boundary", "Execution must follow origin and precede end; same-close execution is unavailable");
      if (Date.parse(period.outcomeAvailableAt) > Date.parse(corpus.dataEnd))
        add("period", "incomplete-outcome", "This period outcome was not available by the retained corpus cutoff");
      if (Date.parse(period.outcomeAvailableAt) < Date.parse(period.endAt))
        add("period", "outcome-before-period-end", "Outcome availability precedes the holding period end");
      if (new Set(period.expectedCompanyIds).size !== period.expectedCompanyIds.length ||
        new Set(period.securities.map(s => s.companyId)).size !== period.securities.length)
        add("period", "duplicate-universe-company", "Duplicate declared or supplied company; no arbitrary survivor selected");
      if (period.securities.some(s => !period.expectedCompanyIds.includes(s.companyId)))
        add("period", "undeclared-company", "Security lies outside the frozen origin universe");
      const universe = resolve(period.universeHash, "period");
      if (universe && contentHash(universe.payload) !== contentHash([...period.expectedCompanyIds].sort()))
        add("period", "universe-membership-mismatch", "Origin universe receipt does not bind exact sorted expected membership", null, period.universeHash);
      for (const id of period.expectedCompanyIds)
        if (!period.securities.some(s => s.companyId === id))
          add("period", "missing-company", "Expected company is absent; no survivor-only Track B", id);
      const root = period.trackBManifestHash ? resolve(period.trackBManifestHash, "period") : null;
      if (!period.trackBManifestHash) add("period", "missing-period-manifest", "No immutable Track B period manifest was supplied");
      const parsed = root && periodManifest.safeParse(root.payload);
      if (root && parsed && !parsed.success)
        add("period", "invalid-period-manifest", "Period manifest does not satisfy exact track-b-period-manifest-1 schema", null, root.hash);
      const manifest = parsed && parsed.success ? parsed.data : null;
      stage9ReviewHash = manifest?.stage9ManifestHash ?? null;
      if (manifest && (manifest.origin !== origin || manifest.informationCutoff !== origin ||
        specificationKey(manifest.specification) !== specificationKey(specification)))
        add("period", "period-manifest-identity-mismatch", "Manifest origin/specification/cutoff must equal this exact frozen period", null, root!.hash);
      if (!manifest) add("stage9", "missing-stage9-lineage", "No bound Stage9 retrospective-input/parameter lineage manifest");
      if (manifest) {
        const source = resolve(manifest.stage9ManifestHash, "stage9");
        const parsedStage9 = source && stage9Manifest.safeParse(source.payload);
        if (!parsedStage9 || !parsedStage9.success) add("stage9", "invalid-stage9-manifest", "Missing or malformed Stage9 retrospective lineage", null, manifest.stage9ManifestHash);
        else {
          const stage9 = parsedStage9.data;
          if (stage9.origin !== origin || stage9.informationCutoff !== origin ||
            specificationKey(stage9.specification) !== specificationKey(specification))
            add("stage9", "stage9-identity-mismatch", "Stage9 model/specification/origin/cutoff differs from this period", null, source!.hash);
          if (stage9.classification !== "retrospective-simulation-on-verified-past-inputs")
            add("stage9", "stage9-not-retrospective", `Stage9 classification ${stage9.classification} is not retrospective simulation on verified past inputs`, null, source!.hash);
          if (Date.parse(stage9.parameterFitThrough) > Date.parse(origin))
            add("stage9", "future-parameter-fit", "Stage4/Stage9 parameters were fitted using information after origin", null, source!.hash);
          const fitSource = resolve(stage9.parameterFitManifestHash, "stage9");
          const parsedFit = fitSource && fitManifest.safeParse(fitSource.payload);
          if (!parsedFit || !parsedFit.success) add("stage9", "invalid-parameter-fit-manifest", "No retained, schema-valid parameter-fit receipt", null, stage9.parameterFitManifestHash);
          else {
            const fit = parsedFit.data;
            if (fit.model !== specification.model || fit.fittedThrough !== stage9.parameterFitThrough)
              add("stage9", "parameter-fit-identity-mismatch", "Fit model/date differs from this exact Stage9 lineage", null, fitSource!.hash);
            for (const hash of [fit.parametersHash, ...fit.inputHashes]) resolve(hash, "stage9");
          }
          const expected = period.securities.map(s => s.pair && typeof s.pair === "object"
            ? (s.pair as { projectionManifest?: string }).projectionManifest : undefined);
          if (expected.some(h => !h || !/^[a-f0-9]{64}$/.test(h)) ||
            contentHash([...stage9.projectionManifestHashes].sort()) !== contentHash(expected.filter((h): h is string => !!h).sort()))
            add("stage9", "projection-manifest-domain-mismatch", "Stage9 receipt must bind every and only this period's projection manifest", null, source!.hash);
          for (const hash of [...stage9.inputHashes, ...stage9.projectionManifestHashes]) resolve(hash, "stage9");
        }
      }
      for (const security of period.securities) {
        if (Date.parse(security.informationAvailableAt) > Date.parse(origin))
          add("original-filings", "future-security-information", "Security input availability exceeds origin", security.companyId);
        const entries = manifest?.filings.filter(f => f.companyId === security.companyId) ?? [];
        if (entries.length !== 1) {
          add("original-filings", entries.length ? "duplicate-filing-binding" : "missing-original-filing",
            "Exactly one original-filing lineage binding is required for this company/period", security.companyId);
          continue;
        }
        const entry = entries[0], source = resolve(entry.artifactHash, "original-filings", security.companyId);
        filingReviewHashes.set(security.companyId, entry.artifactHash);
        if (!security.sourceHashes.includes(entry.artifactHash))
          add("original-filings", "filing-not-used-by-security", "Filing hash is not in the security's retained input domain", security.companyId, entry.artifactHash);
        const parsedFiling = source && filingManifest.safeParse(source.payload);
        if (!parsedFiling || !parsedFiling.success) {
          add("original-filings", "invalid-filing-manifest", "Missing or malformed original-filing-lineage-1 payload", security.companyId, entry.artifactHash); continue;
        }
        const filing = parsedFiling.data;
        filingDocumentReviewHashes.set(security.companyId, filing.sourceDocumentHash);
        resolve(filing.sourceDocumentHash, "original-filings", security.companyId);
        if (!security.sourceHashes.includes(filing.sourceDocumentHash))
          add("original-filings", "filing-document-not-used", "Original document hash is not in the actual security input domain", security.companyId, filing.sourceDocumentHash);
        const valuationHash = security.pair && typeof security.pair === "object"
          ? (security.pair as { valuationManifest?: string }).valuationManifest : undefined;
        if (filing.companyId !== security.companyId || filing.valuationManifestHash !== valuationHash)
          add("original-filings", "filing-valuation-identity-mismatch", "Filing issuer/valuation-manifest binding does not equal the actual security pair", security.companyId, entry.artifactHash);
        if (!filing.original || filing.restated)
          add("original-filings", "restated-or-non-original-filing", "Only original, not restated, fundamentals are admitted", security.companyId, entry.artifactHash);
        if (Date.parse(filing.fiscalEnd) > Date.parse(filing.publishedAt))
          add("original-filings", "invalid-filing-dates", "Fiscal end is after publication timestamp", security.companyId, entry.artifactHash);
        if (Date.parse(filing.publishedAt) > Date.parse(origin))
          add("original-filings", "filing-published-after-origin", "Original filing publication is after information cutoff", security.companyId, entry.artifactHash);
        if (source && Date.parse(source.availableAt) < Date.parse(filing.publishedAt))
          add("original-filings", "receipt-before-filing-publication", "Receipt claims availability before the original filing publication", security.companyId, entry.artifactHash);
        if (protocol.trackBPolicy && Date.parse(filing.publishedAt) + protocol.trackBPolicy.filingLagDays * 86400000 > Date.parse(origin))
          add("original-filings", "filing-lag-after-origin", "Frozen publication lag has not elapsed by information cutoff", security.companyId, entry.artifactHash);
      }
      if (manifest?.filings.some(f => !period.expectedCompanyIds.includes(f.companyId)))
        add("original-filings", "undeclared-filing-company", "Filing manifest includes companies outside the frozen universe");
    }
    // A valid self-hash and a caller's 'verified' classification cannot sign off
    // either conjunct. No authenticated historical review is provisioned here.
    add("authenticity", "stage9-independent-review-unavailable",
      "No authenticated independent review of this exact period's referenced Stage9 input/parameter lineage", null, stage9ReviewHash);
    if (period) for (const id of period.expectedCompanyIds) {
      add("authenticity", "original-filing-independent-review-unavailable",
        "No authenticated independent review of this company's original filing at this period cutoff", id, filingReviewHashes.get(id) ?? null);
      const documentHash = filingDocumentReviewHashes.get(id);
      if (documentHash) add("authenticity", "original-source-document-independent-review-unavailable",
        "Underlying retained original-filing source document has no authenticated independent review at this period cutoff", id, documentHash);
    }
    else add("authenticity", "original-filing-independent-review-unavailable",
      "Absent period has no original filing sources or authenticated independent review");
    return {
      specification: specificationKey(specification), origin, informationCutoff: origin,
      executionAt: period?.executionAt ?? null, endAt: period?.endAt ?? null,
      manifestHash: period?.trackBManifestHash ?? null,
      stage9ContractSatisfied: !reasons.some(r => r.gate === "stage9" || r.gate === "period"),
      originalFilingsContractSatisfied: !reasons.some(r => r.gate === "original-filings" || r.gate === "period"),
      status: "unavailable" as const, result: null, reasons,
    };
  }));
  return {
    contract: "track-b-period-admission-1" as const, protocolHash: expectedProtocolHash, corpusHash,
    corpusCutoff: corpus.dataEnd, periods, scientificAcceptance: false as const, investmentEvidence: false as const,
    authenticityVerified: false as const,
    limitation: "Per-period Stage9 AND original-filing contract checks; no authenticated independent Stage9/original-source review store is provisioned. Public disclosure authorization does not satisfy those gates. Synthetic/contract-passing records never establish historical efficacy.",
  };
}

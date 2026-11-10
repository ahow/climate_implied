import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { filingFactsSchema, marketReferenceSchema } from "./companyFilingPair";
import { calculateCompanyFullCashflowCase, pairCompanyFullCashflowCase } from "./companyFullCashflowCase";
import { primaryCommonSharesSchema, reviewCompanyShareReference } from "./companyShareEvidence";
import { originalNominalEquityAssessment } from "./reverseValuation";

const ids = z.array(z.string().min(1)).min(1);
const number = z.number().finite();
const evidenceSchema = z.object({
  id: z.string().min(1), kind: z.enum(["primary-disclosure", "frozen-analyst-assumption"]),
  symbol: z.string(), cik: z.string().regex(/^\d{10}$/), security: z.string(),
  url: z.string().url(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.string().datetime(), availableAt: z.string().datetime().nullable(),
  publicationBasis: z.enum(["verified-publication", "signed-report-only", "unknown", "actual-assumption-freeze"]),
  rationale: z.string().trim().min(1), licence: z.string().trim().min(1),
  dependencies: z.array(z.string()),
  claims: z.array(z.object({ path: z.string().startsWith("/"),
    valueHash: z.string().regex(/^[a-f0-9]{64}$/), locator: z.string().min(1) }).strict()),
}).strict();
const terminalTopics = ["discountRate", "terminalGrowth", "continuationGrowthAtYear5",
  "maintenanceAndGrowthReinvestment", "workingCapital", "cashTax", "financing",
  "nonCommonClaims", "policyExpiryAndEligibility"] as const;
const terminalSchema = z.object({
  model: z.literal("explicit-fcfe-ten-year-fade"), rateBasis: z.literal("nominal"),
  discountRate: number.positive().max(1), terminalGrowth: number.min(0).max(.2),
  continuationGrowthAtYear5: number.gt(-1).max(1),
  sustainableYearFiveFcfe: number.positive(),
  basisByTopic: z.object(Object.fromEntries(terminalTopics.map(k => [k, z.string().trim().min(1)])) as Record<
    typeof terminalTopics[number], z.ZodString>).strict(),
  evidenceByTopic: z.object(Object.fromEntries(terminalTopics.map(k => [k, ids])) as Record<
    typeof terminalTopics[number], typeof ids>).strict(),
}).strict();
export const sourcedCompanyCaseSchema = z.object({
  version: z.literal("sourced-company-case-1"),
  facts: filingFactsSchema, referenceAt: z.string().datetime(), frozenAt: z.string().datetime(),
  assessmentMode: z.enum(["prospective-conditional", "historical-point-in-time"]).optional(),
  informationCutoff: z.string().datetime().optional(),
  evidence: z.array(evidenceSchema), financialBasisEvidenceIds: z.array(z.string().min(1)),
  financialCashflow: z.object({
    engineInput: z.record(z.unknown()),
    bindings: z.record(ids),
  }).strict().nullable(),
  // Coverage is (referenceDate, throughDate], ending immediately before the
  // first full forecast year. Even a zero stub needs explicit evidence.
  stub: z.object({
    cashBasis: z.literal("FCFE-whole-issuer-common-equity"), currency: z.literal("USD"),
    rationale: z.string().trim().min(1),
    throughDate: z.string().date(),
    cashFlows: z.array(z.object({ date: z.string().date(), fcfe: number, evidenceIds: ids }).strict()),
    completenessEvidenceIds: ids,
  }).strict().nullable(),
  terminal: terminalSchema.nullable(),
  market: z.object({
    reference: marketReferenceSchema, quoteAt: z.string().datetime(), quoteEvidenceIds: ids,
    shareEvidenceIds: ids,
    primaryShares: primaryCommonSharesSchema,
  }).strict().nullable(),
  unresolvedClaims: z.array(z.string()),
}).strict();

/** Evidence is value-bound, identity-specific and cutoff-checked, never approved
 * by this adapter. Missing evidence is a dependency, not an assumed zero.
 * Existing FY2024 facts and separate FY2025 schedules cannot silently merge. */
export function assessSourcedCompanyCase(input: unknown) {
  const x = sourcedCompanyCaseSchema.parse(input), gaps = [...x.unresolvedClaims];
  const referenceDate = x.referenceAt.slice(0, 10);
  const informationCutoff = x.informationCutoff ?? x.referenceAt;
  const registry = new Map(x.evidence.map(e => [e.id, e]));
  if (registry.size !== x.evidence.length) throw new Error("Duplicate evidence identity");
  if (Date.parse(x.frozenAt) > Date.parse(informationCutoff) ||
      Date.parse(informationCutoff) > Date.parse(x.referenceAt))
    gaps.push("Information cutoff must include actual freeze and not exceed model as-of; never backdate historical evidence.");
  if (x.facts.documentDate > informationCutoff.slice(0, 10))
    gaps.push("Selected financial disclosure follows reference.");
  const used = new Set<string>();
  const check = (references: string[], path?: string, value?: unknown, visiting = new Set<string>()) => {
    for (const id of references) {
      const e = registry.get(id);
      if (!e) { gaps.push(`Missing evidence: ${id}`); continue; }
      if (visiting.has(id)) throw new Error("Cyclic evidence dependencies");
      used.add(id);
      if (["symbol", "cik", "security"].some(k =>
        e[k as "symbol" | "cik" | "security"] !== x.facts[k as "symbol" | "cik" | "security"]))
        gaps.push(`Evidence ${id} issuer/class differs; no automatic ticker or successor join.`);
      if (e.availableAt === null || e.publicationBasis === "signed-report-only" || e.publicationBasis === "unknown")
        gaps.push(`Evidence ${id} public availability is not verified.`);
      if (e.availableAt && Date.parse(e.availableAt) > Date.parse(informationCutoff))
        gaps.push(`Evidence ${id} unavailable at reference.`);
      // Quotes may be retrieved after the already frozen operating assumptions.
      // Their publication still must precede the explicit market cutoff.
      if (!path?.startsWith("/market/") && Date.parse(e.capturedAt) > Date.parse(x.frozenAt))
        gaps.push(`Evidence ${id} captured after freeze.`);
      if (e.kind === "frozen-analyst-assumption" &&
          (e.publicationBasis !== "actual-assumption-freeze" || e.availableAt !== x.frozenAt))
        gaps.push(`Assumption ${id} needs its actual freeze timestamp.`);
      if (e.kind === "primary-disclosure" && e.publicationBasis === "actual-assumption-freeze")
        gaps.push(`Primary evidence ${id} cannot use assumption-freeze publication basis.`);
      if (path && !e.claims.some(c => c.path === path && c.valueHash === contentHash(value)))
        gaps.push(`Evidence ${id} does not bind ${path} to the supplied value.`);
      check(e.dependencies, undefined, undefined, new Set(Array.from(visiting).concat(id)));
    }
  };
  if (!x.financialBasisEvidenceIds.length) gaps.push("Missing selected financial-basis publication/content evidence.");
  check(x.financialBasisEvidenceIds, "/facts", x.facts);
  if (x.financialBasisEvidenceIds.some(id => {
    const e = registry.get(id);
    return e?.kind !== "primary-disclosure" || e.sha256 !== x.facts.sourceHash;
  })) gaps.push("Selected financial basis needs primary disclosure matching retained filing hash; no assumption substitution.");
  let ledger: ReturnType<typeof calculateCompanyFullCashflowCase> | null = null;
  if (x.financialCashflow === null) gaps.push("Missing issuer-wide five-year financial cash-flow schedule.");
  else {
    const f = x.financialCashflow, engine = f.engineInput;
    // Existing engine remains authoritative for ledger arithmetic and continuity.
    const terminal = x.terminal ? {
      discountRate: x.terminal.discountRate, terminalGrowth: x.terminal.terminalGrowth,
      continuationGrowthAtYear5: x.terminal.continuationGrowthAtYear5,
      terminalEvidenceIds: Array.from(new Set(Object.values(x.terminal.evidenceByTopic).flat())),
    } : {};
    for (const key of ["discountRate", "terminalGrowth", "continuationGrowthAtYear5"] as const)
      if (engine[key] !== undefined && x.terminal && engine[key] !== x.terminal[key])
        gaps.push(`Engine ${key} differs from sourced terminal contract.`);
    if (engine.stub !== undefined && contentHash(engine.stub) !== contentHash(x.stub))
      gaps.push("Engine stub differs from value-bound sourced stub.");
    ledger = calculateCompanyFullCashflowCase({ ...engine, ...terminal,
      ...(x.stub ? { stub: x.stub } : {}),
      informationContext: { mode: x.assessmentMode ?? "historical-point-in-time",
        modelAsOf: x.referenceAt, informationCutoff },
    });
    const s = ledger.specification;
    for (const e of s.evidence) {
      const archived = registry.get(e.id);
      if (!archived || archived.sha256 !== e.sha256 || archived.availableAt !== e.availableAt ||
          archived.kind !== e.kind)
        gaps.push(`Engine evidence ${e.id} differs from sourced registry.`);
      check([e.id]);
    }
    if (["symbol", "cik", "security", "currency"].some(k =>
      s[k as "symbol" | "cik" | "security" | "currency"] !== x.facts[k as "symbol" | "cik" | "security" | "currency"]))
      gaps.push("Financial cash schedule does not use the selected issuer/class basis.");
    if (s.referenceDate !== referenceDate || s.frozenAt !== x.frozenAt)
      gaps.push("Financial schedule reference/freeze differs from sourced contract.");
    const historicalFcfe = x.facts.operatingCashFlow - x.facts.capitalSpend +
      x.facts.debtProceeds - x.facts.debtRepayments;
    if (s.baseFcfe !== historicalFcfe)
      gaps.push("Financial base FCFE differs from selected FY2024 facts; separate FY2025 basis must remain distinct.");
    for (const [i, y] of Array.from(s.years.entries())) for (const [key, value] of Object.entries(y)) {
      if (typeof value !== "number") continue;
      const path = `/financialCashflow/years/${i}/${key}`, refs = f.bindings[path];
      if (!refs?.length) gaps.push(`Missing financial field evidence: ${path}`);
      else check(refs, path, value);
    }
    const basePath = "/financialCashflow/baseFcfe";
    if (!f.bindings[basePath]?.length) gaps.push(`Missing financial field evidence: ${basePath}`);
    else check(f.bindings[basePath], basePath, s.baseFcfe);
    gaps.push(...ledger.gaps);
    if (x.stub && x.stub.throughDate !== `${s.firstYear - 1}-12-31`)
      gaps.push("Stub does not cover through the day before the first full annual forecast.");
  }
  if (!x.stub) gaps.push("Missing explicit reference-to-first-full-year stub cash flows, including justified zero if applicable.");
  else {
    if (x.stub.throughDate < referenceDate) gaps.push("Stub end precedes reference.");
    check(x.stub.completenessEvidenceIds, "/stub", x.stub);
    let previous = referenceDate;
    for (const [i, row] of Array.from(x.stub.cashFlows.entries())) {
      if (row.date <= previous || row.date > x.stub.throughDate)
        gaps.push("Stub cash dates must be ordered, after reference, and inside covered period.");
      previous = row.date;
      check(row.evidenceIds, `/stub/cashFlows/${i}`, row);
    }
  }
  if (!x.terminal) gaps.push("Missing sustainable terminal/continuation evidence; five-year cash is not whole equity.");
  else {
    if (x.terminal.discountRate <= x.terminal.terminalGrowth)
      gaps.push("Terminal growth must be below nominal discount rate.");
    for (const topic of terminalTopics) {
      check(x.terminal.evidenceByTopic[topic],
        `/terminal/basisByTopic/${topic}`, x.terminal.basisByTopic[topic]);
      if (["discountRate", "terminalGrowth", "continuationGrowthAtYear5"].includes(topic))
        check(x.terminal.evidenceByTopic[topic], `/terminal/${topic}`, x.terminal[topic as "discountRate"]);
    }
    if (ledger && Math.abs(ledger.years[4].fcfe - x.terminal.sustainableYearFiveFcfe) > .01)
      gaps.push("Terminal anchor does not reconcile to explicit year-five FCFE.");
    if (ledger) for (const key of ["discountRate", "terminalGrowth", "continuationGrowthAtYear5"] as const) {
      const supplied = ledger.specification[key];
      if (supplied !== undefined && supplied !== x.terminal[key])
        gaps.push(`Engine ${key} differs from sourced terminal contract.`);
    }
    check(x.terminal.evidenceByTopic.maintenanceAndGrowthReinvestment,
      "/terminal/sustainableYearFiveFcfe", x.terminal.sustainableYearFiveFcfe);
  }
  if (!x.market) gaps.push("Missing authorized same-date quote and exact primary common shares.");
  else {
    const m = x.market, r = m.reference;
    if (r.referenceDate !== referenceDate || m.quoteAt.slice(0, 10) !== r.priceDate ||
        (x.assessmentMode !== "prospective-conditional" && m.quoteAt !== x.referenceAt) ||
        Date.parse(m.quoteAt) > Date.parse(informationCutoff))
      gaps.push("Quote observation differs from declared timing mode or exceeds information cutoff.");
    if (Date.parse(r.observedAt) < Date.parse(m.quoteAt))
      gaps.push("Quote retrieval precedes its observation timestamp; no backdated current quotes.");
    if (["symbol", "cik", "security", "currency"].some(k =>
      r[k as "symbol" | "cik" | "security" | "currency"] !== x.facts[k as "symbol" | "cik" | "security" | "currency"]))
      gaps.push("Market identity differs from selected financial basis; succession review required.");
    const shares = reviewCompanyShareReference(m.primaryShares, { ...r,
      informationCutoffDate: x.assessmentMode === "prospective-conditional" ? informationCutoff.slice(0, 10) : undefined });
    gaps.push(...shares.gaps);
    if (shares.shares !== r.shares || r.sharesDate !== r.priceDate ||
        (x.assessmentMode === "prospective-conditional" ? r.priceDate > referenceDate : r.priceDate !== referenceDate))
      gaps.push("Market reference must use exact same-date primary common shares, never marketCap/price.");
    check(m.quoteEvidenceIds, "/market/reference", r);
    check(m.shareEvidenceIds, "/market/primaryShares", m.primaryShares);
    if (m.quoteEvidenceIds.some(id => registry.get(id)?.kind !== "primary-disclosure" ||
        registry.get(id)?.sha256 !== r.sourceHash) ||
        m.shareEvidenceIds.some(id => registry.get(id)?.kind !== "primary-disclosure" ||
        registry.get(id)?.sha256 !== m.primaryShares.evidence.sha256))
      gaps.push("Quote and primary shares require matching retained observation hashes, not analyst assumptions.");
  }
  return { status: gaps.length ? "blocked" as const : "dependency-ready-conditional-case" as const,
    gaps: Array.from(new Set(gaps)), ledger, specification: x, usedEvidenceIds: Array.from(used).sort(),
    productionEligible: false, identityApproved: false, ownerApproved: false,
    actualMarketPairs: 0, completeApprovedIssuerCases: 0 };
}

/** Executes only after all source dependencies pass. Stub valuation belongs to
 * the explicit FCFE model, never to the separate original earnings model. */
export function pairSourcedCompanyCase(input: unknown) {
  const assessment = assessSourcedCompanyCase(input);
  if (assessment.status === "blocked" || !assessment.ledger || !assessment.specification.market)
    return { assessment, pairing: null };
  const m = assessment.specification.market;
  return { assessment, pairing: pairCompanyFullCashflowCase(assessment.ledger.specification, {
    ...m.reference, quoteAt: m.quoteAt, observedAt: m.reference.observedAt,
    datedReferenceReviewed: true,
  }) };
}

/** Dependency-ready original earnings/ROE adapter. It deliberately does NOT
 * substitute an FCFE anchor or an FPL allowed ROE for issuer-wide earnings/ROE.
 * Midyear calendar stub valuation is not supported by the original model. */
export function assessSourcedOriginalNominalCase(input: unknown, original: {
  baseEarnings: number; discountRate: number; returnOnEquity: number; stageOneGrowth: number;
  sharesBasis: "total-equity"; rateBasis: "nominal";
  returnOnEquityEvidence: string; discountRateEvidence: string;
}, bindings: Record<string, string[]>) {
  const assessment = assessSourcedCompanyCase(input), x = assessment.specification;
  const gaps = [...assessment.gaps];
  if (!x.referenceAt.slice(0, 10).endsWith("-12-31"))
    gaps.push("Original earnings model uses annual t=1 timing; explicit non-year-end stub integration remains required.");
  for (const [key, value] of Object.entries(original)) {
    const path = `/originalNominal/${key}`, refs = bindings[path];
    if (!refs?.length || refs.some(id => !x.evidence.some(e => e.id === id &&
      assessment.usedEvidenceIds.includes(id) &&
      (key !== "baseEarnings" || e.kind === "primary-disclosure") &&
      e.claims.some(c => c.path === path && c.valueHash === contentHash(value)))))
      gaps.push(`Missing independently bound original nominal evidence: ${path}`);
  }
  return { ...assessment, status: gaps.length ? "blocked" as const : "dependency-ready-conditional-case" as const,
    gaps, originalNominalAssessment: gaps.length ? null : originalNominalEquityAssessment(original),
    modelSeparation: "Original nominal 2.5–4% earnings/ROE assessment is not the retained 1–3% FCFE diagnostic." };
}

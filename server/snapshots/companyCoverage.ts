import { sql } from "drizzle-orm";
import { db } from "../db";
import { cvCompanies, cvTimeSeries } from "../../shared/schema";
import { loadSnapshot, resolveSnapshot, snapshotContext } from "./store";
import { overlayContext } from "./overlays";
import { companyCoverage, type CoverageReview } from "../calculation/companyCoverage";
import { snapshotSchema } from "../financialData/review";
import { contentHash } from "../calculation/analysisManifest";
import { resolveCompanySourceEvidence } from "../calculation/companySourceArchive";
import { projectCompanyMembers } from "../calculation/companyProjection";
import { rememberReportRelease } from "./reportMaterialContext";

/** Read-only complete journal scan; deliberately not the paginated review UI getter.
 * No locks, DDL, approval helpers, source staging, or mutation are invoked.
 */
type CoverageOptions = { observationDate?: string; informationCutoff: string; snapshotId?: string };
export async function getCompanyCoverage(options: CoverageOptions) {
  return db.transaction(tx => readCompanyCoverage(tx, options),
    { isolationLevel: "repeatable read", accessMode: "read only" });
}
async function readCompanyCoverage(connection: Pick<typeof db, "select" | "execute">, options: CoverageOptions) {
  if (!Number.isFinite(Date.parse(options.informationCutoff))) throw new Error("Explicit valid information cutoff required");
  options = { ...options, informationCutoff: new Date(options.informationCutoff).toISOString() };
  if (overlayContext.getStore()?.ids.length) throw new Error("Coverage reports baseline workbook only; overlays are not supported");
  const contextualHeader = snapshotContext.getStore();
  if (options.snapshotId && contextualHeader && contextualHeader.id !== options.snapshotId)
    throw new Error("Coverage workbook selection conflict");
  const header = options.snapshotId ? await resolveSnapshot(options.snapshotId) : contextualHeader;
  const current = header ? null : await loadCurrentCoverageWorkbook(connection, options);
  const workbook = header ? await loadSnapshot(header) : current!;
  const readiness = await connection.execute(sql`SELECT to_regclass('public.financial_reviews') IS NOT NULL AS financial,
    to_regclass('public.cv_analysis_snapshots') IS NOT NULL AND to_regclass('public.cv_analysis_chunks') IS NOT NULL AS operating`);
  if (!readiness.rows[0]?.financial || !readiness.rows[0]?.operating) throw new Error("Coverage review storage unavailable; missing storage is not zero coverage");
  const financial = await connection.execute(sql`SELECT id,status,payload,reviewed_at FROM financial_reviews WHERE status='approved'`);
  const archives = await connection.execute(sql`SELECT s.id,s.kind,s.created_at,s.chunk_count,c.ordinal,c.payload FROM cv_analysis_snapshots s
    LEFT JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
    WHERE s.kind IN ('company-operating-source-proposal','company-operating-proposal','company-operating-decision','company-operating-identity','company-operating-source')`);
  const reviews = await coverageReviews(workbook.companies, financial.rows, archives.rows, options.informationCutoff);
  const dates = header ? workbook.timeSeries.map(r => new Date(r.date).toISOString().slice(0, 10))
    .filter(d => d <= options.informationCutoff.slice(0, 10)).sort() : [];
  const observationDate = current?.observationDate ?? options.observationDate ?? dates.at(-1);
  if (!observationDate) throw new Error("No workbook observation date available at cutoff");
  const report = companyCoverage({ companies: workbook.companies, observations: workbook.timeSeries, reviews,
    observationDate, informationCutoff: options.informationCutoff, sourceId: header?.id ?? "current-workbook-unversioned" });
  return rememberReportRelease(report, "company-coverage", { version: "company-coverage-consumed-source-1",
    options, sourceId: report.sourceId, observationDate, workbook, financialRows: financial.rows, archiveRows: archives.rows,
    meaning: "Full actual repeatable-read workbook/day and financial/operating source/review journal snapshot; no source approval or private publication" });
}

/** Current DB path reads the complete company population, but only one day of
 * observations. Caller supplies its repeatable-read READ ONLY transaction.
 * Calendar-day cutoff intentionally matches the immutable calculator path.
 */
export async function loadCurrentCoverageWorkbook(connection: Pick<typeof db, "select" | "execute">,
  options: Pick<CoverageOptions, "observationDate" | "informationCutoff">) {
  if (!Number.isFinite(Date.parse(options.informationCutoff))) throw new Error("Explicit valid information cutoff required");
  const cutoffDay = new Date(options.informationCutoff).toISOString().slice(0, 10);
  let observationDate = options.observationDate;
  if (observationDate !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(observationDate) ||
    !Number.isFinite(Date.parse(observationDate)) || new Date(observationDate).toISOString().slice(0, 10) !== observationDate))
    throw new Error("Exact valid observation calendar date required");
  if (observationDate && observationDate > cutoffDay) throw new Error("Observation after information cutoff");
  const companies = await connection.select().from(cvCompanies);
  if (!observationDate) {
    const latest = await connection.execute(sql`SELECT max(date) AS latest_date FROM cv_time_series
      WHERE date < (${cutoffDay}::date + interval '1 day')`);
    const value = latest.rows[0]?.latest_date;
    observationDate = value ? new Date(value as string).toISOString().slice(0, 10) : undefined;
  }
  if (!observationDate) throw new Error("No workbook observation date available at cutoff");
  const timeSeries = await connection.select().from(cvTimeSeries).where(sql`
    ${cvTimeSeries.date} >= ${observationDate}::date
    AND ${cvTimeSeries.date} < (${observationDate}::date + interval '1 day')`);
  return { companies, timeSeries, observationDate };
}

/** Detached journal evaluator for focused non-mutating source/approval controls. */
export async function coverageReviews(companies: { id: number; isin: string }[],
  financialRows: Record<string, any>[], archiveRows: Record<string, any>[], informationCutoff: string) {
  const byId = new Map<string, { kind: string; payload: any; valid: boolean }>();
  for (const row of archiveRows) {
    const id = String(row.id), previous = byId.get(id);
    byId.set(id, { kind: String(row.kind), payload: row.payload,
      valid: !previous && row.chunk_count === 1 && row.ordinal === 0 && contentHash(row.payload) === id });
  }
  const load = (id: string, kind: string) => {
    const row = byId.get(id);
    if (!row?.valid || row.kind !== kind) throw new Error("Missing or corrupt coverage source archive");
    return row.payload;
  };
  const available = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) &&
    Date.parse(value) <= Date.parse(informationCutoff);
  const reviews: CoverageReview[] = [];
  const issuers = new Map<string, number[]>();
  const parsed = financialRows.filter(row => row.status === "approved")
    .map(row => ({ row, parsed: snapshotSchema.safeParse(row.payload) }));
  for (const item of parsed) if (item.parsed.success) {
    const issuer = item.parsed.data.identity.issuerId;
    issuers.set(issuer, [...(issuers.get(issuer) ?? []), item.parsed.data.identity.companyId]);
  }
  for (const company of companies) {
    const matches = parsed.filter(r => Number((r.row.payload as any)?.identity?.companyId) === company.id);
    const packets = archiveRows.filter(row => ["company-operating-proposal", "company-operating-source-proposal"].includes(row.kind) &&
      String(row.payload?.identity?.companyId) === String(company.id) &&
      row.created_at && available(new Date(row.created_at).toISOString()));
    const review: CoverageReview = { companyId: company.id, eligible: false, mapping: packets.length ? "unknown" : "missing" };
    reviews.push(review);
    if (!matches.length) continue;
    const item = matches[0];
    if (matches.length !== 1 || !item.parsed.success) { review.eligibilityConflict = true; continue; }
    const payload = item.parsed.data;
    if (payload.identity.isin !== company.isin || (issuers.get(payload.identity.issuerId)?.length ?? 0) !== 1) {
      review.eligibilityConflict = true; continue;
    }
    const reviewedAt = item.row.reviewed_at ? new Date(item.row.reviewed_at as string).toISOString() : null;
    if (![reviewedAt, payload.identity.reviewedAt, payload.fetchedAt, payload.quote.observedAt,
      `${payload.statement.filingDate}T23:59:59.999Z`].every(available)) continue;
    review.eligible = true;
    const proposals = Array.from(byId.entries()).filter(([, r]) =>
      r.kind === "company-operating-proposal" && String(r.payload?.identity?.companyId) === String(company.id));
    const approved: string[] = [];
    let conflicted = false;
    for (const [id, proposalRow] of proposals) {
      const decisions = Array.from(byId.entries()).filter(([, r]) => r.kind === "company-operating-decision" &&
        r.payload?.proposalId === id && available(r.payload?.decidedAt));
      if (decisions.length > 1) { conflicted = true; continue; }
      if (decisions[0]?.[1].payload?.decision !== "approved") continue;
      try {
        const proposal = load(id, "company-operating-proposal");
        const decision = load(decisions[0][0], "company-operating-decision");
        const identity = load(decision.financialIdentityArchive, "company-operating-identity");
        if (decision.financialReviewId !== item.row.id || identity.financialReviewId !== item.row.id ||
          identity.status !== "approved" || identity.reviewedAt !== decision.financialReviewedAt ||
          !available(identity.reviewedAt) || Date.parse(identity.reviewedAt) > Date.parse(decision.decidedAt) ||
          contentHash(identity.payload) !== contentHash(payload) ||
          proposal.identity.isin !== company.isin || proposal.input.companyId !== String(company.id))
          throw new Error("Coverage archived identity conflict");
        projectCompanyMembers(proposal.input);
        await resolveCompanySourceEvidence(proposal.input, proposal.evidence, informationCutoff,
          proposal.identity, async sourceId => load(sourceId, "company-operating-source"));
        approved.push(proposal.input.mapping.basis);
      } catch { conflicted = true; }
    }
    review.mapping = conflicted || approved.length > 1 ? "conflicted" : (approved[0] as CoverageReview["mapping"] ?? review.mapping);
  }
  return reviews;
}

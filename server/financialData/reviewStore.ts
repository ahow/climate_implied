import { sql } from "drizzle-orm";
import { db } from "../db";
import { snapshotSchema, snapshotId, financialCalculation, transition, type FinancialSnapshot, type ReviewStatus } from "./review";
import { archiveFinancialApproval } from "./approvalArchive";

export async function ensureFinancialReviews() {
  const result = await db.execute(sql`SELECT to_regclass('public.financial_reviews') IS NOT NULL AS ready`);
  if (result.rows[0]?.ready !== true) throw new Error("Financial review storage is not provisioned");
}
export async function stageSnapshot(value: unknown) {
  const payload = snapshotSchema.parse(value);
  const company = await db.execute(sql`SELECT isin FROM cv_companies WHERE id = ${payload.identity.companyId}`);
  if (company.rows[0]?.isin !== payload.identity.isin) throw new Error("Workbook company identity does not match");
  await ensureFinancialReviews();
  const id = snapshotId(payload);
  await db.execute(sql`INSERT INTO financial_reviews (id,status,payload)
    VALUES (${id},'pending',${JSON.stringify(payload)}::jsonb) ON CONFLICT (id) DO NOTHING`);
  return id;
}
// A transaction-scoped helper also permits rollback-only integration fixtures.
export async function reviewInTransaction(tx: Pick<typeof db, "execute">, id: string, decision: "approved" | "rejected") {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(24713482)`);
  const result = await tx.execute(sql`SELECT status,payload FROM financial_reviews WHERE id=${id} FOR UPDATE`);
  const row = result.rows[0];
  if (!row) throw new Error("Proposal not found");
  const status = transition(row.status as ReviewStatus, decision);
  const payload = snapshotSchema.parse(row.payload);
  if (row.status === status) return;
  if (status === "approved") {
    const conflicts = await tx.execute(sql`SELECT id FROM financial_reviews WHERE status='approved'
      AND payload->'identity'->>'issuerId'=${payload.identity.issuerId}
      AND payload->'identity'->>'companyId'<>${String(payload.identity.companyId)}`);
    if (conflicts.rows.length) throw new Error("Issuer already accepted for another company; double counting prevented");
    await tx.execute(sql`UPDATE financial_reviews SET status='superseded'
      WHERE status='approved' AND payload->'identity'->>'companyId'=${String(payload.identity.companyId)}`);
  }
  await tx.execute(sql`UPDATE financial_reviews SET status=${status},reviewed_at=now() WHERE id=${id}`);
  if (status === "approved") {
    const archive = await archiveFinancialApproval(tx, id, payload);
    if (archive.state === "not-provisioned")
      console.warn("[financial-archive] not provisioned; existing review retained without archive");
  }
}
export async function reviewSnapshot(id: string, decision: "approved" | "rejected") {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid proposal ID");
  await ensureFinancialReviews();
  await db.transaction(tx => reviewInTransaction(tx, id, decision));
}
export async function listFinancialReviews() {
  await ensureFinancialReviews();
  const result = await db.execute(sql`SELECT id,status,payload FROM financial_reviews ORDER BY created_at DESC LIMIT 200`);
  return {
    items: result.rows.map(row => ({ ...row, calculation: financialCalculation(row.payload as FinancialSnapshot) })),
    approvalMode: "operator-cli",
    limitation: "Operator-reviewed snapshots only. No historical workbook or carbon fields are overwritten. Quotes are timestamped snapshots, not streaming prices. The ratio uses last reported annual earnings, not TTM earnings.",
  };
}

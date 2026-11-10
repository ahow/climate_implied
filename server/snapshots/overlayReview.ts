import { sql } from "drizzle-orm";
import { db } from "../db";
import { snapshotsAvailable } from "./store";
import { packOverlay, type CompanyOverlay } from "./overlayContract";
import { contentHash } from "../calculation/analysisManifest";

type Connection = Pick<typeof db, "execute">;
async function save(tx: Connection, kind: string, payload: unknown) {
  const id = contentHash(payload);
  const entries = kind === "company-overlay" ? (payload as CompanyOverlay).entries : [];
  const companyCount = new Set(entries.map(e => e.companyId)).size;
  const inserted = await tx.execute(sql`INSERT INTO cv_analysis_snapshots
    (id,kind,company_count,observation_count,chunk_count,source_note)
    VALUES (${id},${kind},${companyCount},${entries.length},1,'Operator-reviewed revised-history overlay lifecycle')
    ON CONFLICT (id) DO NOTHING RETURNING id`);
  if (inserted.rows.length) await tx.execute(sql`INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload)
    VALUES (${id},0,${JSON.stringify(payload)}::jsonb)`);
  return id;
}
async function load(tx: Connection, id: string, kind: string) {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid review archive ID");
  const r = await tx.execute(sql`SELECT s.chunk_count,c.ordinal,c.payload FROM cv_analysis_snapshots s
    JOIN cv_analysis_chunks c ON c.snapshot_id=s.id WHERE s.id=${id} AND s.kind=${kind}`);
  if (r.rows.length !== 1 || r.rows[0].chunk_count !== 1 || r.rows[0].ordinal !== 0)
    throw new Error("Missing or incomplete review archive");
  const payload = r.rows[0].payload as any;
  if (contentHash(payload) !== id) throw new Error("Corrupt review archive");
  return payload;
}
async function lock(tx: Connection) {
  if (!await snapshotsAvailable(tx)) throw new Error("Immutable review storage unavailable");
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('company-overlay-review'))`);
}
export async function stageOverlayReviewInTransaction(tx: Connection, entries: unknown) {
  await lock(tx);
  const packed = packOverlay(entries);
  if (packed.payload.entries.some(e => e.kind === "financial"))
    throw new Error("Financial reviews use the existing financial operator workflow");
  for (const e of packed.payload.entries) {
    const company = await tx.execute(sql`SELECT id FROM cv_companies WHERE id=${e.companyId}`);
    if (company.rows.length !== 1) throw new Error("Unknown company");
    if (e.kind === "carbon") {
      const observation = await tx.execute(sql`SELECT id FROM cv_time_series
        WHERE company_id=${e.companyId} AND date::date=${e.observationDate}::date LIMIT 1`);
      if (!observation.rows.length) throw new Error("No matching historical observation");
    }
  }
  // Supplied approvalEvidence is source review documentation, not a decision.
  return save(tx, "company-overlay-proposal", { version: "overlay-proposal-1", overlay: packed.payload });
}
export async function decideOverlayReviewInTransaction(
  tx: Connection, proposalId: string, decision: "approved" | "rejected",
) {
  if (!["approved", "rejected"].includes(decision)) throw new Error("Invalid decision");
  await lock(tx);
  const proposal = await load(tx, proposalId, "company-overlay-proposal");
  const previous = await tx.execute(sql`SELECT s.id FROM cv_analysis_snapshots s
    JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
    WHERE s.kind='company-overlay-decision' AND c.payload->>'proposalId'=${proposalId}`);
  if (previous.rows.length > 1) throw new Error("Conflicting immutable decisions");
  if (previous.rows.length) {
    const saved = await load(tx, String(previous.rows[0].id), "company-overlay-decision");
    if (saved.decision !== decision) throw new Error("Conflicting decision; submit a new proposal");
    if (saved.overlayId) await load(tx, saved.overlayId, "company-overlay");
    return { id: previous.rows[0].id, ...saved };
  }
  const now = await tx.execute(sql`SELECT transaction_timestamp() AS now`);
  const decidedAt = new Date(now.rows[0].now as string).toISOString();
  const overlay = proposal.overlay as CompanyOverlay;
  if (decision === "approved" && overlay.entries.some(e => e.availableAt > decidedAt.slice(0, 10)))
    throw new Error("Future source availability cannot be approved as current");
  let overlayId: string | null = null;
  if (decision === "approved") {
    const approved = packOverlay(overlay.entries.map(e => ({
      ...e, availableAt: decidedAt.slice(0, 10),
      approvalEvidence: `review:${proposalId};decidedAt:${decidedAt};sourceReview:${e.approvalEvidence}`,
    })));
    overlayId = await save(tx, "company-overlay", approved.payload);
    if (overlayId !== approved.id) throw new Error("Overlay identity mismatch");
  }
  const payload = { version: "overlay-decision-1", proposalId, decision, decidedAt, overlayId };
  return { id: await save(tx, "company-overlay-decision", payload), ...payload };
}
export const stageOverlayReview = (entries: unknown) =>
  db.transaction(tx => stageOverlayReviewInTransaction(tx, entries));
export const decideOverlayReview = (id: string, decision: "approved" | "rejected") =>
  db.transaction(tx => decideOverlayReviewInTransaction(tx, id, decision));

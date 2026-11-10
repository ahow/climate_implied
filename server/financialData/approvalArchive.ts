import { sql } from "drizzle-orm";
import type { db } from "../db";
import { snapshotGuardQuery, guardRowsValid } from "../snapshots/guards";
import { contentHash } from "../calculation/analysisManifest";
import { snapshotSchema } from "./review";

/** Same transaction as the review decision. This archives current financial
 * inputs, never rewrites historical workbook rows or approves an identity. */
export async function archiveFinancialApproval(tx: Pick<typeof db, "execute">, reviewId: string, input: unknown) {
  const guards = await tx.execute(snapshotGuardQuery);
  if (!guardRowsValid(guards.rows)) return { state: "not-provisioned" as const };
  const approved = await tx.execute(sql`SELECT reviewed_at FROM financial_reviews WHERE id=${reviewId} AND status='approved'`);
  if (approved.rows.length !== 1 || !approved.rows[0].reviewed_at) throw new Error("Approval evidence absent");
  const payload = {
    version: "approved-current-financial-1", reviewId,
    approvedAt: new Date(approved.rows[0].reviewed_at as string).toISOString(),
    input: snapshotSchema.parse(input),
    boundary: "current descriptive financials; not eligible for historical workbook substitution",
  };
  const id = contentHash(payload);
  const inserted = await tx.execute(sql`INSERT INTO cv_analysis_snapshots
    (id,kind,company_count,observation_count,chunk_count,source_note)
    VALUES (${id},'approved-current-financial',1,1,1,'Existing operator approval; current-only, no original-vintage claim')
    ON CONFLICT (id) DO NOTHING RETURNING id`);
  if (inserted.rows.length) await tx.execute(sql`INSERT INTO cv_analysis_chunks(snapshot_id,ordinal,payload)
    VALUES (${id},0,${JSON.stringify(payload)}::jsonb)`);
  return { state: "archived" as const, id };
}

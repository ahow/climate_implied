/** Rollback-only development database fixture. Never run against production. */
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../server/db";
import { ensureFinancialReviews, reviewInTransaction } from "../server/financialData/reviewStore";
import { contentHash } from "../server/calculation/analysisManifest";
if (process.env.NODE_ENV === "production") throw new Error("Development fixture only");
await ensureFinancialReviews();
const id = `rollback-test-${randomUUID()}`;
const rollback = new Error("intentional rollback");
const payload = {
  identity: { companyId: 2147483647, isin: "US0378331005", symbol: "FIXTURE", currency: "USD",
    exchange: "NASDAQ", shareClassFIGI: "FIXTURE", issuerId: id, marketCapScope: "issuer",
    primaryListingEvidence: "https://example.org/fixture", issuerEvidence: "https://example.org/fixture",
    reviewedAt: "2026-11-06T00:00:00Z" },
  quote: { price: 10, marketCap: 1000, observedAt: "2026-11-05T21:00:00Z" },
  statement: { netIncome: 100, currency: "USD", period: "2025-12-31", filingDate: "2026-02-01" },
  fetchedAt: "2026-11-06T00:00:00Z",
};
try {
  await db.transaction(async tx => {
    await tx.execute(sql`INSERT INTO financial_reviews(id,status,payload) VALUES (${id},'pending',${JSON.stringify(payload)}::jsonb)`);
    await reviewInTransaction(tx, id, "approved");
    await reviewInTransaction(tx, id, "approved");
    const result = await tx.execute(sql`SELECT status FROM financial_reviews WHERE id=${id}`);
    assert.equal(result.rows[0].status, "approved");
    const archive = await tx.execute(sql`SELECT s.id,c.payload FROM cv_analysis_snapshots s
      JOIN cv_analysis_chunks c ON c.snapshot_id=s.id
      WHERE s.kind='approved-current-financial' AND c.payload->>'reviewId'=${id}`);
    assert.equal(archive.rows.length, 1, "Approval must archive once in provisioned development");
    assert.equal(contentHash(archive.rows[0].payload), archive.rows[0].id);
    await assert.rejects(reviewInTransaction(tx, id, "rejected"));
    throw rollback;
  });
} catch (e) { if (e !== rollback) throw e; }
assert.equal((await db.execute(sql`SELECT id FROM financial_reviews WHERE id=${id}`)).rows.length, 0);
assert.equal((await db.execute(sql`SELECT snapshot_id FROM cv_analysis_chunks WHERE payload->>'reviewId'=${id}`)).rows.length, 0);
console.log("PASS: transactional approval, repeated approval, conflicting rejection, complete rollback");
process.exit(0);

/** Development-only concurrent approval acceptance; removes its own fixtures. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../server/db";
import { indicatorValues } from "../shared/schema";
import { approveProposal, createManualApproved } from "../server/dataIngestion/dataStore";
if (process.env.NODE_ENV === "production") throw new Error("Development only");
const key = `acceptance-fixture-${randomUUID()}`;
try {
  const proposals = await db.insert(indicatorValues).values([1, 2].map(value => ({
    indicatorKey: key, year: 2024, value, source: "Acceptance fixture", method: "manual", status: "pending",
  }))).returning();
  await Promise.all(proposals.map(p => approveProposal(p.id)));
  let rows = await db.select().from(indicatorValues).where(eq(indicatorValues.indicatorKey, key));
  assert.equal(rows.filter(r => r.status === "approved").length, 1);
  assert.equal(rows.filter(r => r.status === "superseded").length, 1);
  assert.equal(await approveProposal(proposals[0].id), undefined);
  await Promise.all([3, 4].map(value => createManualApproved({ indicatorKey: key, year: 2024, value })));
  rows = await db.select().from(indicatorValues).where(eq(indicatorValues.indicatorKey, key));
  assert.equal(rows.filter(r => r.status === "approved").length, 1);
  console.log("PASS: concurrent proposals/manual approvals leave exactly one approved value; double approval is rejected");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Approval acceptance failed");
  process.exitCode = 1;
} finally {
  await db.delete(indicatorValues).where(eq(indicatorValues.indicatorKey, key));
  process.exit(process.exitCode ?? 0);
}

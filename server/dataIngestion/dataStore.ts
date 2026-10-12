import { db } from "../db";
import { indicatorValues, indicatorFetchRuns } from "@shared/schema";
import type { IndicatorValue, IndicatorFetchRun } from "@shared/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { FetchedValue } from "./adapters/types";

export async function createFetchRun(
  trigger: "manual" | "scheduled"
): Promise<IndicatorFetchRun> {
  const [run] = await db
    .insert(indicatorFetchRuns)
    .values({ trigger, status: "running" })
    .returning();
  return run;
}

export async function finishFetchRun(
  id: string,
  fields: {
    status: "completed" | "failed";
    proposalsCreated: number;
    adaptersSucceeded: number;
    adaptersFailed: number;
    summary?: unknown;
  }
): Promise<void> {
  await db
    .update(indicatorFetchRuns)
    .set({
      status: fields.status,
      proposalsCreated: fields.proposalsCreated,
      adaptersSucceeded: fields.adaptersSucceeded,
      adaptersFailed: fields.adaptersFailed,
      summary: fields.summary ?? null,
      finishedAt: new Date(),
    })
    .where(eq(indicatorFetchRuns.id, id));
}

/**
 * Insert fetched values as pending proposals. Any prior PENDING proposal for the
 * same (indicatorKey, year) is superseded so only the latest pending shows.
 */
export async function insertProposals(
  values: FetchedValue[],
  runId: string
): Promise<number> {
  if (values.length === 0) return 0;

  for (const v of values) {
    await db
      .update(indicatorValues)
      .set({ status: "superseded", decidedAt: new Date() })
      .where(
        and(
          eq(indicatorValues.indicatorKey, v.indicatorKey),
          eq(indicatorValues.year, v.year),
          eq(indicatorValues.status, "pending")
        )
      );
  }

  await db.insert(indicatorValues).values(
    values.map((v) => ({
      indicatorKey: v.indicatorKey,
      year: v.year,
      value: v.value,
      source: v.source,
      sourceUrl: v.sourceUrl ?? null,
      asOfDate: v.asOfDate ?? null,
      method: v.method,
      status: "pending" as const,
      rawContext: v.rawContext ?? null,
      runId,
    }))
  );

  return values.length;
}

export async function getApprovedValues(): Promise<IndicatorValue[]> {
  return db
    .select()
    .from(indicatorValues)
    .where(eq(indicatorValues.status, "approved"));
}

export async function getPendingValues(): Promise<IndicatorValue[]> {
  return db
    .select()
    .from(indicatorValues)
    .where(eq(indicatorValues.status, "pending"))
    .orderBy(desc(indicatorValues.createdAt));
}

export async function getValuesForKey(
  indicatorKey: string
): Promise<IndicatorValue[]> {
  return db
    .select()
    .from(indicatorValues)
    .where(eq(indicatorValues.indicatorKey, indicatorKey))
    .orderBy(desc(indicatorValues.createdAt));
}

export async function getProposalById(
  id: string
): Promise<IndicatorValue | undefined> {
  const rows = await db
    .select()
    .from(indicatorValues)
    .where(eq(indicatorValues.id, id))
    .limit(1);
  return rows[0];
}

/** Approve a pending proposal, superseding any prior approved row for that cell. */
export async function approveProposal(id: string): Promise<IndicatorValue | undefined> {
  const proposal = await getProposalById(id);
  if (!proposal || proposal.status !== "pending") return undefined;

  await db
    .update(indicatorValues)
    .set({ status: "superseded", decidedAt: new Date() })
    .where(
      and(
        eq(indicatorValues.indicatorKey, proposal.indicatorKey),
        eq(indicatorValues.year, proposal.year),
        eq(indicatorValues.status, "approved")
      )
    );

  // Pending-only transition: WHERE status='pending' guards against double-apply
  // if two requests race on the same proposal.
  const [updated] = await db
    .update(indicatorValues)
    .set({ status: "approved", decidedAt: new Date() })
    .where(and(eq(indicatorValues.id, id), eq(indicatorValues.status, "pending")))
    .returning();

  return updated;
}

/** Reject a pending proposal. Only pending rows may be rejected. */
export async function rejectProposal(id: string): Promise<IndicatorValue | undefined> {
  const [updated] = await db
    .update(indicatorValues)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(and(eq(indicatorValues.id, id), eq(indicatorValues.status, "pending")))
    .returning();
  return updated;
}

/** Create a manually-entered approved value, superseding any prior approved cell. */
export async function createManualApproved(params: {
  indicatorKey: string;
  year: number;
  value: number;
  note?: string;
}): Promise<IndicatorValue> {
  await db
    .update(indicatorValues)
    .set({ status: "superseded", decidedAt: new Date() })
    .where(
      and(
        eq(indicatorValues.indicatorKey, params.indicatorKey),
        eq(indicatorValues.year, params.year),
        eq(indicatorValues.status, "approved")
      )
    );

  const [created] = await db
    .insert(indicatorValues)
    .values({
      indicatorKey: params.indicatorKey,
      year: params.year,
      value: params.value,
      source: "Manual entry",
      method: "manual",
      status: "approved",
      note: params.note ?? null,
      decidedAt: new Date(),
    })
    .returning();

  return created;
}

export async function getRecentRuns(limit = 10): Promise<IndicatorFetchRun[]> {
  return db
    .select()
    .from(indicatorFetchRuns)
    .orderBy(desc(indicatorFetchRuns.startedAt))
    .limit(limit);
}

export async function getLastRun(): Promise<IndicatorFetchRun | undefined> {
  const rows = await getRecentRuns(1);
  return rows[0];
}

export async function hasRunningFetch(): Promise<boolean> {
  const rows = await db
    .select({ id: indicatorFetchRuns.id })
    .from(indicatorFetchRuns)
    .where(eq(indicatorFetchRuns.status, "running"))
    .limit(1);
  return rows.length > 0;
}

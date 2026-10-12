import { ADAPTERS } from "./adapters";
import type { AdapterContext, FetchedValue } from "./adapters/types";
import { getCuratedValue, LATEST_CURATED_YEAR, type IndicatorKey } from "./indicatorRegistry";
import {
  createFetchRun,
  finishFetchRun,
  hasRunningFetch,
  insertProposals,
} from "./dataStore";

export interface FetchRunSummary {
  runId: string;
  status: "completed" | "failed" | "skipped";
  proposalsCreated: number;
  adaptersSucceeded: number;
  adaptersFailed: number;
  perAdapter: { id: string; values: number; error?: string }[];
}

let inFlight = false;

function skippedSummary(): FetchRunSummary {
  return {
    runId: "",
    status: "skipped",
    proposalsCreated: 0,
    adaptersSucceeded: 0,
    adaptersFailed: 0,
    perAdapter: [],
  };
}

/**
 * Run all source adapters and stage their results as PENDING proposals.
 * Never auto-applies values to the model — approval is a separate, human step.
 */
export async function runFetch(
  trigger: "manual" | "scheduled"
): Promise<FetchRunSummary> {
  // Acquire the in-process lock synchronously BEFORE any await so two
  // near-simultaneous callers cannot both pass the gate. The DB check guards
  // against a run left "running" by a prior crashed process.
  if (inFlight) {
    return skippedSummary();
  }
  inFlight = true;

  let run: Awaited<ReturnType<typeof createFetchRun>>;
  try {
    if (await hasRunningFetch()) {
      inFlight = false;
      return skippedSummary();
    }
    run = await createFetchRun(trigger);
  } catch (e) {
    inFlight = false;
    throw e;
  }
  const perAdapter: FetchRunSummary["perAdapter"] = [];
  const fetchedSoFar = new Map<string, FetchedValue>();
  const allValues: FetchedValue[] = [];
  let succeeded = 0;
  let failed = 0;

  const ctx: AdapterContext = {
    curated: (key: IndicatorKey, year?: number) => getCuratedValue(key, year),
    latestCuratedYear: LATEST_CURATED_YEAR,
    fetchedSoFar,
  };

  try {
    for (const adapter of ADAPTERS) {
      try {
        const values = await adapter.fetch(ctx);
        for (const v of values) {
          fetchedSoFar.set(v.indicatorKey, v);
          allValues.push(v);
        }
        succeeded += 1;
        perAdapter.push({ id: adapter.id, values: values.length });
      } catch (e) {
        failed += 1;
        const message = (e as Error).message ?? String(e);
        console.error(`[orchestrator] adapter ${adapter.id} failed:`, message);
        perAdapter.push({ id: adapter.id, values: 0, error: message });
      }
    }

    const proposalsCreated = await insertProposals(allValues, run.id);

    await finishFetchRun(run.id, {
      status: "completed",
      proposalsCreated,
      adaptersSucceeded: succeeded,
      adaptersFailed: failed,
      summary: { perAdapter },
    });

    console.log(
      `[orchestrator] run ${run.id} complete: ${proposalsCreated} proposals, ${succeeded} adapters ok, ${failed} failed`
    );

    return {
      runId: run.id,
      status: "completed",
      proposalsCreated,
      adaptersSucceeded: succeeded,
      adaptersFailed: failed,
      perAdapter,
    };
  } catch (e) {
    console.error("[orchestrator] run failed:", e);
    await finishFetchRun(run.id, {
      status: "failed",
      proposalsCreated: 0,
      adaptersSucceeded: succeeded,
      adaptersFailed: failed,
      summary: { perAdapter, error: (e as Error).message },
    });
    return {
      runId: run.id,
      status: "failed",
      proposalsCreated: 0,
      adaptersSucceeded: succeeded,
      adaptersFailed: failed,
      perAdapter,
    };
  } finally {
    inFlight = false;
  }
}

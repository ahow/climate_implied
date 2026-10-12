import { runFetch } from "./orchestrator";
import { getLastRun } from "./dataStore";

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // re-check every 6h
let timer: NodeJS.Timeout | null = null;

/**
 * Lightweight monthly scheduler. Every 6h it checks whether the most recent run
 * is older than ~30 days and, if so, triggers a scheduled fetch. All indicators
 * share the same cadence. Survives restarts because the cadence is derived from
 * the persisted last-run timestamp, not an in-process clock.
 */
export function startScheduler(): void {
  if (timer) return;

  const check = async () => {
    try {
      const last = await getLastRun();
      const lastTime = last ? new Date(last.startedAt).getTime() : 0;
      if (Date.now() - lastTime >= MONTH_MS) {
        console.log("[scheduler] Monthly cadence reached — triggering scheduled fetch");
        await runFetch("scheduled");
      }
    } catch (e) {
      console.error("[scheduler] check failed:", e);
    }
  };

  // Defer the first check so startup isn't blocked by network fetches.
  setTimeout(check, 60 * 1000);
  timer = setInterval(check, CHECK_INTERVAL_MS);
  console.log("[scheduler] Started (monthly cadence, 6h checks)");
}

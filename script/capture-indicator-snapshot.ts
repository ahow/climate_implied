import assert from "node:assert/strict";
import { captureApprovedIndicators, loadIndicatorSnapshot } from "../server/snapshots/indicators";
import { packIndicators } from "../server/snapshots/indicatorContract";
// This command does not migrate any schema or change approved values.
if (process.env.NODE_ENV === "production") throw new Error("Development capture only");
try {
  const captured = await captureApprovedIndicators();
  const replay = await loadIndicatorSnapshot(captured.id);
  assert.equal(packIndicators(replay).id, captured.id);
  console.log(JSON.stringify({ ...captured, replay: "passed" }));
  process.exit(0);
} catch {
  console.error("Indicator snapshot capture/replay failed");
  process.exit(1);
}

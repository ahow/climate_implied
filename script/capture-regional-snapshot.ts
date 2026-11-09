import assert from "node:assert/strict";
import { captureRegionalInputs, loadRegionalInputs } from "../server/snapshots/regional";
import { getRegionalCarbonIntensities } from "../server/calculation/regionalProjections";
import { packRegional } from "../server/snapshots/regionalContract";
if (process.env.NODE_ENV !== "development") throw new Error("Development operator only");
try {
  const captured = await captureRegionalInputs(await getRegionalCarbonIntensities());
  assert.equal(packRegional(await loadRegionalInputs(captured.id)).id, captured.id);
  console.log(JSON.stringify({ ...captured, replay: "passed", source: "Resolved external inputs; not approved indicator changes" }));
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Regional archive failed");
  process.exit(1);
}

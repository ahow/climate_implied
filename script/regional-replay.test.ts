import test from "node:test";
import assert from "node:assert/strict";
import { calculateRegionalFromInputs } from "../server/calculation/regionalProjections";
import { inputs } from "./fixtures/calculationInputs";
test("regional replay rejects incomplete or invalid captured external inputs", () => {
  assert.throws(() => calculateRegionalFromInputs(inputs, {}));
  assert.throws(() => calculateRegionalFromInputs(inputs, {
    eu: { value: 0, source: "owid" }, us: { value: .2, source: "owid" },
    china: { value: .5, source: "owid" }, india: { value: .6, source: "owid" },
  }));
});

import test from "node:test";
import assert from "node:assert/strict";

test("WORKPLAN_S00_011_DELIBERATELY_BROKEN_SOURCE", () => {
  assert.fail("Expected negative control: this source revision must not promote.");
});

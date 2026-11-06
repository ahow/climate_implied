import { test } from "node:test";
import assert from "node:assert/strict";
import { validIsin } from "../server/financialData/isin";
test("ISIN checksum rejects plausible but corrupted identifiers", () => {
  for (const id of ["US0378331005", "US1264081035", "GB0002634946"]) assert.equal(validIsin(id), true);
  for (const id of ["US0378331006", "us0378331005", "", "US000000000A"]) assert.equal(validIsin(id), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseMapping } from "../server/financialData/mappingDiagnostics";
test("matching diagnostics distinguish absent providers, excluded listings and unresolved joins", () => {
  assert.deepEqual(diagnoseMapping("US0000000000", [], []).reasons,
    ["no-fmp-profile", "no-openfigi-equity"]);
  const p = { isin: "US0000000000", symbol: "X", exchange: "UNKNOWN", currency: "USD", isAdr: true };
  assert.ok(diagnoseMapping(p.isin, [p], []).reasons.includes("adr-excluded"));
  assert.equal(diagnoseMapping(p.isin, [p], []).accepted, false);
  assert.ok(diagnoseMapping(p.isin, [{ ...p, isAdr: false, isActivelyTrading: false }], [])
    .reasons.includes("provider-reports-inactive"));
});

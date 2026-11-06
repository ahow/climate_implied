import { test } from "node:test";
import assert from "node:assert/strict";
import { assessMapping, type Profile, type FigiCandidate, fmpRequest } from "../server/financialData/provider";

const p: Profile = { isin: "US0378331005", symbol: "AAPL", exchange: "NASDAQ", currency: "USD" };
const f: FigiCandidate = { figi: "listing-a", shareClassFIGI: "class-a",
  compositeFIGI: "composite-us", marketSector: "Equity", ticker: "AAPL", exchCode: "US" };
test("exact evidence remains a candidate, never an automatic issuer merge", () => {
  const result = assessMapping(p.isin, [p], [f]);
  assert.equal(result.status, "candidate-needs-issuer-review");
  assert.equal(result.accepted, false);
  assert.equal(result.candidates[0].shareClassFIGI, "class-a");
});
test("wrong ISIN, currency, exchange, ADR and inactive listings do not pass", () => {
  for (const override of [{ isin: "wrong" }, { currency: "" }, { exchange: "unknown" },
    { isAdr: true }, { isActivelyTrading: false }]) {
    assert.equal(assessMapping(p.isin, [{ ...p, ...override }], [f]).status, "unmatched");
  }
});
test("duplicate listings do not duplicate candidates; multiple classes are not collapsed", () => {
  assert.equal(assessMapping(p.isin, [p, p], [f, f]).candidates.length, 1);
  assert.equal(assessMapping(p.isin, [p], [f, { ...f, shareClassFIGI: "different" }]).status, "unmatched");
});
test("same ticker on another exchange does not count as a matching listing", () => {
  assert.equal(assessMapping(p.isin, [p], [{ ...f, exchCode: "LN" }]).status, "unmatched");
});
test("multiple FMP listings remain ambiguous", () => {
  assert.equal(assessMapping(p.isin, [p, { ...p, symbol: "AAPL.X" }], [f]).status, "ambiguous");
});
test("arbitrary paid API paths are rejected before a request", async () => {
  await assert.rejects(fmpRequest("https://example.com", {}), /Unsupported/);
});

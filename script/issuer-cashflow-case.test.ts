import assert from "node:assert/strict";
import test from "node:test";
import { authenticatePrimaryIssuerCashflow, buildIssuerCashflowScenario,
  type IssuerCashflowObservation } from "../server/calculation/issuerCashflowCase";
import { calculateCompanyFullCashflowCase, valueCompanyFullCashflowCase,
  pairCompanyFullCashflowCase } from "../server/calculation/companyFullCashflowCase";

// Synthetic engineering fixture only; actual retained issuer work is validated separately.
function observation(): IssuerCashflowObservation {
  return { identity: { symbol: "TEST", cik: "0000000001", security: "Synthetic common", fiscalEnd: "2024-12-31" },
    referenceDate: "2025-02-21", frozenAt: "2026-11-10T14:00:00.000Z",
    sourceHash: "a".repeat(64), availableAt: "2025-02-25T21:00:00.000Z",
    historicalBaseFcfe: -25, revenue: 1000, operatingIncome: 400, depreciation: 100,
    interest: 10, policyCredit: 100, capex: 400, otherInvesting: 5,
    nonCommonClaims: 0, otherCash: -10, stubLiabilitySettlement: 20, gaps: [] };
}

test("Revised history is explicit; later filing and actual freeze never become historical knowledge", () => {
  const s = buildIssuerCashflowScenario(observation(), false);
  assert.equal(calculateCompanyFullCashflowCase(s.engineInput).years.length, 5);
  assert.throws(() => calculateCompanyFullCashflowCase({ ...s.engineInput,
    informationContext: { ...s.engineInput.informationContext, mode: "historical-point-in-time" } }),
  /cutoff/);
  assert.throws(() => calculateCompanyFullCashflowCase({ ...s.engineInput,
    informationContext: { ...s.engineInput.informationContext, informationCutoff: "2025-02-21T21:00:00.000Z" } }),
  /cutoff/);
});

test("Explicit fifteen-year operating bridge and terminal reconcile independently to dated PV", () => {
  const s = buildIssuerCashflowScenario(observation(), false);
  const l = calculateCompanyFullCashflowCase(s.engineInput), v = valueCompanyFullCashflowCase(s.engineInput);
  assert.equal(l.continuationYears.length, 10);
  assert.equal(l.terminalYear!.year, 2041);
  assert.equal(l.years[0].fcfe, 219);
  assert.equal(l.years[0].recognizedPolicyCredit, 0);
  assert.equal(l.terminalYear!.cashPolicyCredit, 0);
  assert.equal(l.terminalYear!.capitalSpend, 105);
  const days = (date: string) => (Date.parse(date) - Date.parse(s.engineInput.referenceDate)) / 86400000 / 365.25;
  const expected = s.engineInput.stub.cashFlows[0].fcfe / 1.1 ** days("2025-12-31") +
    Array.from({ length: 15 }, (_, i) => 219 / 1.1 ** days(`${2026 + i}-12-31`)).reduce((a, b) => a + b, 0) +
    219 / .10 / 1.1 ** days("2040-12-31");
  assert.ok(Math.abs(v.forwardWholeEquity - expected) < 1e-9);
  const market = { symbol: "TEST", cik: "0000000001", security: "Synthetic common", currency: "USD" as const,
    referenceDate: "2025-02-21", priceDate: "2025-02-21", sharesDate: "2025-02-21",
    price: v.forwardWholeEquity / 10, shares: 10, datedReferenceReviewed: true };
  const pair = pairCompanyFullCashflowCase(s.engineInput, market);
  assert.equal(pair.pairing, "conditional-same-basis-whole-equity");
  assert.ok("impliedAnnualFcfeAdjustment" in pair && Math.abs(pair.impliedAnnualFcfeAdjustment) < 1e-10);
});

test("Collection stress consumes new receivables once, leaves fixed stub and steady terminal unchanged", () => {
  const a = buildIssuerCashflowScenario(observation(), false), b = buildIssuerCashflowScenario(observation(), true);
  const base = calculateCompanyFullCashflowCase(a.engineInput), stress = calculateCompanyFullCashflowCase(b.engineInput);
  assert.deepEqual(a.engineInput.stub, b.engineInput.stub);
  assert.ok(Math.abs(base.years[0].fcfe - stress.years[0].fcfe - 1000 * 15 / 365) < 1e-10);
  assert.equal(base.years[1].fcfe, stress.years[1].fcfe);
  assert.equal(base.terminalYear!.fcfe, stress.terminalYear!.fcfe);
  assert.equal(stress.years[1].openingReceivables, stress.years[0].closingReceivables);
});

test("Terminal operating reinvestment, credit, margin and claim tampering fails closed", () => {
  const s = buildIssuerCashflowScenario(observation(), false);
  for (const field of ["capitalSpend", "recognizedPolicyCredit", "operatingMarginBeforeClimateCostsAndCredits", "nonCommonCashClaims"]) {
    const copy = structuredClone(s.engineInput);
    (copy.continuation.terminalYear as Record<string, unknown>)[field] =
      Number((copy.continuation.terminalYear as Record<string, unknown>)[field]) +
        (field === "operatingMarginBeforeClimateCostsAndCredits" ? .01 : 1);
    assert.throws(() => calculateCompanyFullCashflowCase(copy), /Terminal/);
  }
  const unresolved = buildIssuerCashflowScenario({ ...observation(), gaps: ["Unallocated non-common claim"] }, false);
  assert.equal(calculateCompanyFullCashflowCase(unresolved.engineInput).status, "blocked");
  assert.throws(() => valueCompanyFullCashflowCase(unresolved.engineInput), /Unresolved accounting/);
});

test("Primary iXBRL authentication binds issuer, exact common class, duration and ISO USD unit", () => {
  const identity = observation().identity;
  const html = `<xbrli:context id="a"><xbrli:entity><xbrli:identifier>0000000001</xbrli:identifier></xbrli:entity><xbrli:period><xbrli:startDate>2024-01-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period></xbrli:context>
<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>
<ix:nonNumeric name="dei:TradingSymbol" contextRef="a">TEST</ix:nonNumeric>
<ix:nonNumeric name="dei:Security12bTitle" contextRef="a">Synthetic common</ix:nonNumeric>
<ix:nonNumeric name="dei:SecurityExchangeName" contextRef="a">Synthetic exchange</ix:nonNumeric>
<ix:nonFraction id="float" name="dei:EntityPublicFloat" contextRef="a" unitRef="usd" scale="3">20</ix:nonFraction>
<ix:nonFraction id="sales" name="us-gaap:Revenues" contextRef="a" unitRef="usd" scale="3">1,000</ix:nonFraction>`;
  assert.equal(authenticatePrimaryIssuerCashflow(html, identity).annual("us-gaap:Revenues"), 1e6);
  assert.throws(() => authenticatePrimaryIssuerCashflow(html.replace("iso4217:USD", "iso4217:CAD"), identity), /claim/);
  assert.throws(() => authenticatePrimaryIssuerCashflow(html, { ...identity, cik: "0000000002" }), /class/);
  assert.throws(() => authenticatePrimaryIssuerCashflow(html, { ...identity, security: "Preferred" }), /class/);
  assert.throws(() => authenticatePrimaryIssuerCashflow(html.replace("2024-12-31", "2023-12-31"), identity)
    .annual("us-gaap:Revenues"), /claim/);
});

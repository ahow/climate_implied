import assert from "node:assert/strict";
import test from "node:test";
import { inspectRetainedRiConvention, type RetainedRiMetadata } from "../server/calculation/returnQualitySourceConvention";

// Synthetic request only; no private RI levels, company names or sampled identities.
function fixture(): RetainedRiMetadata {
  const options = "RowHeader=true;ColHeader=true;DispSeriesDescription=true;YearlyTSFormat=false;QuarterlyTSFormat=false;MonthlyTSFormat=true;TimeSeriesList=true";
  const body = `DSGRID("L#TEST1","X(RI)~U$","2010","","M","${options}")`;
  return {
    formula: `_xll.${body}`,
    commentFormula: `=${body}`,
    customPropertyJson: JSON.stringify({
      [`[0:0]=DSGRID(L#TEST1,X(RI)~U$,2010,,M,${options}),`]: "$B$1:$COY$1,$A$2:$COY$194",
    }),
    date1904: false,
    dateSerials: Array.from({ length: 193 }, (_, i) =>
      (Date.UTC(2010, i, 22) - Date.UTC(1899, 11, 30)) / 86400000),
  };
}

test("source request extraction preserves all monthly labels including weekends; never qualifies returns", () => {
  const result = inspectRetainedRiConvention(fixture());
  assert.equal(result.datatypeExpression, "X(RI)~U$");
  assert.equal(result.requestedCurrencyToken, "U$");
  assert.equal(result.frequency, "M");
  assert.equal(result.dates[0], "2010-01-22");
  assert.ok(result.dates.includes("2010-05-22")); // Saturday, not moved to Friday.
  assert.equal(result.dates.at(-1), "2026-01-22");
  assert.equal(result.weekendLabels, 54);
  assert.equal(result.reconstructionStatus, "unavailable");
  assert.equal(result.calendarRule, "unresolved");
  assert.equal(result.dividendAndAdjustmentRule, "unresolved");
  assert.equal(result.currencyConversion, "requested-but-method-unresolved");
  assert.equal(result.blockers.length, 4);
});

test("strict request adapter rejects changed currency, datatype, frequency, end and options", () => {
  for (const [before, after] of [
    ["~U$", "~E"], ["X(RI)", "X(P)"], ['"M"', '"D"'],
    ['"2010","","M"', '"2010","2026-01-22","M"'],
    ["MonthlyTSFormat=true", "MonthlyTSFormat=false"],
  ]) {
    assert.throws(() => inspectRetainedRiConvention({ ...fixture(), formula: fixture().formula.replace(before, after) }),
      /Unsupported or changed/);
  }
});

test("strict adapter requires independently corroborating comment and custom-property metadata", () => {
  assert.throws(() => inspectRetainedRiConvention({ ...fixture(), commentFormula: "" }), /provenance mismatch/);
  for (const customPropertyJson of ["{}", "null", '{"unrelated":"value"}']) {
    assert.throws(() => inspectRetainedRiConvention({ ...fixture(), customPropertyJson }), /provenance/);
  }
});

test("date adapter rejects epoch defaults, changed population and fractional/duplicate/reordered/invalid serials", () => {
  assert.throws(() => inspectRetainedRiConvention({ ...fixture(), date1904: true }), /date system/);
  assert.throws(() => inspectRetainedRiConvention({ ...fixture(), dateSerials: [] }), /date population/);
  for (const bad of [NaN, Infinity, 60, 40200.5, 2958466, 40231]) {
    const input = fixture();
    input.dateSerials[0] = bad;
    assert.throws(() => inspectRetainedRiConvention(input), /Excel date/);
  }
});

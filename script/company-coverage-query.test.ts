import test from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import { cvCompanies, cvTimeSeries } from "../shared/schema";
import { loadCurrentCoverageWorkbook } from "../server/snapshots/companyCoverage";
import { companyCoverage } from "../server/calculation/companyCoverage";
import { readFileSync } from "node:fs";
const dialect = new PgDialect();
const companies = [1, 2, 3].map(id => ({ id, isin: `test-${id}` }));
const rows = [
  { companyId: 1, date: new Date("2024-12-31T12:00:00Z"), marketCap: 10, scope1Emissions: null },
  { companyId: 2, date: new Date("2024-12-31T00:00:00Z"), marketCap: null, scope1Emissions: 0 },
  { companyId: 3, date: new Date("2024-11-30T00:00:00Z"), marketCap: 100, scope1Emissions: 50 },
  { companyId: 1, date: new Date("2025-01-01T00:00:00Z"), marketCap: 1000, scope1Emissions: 500 },
];
function fixture() {
  const queries: { sql: string; params: unknown[] }[] = [];
  let fullCompanyReads = 0;
  const connection = {
    select: () => ({ from: (table: unknown) => {
      if (table === cvCompanies) { fullCompanyReads++; return Promise.resolve(companies); }
      assert.equal(table, cvTimeSeries);
      // Deliberately non-thenable: unfiltered observation reads cannot succeed.
      return { where: async (query: any) => {
        const compiled = dialect.sqlToQuery(query); queries.push(compiled);
        const day = String(compiled.params[0]);
        return rows.filter(r => r.date.toISOString().slice(0, 10) === day);
      } };
    } }),
    execute: async (query: any) => {
      const compiled = dialect.sqlToQuery(query); queries.push(compiled);
      const cutoffDay = String(compiled.params[0]);
      const eligible = rows.filter(r => r.date.toISOString().slice(0, 10) <= cutoffDay);
      return { rows: [{ latest_date: eligible.map(r => r.date).sort((a, b) => b.getTime() - a.getTime())[0] ?? null }] };
    },
  };
  return { connection: connection as any, queries, companyReads: () => fullCompanyReads };
}
test("current-day bounded reads equal former full-history calculation, with full universe and null/missing preserved", async () => {
  const f = fixture(), informationCutoff = "2024-12-31T00:01:00Z";
  const bounded = await loadCurrentCoverageWorkbook(f.connection, { informationCutoff });
  assert.equal(bounded.observationDate, "2024-12-31");
  assert.equal(bounded.companies.length, 3); assert.equal(bounded.timeSeries.length, 2);
  const common = { reviews: [], observationDate: bounded.observationDate, informationCutoff, sourceId: "test" };
  assert.deepEqual(companyCoverage({ ...common, companies, observations: rows }),
    companyCoverage({ ...common, companies: bounded.companies, observations: bounded.timeSeries }));
  assert.equal(f.companyReads(), 1); assert.equal(f.queries.length, 2);
  assert.match(f.queries[0].sql, /SELECT max\(date\).*WHERE date </s);
  assert.match(f.queries[1].sql, /date.*>=.*AND.*date.*</s);
  assert.ok(f.queries.every(q => !/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|LOCK)\b/i.test(q.sql)));
});
test("explicit empty day skips MAX and returns all companies with missing, not null/zero observations", async () => {
  const f = fixture();
  const bounded = await loadCurrentCoverageWorkbook(f.connection,
    { observationDate: "2024-12-30", informationCutoff: "2025-01-02T00:00:00Z" });
  assert.equal(f.queries.length, 1); assert.equal(bounded.timeSeries.length, 0);
  const r = companyCoverage({ companies: bounded.companies, observations: bounded.timeSeries, reviews: [],
    observationDate: bounded.observationDate, informationCutoff: "2025-01-02T00:00:00Z", sourceId: "test" });
  assert.equal(r.fullWorkbook.denominator, 3);
  assert.equal(r.fullWorkbook.metrics.marketCap.states.missing, 3);
  assert.equal(r.fullWorkbook.metrics.marketCap.states.null, 0);
  assert.equal(r.fullWorkbook.metrics.marketCap.knownTotal, null);
});
test("future/invalid explicit days fail before any query and latest cutoff excludes future rows", async () => {
  for (const observationDate of ["2025-01-02", "2024-02-30", "not-a-date"]) {
    const f = fixture();
    await assert.rejects(loadCurrentCoverageWorkbook(f.connection, { observationDate, informationCutoff: "2025-01-01T00:00:00Z" }));
    assert.equal(f.companyReads(), 0); assert.equal(f.queries.length, 0);
  }
  const f = fixture();
  await assert.rejects(loadCurrentCoverageWorkbook(f.connection, { informationCutoff: "2020-01-01T00:00:00Z" }), /No workbook/);
});
test("production wrapper retains repeatable-read READ ONLY transaction and no source mutation helpers", () => {
  const source = readFileSync("server/snapshots/companyCoverage.ts", "utf8");
  assert.match(source, /db\.transaction\(tx => readCompanyCoverage\(tx, options\),\s*\{ isolationLevel: "repeatable read", accessMode: "read only" \}/);
  assert.doesNotMatch(source, /\b(?:INSERT INTO|UPDATE\s+\w+\s+SET|CREATE TABLE|ALTER TABLE|FOR UPDATE|pg_advisory|stageCompany|decideCompany)\b/);
  assert.match(source, /connection\.select\(\)\.from\(cvTimeSeries\)\.where/);
});

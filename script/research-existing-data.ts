/** Read-only, revised-history pilot. Never invent publication timestamps. */
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { evaluateSignal } from "../server/calculation/signalResearch";
import { mkdir, writeFile } from "node:fs/promises";
const result = await db.execute(sql`
  WITH selected AS (SELECT id FROM cv_companies ORDER BY id LIMIT 40),
  observations AS (
    SELECT t.*, c.sector,
      lead(t.total_return_index) OVER (PARTITION BY t.company_id ORDER BY t.date) AS next_ri,
      lead(t.date) OVER (PARTITION BY t.company_id ORDER BY t.date) AS next_date
    FROM cv_time_series t JOIN selected s ON s.id=t.company_id JOIN cv_companies c ON c.id=t.company_id
  )
  SELECT * FROM observations WHERE market_cap>0 AND total_return_index>0
    AND next_ri>0 AND price_earnings>0 AND scope1_emissions>=0 AND scope2_emissions>=0
    AND next_date <= date + interval '40 days'
  ORDER BY date, company_id`);
const date = (v: unknown) => new Date(String(v)).toISOString().slice(0, 10);
const rows = result.rows.map(r => ({
  date: date(r.date), publishedAt: null, outcomeAvailableAt: date(r.next_date),
  controls: [Math.log(Number(r.market_cap)), 1 / Number(r.price_earnings)],
  signal: -Math.log1p((Number(r.scope1_emissions) + Number(r.scope2_emissions)) / Number(r.market_cap)),
  outcome: Number(r.next_ri) / Number(r.total_return_index) - 1,
  sector: String(r.sector),
})).filter(r => r.date < "2019-12-01" || r.date >= "2020-01-01");
const protocol = { frozenAt: new Date().toISOString().slice(0, 10), splitDate: "2020-01-01",
  minimumMseImprovement: .05, specificationCount: 1, evidenceMode: "revised-history", uncertainty: "date-blocks" };
const run = (input: typeof rows, blockLength: number) => {
  try { return { result: evaluateSignal({ ...protocol, rows: input, blockLength }) }; }
  catch (e) { return { blocked: e instanceof Error ? e.message : "Invalid research inputs" }; }
};
const report = {
  scope: "First 40 workbook company IDs, complete contemporaneous fields only; not a representative universe sample.",
  publicationVintageAvailable: false, rows: rows.length,
  specification: "Next-observation total return; controls log market cap and earnings yield; signal negative log(1 + scope1+2 intensity). No carry-forward.",
  primary: run(rows, 3),
  sensitivity: [1, 6, 12].map(blockLength => ({ blockLength, ...run(rows, blockLength) })),
  sectors: [...new Set(rows.map(r => r.sector))].map(sector => ({ sector, ...run(rows.filter(r => r.sector === sector), 3) })),
  limitations: ["Source units/currencies are inherited and not independently harmonized.",
    "Historical workbook revisions, survivor selection and missing publication dates preclude investment claims.",
    "All sensitivity specifications are reported; none is selected as a replacement primary after seeing results."],
};
await mkdir("generated-artifacts/research", { recursive: true });
await writeFile("generated-artifacts/research/existing-data.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, sectors: report.sectors.map(s => ({ sector: s.sector,
  decision: s.result?.decision, blocked: s.blocked })) }, null, 2));
process.exit(0);

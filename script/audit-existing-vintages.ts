/** Read-only whole-dataset audit. Observation dates are not publication dates. */
import { db } from "../server/db";
import { sql } from "drizzle-orm";
import { mkdir, writeFile } from "node:fs/promises";
const stats = await db.execute(sql`
  WITH observations AS (
    SELECT *, lead(date) OVER (PARTITION BY company_id ORDER BY date) AS next_date,
      lead(total_return_index) OVER (PARTITION BY company_id ORDER BY date) AS next_ri
    FROM cv_time_series
  )
  SELECT count(*)::int AS observations, count(DISTINCT company_id)::int AS companies,
    min(date) AS first_date, max(date) AS last_date,
    count(*) FILTER (WHERE total_return_index IS NULL OR total_return_index<=0)::int AS missing_or_invalid_ri,
    count(*) FILTER (WHERE market_cap IS NULL OR market_cap<=0)::int AS missing_or_invalid_cap,
    count(*) FILTER (WHERE next_date > date + interval '40 days')::int AS long_return_gaps,
    count(*) FILTER (WHERE next_date IS NULL)::int AS terminal_observations
  FROM observations`);
const columns = await db.execute(sql`SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='cv_time_series'`);
const names = columns.rows.map(r => String(r.column_name));
const report = { ...stats.rows[0],
  storedEvidenceFields: { publicationDate: names.includes("published_at"), universeMembership: names.includes("universe_known_at"),
    corporateActionVerification: names.includes("corporate_actions_verified"), delistingVerification: names.includes("delisting_verified") },
  classification: "revised-history-not-point-in-time", certified: false,
  limitations: ["A terminal observation is not proof of delisting.",
    "Accounting lags cannot establish actual publication dates.",
    "No publication-vintage or historical-membership evidence is supplied by the current workbook schema."],
};
await mkdir("generated-artifacts/research", { recursive: true });
await writeFile("generated-artifacts/research/vintage-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(0);

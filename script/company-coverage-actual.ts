/** Authorized existing DEVELOPMENT data only; transaction is repeatable-read READ ONLY.
 * Emits aggregates, never workbook issuer rows, financial payloads or source contents.
 */
import { getCompanyCoverage } from "../server/snapshots/companyCoverage";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
if (process.env.NODE_ENV === "production") throw new Error("Development aggregate evidence only");
try {
  const snapshotId = process.argv[3];
  const report = await getCompanyCoverage({ informationCutoff: new Date().toISOString(),
    observationDate: process.argv[2] === "latest" ? undefined : process.argv[2], snapshotId });
  const dates = await db.transaction(tx => tx.execute(sql`SELECT max(date) AS latest_emissions_date,
    count(DISTINCT company_id)::int AS companies_with_any_dated_emissions FROM cv_time_series
    WHERE scope1_emissions IS NOT NULL OR scope2_emissions IS NOT NULL OR scope3_emissions IS NOT NULL`),
    { isolationLevel: "repeatable read", accessMode: "read only" });
  const latestEmissionsDate = dates.rows[0]?.latest_emissions_date
    ? new Date(dates.rows[0].latest_emissions_date as string).toISOString().slice(0, 10) : null;
  const emissionsReferenceReport = latestEmissionsDate && latestEmissionsDate !== report.observationDate
    ? await getCompanyCoverage({ informationCutoff: report.informationCutoff, observationDate: latestEmissionsDate, snapshotId }) : null;
  console.log(JSON.stringify({ executedAt: new Date().toISOString(), access: "repeatable-read read-only",
    report, emissionsDateContext: { source: "current database workbook; reference report independently evaluates selected snapshot at this exact date", latestEmissionsDate,
      companiesWithAnyDatedEmissions: dates.rows[0]?.companies_with_any_dated_emissions },
    emissionsReferenceReport }, null, 2));
  process.exit(0);
} catch (error) {
  console.error("Coverage aggregate failed:", error instanceof Error ? error.message : "Unknown error");
  process.exit(1);
}

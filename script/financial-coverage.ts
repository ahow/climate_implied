/** Existing read-only census consumer now reports all seven actual states,
 * complete immutable workbook and verified-eligible denominators,not accepted
 * versus collapsed unresolved. Never calls a provider or changes approvals. */
import { getStage10Coverage } from "../server/financialData/stage10Source";
try {
  const report = await getStage10Coverage();
  const identityRows = report.rows.filter(row => row.sector === "All sectors" && row.dimension === "identity");
  const count = (key: string) => {
    const n = identityRows.find(r => r.population === "full-workbook" && r.key === key)?.present;
    if (n === null || n === undefined) throw new Error("Legacy95%acceptance gate unavailable from suppressed counts; no zero substitution");
    return n;
  };
  const outOfScope = count("out-of-scope"), eligible = report.fullWorkbookCompanies - outOfScope, accepted = count("accepted");
  const coverage = eligible === 0 ? 0 : accepted / eligible;
  console.log(JSON.stringify({ ...report,
    universe: report.fullWorkbookCompanies, eligible, accepted, unresolved: eligible - accepted, outOfScope,
    coverage, passed: coverage >= 0.95,
    eligibilityRule: "Legacy95%identity-acceptance gate retained: checksum-valid ISIN denominator; independent current accepted identities only. Immutable verified-eligible financial/history population is separately named; this gate never admits historical model records.",
    rows: identityRows }, null, 2));
  process.exit(0);
} catch {
  console.error("Retained Stage10 census unavailable; source/storage failures are not zero coverage or not-queried identities");
  process.exit(1);
}

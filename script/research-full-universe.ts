/** Supplementary old-signal diagnostic, NOT the Stage 14 valuation-gap study. */
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadSnapshot, resolveSnapshot } from "../server/snapshots/store";
import { evaluateSignal } from "../server/calculation/signalResearch";

async function main() {
  const header = await resolveSnapshot(process.argv[2]);
  if (!header) throw new Error("Immutable workbook snapshot required");
  const data = await loadSnapshot(header);
  const rows = [...data.timeSeries].sort((a, b) => a.companyId - b.companyId || a.date.getTime() - b.date.getTime());
  const observations = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const r = rows[i], next = rows[i + 1];
    if (r.companyId !== next.companyId || next.date.getTime() - r.date.getTime() > 40 * 86400000) continue;
    if (!(r.marketCap! > 0 && r.totalReturnIndex! > 0 && next.totalReturnIndex! > 0 && r.priceEarnings! > 0) ||
      r.scope1Emissions === null || r.scope2Emissions === null || r.scope1Emissions < 0 || r.scope2Emissions < 0) continue;
    const date = r.date.toISOString().slice(0, 10), outcomeAvailableAt = next.date.toISOString().slice(0, 10);
    if (date >= "2019-12-01" && date < "2020-01-01") continue;
    observations.push({ date, outcomeAvailableAt, publishedAt: null,
      controls: [Math.log(r.marketCap!), 1 / r.priceEarnings!],
      signal: -Math.log1p((r.scope1Emissions + r.scope2Emissions) / r.marketCap!),
      outcome: next.totalReturnIndex! / r.totalReturnIndex! - 1 });
  }
  observations.sort((a, b) => a.date.localeCompare(b.date));
  const protocol = await readFile("docs/Full_Universe_Diagnostic_Protocol.md");
  const results = [3, 1, 6, 12].map(blockLength => {
    try { return { blockLength, result: evaluateSignal({
      rows: observations, frozenAt: "2026-11-08", splitDate: "2020-01-01", minimumMseImprovement: .05,
      specificationCount: 1, evidenceMode: "revised-history", uncertainty: "date-blocks", blockLength,
    }, 1000000) }; }
    catch (e) { return { blockLength, error: e instanceof Error ? e.message : "Study failed" }; }
  });
  const report = { snapshotId: header.id, protocolHash: createHash("sha256").update(protocol).digest("hex"),
    companies: header.companyCount, sourceObservations: header.observationCount,
    eligibleObservations: observations.length, excludedObservations: header.observationCount - observations.length,
    historyBasis: "revised-history", priorExposure: "2020 onward", investmentEvidence: false,
    currencyUnitReconciliation: "not-established; results are preliminary numerical diagnostics",
    signal: "legacy-emissions-intensity-not-new-valuation-gap", results };
  await mkdir("generated-artifacts/research", { recursive: true });
  await writeFile("generated-artifacts/research/full-universe.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
main().then(() => process.exit(0)).catch(() => { console.error("Full-universe study failed"); process.exit(1); });

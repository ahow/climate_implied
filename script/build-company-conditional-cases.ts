/**
 * Read-only with respect to DB/reviews/collectors. Prints a compact derived
 * report to stdout; never copies retained provider statements or source text.
 */
import { readFile } from "node:fs/promises";
import { contentHash } from "../server/calculation/analysisManifest";
import { unpackCompanySource } from "../server/calculation/companySourceArchive";
import {
  calculateCcsOperatingChannel, ccsDeliveryAssumptions, issuerCaseDecisions, buildFplSolarCases,
} from "../server/calculation/companyConditionalCases";

async function main() {
  const receipts = JSON.parse(await readFile("docs/company_operating_source_receipts.json", "utf8"));
  const evidence = [];
  for (const symbol of ["NEE", "XOM", "CAT"]) {
    const receipt = receipts.find((r: { symbol: string }) => r.symbol === symbol);
    if (!receipt) throw new Error(`Missing receipt for ${symbol}`);
    const packet = JSON.parse(await readFile(
      `generated-artifacts/company-operating-corpus/${symbol}-${receipt.sourceArchiveId}.json`, "utf8"));
    const source = unpackCompanySource(receipt.sourceArchiveId, packet.sources[0]);
    if (source.isin !== receipt.isin || source.contentHash !== receipt.sourceTextHash ||
        source.url !== receipt.url || source.retrievedAt !== receipt.availableAt ||
        source.publishedDate !== receipt.reportedPublicationDate)
      throw new Error(`Receipt/source mismatch for ${symbol}`);
    if (symbol === "XOM" && !source.content.includes("roughly 9 million metric tons of CO₂ annually"))
      throw new Error("Contracted CCS source claim missing; manual source review required");
    evidence.push({ symbol, url: source.url, publishedDate: source.publishedDate,
      availableAt: source.retrievedAt, sourceTextHash: source.contentHash,
      sourceArchiveId: receipt.sourceArchiveId, reviewStatus: "pending; content integrity is not authenticity approval" });
  }
  const xom = evidence.find(e => e.symbol === "XOM")!;
  const assumptions = {
    sourceTextHash: xom.sourceTextHash, availableAt: xom.availableAt,
    knowledgeCutoff: "2026-11-10T04:00:00.000Z", firstYear: 2027,
    contractedAnnualTonnes: 9_000_000,
    members: ccsDeliveryAssumptions.map(m => ({
      ...m, annualContractDeliveryFraction: [...m.annualContractDeliveryFraction],
    })),
  };
  const result = calculateCcsOperatingChannel(assumptions);
  console.log(JSON.stringify({
    version: "conditional-climate-channel-2",
    evidence, assumptions, assumptionHash: contentHash(assumptions),
    measuredVsAssumed: {
      contractedAnnualTonnes: "Dated approximate issuer contractual claim; not measured annual injection.",
      deliveryFractions: "Frozen analyst stress assumptions, not observed or calibrated.",
      monetarySensitivity: "Algebraic derivative in nominal USD per USD/tonne; no assumed tariff, margin or credit.",
    },
    result, fplSolarCases: buildFplSolarCases(), issuerCaseDecisions,
    fullCompanyEngineRuns: 0,
    refusal: "No complete, defensible companyProjection input exists in these packets. Missing scope/operating fields are not zero-filled or replaced by accounting controls.",
    productionEligible: false, approvalsIssued: 0,
  }, null, 2));
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Conditional case preparation failed");
  process.exitCode = 1;
});

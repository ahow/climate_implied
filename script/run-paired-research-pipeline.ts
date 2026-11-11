import { readFile, mkdir, writeFile } from "node:fs/promises";
import { contentHash } from "../server/calculation/analysisManifest";
import { runPairedResearchPipeline } from "../server/calculation/pairedResearchPipeline";
import { buildTrackBAdmissionWorkbook } from "../server/calculation/trackBAdmissionWorkbook";
import { bindTrackBAdmission } from "../shared/trackBAdmissionContract";
import { trackBPeriodDomainHash } from "../server/trackBDisclosureStore";

async function main() {
  const [protocolPath, expectedHash, corpusPath] = process.argv.slice(2);
  if (!protocolPath || !expectedHash || !corpusPath || process.argv.length !== 5)
    throw new Error("Usage: npx tsx script/run-paired-research-pipeline.ts frozen-protocol.json PRECOMMITTED_SHA256 retained-corpus.json");
  const protocol = JSON.parse(await readFile(protocolPath, "utf8"));
  const corpus = JSON.parse(await readFile(corpusPath, "utf8"));
  const result = runPairedResearchPipeline(protocol, expectedHash, corpus);
  const directory = "generated-artifacts/paired-research-pipeline";
  await mkdir(directory, { recursive: true });
  const path = `${directory}/${contentHash(result)}.json`, text = JSON.stringify(result, null, 2) + "\n";
  try { await writeFile(path, text, { flag: "wx" }); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(path, "utf8") !== text) throw e;
  }
  const trackBWorkbookPath = `${directory}/${contentHash(result)}-track-b-admission.xlsx`;
  const workbook = buildTrackBAdmissionWorkbook(result.trackBAdmission);
  try { await writeFile(trackBWorkbookPath, workbook, { flag: "wx" }); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST" || !(await readFile(trackBWorkbookPath)).equals(workbook)) throw e;
  }
  const report = bindTrackBAdmission(result.trackBAdmission).report, reportHash = contentHash(report);
  const reportPath = `${directory}/${reportHash}.report.json`;
  const draft = { contract: "track-b-public-disclosure-1", status: "unpublished",
    classification: corpus.mode === "engineering-fixture" ? "engineering-fixture" : "retained-research",
    protocolHash: report.protocolHash, reportHash, pipelineResultHash: contentHash(result), corpusHash: report.corpusHash,
    periodDomainHash: trackBPeriodDomainHash(report), providerPayloadIncluded: false,
    review: { kind: "not-reviewed" }, scientificAcceptance: false, investmentEvidence: false };
  const disclosureDraftPath = `${directory}/${contentHash(draft)}.disclosure.json`;
  for (const [file, value] of [[reportPath, report], [disclosureDraftPath, draft]] as const) {
    const text = JSON.stringify(value, null, 2) + "\n";
    try { await writeFile(file, text, { flag: "wx" }); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(file, "utf8") !== text) throw e; }
  }
  console.log(JSON.stringify({ path, trackBWorkbookPath, reportPath, disclosureDraftPath, efficacy: result.efficacy, scientificAcceptance: false,
    familySize: result.family.familySize, unavailable: result.family.unavailableHypotheses }));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Pipeline failed"); process.exitCode = 1; });

import { contentHash } from "./analysisManifest";
import { assessTrackBAdmission } from "./trackBAdmission";
import { calculationSourceArtifact } from "../snapshots/calculationSourceArtifact";
/** Prospective full assessment inputs retained privately beside the existing
 * CLI pipeline artifacts. Never added to public disclosure/report documents. */
export function captureTrackBExportMaterial(protocol: any, corpus: any, report: unknown, code = calculationSourceArtifact()) {
  const protocolHash = contentHash(protocol), replay = assessTrackBAdmission(protocol, protocolHash, corpus);
  if (contentHash(replay) !== contentHash(report)) throw new Error("TrackB actual assessment producer/input replay conflicts");
  return { version: "track-b-assessment-material-1", protocol, protocolHash, corpus, corpusHash: contentHash(corpus),
    reportHash: contentHash(report), code,
    model: "track-b-period-admission-1", runMeaning: "Deterministic period admission assessment of full frozen protocol/corpus, not numerical efficacy acceptance",
    seed: null, seedMeaning: "Admission decisions are deterministic; research protocol resampling settings remain in full captured protocol; not a new random study run" };
}
export function replayTrackBExportMaterial(input: ReturnType<typeof captureTrackBExportMaterial>, report: unknown) {
  if (input.version !== "track-b-assessment-material-1" || input.protocolHash !== contentHash(input.protocol) ||
    input.corpusHash !== contentHash(input.corpus) || contentHash(input.code.payload) !== input.code.id ||
    input.code.id !== calculationSourceArtifact().id || input.reportHash !== contentHash(report) ||
    contentHash(assessTrackBAdmission(input.protocol, input.protocolHash, input.corpus)) !== input.reportHash)
    throw new Error("TrackB full assessment source/code/material replay unavailable, corrupt or unsupported release");
  return report;
}

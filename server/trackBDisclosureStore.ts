import { open, realpath, lstat, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, sep } from "node:path";
import { contentHash } from "./calculation/analysisManifest";
import { bindTrackBAdmission, type TrackBAdmissionReport } from "../shared/trackBAdmissionContract";
import { trackBDisclosureSchema, trackBPublicPinSchema, type TrackBPublicPin } from "../shared/trackBDisclosureContract";
import { trackBPublicCatalog } from "./trackBPublicCatalog";
import { rememberReportRelease } from "./snapshots/reportMaterialContext";

export const TRACK_B_PUBLIC_ROOT = "generated-artifacts/track-b-public";
export class TrackBDisclosureError extends Error {
  constructor(public status: 403 | 404 | 503, message: string) { super(message); }
}
export function trackBPeriodDomainHash(report: TrackBAdmissionReport) {
  return contentHash(report.periods.map(p => ({ specification: p.specification, origin: p.origin,
    informationCutoff: p.informationCutoff, executionAt: p.executionAt, endAt: p.endAt })));
}
export type PublishedTrackBReport = { report: TrackBAdmissionReport; identity: TrackBPublicPin };
export function validateTrackBPublication(pinInput: unknown, disclosureInput: unknown, reportInput: unknown,
  allowEngineeringFixtures = false): PublishedTrackBReport {
  const pin = trackBPublicPinSchema.parse(pinInput), disclosure = trackBDisclosureSchema.parse(disclosureInput);
  const { report } = bindTrackBAdmission(reportInput);
  if (contentHash(disclosure) !== pin.disclosureHash || contentHash(report) !== pin.reportHash)
    throw new TrackBDisclosureError(503, "Retained public disclosure/report hash mismatch");
  if (disclosure.status !== "published" || disclosure.review.kind === "not-reviewed")
    throw new TrackBDisclosureError(403, "Retained report is unpublished or lacks public disclosure authorization");
  const engineering = disclosure.classification === "engineering-fixture" || disclosure.review.kind === "synthetic-development-only";
  if (engineering && !(allowEngineeringFixtures && process.env.NODE_ENV === "development" &&
    disclosure.classification === "engineering-fixture" && disclosure.review.kind === "synthetic-development-only"))
    throw new TrackBDisclosureError(403, "Synthetic DEV disclosure is not authorized for real/production publication");
  if (!engineering && disclosure.review.kind !== "operator-public-disclosure")
    throw new TrackBDisclosureError(403, "No operator public-disclosure review is retained");
  if (pin.protocolHash !== report.protocolHash || disclosure.protocolHash !== report.protocolHash ||
    disclosure.reportHash !== pin.reportHash || disclosure.pipelineResultHash !== pin.pipelineResultHash ||
    disclosure.corpusHash !== report.corpusHash || disclosure.periodDomainHash !== pin.periodDomainHash ||
    trackBPeriodDomainHash(report) !== pin.periodDomainHash)
    throw new TrackBDisclosureError(503, "Public report protocol/pipeline/corpus/origin/specification/cutoff identity mismatch");
  return { report, identity: pin };
}
/** Server-owned fixed root and reviewed catalog; injectable only from trusted
 * code for isolated DEV tests. Nothing here takes a request path/review/approval.
 * Public reads never open original pipeline archives or filing/provider bytes. */
export function createTrackBPublicationReader(options: {
  root?: string; catalog?: readonly TrackBPublicPin[]; allowEngineeringFixtures?: boolean;
} = {}) {
  const root = resolve(options.root ?? TRACK_B_PUBLIC_ROOT);
  const injected = Object.keys(options).length > 0;
  const catalog = [...(options.catalog ?? trackBPublicCatalog)].map(p => trackBPublicPinSchema.parse(p));
  const safeRead = async (hash: string, kind: "report" | "disclosure") => {
    if ((await lstat(root)).isSymbolicLink()) throw new TrackBDisclosureError(503, "Public retained root must not be a symbolic link");
    const file = resolve(root, `${hash}.${kind}.json`);
    const stat = await lstat(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 16 * 1024 * 1024)
      throw new TrackBDisclosureError(503, "Public retained artifact is not a bounded regular file");
    const realRoot = await realpath(root), realFile = await realpath(file);
    if (!realFile.startsWith(realRoot + sep)) throw new TrackBDisclosureError(503, "Public retained artifact escapes fixed root");
    const fileHandle = await open(realFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const actual = await fileHandle.stat();
      if (!actual.isFile() || actual.size > 16 * 1024 * 1024)
        throw new TrackBDisclosureError(503, "Public retained artifact changed or exceeds bounded size");
      return JSON.parse(await fileHandle.readFile("utf8"));
    } finally { await fileHandle.close(); }
  };
  return async (protocolHash: string): Promise<PublishedTrackBReport> => {
    if (injected && !(process.env.NODE_ENV === "development" && options.allowEngineeringFixtures === true))
      throw new TrackBDisclosureError(403, "Injected disclosure roots/catalogs are isolated synthetic DEV only; not authorized for real publication");
    if (!/^[a-f0-9]{64}$/.test(protocolHash)) throw new TrackBDisclosureError(404, "Invalid exact protocol identity");
    const matches = catalog.filter(p => p.protocolHash === protocolHash);
    if (!matches.length) throw new TrackBDisclosureError(404, "No source-authorized public disclosure for this exact protocol");
    if (matches.length !== 1) throw new TrackBDisclosureError(503, "Ambiguous trusted public protocol pin; no latest/survivor substitution");
    const pin = matches[0];
    try {
      const disclosure = await safeRead(pin.disclosureHash, "disclosure");
      if (injected && (disclosure.classification !== "engineering-fixture" || disclosure.review?.kind !== "synthetic-development-only"))
        throw new TrackBDisclosureError(403, "Injected catalog cannot grant a real operator disclosure authorization");
      const validated = validateTrackBPublication(pin, disclosure,
        await safeRead(pin.reportHash, "report"), options.allowEngineeringFixtures);
      const result = { report: validated.report, identity: { ...validated.identity } };
      let assessment = null;
      try {
        const path = resolve("generated-artifacts/paired-research-pipeline", `${pin.reportHash}.assessment-inputs.json`);
        if ((await lstat(path)).isSymbolicLink()) throw new Error("Assessment input symlink forbidden");
        assessment = JSON.parse(await readFile(path, "utf8"));
      } catch {
        // Missing historical/prospective material never disables ordinary
        // rights-qualified report retrieval, and cannot grant a bound claim.
        assessment = null;
      }
      rememberReportRelease(result.report, "track-b-publication", {
        version: "track-b-consumed-publication-1", pin, disclosure, report: validated.report,
        assessment,
        allowEngineeringFixtures: options.allowEngineeringFixtures === true,
        meaning: "Actual rights-qualified public disclosure/report release, not raw private research inputs or a rerun of the study pipeline",
      });
      return result;
    } catch (error) {
      if (error instanceof TrackBDisclosureError) throw error;
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new TrackBDisclosureError(404, "Source-pinned public disclosure/report bytes are missing");
      throw new TrackBDisclosureError(503, "Retained public disclosure/report is corrupt or unreadable");
    }
  };
}
export const loadPublishedTrackBAdmission = createTrackBPublicationReader();

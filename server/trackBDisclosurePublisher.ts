import { readFile, mkdir, writeFile, lstat } from "node:fs/promises";
import { contentHash } from "./calculation/analysisManifest";
import { validateTrackBPublication, TRACK_B_PUBLIC_ROOT } from "./trackBDisclosureStore";
import { trackBPublicCatalog } from "./trackBPublicCatalog";
import { trackBPublicPinSchema, type TrackBPublicPin } from "../shared/trackBDisclosureContract";

/** Offline authorized-workspace command only. Copies ONLY already source-pinned
 * reviewed bytes; never makes a review decision or creates a catalog approval.
 * Test injection is trusted code, not an HTTP/env/path/review override. */
export async function publishPinnedTrackBReport(protocolHash: string, options: {
  catalog?: readonly TrackBPublicPin[]; pipelineRoot?: string; publicRoot?: string; allowEngineeringFixtures?: boolean;
} = {}) {
  const injected = Object.keys(options).length > 0;
  if (injected && !(process.env.NODE_ENV === "development" && options.allowEngineeringFixtures === true))
    throw new Error("Injected publication inputs are isolated synthetic DEV only and cannot grant approval");
  if (!/^[a-f0-9]{64}$/.test(protocolHash)) throw new Error("Exact protocol SHA256 required");
  const matches = (options.catalog ?? trackBPublicCatalog).filter(p => p.protocolHash === protocolHash);
  if (matches.length !== 1) throw new Error("Exactly one reviewed source-catalog publication pin is required; this command cannot grant approval");
  const pin = trackBPublicPinSchema.parse(matches[0]), source = options.pipelineRoot ?? "generated-artifacts/paired-research-pipeline";
  const disclosure = JSON.parse(await readFile(`${source}/${pin.disclosureHash}.disclosure.json`, "utf8"));
  if (injected && (disclosure.classification !== "engineering-fixture" || disclosure.review?.kind !== "synthetic-development-only"))
    throw new Error("Injected catalog cannot grant a real operator disclosure authorization");
  const report = JSON.parse(await readFile(`${source}/${pin.reportHash}.report.json`, "utf8"));
  const pipeline = JSON.parse(await readFile(`${source}/${pin.pipelineResultHash}.json`, "utf8"));
  const validated = validateTrackBPublication(pin, disclosure, report, options.allowEngineeringFixtures);
  if (contentHash(pipeline) !== pin.pipelineResultHash || contentHash(pipeline.trackBAdmission) !== pin.reportHash)
    throw new Error("Retained CLI pipeline and allowlisted report identities disagree");
  const root = options.publicRoot ?? TRACK_B_PUBLIC_ROOT;
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink()) throw new Error("Public publication root must not be a symbolic link");
  for (const [hash, kind, value] of [[pin.reportHash, "report", validated.report], [pin.disclosureHash, "disclosure", disclosure]] as const) {
    const path = `${root}/${hash}.${kind}.json`, text = JSON.stringify(value, null, 2) + "\n";
    try { await writeFile(path, text, { flag: "wx" }); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(path, "utf8") !== text) throw e; }
  }
  return { ...pin, scientificAcceptance: false as const, investmentEvidence: false as const };
}

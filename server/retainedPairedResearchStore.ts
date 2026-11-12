import { z } from "zod";
import { open, realpath, lstat, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve, sep } from "node:path";
import { contentHash } from "./calculation/analysisManifest";
import { trackBDisclosureSchema } from "../shared/trackBDisclosureContract";
import {
  retainedPairedPinSchema, retainedPairedReportSchema, retainedPairedPinKey,
  type RetainedPairedPin, type RetainedPairedReport,
} from "../client/src/components/retained-paired-research-contract";
import { retainedPairedResearchCatalog } from "./retainedPairedResearchCatalog";
import { buildRetainedPairedResearch } from "./retainedPairedResearchProjection";

export const RETAINED_PAIRED_PUBLIC_ROOT = "generated-artifacts/paired-research-public";
export const RETAINED_PAIRED_PIPELINE_ROOT = "generated-artifacts/paired-research-pipeline";
export const retainedPairedDisclosureSchema = trackBDisclosureSchema.omit({
  contract: true, periodDomainHash: true,
}).extend({
  contract: z.literal("retained-paired-research-disclosure-1"),
  originDomainHash: retainedPairedPinSchema.shape.originDomainHash,
  sourceContextHash: retainedPairedPinSchema.shape.sourceContextHash,
  codeContextHash: retainedPairedPinSchema.shape.codeContextHash,
}).strict();
export class RetainedPairedError extends Error {
  constructor(public status: 403 | 404 | 409 | 503, message: string) { super(message); }
}
type Options = { root?: string; catalog?: readonly RetainedPairedPin[]; allowEngineeringFixtures?: boolean };
function requireDev(options: object, allowEngineeringFixtures?: boolean) {
  if (Object.keys(options).length && !(process.env.NODE_ENV === "development" && allowEngineeringFixtures === true))
    throw new RetainedPairedError(403, "Injected roots/catalogs are synthetic DEV engineering only; cannot authorize real publication");
}
/** Bounded, no-follow reads within a server-owned root. The hash and kind are
 * internal values from the trusted catalog, never filesystem request inputs. */
export async function readRetainedPairedArtifact(rootInput: string, hash: string, kind: string): Promise<unknown> {
  if (!/^[a-f0-9]{64}$/.test(hash) || !["paired-report", "paired-disclosure", "paired-inputs", "pipeline"].includes(kind))
    throw new RetainedPairedError(503, "Invalid retained artifact identity");
  const root = resolve(rootInput);
  try {
    if ((await lstat(root)).isSymbolicLink()) throw new Error("Root symlink");
    const path = resolve(root, `${hash}${kind === "pipeline" ? "" : `.${kind}`}.json`);
    const stat = await lstat(path);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 64 * 1024 * 1024) throw new Error("Unbounded/nonregular artifact");
    const realRoot = await realpath(root), realFile = await realpath(path);
    if (!realFile.startsWith(realRoot + sep)) throw new Error("Artifact escapes root");
    const handle = await open(realFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const actual = await handle.stat();
      if (!actual.isFile() || actual.size > 64 * 1024 * 1024) throw new Error("Artifact changed");
      return JSON.parse(await handle.readFile("utf8"));
    } finally { await handle.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      throw new RetainedPairedError(404, "Exact retained public artifact is missing; no fallback returned");
    throw new RetainedPairedError(503, "Retained artifact is corrupt, unsafe or unreadable");
  }
}
export function retainedPairedIdentity(report: RetainedPairedReport, disclosureHash: string): RetainedPairedPin {
  return retainedPairedPinSchema.parse({
    protocolHash: report.protocolHash, reportHash: contentHash(report), disclosureHash,
    pipelineResultHash: report.pipelineResultHash, corpusHash: report.corpusHash,
    originDomainHash: contentHash(report.originDomain), sourceContextHash: contentHash(report.sourceContext),
    codeContextHash: contentHash(report.codeContext),
  });
}
export function validateRetainedPairedPublication(pinInput: unknown, disclosureInput: unknown,
  reportInput: unknown, allowEngineeringFixtures = false) {
  const pin = retainedPairedPinSchema.parse(pinInput), report = retainedPairedReportSchema.parse(reportInput);
  const disclosure = retainedPairedDisclosureSchema.parse(disclosureInput);
  if (retainedPairedPinKey(retainedPairedIdentity(report, contentHash(disclosure))) !== retainedPairedPinKey(pin))
    throw new RetainedPairedError(503, "Public report/disclosure or context hash mismatch");
  for (const [key, value] of Object.entries(pin)) {
    if (key !== "disclosureHash" && disclosure[key as keyof typeof disclosure] !== value)
      throw new RetainedPairedError(503, `Retained disclosure ${key} binding mismatch`);
  }
  if (disclosure.status !== "published" || disclosure.review.kind === "not-reviewed")
    throw new RetainedPairedError(403, "Unpublished report or missing source-authorized public disclosure review");
  if (report.classification !== disclosure.classification)
    throw new RetainedPairedError(403, "Report/disclosure classification mismatch");
  const engineering = report.classification === "engineering-fixture" || disclosure.review.kind === "synthetic-development-only";
  if (engineering && !(allowEngineeringFixtures && process.env.NODE_ENV === "development" &&
    report.classification === "engineering-fixture" && disclosure.review.kind === "synthetic-development-only"))
    throw new RetainedPairedError(403, "Synthetic artifacts are DEV engineering only, not real/production publications");
  if (!engineering && disclosure.review.kind !== "operator-public-disclosure")
    throw new RetainedPairedError(403, "No operator public disclosure review retained");
  return { report, identity: pin };
}
export function createRetainedPairedResearchReader(options: Options = {}) {
  const catalog = (options.catalog ?? retainedPairedResearchCatalog).map(pin => retainedPairedPinSchema.parse(pin));
  return async (selected: RetainedPairedPin) => {
    requireDev(options, options.allowEngineeringFixtures);
    const pin = retainedPairedPinSchema.parse(selected);
    const matches = catalog.filter(candidate => retainedPairedPinKey(candidate) === retainedPairedPinKey(pin));
    if (!matches.length) throw new RetainedPairedError(catalog.some(candidate => candidate.protocolHash === pin.protocolHash) ? 409 : 404,
      "No exact source-authorized eight-hash publication selection; no replacement returned");
    if (matches.length !== 1) throw new RetainedPairedError(503, "Ambiguous trusted publication identity");
    const root = options.root ?? RETAINED_PAIRED_PUBLIC_ROOT;
    const disclosure = await readRetainedPairedArtifact(root, pin.disclosureHash, "paired-disclosure");
    if (Object.keys(options).length && (disclosure as { classification?: string }).classification !== "engineering-fixture")
      throw new RetainedPairedError(403, "Injected catalog cannot grant real operator publication authorization");
    try {
      return validateRetainedPairedPublication(pin, disclosure,
        await readRetainedPairedArtifact(root, pin.reportHash, "paired-report"), options.allowEngineeringFixtures);
    } catch (error) {
      if (error instanceof RetainedPairedError) throw error;
      throw new RetainedPairedError(503, "Retained paired report failed its strict public contract");
    }
  };
}
export const loadPublishedRetainedPairedResearch = createRetainedPairedResearchReader();

/** Exclusive content-addressed writes; existing bytes must be exactly equal. */
export async function writeRetainedPairedArtifact(root: string, hash: string,
  kind: "paired-report" | "paired-disclosure" | "paired-inputs" | "pipeline", value: unknown) {
  if (!/^[a-f0-9]{64}$/.test(hash) || (kind === "paired-inputs"
    ? (value as { pipelineResultHash?: string }).pipelineResultHash !== hash
    : contentHash(value) !== hash)) throw new Error("Artifact hash mismatch before write");
  await mkdir(root, { recursive: true });
  if ((await lstat(root)).isSymbolicLink()) throw new Error("Retained root symlink forbidden");
  const path = resolve(root, `${hash}${kind === "pipeline" ? "" : `.${kind}`}.json`);
  try { await writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST" ||
      contentHash(await readRetainedPairedArtifact(root, hash, kind)) !== contentHash(value)) throw error;
  }
}

/** No approval creation. Only copies a reviewed, source-catalog-pinned public
 * projection after rerunning its actual private offline pipeline inputs. */
export async function publishPinnedRetainedPairedResearch(selected: RetainedPairedPin, options: {
  catalog?: readonly RetainedPairedPin[]; pipelineRoot?: string; publicRoot?: string; allowEngineeringFixtures?: boolean;
} = {}) {
  requireDev(options, options.allowEngineeringFixtures);
  const pin = retainedPairedPinSchema.parse(selected);
  const matches = (options.catalog ?? retainedPairedResearchCatalog).filter(p => retainedPairedPinKey(p) === retainedPairedPinKey(pin));
  if (matches.length !== 1) throw new RetainedPairedError(403, "Exactly one reviewed source-catalog pin required; publisher cannot grant approval");
  const source = options.pipelineRoot ?? RETAINED_PAIRED_PIPELINE_ROOT;
  const disclosure = await readRetainedPairedArtifact(source, pin.disclosureHash, "paired-disclosure");
  if (Object.keys(options).length && (disclosure as { classification?: string }).classification !== "engineering-fixture")
    throw new RetainedPairedError(403, "Injected publisher cannot grant real operator publication authorization");
  const published = validateRetainedPairedPublication(pin, disclosure,
    await readRetainedPairedArtifact(source, pin.reportHash, "paired-report"), options.allowEngineeringFixtures);
  const pipeline = await readRetainedPairedArtifact(source, pin.pipelineResultHash, "pipeline");
  // Inputs are addressed by a deterministic binding to the exact pipeline hash,
  // retained separately by the producer; never opened by public HTTP readers.
  const receipt = await readRetainedPairedArtifact(source, pin.pipelineResultHash, "paired-inputs") as {
    protocol: unknown; corpus: unknown; pipelineResultHash: string;
  };
  if (receipt.pipelineResultHash !== pin.pipelineResultHash)
    throw new RetainedPairedError(503, "Private retained pipeline input receipt binding mismatch");
  const actual = await buildRetainedPairedResearch(receipt.protocol, pin.protocolHash, receipt.corpus);
  if (contentHash(pipeline) !== pin.pipelineResultHash || contentHash(actual.pipeline) !== pin.pipelineResultHash ||
    contentHash(actual.report) !== pin.reportHash)
    throw new RetainedPairedError(503, "Actual retained pipeline/projection/source/code mismatch; publication refused");
  const root = options.publicRoot ?? RETAINED_PAIRED_PUBLIC_ROOT;
  await writeRetainedPairedArtifact(root, pin.reportHash, "paired-report", published.report);
  await writeRetainedPairedArtifact(root, pin.disclosureHash, "paired-disclosure", disclosure);
  return pin;
}

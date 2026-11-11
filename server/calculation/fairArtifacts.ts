import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ensembleSchema } from "./ensemble";
import { fairArtifactCatalog, fairArtifactSelection, fairSha256 } from "./fairArtifactCatalog";

export class FairArtifactError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const fairArtifactSelectionSchema = z.object({
  artifactId: z.string().min(1).max(100),
  version: z.string().min(1).max(80),
  manifestSha256: hash, ensembleSha256: hash, memberIdsSha256: hash,
}).strict();
export type FairArtifactSelection = z.infer<typeof fairArtifactSelectionSchema>;
const resultSchema = z.object({
  fairVersion: z.literal("2.2.4"), upstreamRevision: z.string(),
  ensembleMembers: z.number().int(),
  status: z.literal("reference_execution_only_not_validated_for_dashboard"),
  temperatureBaseline: z.literal("1850–1900 annual mean"),
  inputs: z.array(z.object({ file: z.string(), sha256: hash })).length(4),
  promotionBlockedBy: z.array(z.string()).min(1),
}).passthrough();

/** No request paths, latest aliases, Python, writes, network access, cached stale
 * bytes or fallback data. Reader injection is only for isolated engineering tests. */
export function createFairArtifactLoader(reader: (path: string) => Promise<Buffer> = readFile) {
  return async (input: unknown) => {
    const parsed = fairArtifactSelectionSchema.safeParse(input);
    if (!parsed.success) throw new FairArtifactError("FAIR_SELECTION_INVALID", 400,
      "Exact artifactId, version, manifestSha256, ensembleSha256 and memberIdsSha256 are required.");
    const selection = parsed.data;
    const entry = fairArtifactCatalog.find(e => e.manifest.artifactId === selection.artifactId);
    if (!entry) throw new FairArtifactError("FAIR_ARTIFACT_UNKNOWN", 404, "No retained ensemble is registered for this artifactId.");
    if (JSON.stringify(selection) !== JSON.stringify(fairArtifactSelection(entry))) {
      throw new FairArtifactError("FAIR_VERSION_MISMATCH", 409, "Requested version or identity hashes do not match the pinned manifest; no fallback.");
    }
    const checked = async (path: string, expected: string) => {
      let bytes: Buffer;
      try { bytes = await reader(path); }
      catch (error) {
        const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
        throw new FairArtifactError(missing ? "FAIR_ARTIFACT_MISSING" : "FAIR_ARTIFACT_UNREADABLE", 503,
          missing ? "Required retained FaIR artifact is missing; no request-time computation or fallback." :
            "Required retained FaIR artifact cannot be read.");
      }
      if (fairSha256(bytes) !== expected) throw new FairArtifactError("FAIR_ARTIFACT_CORRUPT", 503,
        "Retained FaIR artifact failed its pinned SHA256 check.");
      return bytes;
    };
    const resultBytes = await checked(`${entry.directory}/result.json`, entry.manifest.resultSha256);
    const ensembleBytes = await checked(`${entry.directory}/ensemble.json`, entry.manifest.ensembleSha256);
    try {
      const provenance = resultSchema.parse(JSON.parse(resultBytes.toString("utf8")));
      const ensemble = ensembleSchema.parse(JSON.parse(ensembleBytes.toString("utf8")));
      if (provenance.upstreamRevision !== entry.manifest.upstreamRevision ||
        provenance.ensembleMembers !== entry.manifest.members ||
        ensemble.memberIds.length !== entry.manifest.members ||
        fairSha256(JSON.stringify(ensemble.memberIds)) !== entry.manifest.memberIdsSha256 ||
        ensemble.years.length !== 351 || ensemble.years.some((year, i) => year !== 1750 + i)) {
        throw new Error("Manifest dimensions/version/member identity mismatch");
      }
      // The original runs sometimes reused the upstream input directory. Bind
      // all four inputs there, not nonexistent per-sensitivity copies.
      const pinned = fairArtifactCatalog[0];
      const referenceBytes = await checked(`${pinned.directory}/result.json`, pinned.manifest.resultSha256);
      const reference = resultSchema.parse(JSON.parse(referenceBytes.toString("utf8")));
      const verifiedInputs = new Map<string, Buffer>();
      for (const source of provenance.inputs) {
        if (!reference.inputs.some(p => p.file === source.file && p.sha256 === source.sha256)) {
          throw new Error("Unpinned upstream input");
        }
        verifiedInputs.set(source.file, await checked(`${pinned.directory}/${source.file}`, source.sha256));
      }
      if (verifiedInputs.size !== 4) throw new Error("Duplicate upstream inputs");
      const calibration = verifiedInputs.get("calibrated_constrained_parameters_calibration1.4.1.csv")!
        .toString("utf8").trim().split(/\r?\n/).slice(1).map(line => line.split(",")[0]);
      if (JSON.stringify(calibration) !== JSON.stringify(ensemble.memberIds)) throw new Error("Calibration member order mismatch");
      return { identity: { ...fairArtifactSelection(entry), resultSha256: entry.manifest.resultSha256 },
        manifest: entry.manifest, ensemble, provenance };
    } catch (error) {
      if (error instanceof FairArtifactError) throw error;
      throw new FairArtifactError("FAIR_ARTIFACT_INVALID", 503, "Retained FaIR artifact schema, provenance or member coordinates are invalid.");
    }
  };
}
export const loadFairArtifact = createFairArtifactLoader();
export type LoadedFairArtifact = Awaited<ReturnType<typeof loadFairArtifact>>;

export function fairMember(loaded: LoadedFairArtifact, memberId: string) {
  const index = loaded.ensemble.memberIds.indexOf(memberId);
  if (index < 0) throw new FairArtifactError("FAIR_MEMBER_MISSING", 404, "Member ID is not present in the selected versioned ensemble.");
  const member = { baseline: loaded.ensemble.baseline, memberId, years: loaded.ensemble.years,
    temperature: loaded.ensemble.temperature.map(row => row[index]) };
  return { ...member, memberSha256: fairSha256(JSON.stringify(member)) };
}

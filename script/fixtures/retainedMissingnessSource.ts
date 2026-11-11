/** Parent-approved CI-only code snapshots. Never a provider-data or Git-history export. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MISSINGNESS_FIXTURE_PATH = "script/fixtures/retained-missingness-source.json";
export const MISSINGNESS_FIXTURE_SHA256 = "c6bb4bfc8dbd66e0912bc7759b942521562dbbcd1462a8b44cf21557a57ba25d";
const approved = [
  { revision: "b91c298dba2b0a1884b5c758ebc0c21e0a59f84e", path: "server/dataIngestion/adapters/owid.ts",
    mode: "100644", bytes: 1441, gitBlobSha1: "2c80013f9c3d409c1e8480a5b428960dec51d5f0",
    sha256: "63e878c020d62520f65a344534d7b01e60f7a69693f32fa7b284dcdce3e92924" },
  { revision: "b91c298dba2b0a1884b5c758ebc0c21e0a59f84e", path: "server/dataIngestion/adapters/noaa.ts",
    mode: "100644", bytes: 3144, gitBlobSha1: "b1efc5f30fe001ac40320b754f2fc18b6d39ba85",
    sha256: "6179213fdcbe5553828dc542d483d6619856734c8a17f285cc75f54bb3c4c554" },
  { revision: "40c524b29bec455f51e0bb9ac7d3efabe0218e3e", path: "server/climateValuation/carbonPriceCalculator.ts",
    mode: "100644", bytes: 13083, gitBlobSha1: "ddcaa21c9907a05bdefe01c1bb03aabcef863e8c",
    sha256: "7a27f7b8e7862cbc457a66dc364d673996e0739bcb30fbb0432d2a5f2a1f6aa9" },
] as const;
interface Source {
  revision: string; path: string; mode: string; bytes: number;
  gitBlobSha1: string; sha256: string; text: string;
}
const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const credentials = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/,
  /AKIA[0-9A-Z]{16}/, /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/,
  /sk-(?:proj-)?[A-Za-z0-9_-]{24,}/, /AIza[0-9A-Za-z_-]{30,}/,
  /xox[baprs]-[0-9A-Za-z-]{20,}/,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["'][A-Za-z0-9_+/-]{20,}["']/i,
];
export function inspectMissingnessSources(sources: Source[]) {
  if (sources.length !== approved.length) throw new Error("Exactly three approved missingness sources required");
  for (const [index, source] of Array.from(sources.entries())) {
    const pin = approved[index];
    for (const key of ["revision", "path", "mode", "bytes", "gitBlobSha1", "sha256"] as const)
      if (source[key] !== pin[key]) throw new Error(`Unapproved historical source identity: ${key}`);
    if (typeof source.text !== "string" || source.text.includes("\0"))
      throw new Error("Historical source must be regular UTF8 code");
    const bytes = Buffer.from(source.text, "utf8");
    if (bytes.toString("utf8") !== source.text || bytes.length !== pin.bytes ||
      sha256(bytes) !== source.sha256 ||
      createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") !== pin.gitBlobSha1)
      throw new Error(`Historical source SHA/blob/byte mismatch: ${pin.path}`);
    if (credentials.some(pattern => pattern.test(source.text)))
      throw new Error(`Credential fingerprint refuses source retention: ${pin.path}`);
  }
}

export function decodeRetainedMissingnessSources(bytes: Buffer): Source[] {
  if (sha256(bytes) !== MISSINGNESS_FIXTURE_SHA256)
    throw new Error("Immutable retained-missingness source fixture SHA256 mismatch");
  const fixture = JSON.parse(bytes.toString("utf8")) as { format: string; sources: Source[] };
  if (fixture.format !== "retained-missingness-source-fixture-v1" || !Array.isArray(fixture.sources))
    throw new Error("Retained-missingness source fixture format mismatch");
  inspectMissingnessSources(fixture.sources);
  return fixture.sources;
}

export function retainedMissingnessSource(revision: string, path: string): string {
  const source = decodeRetainedMissingnessSources(readFileSync(MISSINGNESS_FIXTURE_PATH))
    .find(source => source.revision === revision && source.path === path);
  if (!source) throw new Error("Requested historical source is not in approved immutable missingness fixture");
  return source.text;
}

function exportApprovedSources() {
  const sources = approved.map(pin => {
    const entries = execFileSync("git", ["ls-tree", "-rz", pin.revision, "--", pin.path])
      .toString().split("\0").filter(Boolean);
    if (entries.length !== 1) throw new Error("Exact approved historical source absent");
    const [info, path] = entries[0].split("\t"), [mode, kind, blob] = info.split(" ");
    if (path !== pin.path || mode !== pin.mode || kind !== "blob" || blob !== pin.gitBlobSha1)
      throw new Error("Historical source permissions/path/blob differs from approval");
    const bytes = execFileSync("git", ["cat-file", "blob", blob], { maxBuffer: 100_000 });
    const text = bytes.toString("utf8");
    if (!Buffer.from(text, "utf8").equals(bytes)) throw new Error("Non-UTF8 source refuses retention");
    return { ...pin, sha256: sha256(bytes), text };
  });
  inspectMissingnessSources(sources);
  const bytes = Buffer.from(JSON.stringify({ format: "retained-missingness-source-fixture-v1", sources }, null, 2) + "\n");
  writeFileSync(MISSINGNESS_FIXTURE_PATH, bytes, { flag: "wx", mode: 0o444 });
  console.log(JSON.stringify({ path: MISSINGNESS_FIXTURE_PATH, sha256: sha256(bytes), bytes: bytes.length,
    originalSourceBytes: sources.reduce((sum, source) => sum + source.bytes, 0),
    sources: sources.map(({ text, ...receipt }) => receipt),
    sourcePermissionCheck: "three regular100644 blobs", credentialFingerprintMatches: 0,
    privateProviderDataAssetsOrHistory: 0 }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== "--export-reviewed-missingness-source")
    throw new Error("Explicit approved three-source retention authorization required");
  exportApprovedSources();
}

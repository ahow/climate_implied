/** Private historical replay only. Never overwrite a frozen receipt or load
 * mutable current calculation modules as a historical-code fallback. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";

const revision = "c3bc94940099aa22feddd56f382c5a6d2a25d1bf";
const directPaths = ["server/calculation/companyFullCashflowCase.ts",
  "server/calculation/fslrFullCashflowCase.ts", "server/calculation/issuerConditionalFiveYear.ts"];
const dependencyPath = "server/calculation/analysisManifest.ts";
export const pinnedSourceSha256 = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");

export function verifyPinnedSourceBytes(path: string, expectedSha256: string, bytes: Buffer) {
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || pinnedSourceSha256(bytes) !== expectedSha256)
    throw new Error(`Pinned source hash mismatch: ${path}; historical validation cannot use current or substitute bytes`);
  return bytes;
}

/** Existing archived corruption fails rather than being silently repaired.
 * Recovered source bytes must already match their recorded expected digest. */
export function retainVerifiedPinnedSource(path: string, expectedSha256: string, bytes: Buffer) {
  verifyPinnedSourceBytes(path, expectedSha256, bytes);
  if (existsSync(path)) verifyPinnedSourceBytes(path, expectedSha256, readFileSync(path));
  else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes, { flag: "wx" });
  }
  return path;
}

export function verifyRecoveredSources(codeSources: {path:string;sha256:string}[], readSource:(path:string)=>Buffer) {
  return codeSources.map(source=>({...source,
    bytes:verifyPinnedSourceBytes(source.path,source.sha256,readSource(source.path))}));
}

export async function loadPinnedFslrCode(codeSources: { path: string; sha256: string }[]) {
  if (process.env.NODE_ENV === "production") throw new Error("Private historical replay only");
  if (codeSources.length !== directPaths.length ||
      new Set(codeSources.map(s => s.path)).size !== directPaths.length ||
      codeSources.some(s => !directPaths.includes(s.path)))
    throw new Error("Historical FSLR receipt must pin exactly the three expected direct source paths");
  const resolvedRevision = execFileSync("git", ["rev-parse", `${revision}^{commit}`], { encoding: "utf8" }).trim();
  if (resolvedRevision !== revision) throw new Error("Known historical recovery revision is unavailable");
  const fromGit = (path: string) => execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 4 * 1024 * 1024 });
  // Verify ALL original frozen digests before writing/recovering any code.
  const recovered = verifyRecoveredSources(codeSources,fromGit);
  const lockBytes = fromGit("package-lock.json"), lockHash = pinnedSourceSha256(lockBytes);
  if (pinnedSourceSha256(readFileSync("package-lock.json")) !== lockHash)
    throw new Error("Runtime dependency lock differs from known recovery revision; historical replay refused");
  const archiveId = pinnedSourceSha256(JSON.stringify(codeSources));
  const archive = resolve("generated-artifacts/company-operating-corpus/fslr-full-cashflow/pinned-code",
    revision.slice(0, 7), archiveId);
  const sources = recovered.map(source => {
    const archivedPath = retainVerifiedPinnedSource(join(archive, source.path), source.sha256, source.bytes);
    return { path: source.path, archivedPath, sha256: source.sha256,
      provenance: "Exact frozen receipt digest, recovered from known Git revision" };
  });
  // Transitive local hashing dependency is also isolated from current files.
  // It was NOT separately listed in the original freeze; disclose that limit.
  const dependencyBytes = fromGit(dependencyPath), dependencyHash = pinnedSourceSha256(dependencyBytes);
  const dependencyArchive = retainVerifiedPinnedSource(join(archive, dependencyPath), dependencyHash, dependencyBytes);
  const dependency = { path: dependencyPath, archivedPath: dependencyArchive, sha256: dependencyHash,
    provenance: "Supplemental transitive dependency from recovery revision; not independently frozen by original receipt" };
  retainVerifiedPinnedSource(join(archive, "package-lock.json"), lockHash, lockBytes);
  const allowedInputs = new Set([...sources.map(s => resolve(s.archivedPath)), resolve(dependencyArchive)]);
  const bundlePath = join(archive, "fslr-frozen-replay.cjs");
  const compilation = await build({
    entryPoints: [join(archive, "server/calculation/fslrFullCashflowCase.ts")],
    outfile: bundlePath, bundle: true, platform: "node", format: "cjs", packages: "external",
    metafile: true, logLevel: "silent",
    plugins: [{ name: "pinned-local-imports-only", setup(builder) {
      builder.onResolve({ filter: /^\./ }, args => {
        const path = resolve(args.resolveDir, `${args.path}.ts`);
        if (!allowedInputs.has(path)) throw new Error("Historical replay local import is outside verified private archive");
        return { path };
      });
    } }],
  });
  for (const path of Object.keys(compilation.metafile!.inputs))
    if (!allowedInputs.has(resolve(path))) throw new Error("Unpinned input entered historical replay bundle");
  for (const output of Object.values(compilation.metafile!.outputs))
    for (const imported of output.imports)
      if (!imported.external || !["zod", "node:crypto"].includes(imported.path))
        throw new Error("Unexpected runtime dependency in historical replay");
  // Reverify archived TS bytes after compilation, before execution.
  for (const source of [...sources, dependency])
    verifyPinnedSourceBytes(source.path, source.sha256, readFileSync(source.archivedPath));
  const record = { recoveredAt: new Date().toISOString(), revision, archive: relative(process.cwd(), archive),
    sources, supplementalDependency: dependency, packageLockSha256: lockHash,
    bundlePath, bundleSha256: pinnedSourceSha256(readFileSync(bundlePath)),
    limits: "Original freeze pinned three direct TS sources, not compiler/runtime bytes. Exact retained-result equality is checked separately.",
    originalFreezeModified: false };
  writeFileSync(join(archive, "recovery-receipt.json"), JSON.stringify(record, null, 2) + "\n");
  const entry = createRequire(import.meta.url)(bundlePath) as {
    calculateFslrFrozenFullCashflow: (frozen: unknown) => { cases: unknown[] };
  };
  if (typeof entry.calculateFslrFrozenFullCashflow !== "function")
    throw new Error("Pinned replay entry point missing");
  return { entry, record };
}

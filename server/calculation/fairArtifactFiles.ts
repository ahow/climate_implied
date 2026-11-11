import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";

export function safeBundlePath(relative: string) {
  if (!relative || relative.includes("\\") || relative.includes("\0") ||
    relative.split("/").some(part => !part || part === "." || part === "..") || path.isAbsolute(relative))
    throw new Error("FAIR_BUNDLE_PATH_INVALID");
  return relative;
}

/** No symlink components or nonregular/hardlinked files. Private installation
 * directories must not be concurrently writable by an untrusted process. */
export async function readFairPrivateFile(root: string, relative: string, restrictive = false) {
  safeBundlePath(relative);
  const absolute = path.resolve(root);
  const full = path.join(absolute, relative);
  let current = path.parse(full).root;
  const parts = full.slice(current.length).split(path.sep);
  for (const [i, part] of Array.from(parts.entries())) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink() || (i < parts.length - 1 && !info.isDirectory()))
      throw new Error("FAIR_BUNDLE_SYMLINK_REFUSED");
    if (restrictive && (current === absolute || current.startsWith(`${absolute}${path.sep}`)) &&
      (info.mode & 0o077) !== 0) throw new Error("FAIR_BUNDLE_PERMISSIONS_INVALID");
  }
  const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1) throw new Error("FAIR_BUNDLE_NONREGULAR_REFUSED");
    return await handle.readFile();
  } finally { await handle.close(); }
}

/** Optional operator-owned runtime flag. Unset preserves the exact legacy file
 * layout. A configured but missing/broken activation never falls back to it. */
export async function readRuntimeFairArtifact(relative: string) {
  const root = process.env.FAIR_ARTIFACT_ROOT;
  if (!root) return readFairPrivateFile(process.cwd(), relative);
  if (!path.isAbsolute(root)) throw new Error("FAIR_ARTIFACT_ROOT_MUST_BE_ABSOLUTE");
  const pointer = JSON.parse((await readFairPrivateFile(root, "active.json", true)).toString("utf8"));
  if (pointer.version !== "s07-offline-fair-v1" || !/^[a-f0-9]{64}$/.test(pointer.release))
    throw new Error("FAIR_BUNDLE_ACTIVATION_INVALID");
  return readFairPrivateFile(root, `releases/${pointer.release}/data/${safeBundlePath(relative)}`, true);
}

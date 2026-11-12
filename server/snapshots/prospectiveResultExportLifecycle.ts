/**
 * Private append-only NEW export storage under the existing workspace-shell
 * authority. No mkdir, database writes, HTTP identity, approval or publication.
 * Explicit DEV + an already provisioned, owner-only directory are mandatory.
 */
import { constants } from "node:fs";
import { open, lstat, realpath, link, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { canonicalJson } from "../calculation/analysisManifest";
import { captureProspectiveResultXlsx, readProspectiveResultXlsx } from "./prospectiveResultExport";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const maximumEnvelopeBytes = 64 * 1024 * 1024;
const envelopeSchema = z.object({
  version: z.literal("private-prospective-result-export-file-1"),
  requestId: hash,
  captureId: hash,
  parentResultId: hash,
  record: z.unknown(),
  xlsxBase64: z.string().min(1),
}).strict();
export type ProspectiveExportStoreConfig = {
  environment: string | undefined;
  directory: string | undefined;
};
export type ProspectiveExportSelection = { requestId: string; expectedParentResultId: string };
export type RetainedResultLoader = (id: string) => Promise<unknown>;

/** Configuration is explicit at every call, not an ambient default directory. */
export function prospectiveExportStoreConfig(env: NodeJS.ProcessEnv): ProspectiveExportStoreConfig {
  return { environment: env.NODE_ENV, directory: env.PROSPECTIVE_RESULT_EXPORT_DIR };
}

async function privateRoot(config: ProspectiveExportStoreConfig) {
  if (config.environment !== "development") throw new Error("Prospective export storage requires explicit development");
  const root = config.directory;
  if (!root || !isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root)
    throw new Error("Explicit existing absolute non-symlink private export directory required");
  if (typeof process.getuid !== "function") throw new Error("Private export storage requires POSIX ownership checks");
  const operatorUid = process.getuid();
  // Check every ancestor, top-down: a safe 0700 leaf is insufficient when an
  // untrusted parent can rename/replace it between validation and file IO.
  const ancestors: string[] = [];
  for (let ancestor = dirname(root); ; ancestor = dirname(ancestor)) {
    ancestors.push(ancestor);
    if (dirname(ancestor) === ancestor) break;
  }
  for (const ancestor of ancestors.reverse()) {
    const entry = await lstat(ancestor);
    if (!entry.isDirectory() || (entry.uid !== 0 && entry.uid !== operatorUid) ||
        ((entry.mode & 0o022) !== 0 && (entry.mode & 0o1000) === 0))
      throw new Error("Unsafe private export ancestor: require operator/root ownership and no nonsticky group/world write");
    // A trusted-owner sticky directory (e.g. /tmp, or this container's sticky
    // root) is safe here: other users cannot remove/rename its trusted-owned
    // next path component. Every component's ownership is checked in turn.
  }
  const info = await lstat(root);
  if (!info.isDirectory() || (info.mode & 0o777) !== 0o700 ||
      info.uid !== operatorUid)
    throw new Error("Private export directory must be owned by the operator and mode 0700");
  return root;
}

function selection(input: ProspectiveExportSelection) {
  return z.object({ requestId: hash, expectedParentResultId: hash }).strict().parse(input);
}
function filename(root: string, requestId: string) {
  return join(root, `prospective-result-export-${requestId}.json`);
}
function missing(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}
async function readEnvelope(path: string) {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    let info = await file.stat();
    // Atomic no-replace link publication briefly has two links until staging
    // cleanup. Never read/accept a multiply-linked file. A bounded wait allows
    // another process to finish unlinking; persistent hardlinks still refuse.
    for (let wait = 0; info.nlink === 2 && wait < 10; wait++) {
      await delay(25);
      info = await file.stat();
    }
    if (!info.isFile() || (info.mode & 0o777) !== 0o600 || info.uid !== process.getuid!() ||
        info.nlink !== 1 || info.size > maximumEnvelopeBytes)
      throw new Error("Private export file access, size or type contract refused");
    // Bound allocation/read even if another operator process grows the file
    // after stat. The extra byte detects growth instead of reading unboundedly.
    const buffer = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await file.stat();
    if (length !== info.size || after.size !== info.size || after.nlink !== 1 ||
        after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs)
      throw new Error("Private export file changed during read");
    const bytes = buffer.subarray(0, length);
    return envelopeSchema.parse(JSON.parse(bytes.toString("utf8")));
  } finally { await file.close(); }
}

async function readAt(root: string, selected: ProspectiveExportSelection, load: RetainedResultLoader) {
  const stored = await readEnvelope(filename(root, selected.requestId));
  return verifyEnvelope(stored, selected, load);
}
async function verifyEnvelope(stored: z.infer<typeof envelopeSchema>,
  selected: ProspectiveExportSelection, load: RetainedResultLoader) {
  if (stored.requestId !== selected.requestId) throw new Error("Private export request identity mismatch");
  if (stored.parentResultId !== selected.expectedParentResultId)
    throw new Error("Idempotency conflict: request belongs to a different retained parent");
  const bytes = Buffer.from(stored.xlsxBase64, "base64");
  if (bytes.toString("base64") !== stored.xlsxBase64) throw new Error("Noncanonical or corrupt private XLSX bytes");
  return readProspectiveResultXlsx(stored.captureId, stored.record, bytes, selected.expectedParentResultId, load);
}

/** Consumer interface: exact retained bytes only; no current/result fallback,
 * auto-capture, repair, version upgrade, or unauthenticated HTTP registration. */
export async function readStoredProspectiveResultExport(input: ProspectiveExportSelection,
  config: ProspectiveExportStoreConfig, load: RetainedResultLoader) {
  const selected = selection(input);
  return readAt(await privateRoot(config), selected, load);
}

/** One committed envelope is the whole record. A same-key/same-parent retry
 * returns its original time/id/bytes. A different parent or damaged existing
 * record is refused, never overwritten or silently regenerated. */
export async function captureStoredProspectiveResultExport(input: ProspectiveExportSelection,
  config: ProspectiveExportStoreConfig, load: RetainedResultLoader) {
  const selected = selection(input), root = await privateRoot(config);
  let existing: z.infer<typeof envelopeSchema> | undefined;
  try {
    existing = await readEnvelope(filename(root, selected.requestId));
  } catch (error) {
    // The catch excludes dependency verification, so no downstream ENOENT can
    // authorize recapture/replacement of an existing committed envelope.
    if (!missing(error)) throw error;
  }
  if (existing) return { ...await verifyEnvelope(existing, selected, load), disposition: "retained-retry" as const };
  const captured = await captureProspectiveResultXlsx(selected.expectedParentResultId, load);
  const envelope = canonicalJson({
    version: "private-prospective-result-export-file-1",
    requestId: selected.requestId, captureId: captured.id,
    parentResultId: selected.expectedParentResultId,
    record: captured.record, xlsxBase64: captured.bytes.toString("base64"),
  });
  if (Buffer.byteLength(envelope) > maximumEnvelopeBytes) throw new Error("Private export exceeds size contract");
  // Stage in the explicitly provisioned directory. Link is atomic no-replace;
  // no rename-overwrite window and no partial committed JSON/XLSX pair.
  const temporary = join(root, `.prospective-export-pending-${randomUUID()}`);
  const file = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  let created = false;
  try {
    await file.writeFile(envelope, "utf8");
    await file.sync();
    await file.close();
    // Revalidate directory before publishing (no ambient production writes).
    if (await privateRoot(config) !== root) throw new Error("Private export directory changed");
    try {
      await link(temporary, filename(root, selected.requestId));
      created = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  } finally {
    await file.close();
    await unlink(temporary);
  }
  const directory = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { await directory.sync(); } finally { await directory.close(); }
  return { ...await readAt(root, selected, load), disposition: created ? "captured-new" as const : "retained-retry" as const };
}

import { constants, closeSync, existsSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import XLSX from "xlsx";
import { readQualifiedIndicatorArchive, interpolateQualifiedIndicator, exportQualifiedIndicators } from "./adapters/qualifiedArchive";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function verifyNumericTokens(bytes: Buffer) {
  // Skip JSON strings, including escaped quotes. Nonzero mantissas must never
  // underflow to an apparently observed zero during JSON number decoding.
  const tokens = bytes.toString("utf8").matchAll(/"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g);
  for (const token of Array.from(tokens)) if (token[1] && Number(token[1]) === 0 &&
    /[1-9]/.test(token[1].split(/[eE]/)[0])) throw new Error("Source numeric underflow refused");
}
const idSchema = z.string().regex(/^[a-f0-9]{64}$/);
const eventSchema = z.object({
  version: z.literal("qualified-development-review-1"), sequence: z.number().int().positive(),
  previous: idSchema.nullable(), action: z.enum(["stage", "approve", "reject"]),
  sourceId: idSchema, proposalId: idSchema.nullable(),
  note: z.string().trim().min(1).max(2000),
  classification: z.literal("development-only-not-scientific-approval"),
}).strict();
type Event = z.infer<typeof eventSchema>;
export type QualifiedReviewEvent = Event & { id: string };

/**
 * Private development extension of the existing generated-artifacts file archive.
 * Never imports db/storage, changes indicator_values, or installs HTTP writes.
 * Serialized append-only review events preserve complete historical selections.
 * An operator must recover a stale .writer lock after inspecting a crashed write;
 * it is never automatically broken, and corrupt archives never silently reset.
 */
export class QualifiedMissingnessStore {
  readonly root: string;
  constructor(root: string, readOnly = false) {
    this.guard();
    const allowed = resolve("generated-artifacts");
    const selected = resolve(root);
    if (!selected.startsWith(`${allowed}/`)) throw new Error("Private archive must be inside generated-artifacts");
    if (!readOnly) mkdirSync(allowed, { recursive: true, mode: 0o700 });
    // Reject symlink components before creating or opening any private archive.
    let cursor = allowed;
    if (lstatSync(cursor).isSymbolicLink()) throw new Error("Archive symlinks forbidden");
    for (const segment of selected.slice(allowed.length + 1).split("/")) {
      cursor = join(cursor, segment);
      if (existsSync(cursor) && (lstatSync(cursor).isSymbolicLink() || !lstatSync(cursor).isDirectory()))
        throw new Error("Archive must contain real directories only");
      if (!existsSync(cursor)) {
        if (readOnly) throw new Error("Private development archive not provisioned");
        mkdirSync(cursor, { mode: 0o700 });
      }
    }
    this.root = realpathSync(selected);
  }
  private guard() {
    if (process.env.NODE_ENV !== "development") throw new Error("Explicit NODE_ENV=development required");
  }
  private read(name: string) {
    this.guard();
    const fd = openSync(join(this.root, name), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = lstatSync(join(this.root, name));
      if (!stat.isFile() || stat.size > 16 * 1024 * 1024) throw new Error("Invalid bounded archive file");
      return readFileSync(fd);
    } finally { closeSync(fd); }
  }
  private retain(name: string, bytes: Buffer) {
    const target = join(this.root, name);
    if (existsSync(target)) {
      if (!this.read(name).equals(bytes)) throw new Error("Conflicting immutable archive bytes");
      return;
    }
    // A same-filesystem hard link publishes complete bytes, never a partial file.
    const temporary = `${target}.writing`;
    writeFileSync(temporary, bytes, { flag: "wx", mode: 0o600 });
    try { linkSync(temporary, target); } finally { unlinkSync(temporary); }
  }
  history(revision?: string): QualifiedReviewEvent[] {
    this.guard();
    if (revision !== undefined) idSchema.parse(revision);
    const names = readdirSync(this.root).filter(n => /^event-\d{10}\.json$/.test(n)).sort();
    const events: QualifiedReviewEvent[] = [];
    for (const [index, name] of Array.from(names.entries())) {
      const bytes = this.read(name), event = eventSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (event.sequence !== index + 1 || name !== `event-${String(index + 1).padStart(10, "0")}.json` ||
          event.previous !== (events.at(-1)?.id ?? null)) throw new Error("Broken review history chain");
      const priorProposal = events.find(e => e.id === event.proposalId && e.action === "stage");
      if ((event.action === "stage" && event.proposalId !== null) ||
          (event.action !== "stage" && (!priorProposal || priorProposal.sourceId !== event.sourceId ||
            events.some(e => e.proposalId === event.proposalId)))) throw new Error("Invalid immutable review transition");
      this.source(event.sourceId); // Mandatory exact-byte source verification at every read.
      const item = { ...event, id: hash(bytes) };
      events.push(item);
      if (item.id === revision) return events;
    }
    if (revision !== undefined) throw new Error("Review revision not found");
    return events;
  }
  source(id: string) {
    idSchema.parse(id);
    const name = `source-${id}.json`, bytes = this.read(name);
    if (hash(bytes) !== id) throw new Error("Corrupt qualified source bytes");
    verifyNumericTokens(bytes);
    const loaded = readQualifiedIndicatorArchive(join(this.root, name));
    if (loaded.sourceId !== id) throw new Error("Qualified source changed while reading");
    for (const series of loaded.source.series) {
      if (series.points.some(point => !Number.isSafeInteger(point.year)))
        throw new Error("Safe integer source years required");
      for (const point of series.points) {
        const result = interpolateQualifiedIndicator(loaded, series.indicatorKey, point.year);
        if (!result.infilled) continue;
        const left = series.points.find(p => p.year === result.donorYears[0])!;
        const right = series.points.find(p => p.year === result.donorYears[1])!;
        if (left.state !== "observed" || right.state !== "observed") throw new Error("Invalid source donors");
        const lostNonzero = (value: number, a: number, b: number) => value === 0 &&
          (a !== 0 || b !== 0) && ((a >= 0 && b >= 0) || (a <= 0 && b <= 0));
        if (lostNonzero(result.value!, left.value, right.value) || result.samples.some(sample =>
          lostNonzero(sample.value, left.draws!.find(d => d.id === sample.id)!.value,
            right.draws!.find(d => d.id === sample.id)!.value)))
          throw new Error("Source interpolation numeric underflow/cancellation refused; never substitute zero");
      }
    }
    return loaded;
  }
  private append(action: Event["action"], sourceId: string, proposalId: string | null, note: string) {
    const prior = this.history();
    if (action !== "stage") {
      const proposal = prior.find(e => e.id === proposalId && e.action === "stage");
      if (!proposal || proposal.sourceId !== sourceId) throw new Error("Proposal not found");
      const previous = prior.find(e => e.proposalId === proposalId);
      if (previous) {
        if (previous.action === action) return previous;
        throw new Error("Conflicting decision; stage a new proposal");
      }
    }
    const event = eventSchema.parse({ version: "qualified-development-review-1",
      sequence: prior.length + 1, previous: prior.at(-1)?.id ?? null,
      action, sourceId, proposalId, note, classification: "development-only-not-scientific-approval" });
    const bytes = Buffer.from(JSON.stringify(event));
    this.retain(`event-${String(event.sequence).padStart(10, "0")}.json`, bytes);
    return { ...event, id: hash(bytes) };
  }
  private write<T>(work: () => T): T {
    this.guard();
    const lock = join(this.root, ".writer");
    mkdirSync(lock, { mode: 0o700 });
    try { return work(); } finally { rmdirSync(lock); }
  }
  stage(path: string, note: string) {
    return this.write(() => {
      const source = readQualifiedIndicatorArchive(path);
      const bytes = readFileSync(path);
      verifyNumericTokens(bytes);
      if (hash(bytes) !== source.sourceId) throw new Error("Source changed during staging");
      this.retain(`source-${source.sourceId}.json`, bytes);
      this.source(source.sourceId);
      return this.append("stage", source.sourceId, null, note);
    });
  }
  decide(proposalId: string, action: "approve" | "reject", note: string) {
    idSchema.parse(proposalId);
    if (action !== "approve" && action !== "reject") throw new Error("Invalid review decision");
    return this.write(() => {
      const proposal = this.history().find(e => e.id === proposalId && e.action === "stage");
      if (!proposal) throw new Error("Proposal not found");
      return this.append(action, proposal.sourceId, proposalId, note);
    });
  }
  view(revision?: string) {
    const events = this.history(revision);
    const approved = events.filter(e => e.action === "approve").at(-1);
    const proposals = events.filter(e => e.action === "stage").map(event => {
      const decision = events.find(e => e.proposalId === event.id);
      return { ...event, source: this.source(event.sourceId).source,
        status: !decision ? "pending" : decision.action === "reject" ? "rejected" :
        approved?.proposalId === event.id ? "approved-development-only" : "superseded" };
    });
    const input = approved ? this.source(approved.sourceId) : undefined;
    const cells = input?.source.series.flatMap(series => series.points.map(point => ({
      indicatorKey: series.indicatorKey, unit: series.unit, ...point,
      result: interpolateQualifiedIndicator(input, series.indicatorKey, point.year),
    }))) ?? [];
    return { version: "qualified-development-view-1", classification: "development-only-not-scientific-approval",
      revision: events.at(-1)?.id ?? null, sourceId: input?.sourceId ?? null,
      centralModelApplied: false, events, proposals, cells };
  }
  export(revision?: string) {
    const view = this.view(revision);
    if (!view.sourceId) throw new Error("No development-reviewed source at selected revision");
    const workbook = exportQualifiedIndicators(this.source(view.sourceId));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(view.events), "ReviewHistory");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{
      revision: view.revision, sourceId: view.sourceId, classification: view.classification,
      centralModelApplied: false,
    }]), "ReviewSelection");
    return workbook;
  }
}

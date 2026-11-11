import { readFile, readdir } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { contentHash } from "../calculation/analysisManifest";
import { unpackDataset, type DatasetChunk } from "../snapshots/contract";
import { snapshotGuardQuery, guardRowsValid } from "../snapshots/guards";
import { snapshotSchema, snapshotId } from "./review";
import { buildStage10Coverage, sevenStateIdentity, type Stage10Company, type Stage10Cell } from "./stage10Coverage";
import { stage10Fields, type Stage10Field } from "../../shared/stage10Coverage";

const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const date = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  Number.isFinite(Date.parse(x)) && new Date(x).toISOString().slice(0, 10) === x;
/** Per-value source lineage stays private. Original is NEVER inferred from a
 * missing/false restated flag or provider filing-date proxy. OCF already includes
 * working-capital movements: no second WC deduction from FCFE. */
export function retainedStatementCells(source: {
  companyId: number; isin: string; sourceHash: string; capturedAt: string; statements: Record<string, any[]>;
}, cutoff: string): Stage10Cell[] {
  const cells: Stage10Cell[] = [];
  for (const [endpoint, rows] of Object.entries(source.statements)) for (const row of rows) {
    if (["Q1", "Q2", "Q3", "Q4"].includes(row.period)) continue;
    if (row.period !== "FY" || !date(row.date)) throw new Error("Unplaceable retained fiscal row; cannot silently report missing annual history");
    const fields: Partial<Record<Stage10Field, unknown>> = {};
    if (endpoint === "income-statement") {
      for (const key of ["revenue", "ebitda", "netIncome"] as const) if (Object.hasOwn(row, key)) fields[key] = row[key];
      if (Object.hasOwn(row, "weightedAverageShsOut")) fields.shares = row.weightedAverageShsOut;
    }
    if (endpoint === "cash-flow-statement") {
      if (Object.hasOwn(row, "operatingCashFlow")) fields.operatingCashFlow = row.operatingCashFlow;
      if (Object.hasOwn(row, "capitalExpenditure")) fields.capitalExpenditure = row.capitalExpenditure;
      if ([row.operatingCashFlow, row.capitalExpenditure, row.netDebtIssuance].every(finite))
        fields.fcfe = row.operatingCashFlow + row.capitalExpenditure + row.netDebtIssuance;
    }
    if (endpoint === "balance-sheet-statement") {
      if (Object.hasOwn(row, "netDebt")) fields.netDebt = row.netDebt;
      else if (finite(row.totalDebt) && finite(row.cashAndCashEquivalents)) fields.netDebt = row.totalDebt - row.cashAndCashEquivalents;
      if (Object.hasOwn(row, "workingCapital")) fields.workingCapital = row.workingCapital;
      else if (finite(row.totalCurrentAssets) && finite(row.totalCurrentLiabilities)) fields.workingCapital = row.totalCurrentAssets - row.totalCurrentLiabilities;
    }
    if (endpoint === "segments" && Object.hasOwn(row, "segments")) fields.segments = row.segments;
    for (const [field, value] of Object.entries(fields) as [Stage10Field, unknown][]) {
      let state: Stage10Cell["state"] = value === null ? "explicitNull" :
        field === "segments" ? (value && typeof value === "object" && Object.keys(value).length ? "present" : "invalid") :
          finite(value) ? "present" : "invalid";
      const currency = typeof row.reportedCurrency === "string" && /^[A-Z]{3}$/.test(row.reportedCurrency) ? row.reportedCurrency : null;
      if (state === "present" && !currency && !["shares", "segments"].includes(field)) state = "invalid";
      if ((field === "capitalExpenditure" || field === "fcfe") && finite(row.capitalExpenditure) && row.capitalExpenditure > 0) state = "invalid";
      if (field === "netDebt" && finite(value) && finite(row.totalDebt) && finite(row.cashAndCashEquivalents) &&
        Math.abs(value - (row.totalDebt - row.cashAndCashEquivalents)) >
          Math.max(1, Math.abs(row.totalDebt - row.cashAndCashEquivalents)) * 1e-6) state = "invalid";
      const filingDate = date(row.filingDate) && row.filingDate > row.date ? row.filingDate : null;
      if (filingDate && Date.parse(`${filingDate}T23:59:59.999Z`) > Date.parse(cutoff)) state = "invalid";
      cells.push({ companyId: source.companyId, isin: source.isin, year: Number(row.date.slice(0, 4)), field, state, value,
        currency, sourceFilingDate: typeof row.filingDate === "string" ? row.filingDate : null,
        filingDate, filingEvidence: filingDate ? "provider-unverified" : "missing",
        restatement: row.restated === true || row.isRestated === true ? "restated" : "unknown",
        sourceHash: source.sourceHash, capturedAt: source.capturedAt });
    }
  }
  return cells;
}
export function authenticateStage10RetainedVersion(source: any, name: string) {
  if (!source?.payload || contentHash(source.payload) !== source.inputHash || !name.endsWith(`-${source.inputHash}.json`) ||
    !Number.isFinite(Date.parse(source.fetchedAt))) throw new Error("Retained financial source integrity failure");
  const p = source.payload;
  if (!Number.isInteger(p.company?.id) || p.company.id <= 0 || typeof p.company.isin !== "string" || !p.company.isin ||
    typeof p.profile?.symbol !== "string" || !p.profile.symbol ||
    p.company.isin !== p.profile?.isin || p.company.isin !== p.selection?.isin ||
    p.profile.symbol !== p.selection.symbol || !p.statements ||
    Object.values(p.statements).some(rows => !Array.isArray(rows))) throw new Error("Retained source exact identity/statement binding failed");
  for (const [endpoint, rows] of Object.entries(p.statements) as [string, Record<string, unknown>[]][]) {
    if (!["income-statement", "cash-flow-statement", "balance-sheet-statement", "segments"].includes(endpoint))
      throw new Error("Unknown retained statement endpoint; cannot certify missing history");
    if (endpoint !== "segments" && rows.some(row => row.symbol !== p.selection.symbol))
      throw new Error("Retained statement security scope mismatch; exact identifier binding required");
  }
  return { ...source, fetchedAt: new Date(source.fetchedAt).toISOString(), sourceEnvelopeHash: contentHash(source) };
}
/** Fixed retained roots only; no provider request,filesystem request path,DDL or
 * write. Directory entries are immutable collector hash filenames,not tickers for
 * joining. Exact companyId AND ISIN bind every version to selected workbook. */
export async function readStage10RetainedFiles() {
  const audit = JSON.parse(await readFile("generated-artifacts/financial-data/mapping-audit.json", "utf8"));
  if (!Array.isArray(audit.results) || !Number.isFinite(Date.parse(audit.createdAt)) ||
    !Number.isInteger(audit.universe) || audit.universe < 0 || audit.attempted !== audit.results.length ||
    audit.notAttempted !== audit.universe - audit.attempted ||
    audit.results.some((r: any) => !Number.isInteger(r.companyId) || typeof r.isin !== "string"))
    throw new Error("Retained identity journal unavailable/inconsistent; cannot infer not-queried from corruption");
  const root = "generated-artifacts/company-worked-inputs";
  const names = (await readdir(root)).filter(n => /^[A-Za-z0-9.-]+-[a-f0-9]{64}\.json$/.test(n)).sort();
  const versions = [];
  for (const name of names) {
    const source = JSON.parse(await readFile(`${root}/${name}`, "utf8"));
    versions.push(authenticateStage10RetainedVersion(source, name));
  }
  return { audit, versions };
}
export async function getStage10Coverage(options: { workbookHash?: string; cutoff?: string; firstYear?: number; lastYear?: number } = {}) {
  const firstYear = options.firstYear ?? 2015, lastYear = options.lastYear ?? 2025;
  if (!Number.isInteger(firstYear) || !Number.isInteger(lastYear) || firstYear < 1900 || lastYear > 2100 || lastYear < firstYear || lastYear - firstYear > 50 ||
    (options.workbookHash !== undefined && !/^[a-f0-9]{64}$/.test(options.workbookHash)) ||
    (options.cutoff !== undefined && !Number.isFinite(Date.parse(options.cutoff)))) throw new Error("Invalid frozen coverage selection");
  const files = await readStage10RetainedFiles();
  return db.transaction(async tx => {
    if (!guardRowsValid((await tx.execute(snapshotGuardQuery)).rows)) throw new Error("Immutable snapshot guards unavailable");
    const headers = await tx.execute(options.workbookHash
      ? sql`SELECT id,company_count,observation_count,chunk_count FROM cv_analysis_snapshots WHERE kind='workbook-baseline' AND id=${options.workbookHash}`
      : sql`SELECT id,company_count,observation_count,chunk_count FROM cv_analysis_snapshots WHERE kind='workbook-baseline' ORDER BY created_at DESC,id LIMIT 1`);
    const header = headers.rows[0];
    if (!header) throw new Error("Selected immutable workbook unavailable; no current fallback");
    const chunks = (await tx.execute(sql`SELECT ordinal,payload FROM cv_analysis_chunks WHERE snapshot_id=${String(header.id)} ORDER BY ordinal`)).rows;
    if (chunks.length !== header.chunk_count || chunks.some((c, i) => c.ordinal !== i)) throw new Error("Incomplete immutable workbook");
    const workbook = unpackDataset(String(header.id), chunks.map(c => c.payload as DatasetChunk));
    if (workbook.companies.length !== header.company_count || workbook.timeSeries.length !== header.observation_count) throw new Error("Immutable workbook population mismatch");
    const reviews = (await tx.execute(sql`SELECT id,status,payload,reviewed_at,created_at FROM financial_reviews ORDER BY id`)).rows as Record<string, any>[];
    const archives = (await tx.execute(sql`SELECT s.id,s.chunk_count,s.created_at,c.ordinal,c.payload FROM cv_analysis_snapshots s
      LEFT JOIN cv_analysis_chunks c ON c.snapshot_id=s.id WHERE s.kind='approved-current-financial' ORDER BY s.id,c.ordinal`)).rows as Record<string, any>[];
    const reviewTimes = reviews.flatMap(r => [r.reviewed_at, r.created_at]).filter(Boolean).map(t => new Date(t).toISOString()).sort();
    const actualTimes = [files.audit.createdAt, ...files.versions.map(s => s.fetchedAt), ...archives.map(a => a.created_at),
      ...reviews.flatMap(r => [r.reviewed_at, r.created_at, r.payload?.fetchedAt]).filter(Boolean)].map(t => new Date(t).toISOString()).sort();
    const cutoff = options.cutoff ?? actualTimes.at(-1)!;
    if (!Number.isFinite(Date.parse(cutoff)) || Date.parse(files.audit.createdAt) > Date.parse(cutoff))
      throw new Error("Identity journal not available at cutoff; earlier unqueried states cannot be reconstructed");
    if (reviewTimes.length && Date.parse(reviewTimes.at(-1)!) > Date.parse(cutoff))
      throw new Error("Current mutable review journal cannot reconstruct earlier approval/supersession states; no invented historical review store");
    const companies = workbook.companies as Stage10Company[];
    const eligibleIds: number[] = [], cells: Stage10Cell[] = [], sourceGaps: string[] = [];
    for (const archive of archives) {
      if (archive.chunk_count !== 1 || archive.ordinal !== 0 || contentHash(archive.payload) !== archive.id) throw new Error("Corrupt immutable approved financial overlay");
      const p = archive.payload, parsed = snapshotSchema.safeParse(p.input);
      if (p.version !== "approved-current-financial-1" || !parsed.success) throw new Error("Invalid immutable financial overlay");
      const i = parsed.data.identity, current = reviews.filter(r => r.id === p.reviewId && r.status === "approved");
      if (!companies.some(c => c.id === i.companyId && c.isin === i.isin)) throw new Error("Immutable overlay identity outside workbook");
      if (current.length === 1 && snapshotId(parsed.data) === p.reviewId &&
        [p.approvedAt, parsed.data.fetchedAt, i.reviewedAt, new Date(archive.created_at).toISOString()].every(t => Number.isFinite(Date.parse(t)) && Date.parse(t) <= Date.parse(cutoff)) &&
        sevenStateIdentity(companies.find(c => c.id === i.companyId)!, files.audit.results, reviews, cutoff) === "accepted")
        eligibleIds.push(i.companyId);
    }
    const available = files.versions.filter(s => Date.parse(s.fetchedAt) <= Date.parse(cutoff));
    let selectedVersions = 0;
    for (const company of companies) {
      const versions = available.filter(s => s.payload.company.id === company.id && s.payload.company.isin === company.isin);
      if (!versions.length) continue;
      const latest = versions.map(s => s.fetchedAt).sort().at(-1)!;
      const selected = versions.filter(s => s.fetchedAt === latest);
      selectedVersions += selected.length;
      if (selected.length > 1) {
        for (let year = firstYear; year <= lastYear; year++)
          for (const field of stage10Fields) cells.push({ companyId: company.id, isin: company.isin, year, field, state: "conflicted",
            currency: null, filingDate: null, filingEvidence: "missing", restatement: "unknown", sourceHash: contentHash(selected.map(s => s.inputHash)), capturedAt: latest });
      } else cells.push(...retainedStatementCells({ companyId: company.id, isin: company.isin,
        sourceHash: selected[0].inputHash, capturedAt: latest, statements: selected[0].payload.statements }, cutoff));
    }
    sourceGaps.push("Retained provider candidates are not accepted identities; source fields/captured versions do not establish original publication vintages.",
      "Canonical fields: revenue/EBITDA/netIncome/basic weighted-average shares use income statements; OCF/capex/FCFE use cash flows; working-capital stock/net debt use balance sheets. No same-field fallback across statements or versions.",
      "Retained shares mean annual weighted-average basic shares,not point-in-time outstanding shares; segments unavailable unless explicitly retained.",
      "OCF includes working-capital movements. FCFE=OCF+signed nonpositive capex+net debt issuance; no second WC deduction. Positive capex sign is invalid pending source review.",
      "Provider restated=true is explicit flagged evidence; false/absent never proves original. Unknown original/restated provenance remains unknown.",
      "Net-debt source values require finite native components where available; reported/derived disagreement above max(1,abs(totalDebt-cash))*1e-6 is invalid,not silently replaced. No FX/quote-currency conversion inferred.",
      "Legacy single-company history file is not admitted: its original input hash includes an unretained profile,so no silent refreeze or ticker-only attachment.",
      "Unqueried/provider-error/awaiting-review are distinct; current review without an immutable approved-current-financial archive is not verified-eligible.");
    sourceGaps.push("Existing approved-current-financial snapshots are current-only identities/single-period NI,with no explicit annual FY/original-vintage classification. They are not substituted for annual historical statements.");
    sourceGaps.push("Current mutable approval/supersession rows are not a historical review timeline. Cutoffs before the latest retained review event refuse rather than reconstruct earlier approvals.");
    if (!archives.length) sourceGaps.push("No immutable approved-current-financial overlays retained; verified-eligible corpus cannot advance from current approvals alone.");
    return buildStage10Coverage({ workbookHash: String(header.id), cutoff: new Date(cutoff).toISOString(),
      years: Array.from({ length: lastYear - firstYear + 1 }, (_, i) => firstYear + i), companies,
      attempts: files.audit.results, reviews: reviews.map(r => ({ ...r, reviewed_at: r.reviewed_at ? new Date(r.reviewed_at).toISOString() : null,
        created_at: new Date(r.created_at).toISOString() })),
      eligibleIds, cells, sourceIdentity: { audit: contentHash(files.audit), versions: files.versions.map(s => ({
        hash: s.inputHash, envelopeHash: s.sourceEnvelopeHash, fetchedAt: s.fetchedAt })),
        financialArchives: archives.map(a => ({ hash: a.id, retainedAt: new Date(a.created_at).toISOString() })) },
      retainedVersions: files.versions.length, selectedVersions, sourceGaps });
  }, { isolationLevel: "repeatable read", accessMode: "read only" });
}

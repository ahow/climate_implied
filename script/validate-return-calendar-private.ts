/** Mandatory retained-source check. Only explicit read-only DB access.
 * Optional new private diagnostic receipt; never modifies source or archive.
 * A successful validator verifies the evidence receipt, NOT return qualification. */
import assert from "node:assert/strict";
import { readFileSync, createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import XLSX from "xlsx";
import pg from "pg";
import { inspectRetainedRiConvention } from "../server/calculation/returnQualitySourceConvention";

if (process.env.NODE_ENV === "production") throw new Error("Mandatory private development source validation only");
if (!process.argv.includes("--read-only-db"))
  throw new Error("Explicit --read-only-db required; database precision/immutable-row origins must not be skipped");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const pinned = (path: string, expected: string) => {
  const bytes = readFileSync(path);
  assert.equal(hash(bytes), expected, `Retained source hash mismatch: ${path}`);
  return bytes;
};
const workbookPath = "attached_assets/CarbonData2301a_(1)_1770595242257.xlsx";
pinned(workbookPath, "a52105dae0750d3474d0853960733837b580dc4cef2a208152205f9e164b957c");
pinned("docs/Return_Quality_Protocol.json", "7aa80134ce0bf68ba39d9404eaac0b7be75ffbc98556df51fe71128870b144bd");
const root = "generated-artifacts/return-quality/1cff730fd30647e4bc10de0371353ab7f6a265a51d72f66436a008a7b37d6052-271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac";
pinned(`${root}-freeze.json`, "53a28b0c646b44aa52c3ff481608672da2cc1e44b6e5fc3b6e0bfc6f40848f6d");
pinned(`${root}-identity-attempt.json`, "89829a17e9bf35f6ecdbbae2261db94459da05a4e7f7a29047b25dd3bdd8269d");
const sampleFile = pinned(`${root}-sample.json`, "11b547394d1e29a27ee585c862ff91665c411f8a54457c92e7d077ea8bce5b2b");
const sample = JSON.parse(sampleFile.toString()).sample as Array<{
  isin: string; from: string; to: string; start: number; end: number;
}>;
const part = (name: string, expected: string) => {
  const bytes = execFileSync("unzip", ["-p", workbookPath, name], { maxBuffer: 30_000_000 });
  assert.equal(hash(bytes), expected, `Workbook part changed: ${name}`);
  return bytes.toString();
};
const comment = part("xl/comments2.xml", "3ed046e4c52a415bedad5372920ccd7d10213f92f61f1cd8effe2cf0ad144cdb");
const customBytes = execFileSync("unzip", ["-p", workbookPath, "xl/customProperty2.bin"]);
assert.equal(hash(customBytes), "4db7b32c2a2939a741d7551f22740b50f9c9677140c61e5264544782985ac9a9");
const sheetXml = part("xl/worksheets/sheet2.xml", "88fc66ba725bff55067582b4b99988d2f950ef183d8734d6617e49734dc23320");
assert.equal((sheetXml.match(/<f(?: |>)/g) ?? []).length, 1);
const entries = execFileSync("unzip", ["-Z1", workbookPath]).toString().split("\n");
assert.equal(entries.filter(name => /connections|queryTables|externalLinks/i.test(name)).length, 0);
const wb = XLSX.readFile(workbookPath, { sheets: ["RI", "Descriptive"], cellFormula: true, cellNF: true });
const ri = wb.Sheets.RI;
assert.equal(ri["!ref"], "A1:COY194");
const convention = inspectRetainedRiConvention({
  formula: ri.A1.f!,
  commentFormula: comment.match(/<t>([^<]+)<\/t>/)![1],
  customPropertyJson: customBytes.toString("utf16le"),
  date1904: wb.Workbook!.WBProps!.date1904!,
  dateSerials: Array.from({ length: 193 }, (_, index) => {
    const cell = ri[`A${index + 2}`];
    assert.equal(cell.t, "n");
    assert.equal(cell.z, "m/d/yy");
    return cell.v as number;
  }),
});
assert.equal(convention.weekendLabels, 54);
assert.ok(convention.dates.every(date => date.endsWith("-22")));
assert.equal(convention.reconstructionStatus, "unavailable");
const rows = new Map(convention.dates.map((date, i) => [date, i + 2]));
const descriptive = XLSX.utils.sheet_to_json(wb.Sheets.Descriptive) as Array<{ Type: string; NAME: string }>;
const originalNames = new Map<string, string[]>();
for (const row of descriptive) {
  const names = originalNames.get(row.Type) ?? [];
  names.push(row.NAME.trim().toUpperCase());
  originalNames.set(row.Type, names);
}
const columns = new Map<string, string[]>();
let totalReturnHeaders = 0;
for (const [address, cell] of Object.entries(ri)) {
  if (!/^[A-Z]+1$/.test(address) || address === "A1") continue;
  const header = String(cell.v);
  if (header.endsWith(" - TOT RETURN IND")) totalReturnHeaders++;
  const separator = header.indexOf(" - ");
  const name = (separator < 0 ? header : header.slice(0, separator)).trim().toUpperCase();
  const matches = columns.get(name) ?? [];
  matches.push(address.slice(0, -1));
  columns.set(name, matches);
}
assert.equal(totalReturnHeaders, 2441);
let exactOriginalCells = 0;
let weekendIntervals = 0;
const requested = new Map<string, number>();
const mismatches: Array<{
  isin: string; date: string; address: string; originalLexical: string;
  originalNumeric: number; frozenNumeric: number;
}> = [];
for (const interval of sample) {
  if ([interval.from, interval.to].some(date => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())))
    weekendIntervals++;
  const names = originalNames.get(interval.isin);
  assert.equal(names?.length, 1, "Original descriptive identity missing or ambiguous");
  const cols = columns.get(names![0]);
  assert.equal(cols?.length, 1, "Original workbook name mapping missing or ambiguous");
  for (const [date, expected] of [[interval.from, interval.start], [interval.to, interval.end]] as const) {
    assert.ok(rows.has(date), "Exact source calendar label missing");
    assert.ok(date.endsWith("-22"));
    const original = ri[`${cols![0]}${rows.get(date)}`]?.v;
    assert.equal(typeof original, "number");
    if (original === expected) exactOriginalCells++;
    else {
      const address = `${cols![0]}${rows.get(date)}`;
      const cellXml = sheetXml.match(new RegExp(`<c r="${address}"[^>]*>(.*?)<\\/c>`))![1];
      assert.ok(!cellXml.includes("<f"), "Mismatched source cell must be a numeric cached value, not a formula");
      const originalLexical = cellXml.match(/<v>([^<]+)<\/v>/)![1];
      assert.equal(Number(originalLexical), original, "OOXML numeric decoding differs from lexical Number conversion");
      // sanitizeNumeric's numeric branch is identity; it does not round RI levels.
      assert.equal(ri[address].t, "n");
      mismatches.push({ isin: interval.isin, date, address, originalLexical,
        originalNumeric: original as number, frozenNumeric: expected });
    }
    // No rounding, tolerance-based acceptance or repair of the one retained mismatch.
    requested.set(`${interval.isin}:${date}`, expected);
  }
}
assert.equal(sample.length, 50);
assert.equal(weekendIntervals, 24);
assert.equal(exactOriginalCells, 99, "Original-vs-frozen mismatch count changed; investigate privately");
const archive = "generated-artifacts/recovery/20261109";
pinned(`${archive}/manifest.json`, "9c5d7577aab5f4687e1a03e533a2527f57821928a8e85b3889d60e712ad6a7ef");
const companies = pinned(`${archive}/cv_companies.jsonl`, "366003ba6208085b38141cb4ff6d063626d654cc53a6fff2cc7ad8fd0e3374fc");
const identities = new Map(companies.toString().trim().split("\n").map(line => {
  const row = JSON.parse(line);
  return [row.id as number, row.isin as string] as const;
}));
const digest = createHash("sha256");
const input = createReadStream(`${archive}/cv_time_series.jsonl`);
input.on("data", bytes => digest.update(bytes));
let archiveRows = 0;
let exactArchiveCells = 0;
const seen = new Set<string>();
let mismatchRecoveryRow: Record<string, unknown> | undefined;
for await (const line of createInterface({ input, crlfDelay: Infinity })) {
  const row = JSON.parse(line);
  archiveRows++;
  const key = `${identities.get(row.company_id)}:${new Date(row.date).toISOString().slice(0, 10)}`;
  if (!requested.has(key)) continue;
  assert.ok(!seen.has(key), "Duplicate requested archive cell");
  seen.add(key);
  if (row.total_return_index === requested.get(key)) exactArchiveCells++;
  if (mismatches.some(m => key === `${m.isin}:${m.date}`)) mismatchRecoveryRow = row;
}
assert.equal(digest.digest("hex"), "be7083676a38f01f30674a22cb502b04ef0ae3618b9e3573d86b2c95ee271898");
assert.equal(archiveRows, 470341);
assert.equal(exactArchiveCells, requested.size, "Frozen sample does not exactly match retained recovery rows");
assert.equal(requested.size, 100);
assert.equal(mismatches.length, 1);
assert.ok(mismatchRecoveryRow);
// Exact base-10 lexical difference, not IEEE subtraction displayed as decimal.
function decimalDifference(end: string, start: string) {
  const parts = [end, start].map(value => {
    assert.match(value, /^-?\d+(?:\.\d+)?$/, "Unsupported decimal lexeme; do not approximate the provenance difference");
    const [integer, fraction = ""] = value.split(".");
    return { digits: BigInt(integer + fraction), scale: fraction.length };
  });
  const scale = Math.max(...parts.map(p => p.scale));
  const difference = parts[0].digits * 10n ** BigInt(scale - parts[0].scale) -
    parts[1].digits * 10n ** BigInt(scale - parts[1].scale);
  const abs = (difference < 0n ? -difference : difference).toString().padStart(scale + 1, "0");
  return `${difference < 0n ? "-" : ""}${scale ? `${abs.slice(0, -scale)}.${abs.slice(-scale)}` : abs}`;
}
const mismatch = mismatches[0];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) throw new Error("Mandatory read-only precision provenance unavailable: DATABASE_URL missing");
let dbProof: Record<string, any>;
let immutableProof: Record<string, any>;
let header: Record<string, any>;
try {
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const live = await client.query(`
    SELECT t.company_id, t.total_return_index::text AS stored_text,
      t.total_return_index::double precision AS stored_binary64,
      encode(float4send(t.total_return_index),'hex') AS stored_bits,
      encode(float4send($3::real),'hex') AS original_cast_bits,
      ($3::real)::text AS original_cast_text,
      pg_typeof(t.total_return_index)::text AS column_type,
      current_setting('extra_float_digits') AS extra_float_digits,
      current_setting('transaction_read_only') AS transaction_read_only
    FROM cv_time_series t JOIN cv_companies c ON c.id=t.company_id
    WHERE c.isin=$1 AND t.date=$2::timestamp`,
  [mismatch.isin, mismatch.date, mismatch.originalLexical]);
  assert.equal(live.rows.length, 1, "Missing/ambiguous current DB mismatch row");
  dbProof = live.rows[0];
  assert.equal(dbProof.transaction_read_only, "on");
  assert.equal(dbProof.column_type, "real");
  assert.equal(Number(dbProof.stored_text), mismatch.frozenNumeric);
  assert.equal(Number(dbProof.original_cast_text), mismatch.frozenNumeric);
  assert.equal(dbProof.stored_bits, dbProof.original_cast_bits);
  assert.equal(dbProof.stored_binary64, Math.fround(mismatch.originalNumeric));
  assert.equal(Math.fround(mismatch.originalNumeric), Math.fround(mismatch.frozenNumeric));
  const snapshotId = "271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac";
  const headers = await client.query(`
    SELECT source_upload_id, source_note, created_at, chunk_count, company_count, observation_count
    FROM cv_analysis_snapshots WHERE id=$1`, [snapshotId]);
  assert.equal(headers.rows.length, 1, "Exact immutable snapshot header missing");
  header = headers.rows[0];
  assert.equal(header.source_upload_id, null);
  assert.equal(header.source_note, "Existing revised workbook database; stored precision retained; original source precision and publication vintages not reconstructed");
  assert.equal(header.chunk_count, 238);
  const chunks = await client.query(`
    SELECT ch.ordinal, item AS row, item->>'totalReturnIndex' AS ri_lexical
    FROM cv_analysis_chunks ch
    CROSS JOIN LATERAL jsonb_array_elements(ch.payload->'rows') item
    WHERE ch.snapshot_id=$1 AND ch.payload->>'entity'='timeSeries'
      AND (item->>'companyId')::integer=$2
      AND (item->>'date')::timestamptz=$3::timestamptz`,
  [snapshotId, dbProof.company_id, mismatch.date]);
  assert.equal(chunks.rows.length, 1, "Immutable selected row missing/ambiguous");
  immutableProof = chunks.rows[0];
  assert.equal(immutableProof.row.totalReturnIndex, mismatch.frozenNumeric);
  assert.equal(Number(immutableProof.ri_lexical), mismatch.frozenNumeric);
  assert.equal(mismatchRecoveryRow!.total_return_index, mismatch.frozenNumeric);
  await client.query("ROLLBACK");
} finally {
  await client.end();
}
const exactLexicalDifference = decimalDifference(String(mismatch.frozenNumeric), mismatch.originalLexical);
assert.equal(exactLexicalDifference, "0.00999999998");
const precisionFinding = {
  sourceCellType: "n", ooxmlLexicalNumberConversionExact: true,
  originalVsFrozenExactSignedDecimalDifference: exactLexicalDifference,
  originalVsFrozenBinary64Subtraction: mismatch.frozenNumeric - mismatch.originalNumeric,
  originalAndFrozenSameBinary32: true, dbOriginalRealCastTextEqualsFrozen: true,
  dbOriginalRealCastBitsEqualStoredBits: true, currentDbColumnType: dbProof.column_type,
  extraFloatDigits: dbProof.extra_float_digits, readOnlyTransaction: dbProof.transaction_read_only,
  immutableSelectedRowMatchesFrozen: true, recoverySelectedRowMatchesFrozen: true,
  sourceUploadId: header.source_upload_id,
  conclusion: "Observed difference is reproduced by original lexical -> PostgreSQL real -> text -> JavaScript Number. This is diagnostic equivalence, not original-vintage proof, a value repair, a tolerance pass or return qualification.",
};
if (process.argv.includes("--retain-private")) {
  const directory = "generated-artifacts/return-calendar-source";
  mkdirSync(directory, { recursive: true });
  const receipt = {
    capturedAt: new Date().toISOString(), scope: "private-lineage-diagnostics-not-source-acceptance",
    mismatch, recoveryRow: mismatchRecoveryRow, dbProof, immutableProof, snapshotHeader: header,
    precisionFinding,
  };
  writeFileSync(`${directory}/boundary-lineage-private.json`, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
}
const retainedLineage = JSON.parse(pinned(
  "generated-artifacts/return-calendar-source/boundary-lineage-private.json",
  "df117710b63081b6cad89440c44e9ee33611574144350fc06948ebfa0e3244e9").toString());
assert.deepEqual(retainedLineage.mismatch, mismatch, "Retained private mismatch coordinates/values changed");
assert.equal(retainedLineage.dbProof.stored_bits, dbProof.stored_bits);
assert.equal(retainedLineage.immutableProof.row.totalReturnIndex, mismatch.frozenNumeric);
assert.equal(retainedLineage.precisionFinding.originalVsFrozenExactSignedDecimalDifference, exactLexicalDifference);
const publisherRoot = "generated-artifacts/return-calendar-source/publisher";
const publisherCapture = JSON.parse(pinned(`${publisherRoot}/capture.json`,
  "0d775b931eadd346347fa57173fefa7333e0db52a5303ec337b13f9c15f1f6ee").toString());
assert.equal(publisherCapture.requests, 5);
const publisherExpected: Record<string, { status: number; sha256: string }> = {
  "actual-dates": { status: 200, sha256: "6cdca20f67a6e90526a57375bf812966bc527415bced13b49bdee558142428a5" },
  "currency-code": { status: 200, sha256: "0240ea663bf39fb9e3d209d1b18a1d7c3a7e374dffca8f9c983aba27e7f96b05" },
  "request-frequency": { status: 200, sha256: "6f34a2184eba802caa17c5d3060cdedc6715187e2850e5eb7a21460ba868266e" },
  "datatype-access": { status: 302, sha256: "6bbb1a6faa0ade59f8134b2db70103c9b317368a82b0180f40423facbcdecba6" },
  "legacy-doc-path": { status: 404, sha256: "dc1d54dab6ec8c00f70137927504e4f222c8395f10760b6beecfcfa94e08249f" },
};
for (const [name, expected] of Object.entries(publisherExpected)) {
  const captures = publisherCapture.results.filter((r: { name: string }) => r.name === name);
  assert.equal(captures.length, 1, "Publisher capture missing/duplicate");
  assert.equal(captures[0].status, expected.status);
  assert.equal(captures[0].sha256, expected.sha256);
  pinned(`${publisherRoot}/${name}.html`, expected.sha256);
}
const actualDateText = readFileSync(`${publisherRoot}/actual-dates.html`, "utf8")
  .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
assert.match(actualDateText, /actual start and end dates for a function/);
assert.match(actualDateText, /Saturday or Sunday, the previous Friday is used/);
// These statements concern function parameters, NOT an evidenced raw DSGRID M-label rule.
assert.equal(convention.calendarRule, "unresolved");
console.log(JSON.stringify({
  passed: true, scope: "evidence-validation-only-not-source-acceptance",
  sourceDates: 193, weekendLabels: 54, sampled: 50, weekendIntervals,
  originalExactBoundaryCells: exactOriginalCells, originalMismatchedBoundaryCells: 100 - exactOriginalCells,
  recoveryExactBoundaryCells: exactArchiveCells, archiveRows,
  precisionFinding,
  retainedPublisherCaptures: 5, publicDocuments: 3, loginRedirectsNotFollowed: 1, missingDocumentPaths: 1,
  computedReturns: 0, qualifiedReturns: 0, approvals: 0, reconstructionStatus: convention.reconstructionStatus,
}));

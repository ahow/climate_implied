/** Read-only retained input compatibility audit. Emits counts/hashes, never cell payloads/coordinates. */
import XLSX from "xlsx";
import { createHash } from "node:crypto";
import { workbookSourceId, readWorkbookNumeric } from "../server/climateValuation/workbookMissingness";
import { validateRequiredSheets, parseAndPrepare, generateTimeSeriesStreaming } from "../server/climateValuation/dataProcessor";

const path = process.argv[2];
if (!path || process.env.NODE_ENV === "production") throw new Error("Explicit retained workbook in development required");
const output: any = { sourcePath: path, sourceId: await workbookSourceId(path), databaseReads: 0, databaseWrites: 0, approvalWrites: 0, cacheWrites: 0, sheets: {} };
const log = console.log; console.log = () => {};
try {
  const map = validateRequiredSheets(path);
  const metadata = XLSX.readFile(path, { sheets: ["Descriptive"] });
  const names = new Map<string, string>(), isins = new Set<string>();
  for (const row of XLSX.utils.sheet_to_json<any>(metadata.Sheets.Descriptive)) {
    if (row.NAME && row.Type) { names.set(String(row.NAME).trim().toUpperCase(), row.Type); isins.add(row.Type); }
  }
  const digest = createHash("sha256");
  for (const name of [map.greenRev, map.emissionTargets, "S1", "S2", "S3", "MV", "PE", ...(map.profit ? [map.profit] : []), "RI"]) {
    const book = XLSX.readFile(path, { sheets: [name] }), sheet = book.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    const headers = rows[0] ?? [], summary: any = { consumed: 0, blank: 0, unavailableProviderNA: 0, observedZero: 0, observedOther: 0, rejected: 0, rejectedClasses: {} };
    output.sheets[name] = summary;
    const financial = ["MV", "PE", "RI", map.profit].includes(name);
    const columns: number[] = [];
    const riColumns = new Map<string, number>();
    let mappedRIColumns = 0;
    for (let c = 0; c < headers.length; c++) {
      const header = String(headers[c] ?? "");
      if (financial) {
        if (c === 0) continue;
        const isin = name === "PE" ? header.match(/^([A-Z]{2}[A-Z0-9]{9}[0-9])\(P\)/)?.[1]
          : names.get(header.split(" - ")[0].trim().toUpperCase());
        if (isin && isins.has(isin)) {
          if (name === "RI") { mappedRIColumns++; riColumns.set(isin, c); }
          else columns.push(c);
        }
      } else if (/^S[123]$/.test(name)) {
        if (/^CARBON_EMISSIONS_SCOPE_[123]_FY(?:1\d|2[0-4])$/.test(header)) columns.push(c);
      } else if (header === (name === map.greenRev ? "SDG_07_NET_ALIGNMENT_SCORE" : "TARGET_SUMMARY_CUM_CHANGE_2050")) columns.push(c);
    }
    if (name === "RI") {
      columns.push(...Array.from(riColumns.values()));
      summary.nonAuthoritativeAliasColumns = mappedRIColumns - columns.length;
    }
    for (let r = 1; r < rows.length; r++) {
      if (financial && (rows[r]?.[0] == null || rows[r]?.[0] === "")) continue;
      if (!financial && !rows[r]?.[headers.indexOf("ISSUER_ISIN")]) continue;
      for (const c of columns) {
        const address = XLSX.utils.encode_cell({ r, c }), cell = sheet[address];
        summary.consumed++;
        try {
          const parsed = readWorkbookNumeric(output.sourceId, name, address, cell);
          if (parsed.source.state === "unavailable") summary.unavailableProviderNA++;
          else if (parsed.value === null) summary.blank++;
          else if (parsed.value === 0) summary.observedZero++;
          else summary.observedOther++;
        } catch {
          const value = cell?.v;
          const classification = cell?.t === "e" ? `excel-error-code-${value}` : typeof value === "boolean" ? "boolean"
            : typeof value === "number" ? "nonfinite-number"
            : /^(?:n\/?a|not applicable)$/i.test(String(value).trim()) ? "NA-or-not-applicable-token"
            : /^[<>]/.test(String(value).trim()) ? "threshold-qualifier" : "other-unsupported-string";
          summary.rejected++; summary.rejectedClasses[classification] = (summary.rejectedClasses[classification] ?? 0) + 1;
          digest.update(`${name}:${address}:${classification}\n`);
        }
      }
    }
  }
  output.rejectedCellIdentityDigest = digest.digest("hex");
  let context: Awaited<ReturnType<typeof parseAndPrepare>> | undefined;
  try {
    context = await parseAndPrepare(path, map);
    let rows = 0, nullValues = 0, zeroValues = 0;
    const fields: Record<string, { null: number; zero: number; other: number; providerNA: number; sourceIdentityAbsent: number }> = {};
    const observedKeys = new Set<string>();
    let duplicateCompanyDateRows = 0, alignedProfitValues = 0, sourceStateValueMismatches = 0;
    const ids = new Map(context.companyData.companies.map((row, index) => [row.isin, index + 1]));
    await generateTimeSeriesStreaming(context, path, ids, 2000, async batch => {
      rows += batch.length;
      for (const row of batch) {
        const key = `${row.companyId}:${new Date(row.date).toISOString()}`;
        if (observedKeys.has(key)) duplicateCompanyDateRows++;
        observedKeys.add(key);
        if (row.derivations?.netProfit?.method.includes("same-calendar-month")) alignedProfitValues++;
      }
      for (const row of batch) for (const field of ["totalReturnIndex", "marketCap", "priceEarnings", "netProfit", "scope1Emissions", "scope2Emissions", "scope3Emissions"] as const) {
        const count = fields[field] ??= { null: 0, zero: 0, other: 0, providerNA: 0, sourceIdentityAbsent: 0 };
        const source = row.sourceCells?.[field];
        if (source && (source.originalValue !== row[field] || source.state !== "observed" && row[field] !== null)) sourceStateValueMismatches++;
        if (!row.sourceCells?.[field]) count.sourceIdentityAbsent++;
        if (row.sourceCells?.[field]?.state === "unavailable") count.providerNA++;
        if (row[field] === null) count.null++; else if (row[field] === 0) count.zero++; else count.other++;
        if (row[field] === null) nullValues++; else if (row[field] === 0) zeroValues++;
      }
    });
    output.actualLoader = { status: "accepted", companies: context.companyData.companies.length, streamedRows: rows, nullValues, zeroValues, fields,
      uniqueCompanyIsins: new Set(context.companyData.companies.map(row => row.isin)).size,
      duplicateCompanyDateRows, alignedProfitValues, sourceStateValueMismatches,
      profitPeriods: context.profitTimestamps.length,
      profitPeriodsExactlyMatchingMV: context.profitTimestamps.filter(timestamp => context!.mvArrays.has(timestamp)).length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    output.actualLoader = { status: "refused", errorClass: /Unsupported numeric source cell/.test(message) ? "unsupported-numeric-source-cell" : "other-loader-error",
      diagnosticHash: createHash("sha256").update(message).digest("hex") };
  } finally { context?.releaseMemory(); }
} finally { console.log = log; }
console.log(JSON.stringify(output, null, 2));

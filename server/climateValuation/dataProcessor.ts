import XLSX from 'xlsx';
import type { InsertCvCompany, InsertCvTimeSeries, CvCompany } from '@shared/schema';
import { workbookSourceId, readWorkbookNumeric, numericSourceCell, unavailableSourceCell, type WorkbookSourceCells, type WorkbookSourceMetadata } from "./workbookMissingness";

function excelSerialToDate(serial: number): Date {
  const excelEpoch = new Date(1899, 11, 30);
  const msPerDay = 24 * 60 * 60 * 1000;
  return new Date(excelEpoch.getTime() + serial * msPerDay);
}

export interface CompanyData {
  companies: Omit<CvCompany, 'id'>[];
  stats: {
    totalCompanies: number;
    totalTimePeriods: number;
    companiesWithEmissions: number;
    companiesWithTargets: number;
    companiesWithSDGScores: number;
  };
}

function extractCompanyName(columnName: string): string {
  const dashIdx = columnName.indexOf(' - ');
  return dashIdx >= 0 ? columnName.substring(0, dashIdx).trim() : columnName.trim();
}

function findClosestFY(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const fyYear = month < 6 ? year - 1 : year;
  const fy = fyYear - 2000;
  return `FY${fy.toString().padStart(2, '0')}`;
}

function readSheets(filePath: string, sheets: string[]): XLSX.WorkBook {
  return XLSX.readFile(filePath, { sheets });
}

function parseDateValue(dateValue: any): Date | null {
  let date: Date;
  if (typeof dateValue === 'number') date = excelSerialToDate(dateValue);
  else if (typeof dateValue === 'string') date = new Date(dateValue);
  else return null;
  return isNaN(date.getTime()) ? null : date;
}

export interface ParsedWorkbookContext {
  sourceId: string;
  profitSheet: string | null;
  scopeSources: Map<string, Map<string, WorkbookSourceCells>>;
  financialPositions: Map<string, Map<number, { row: number; columns: Map<number, number>; unavailable: Set<number> }>>;
  nameToIsin: Map<string, string>;
  isinIndex: Map<string, number>;
  numCompanies: number;
  peIsinSet: Set<string>;
  emissionsMap: Map<string, Map<string, { s1: number | null; s2: number | null; s3: number | null }>>;
  mvArrays: Map<number, Float64Array>;
  peArrays: Map<number, Float64Array>;
  profitArrays: Map<number, Float64Array>;
  profitTimestamps: number[];
  riDateCount: number;
  companyData: CompanyData;
  releaseMemory: () => void;
}

function resolveSheetName(sheetNames: string[], candidates: string[]): string | null {
  for (const c of candidates) {
    if (sheetNames.includes(c)) return c;
  }
  return null;
}

export interface SheetNameMap {
  descriptive: string;
  ri: string;
  mv: string;
  s1: string;
  s2: string;
  s3: string;
  pe: string;
  profit: string | null;
  greenRev: string;
  emissionTargets: string;
}

export function validateRequiredSheets(filePath: string): SheetNameMap {
  const wb = XLSX.readFile(filePath, { bookSheets: true });
  const sn = wb.SheetNames;

  const coreSheets = ['Descriptive', 'RI', 'MV', 'S1', 'S2', 'S3', 'PE'];
  for (const name of coreSheets) {
    if (!sn.includes(name)) {
      throw new Error(`Required sheet "${name}" not found. Found: ${sn.join(', ')}`);
    }
  }

  const greenRev = resolveSheetName(sn, ['GreenRev', 'Sales']);
  if (!greenRev) {
    throw new Error(`Required sheet "GreenRev" or "Sales" not found. Found: ${sn.join(', ')}`);
  }

  const emissionTargets = resolveSheetName(sn, ['EmissionTargets', 'NZTarget']);
  if (!emissionTargets) {
    throw new Error(`Required sheet "EmissionTargets" or "NZTarget" not found. Found: ${sn.join(', ')}`);
  }

  const profit = resolveSheetName(sn, ['Profit']);

  console.log(`[DataProcessor] Sheets resolved: greenRev=${greenRev}, emissionTargets=${emissionTargets}, profit=${profit ?? 'N/A (will derive from MV/PE)'}`);

  return {
    descriptive: 'Descriptive',
    ri: 'RI',
    mv: 'MV',
    s1: 'S1',
    s2: 'S2',
    s3: 'S3',
    pe: 'PE',
    profit,
    greenRev,
    emissionTargets,
  };
}

function buildColumnMapping(
  columns: string[],
  nameToIsin: Map<string, string>,
  isinIndex: Map<string, number>
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (col === 'Name') continue;
    const companyName = extractCompanyName(col).toUpperCase();
    const isin = nameToIsin.get(companyName);
    if (!isin) continue;
    const idx = isinIndex.get(isin);
    if (idx === undefined) continue;
    result.push([i, idx]);
  }
  return result;
}

export async function parseAndPrepare(filePath: string, sheetMap: SheetNameMap): Promise<ParsedWorkbookContext> {
  const sourceId = await workbookSourceId(filePath);
  const scopeSources = new Map<string, Map<string, WorkbookSourceCells>>();
  const financialPositions = new Map<string, Map<number, { row: number; columns: Map<number, number>; unavailable: Set<number> }>>();
  const nameToIsin = new Map<string, string>();
  const isinIndex = new Map<string, number>();
  const emissionsMap = new Map<string, Map<string, { s1: number | null; s2: number | null; s3: number | null }>>();
  const companies: Omit<CvCompany, 'id'>[] = [];
  let companiesWithEmissions = 0, companiesWithTargets = 0, companiesWithSDGScores = 0;
  let numCompanies = 0;

  console.log(`[DataProcessor] Phase 1: Metadata sheets (xlsx)...`);
  {
    const wb = readSheets(filePath, ['Descriptive', sheetMap.greenRev, sheetMap.emissionTargets, 'S1', 'S2', 'S3']);

    const descriptive = XLSX.utils.sheet_to_json(wb.Sheets['Descriptive']) as any[];
    console.log(`[DataProcessor] Descriptive: ${descriptive.length} rows`);

    const greenRev = XLSX.utils.sheet_to_json(wb.Sheets[sheetMap.greenRev]) as any[];
    const emissionTargets = XLSX.utils.sheet_to_json(wb.Sheets[sheetMap.emissionTargets]) as any[];

    for (const row of descriptive) {
      const name = row['NAME'];
      const isin = row['Type'];
      if (name && isin) nameToIsin.set(name.trim().toUpperCase(), isin);
    }

    const greenRevMap = new Map<string, number | null>();
    const greenHeaders = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetMap.greenRev], { header: 1 })[0] ?? [];
    const targetHeaders = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheetMap.emissionTargets], { header: 1 })[0] ?? [];
    for (const row of greenRev) {
      const isin = row['ISSUER_ISIN'];
      const column = greenHeaders.indexOf('SDG_07_NET_ALIGNMENT_SCORE');
      const address = XLSX.utils.encode_cell({ r: row.__rowNum__, c: Math.max(0, column) });
      const score = column >= 0 ? readWorkbookNumeric(sourceId, sheetMap.greenRev, address, wb.Sheets[sheetMap.greenRev][address]).value : null;
      if (isin) greenRevMap.set(isin, score);
    }

    const emissionTargetMap = new Map<string, number | null>();
    if (emissionTargets.length > 0) {
      const sampleRow = emissionTargets[0];
      const availableKeys = Object.keys(sampleRow);
      console.log(`[DataProcessor] EmissionTargets columns: ${availableKeys.join(', ')}`);
      const targetColCandidates = availableKeys.filter(k =>
        k.toUpperCase().includes('TARGET') || k.toUpperCase().includes('2050') || k.toUpperCase().includes('CUM_CHANGE')
      );
      console.log(`[DataProcessor] EmissionTargets target-like columns: ${targetColCandidates.join(', ')}`);
    }
    for (const row of emissionTargets) {
      const isin = row['ISSUER_ISIN'];
      const column = targetHeaders.indexOf('TARGET_SUMMARY_CUM_CHANGE_2050');
      const address = XLSX.utils.encode_cell({ r: row.__rowNum__, c: Math.max(0, column) });
      const target = column >= 0 ? readWorkbookNumeric(sourceId, sheetMap.emissionTargets, address, wb.Sheets[sheetMap.emissionTargets][address]).value : null;
      if (isin) emissionTargetMap.set(isin, target);
    }
    console.log(`[DataProcessor] EmissionTargets: ${emissionTargets.length} rows, ${Array.from(emissionTargetMap.values()).filter(value => value !== null).length} with valid target values`);

    let idx = 0;
    for (const row of descriptive) {
      const isin = row['Type'] as string;
      const name = row['NAME'] as string;
      if (!isin || !name) continue;
      isinIndex.set(isin, idx++);
      companies.push({
        isin,
        name,
        geography: (row['GEOGRAPHIC DESCR.'] as string) || null,
        sector: (row['LEVEL2 SECTOR NAME'] as string) || null,
        subSector: (row['LEVEL3 SECTOR NAME'] as string) || null,
        industry: (row['LEVEL4 SECTOR NAME'] as string) || null,
        sdgAlignmentScore: greenRevMap.get(isin) ?? null,
        emissionTarget2050: emissionTargetMap.get(isin) ?? null,
      });
    }
    numCompanies = idx;

    const s1Data = XLSX.utils.sheet_to_json(wb.Sheets['S1']) as any[];
    const s2Data = XLSX.utils.sheet_to_json(wb.Sheets['S2']) as any[];
    const s3Data = XLSX.utils.sheet_to_json(wb.Sheets['S3']) as any[];

    const processScope = (data: any[], scopeKey: 's1' | 's2' | 's3', colPrefix: string) => {
      const sheet = scopeKey.toUpperCase();
      const headers = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sheet], { header: 1 })[0] ?? [];
      for (const row of data) {
        const isin = row['ISSUER_ISIN'];
        if (!isin) continue;
        if (!emissionsMap.has(isin)) emissionsMap.set(isin, new Map());
        const companyMap = emissionsMap.get(isin)!;
        for (let year = 10; year <= 24; year++) {
          const fyKey = `FY${year}`;
          const colName = `${colPrefix}FY${year}`;
          if (!companyMap.has(fyKey)) companyMap.set(fyKey, { s1: null, s2: null, s3: null });
          const column = headers.indexOf(colName);
          // __rowNum__ retains physical rows even when blank rows were skipped.
          const address = XLSX.utils.encode_cell({ r: row.__rowNum__, c: Math.max(0, column) });
          const parsed = column < 0 ? null : readWorkbookNumeric(sourceId, sheet, address, wb.Sheets[sheet][address]);
          if (parsed) {
            if (!scopeSources.has(isin)) scopeSources.set(isin, new Map());
            if (!scopeSources.get(isin)!.has(fyKey)) scopeSources.get(isin)!.set(fyKey, {});
            scopeSources.get(isin)!.get(fyKey)![scopeKey === "s1" ? "scope1Emissions" : scopeKey === "s2" ? "scope2Emissions" : "scope3Emissions"] = parsed.source;
          }
          const sanitized = parsed?.value ?? null;
          companyMap.get(fyKey)![scopeKey] = sanitized;
        }
      }
    };
    processScope(s1Data, 's1', 'CARBON_EMISSIONS_SCOPE_1_');
    processScope(s2Data, 's2', 'CARBON_EMISSIONS_SCOPE_2_');
    processScope(s3Data, 's3', 'CARBON_EMISSIONS_SCOPE_3_');

    for (const c of companies) {
      if (emissionsMap.has(c.isin)) companiesWithEmissions++;
      if (c.emissionTarget2050 !== null && c.emissionTarget2050 !== undefined) companiesWithTargets++;
      if (c.sdgAlignmentScore !== null && c.sdgAlignmentScore !== undefined) companiesWithSDGScores++;
    }
    console.log(`[DataProcessor] Phase 1 done: ${numCompanies} companies indexed`);
  }

  console.log(`[DataProcessor] Phase 2: Reading MV/PE/Profit sheets with xlsx (direct seek)...`);
  const mvArrays = new Map<number, Float64Array>();
  const peArrays = new Map<number, Float64Array>();
  const peIsinSet = new Set<string>();
  const profitArrays = new Map<number, Float64Array>();
  const profitTimestamps: number[] = [];

  function processSheet(sheetName: string) {
    console.log(`[DataProcessor] Reading sheet: ${sheetName}...`);
    const wb = XLSX.readFile(filePath, { sheets: [sheetName] });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 }) as any[][];
    if (rows.length === 0) {
      console.log(`[DataProcessor] ${sheetName}: empty sheet`);
      return;
    }

    const headerCols = rows[0];
    const colMapping: Array<[number, number]> = [];

    if (sheetName === 'PE') {
      for (let c = 1; c < headerCols.length; c++) {
        const colName = headerCols[c] ? String(headerCols[c]) : '';
        if (!colName) continue;
        const match = colName.match(/^([A-Z]{2}[A-Z0-9]{9}[0-9])\(P\)/);
        if (!match) continue;
        const isin = match[1];
        const arrIdx = isinIndex.get(isin);
        if (arrIdx === undefined) continue;
        colMapping.push([c, arrIdx]);
        peIsinSet.add(isin);
      }
      console.log(`[DataProcessor] PE: ${colMapping.length} columns mapped, ${peIsinSet.size} ISINs`);
    } else {
      for (let c = 1; c < headerCols.length; c++) {
        const colName = headerCols[c] ? String(headerCols[c]) : '';
        if (!colName) continue;
        const companyName = extractCompanyName(colName).toUpperCase();
        const isin = nameToIsin.get(companyName);
        if (!isin) continue;
        const arrIdx = isinIndex.get(isin);
        if (arrIdx === undefined) continue;
        colMapping.push([c, arrIdx]);
      }
      console.log(`[DataProcessor] ${sheetName}: ${colMapping.length} columns mapped`);
    }

    let rowCount = 0;
    const positions = new Map<number, { row: number; columns: Map<number, number>; unavailable: Set<number> }>();
    financialPositions.set(sheetName, positions);
    const columns = new Map(colMapping.map(([column, index]) => [index, column]));
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const date = parseDateValue(row[0]);
      if (!date) continue;
      const ts = date.getTime();
      rowCount++;

      const arr = new Float64Array(numCompanies).fill(NaN);
      const unavailable = new Set<number>();
      for (const [colIdx, arrIdx] of colMapping) {
        const address = XLSX.utils.encode_cell({ r, c: colIdx });
        const parsed = readWorkbookNumeric(sourceId, sheetName, address, wb.Sheets[sheetName][address]);
        const val = parsed.value;
        if (parsed.source.state === "unavailable") unavailable.add(arrIdx);
        else unavailable.delete(arrIdx);
        // Last mapped column is authoritative even when it declares missingness.
        // Never backfill its original blank/NA from an earlier alias column.
        arr[arrIdx] = val ?? NaN;
      }
      positions.set(ts, { row: r, columns, unavailable });

      if (sheetName === 'MV') {
        mvArrays.set(ts, arr);
      } else if (sheetName === 'PE') {
        peArrays.set(ts, arr);
      } else if (sheetName === sheetMap.profit) {
        profitArrays.set(ts, arr);
        profitTimestamps.push(ts);
      }
    }
    console.log(`[DataProcessor] ${sheetName}: done, ${rowCount} data rows`);
  }

  processSheet('MV');
  processSheet('PE');
  if (sheetMap.profit) {
    processSheet(sheetMap.profit);
  } else {
    console.log(`[DataProcessor] No Profit sheet; net profit will be derived from MV/PE at query time`);
  }

  profitTimestamps.sort((a, b) => a - b);
  console.log(`[DataProcessor] MV: ${mvArrays.size} dates, PE: ${peArrays.size} dates, Profit: ${profitArrays.size} dates`);

  const riDateCount = mvArrays.size;

  const companyData: CompanyData = {
    companies,
    stats: {
      totalCompanies: companies.length,
      totalTimePeriods: riDateCount,
      companiesWithEmissions,
      companiesWithTargets,
      companiesWithSDGScores,
    },
  };

  const memMV = mvArrays.size * numCompanies * 8;
  const memPE = peArrays.size * numCompanies * 8;
  const memProfit = profitArrays.size * numCompanies * 8;
  console.log(`[DataProcessor] Array memory: MV=${(memMV/1024/1024).toFixed(1)}MB PE=${(memPE/1024/1024).toFixed(1)}MB Profit=${(memProfit/1024/1024).toFixed(1)}MB Total=${((memMV+memPE+memProfit)/1024/1024).toFixed(1)}MB`);

  return {
    sourceId,
    profitSheet: sheetMap.profit,
    scopeSources,
    financialPositions,
    nameToIsin,
    isinIndex,
    numCompanies,
    peIsinSet,
    emissionsMap,
    mvArrays,
    peArrays,
    profitArrays,
    profitTimestamps,
    riDateCount,
    companyData,
    releaseMemory() {
      scopeSources.clear();
      financialPositions.clear();
      nameToIsin.clear();
      isinIndex.clear();
      emissionsMap.clear();
      mvArrays.clear();
      peArrays.clear();
      profitArrays.clear();
      profitTimestamps.length = 0;
      peIsinSet.clear();
      console.log(`[DataProcessor] Memory released`);
    },
  };
}

export async function generateTimeSeriesStreaming(
  ctx: ParsedWorkbookContext,
  filePath: string,
  isinToDbId: Map<string, number>,
  batchSize: number,
  onBatch: (batch: (InsertCvTimeSeries & WorkbookSourceMetadata)[]) => Promise<void>
): Promise<number> {
  if (await workbookSourceId(filePath) !== ctx.sourceId) throw new Error("Workbook source bytes changed after parsing");
  const { nameToIsin, isinIndex, peIsinSet, emissionsMap, mvArrays, peArrays, profitArrays } = ctx;

  console.log(`[DataProcessor] Streaming RI sheet with exceljs (row-by-row)...`);

  const colMappings = new Map<number, { isin: string; companyId: number; arrayIdx: number }>();
  let headerProcessed = false;
  let rowCount = 0;
  let totalGenerated = 0;
  let batch: (InsertCvTimeSeries & WorkbookSourceMetadata)[] = [];
  const profitMonths = new Map<string, number[]>();
  for (const timestamp of ctx.profitTimestamps) {
    const month = new Date(timestamp).toISOString().slice(0, 7);
    if (!profitMonths.has(month)) profitMonths.set(month, []);
    profitMonths.get(month)!.push(timestamp);
  }

  console.log(`[DataProcessor] Reading RI sheet with xlsx (direct seek)...`);
  {
    const wb = XLSX.readFile(filePath, { sheets: ['RI'] });
    const allRows = XLSX.utils.sheet_to_json(wb.Sheets['RI'], { header: 1 }) as any[][];
    const totalRiRows = allRows.length;
    console.log(`[DataProcessor] RI sheet: ${totalRiRows} rows loaded`);

    if (totalRiRows > 0) {
      const headerCols = allRows[0];
      for (let c = 1; c < headerCols.length; c++) {
        const colName = headerCols[c] ? String(headerCols[c]) : '';
        if (!colName) continue;
        const companyName = extractCompanyName(colName).toUpperCase();
        const isin = nameToIsin.get(companyName);
        if (!isin) continue;
        const companyId = isinToDbId.get(isin);
        if (!companyId) continue;
        const arrayIdx = isinIndex.get(isin);
        if (arrayIdx === undefined) continue;
        colMappings.set(c, { isin, companyId, arrayIdx });
      }
      console.log(`[DataProcessor] RI: ${colMappings.size} columns mapped`);

      const effectiveColumns = new Map<number, [number, { isin: string; companyId: number; arrayIdx: number }]>();
      colMappings.forEach((mapping, column) => effectiveColumns.set(mapping.companyId, [column, mapping]));
      // Same deterministic last-column rule as MV/PE/Profit; never emit
      // duplicate company/date originals or reuse an earlier alias's value.
      const colEntries = Array.from(effectiveColumns.values());
      const ROW_CHUNK = 50;
      for (let chunkStart = 1; chunkStart < totalRiRows; chunkStart += ROW_CHUNK) {
        const chunkEnd = Math.min(chunkStart + ROW_CHUNK, totalRiRows);
        for (let r = chunkStart; r < chunkEnd; r++) {
          const row = allRows[r];
          if (!row) continue;
          const date = parseDateValue(row[0]);
          if (!date) continue;
          rowCount++;

          const ts = date.getTime();
          const mvArr = mvArrays.get(ts);
          const peArr = peArrays.get(ts);
          const monthMatches = profitMonths.get(date.toISOString().slice(0, 7)) ?? [];
          const profitTs = profitArrays.has(ts) ? ts : monthMatches.length === 1 ? monthMatches[0] : undefined;
          if (!profitArrays.has(ts) && monthMatches.length > 1) throw new Error("Ambiguous Profit source period; no automatic alignment");
          const profitArr = profitTs === undefined ? undefined : profitArrays.get(profitTs);
          const fy = findClosestFY(date);

          for (const [colIdx, mapping] of colEntries) {
            const riAddress = XLSX.utils.encode_cell({ r, c: colIdx });
            const ri = readWorkbookNumeric(ctx.sourceId, 'RI', riAddress, wb.Sheets['RI'][riAddress]);
            const riValue = ri.value;
            const emissions = emissionsMap.get(mapping.isin)?.get(fy);

            const mvVal = mvArr ? mvArr[mapping.arrayIdx] : NaN;
            const peVal = peArr ? peArr[mapping.arrayIdx] : NaN;

            let netProfitVal: number | null = null;
            if (ctx.profitSheet !== null) {
              // Only a unique same-month observation may align; never nearest-month borrowing.
              const profitVal = profitArr ? profitArr[mapping.arrayIdx] : NaN;
              netProfitVal = isNaN(profitVal) ? null : profitVal;
            } else if (!isNaN(mvVal) && !isNaN(peVal) && peVal !== 0) {
              netProfitVal = mvVal / peVal;
              if (!Number.isFinite(netProfitVal)) netProfitVal = null;
            }

            const sourceCells: WorkbookSourceCells = {
              ...ctx.scopeSources.get(mapping.isin)?.get(fy),
              totalReturnIndex: ri.source,
            };
            for (const [sheet, field, value] of [
              ['MV', 'marketCap', mvVal], ['PE', 'priceEarnings', peVal],
              [ctx.profitSheet, 'netProfit', netProfitVal],
            ] as const) {
              if (!sheet) continue;
              const sourceTimestamp = field === "netProfit" ? profitTs : ts;
              const position = sourceTimestamp === undefined ? undefined : ctx.financialPositions.get(sheet)?.get(sourceTimestamp);
              const column = position?.columns.get(mapping.arrayIdx);
              if (position && column !== undefined) {
                const address = XLSX.utils.encode_cell({ r: position.row, c: column });
                sourceCells[field] = position.unavailable.has(mapping.arrayIdx)
                  ? unavailableSourceCell(ctx.sourceId, sheet, address)
                  : numericSourceCell(ctx.sourceId, sheet, address, value === null || !Number.isFinite(value) ? null : value);
                sourceCells[field]!.observationDate = new Date(sourceTimestamp!).toISOString();
              }
            }
            batch.push({
              sourceCells,
              ...(ctx.profitSheet !== null && netProfitVal !== null && profitTs !== ts ? { derivations: { netProfit: {
                method: "unique-same-calendar-month-source-period-alignment; not-source-cell-infill",
                inputs: [sourceCells.netProfit!], originalSourceCell: null,
              } } } : ctx.profitSheet === null && netProfitVal !== null ? { derivations: { netProfit: {
                method: "market-cap-divided-by-pe; derived-not-source-cell-infill",
                inputs: [sourceCells.marketCap!, sourceCells.priceEarnings!], originalSourceCell: null,
              } } } : {}),
              companyId: mapping.companyId,
              date,
              totalReturnIndex: riValue,
              marketCap: isNaN(mvVal) ? null : mvVal,
              priceEarnings: peIsinSet.has(mapping.isin) ? (isNaN(peVal) ? null : peVal) : null,
              scope1Emissions: emissions?.s1 ?? null,
              scope2Emissions: emissions?.s2 ?? null,
              scope3Emissions: emissions?.s3 ?? null,
              netProfit: netProfitVal,
            });

            if (batch.length >= batchSize) {
              totalGenerated += batch.length;
              await onBatch(batch);
              batch = [];
            }
          }
        }

        if (rowCount % 20 === 0) {
          console.log(`[DataProcessor] RI row ${rowCount}/${totalRiRows - 1}, ${totalGenerated} records so far`);
        }
      }
    }
  }

  if (batch.length > 0) {
    totalGenerated += batch.length;
    await onBatch(batch);
  }
  if (await workbookSourceId(filePath) !== ctx.sourceId) throw new Error("Workbook source bytes changed during streaming; input must not be committed");

  console.log(`[DataProcessor] Total time series generated: ${totalGenerated} from ${rowCount} RI rows`);
  return totalGenerated;
}

import type { CvCompany, CvTimeSeries } from "../../shared/schema";
import { contentHash } from "../calculation/analysisManifest";

export interface DatasetChunk { entity: "companies" | "timeSeries"; rows: unknown[] }
export function packDataset(companies: CvCompany[], timeSeries: CvTimeSeries[]) {
  const cs = [...companies].sort((a, b) => a.id - b.id);
  const ids = new Set(cs.map(c => c.id)), isins = new Set(cs.map(c => c.isin));
  if (ids.size !== cs.length || isins.size !== cs.length) throw new Error("Duplicate company identity");
  const cells = new Set<string>();
  const ts = timeSeries.map(row => {
    if (!ids.has(row.companyId)) throw new Error("Orphan time-series company");
    const date = new Date(row.date).toISOString();
    const key = `${row.companyId}:${date}`;
    if (cells.has(key)) throw new Error("Duplicate company/date observation");
    cells.add(key);
    return { ...row, date };
  }).sort((a, b) => a.companyId - b.companyId || a.date.localeCompare(b.date));
  const chunks: DatasetChunk[] = [];
  for (const [entity, rows] of [["companies", cs], ["timeSeries", ts]] as const)
    for (let i = 0; i < rows.length; i += 2000) chunks.push({ entity, rows: rows.slice(i, i + 2000) });
  const id = contentHash({ version: "workbook-snapshot-1", chunks });
  return { id, chunks, companyCount: cs.length, observationCount: ts.length };
}
export function unpackDataset(id: string, chunks: DatasetChunk[]) {
  if (contentHash({ version: "workbook-snapshot-1", chunks }) !== id) throw new Error("Snapshot content hash mismatch");
  const companies = chunks.filter(c => c.entity === "companies").flatMap(c => c.rows) as CvCompany[];
  const timeSeries = chunks.filter(c => c.entity === "timeSeries").flatMap(c => c.rows)
    .map(row => ({ ...(row as CvTimeSeries), date: new Date((row as CvTimeSeries).date) }));
  return { companies, timeSeries };
}

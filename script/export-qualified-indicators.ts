import XLSX from "xlsx";
import { readQualifiedIndicatorArchive, exportQualifiedIndicators } from "../server/dataIngestion/adapters/qualifiedArchive";

const [source, output, flag] = process.argv.slice(2);
if (!source || !output || flag !== "--engineering-only")
  throw new Error("Usage: export-qualified-indicators.ts source.json output.xlsx --engineering-only; no approval or automated collection");
const input = readQualifiedIndicatorArchive(source);
XLSX.writeFile(exportQualifiedIndicators(input), output);
console.log(JSON.stringify({ sourceId: input.sourceId, series: input.source.series.length,
  observations: input.source.series.reduce((sum, series) => sum + series.points.length, 0),
  status: "source-supplied-not-approved", output }));

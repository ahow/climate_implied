import { economicBridgeCells, economicBridgeContracts, type EconomicBridgeDocument } from "@shared/economicBridgeSchema";
import { apiRequest } from "@/lib/queryClient";

/** Exact finite JSON comparison, not source authentication or an approval check. */
export function exactEconomicJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(exactEconomicJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key =>
    `${JSON.stringify(key)}:${exactEconomicJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error("Calculation contains a non-JSON or nonfinite value.");
}

/** These public routes accept no pins or overrides. Offer the server's bytes
 * only after complete readback equality with the currently consumed document. */
export async function readBoundEconomicExport(
  document: EconomicBridgeDocument,
  format: "json" | "xlsx",
  parse: (value: unknown) => EconomicBridgeDocument | null,
): Promise<Blob> {
  const route = economicBridgeContracts[document.key].route;
  const response = await apiRequest("GET", `${route}/export.${format}`);
  const contentType = response.headers.get("content-type") ?? "";
  if (format === "json") {
    if (!contentType.includes("application/json")) throw new Error("JSON export unavailable.");
    const raw = await response.text();
    const result = parse(JSON.parse(raw));
    if (!result || exactEconomicJson(result) !== exactEconomicJson(document))
      throw new Error("Export identity or result changed. Refresh the panel before downloading.");
    return new Blob([raw], { type: "application/json" });
  }
  if (!contentType.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
    throw new Error("XLSX export unavailable.");
  const bytes = await response.arrayBuffer();
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(bytes, { type: "array", cellFormula: true, cellHTML: false });
  if (workbook.SheetNames.length !== 1 || workbook.SheetNames[0] !== "Public calculation")
    throw new Error("Unexpected workbook sheets; export withheld.");
  const sheet = workbook.Sheets["Public calculation"];
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    if (!/^[A-Z]+[1-9]\d*$/.test(address) || cell.t !== "s" || "f" in cell || "F" in cell || "l" in cell)
      throw new Error("Workbook contains nonliteral content; export withheld.");
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  const expected = [["JSON pointer", "Literal JSON value"], ...economicBridgeCells(document).map(row => [row.pointer, row.jsonValue])];
  if (exactEconomicJson(rows) !== exactEconomicJson(expected))
    throw new Error("Workbook identity or result differs from this panel; export withheld. Refresh and retry.");
  return new Blob([bytes], { type: contentType });
}

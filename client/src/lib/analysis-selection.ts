export interface AnalysisSelection { workbook: string; indicators: string }
export const selectionKey = "climate-analysis-selection-v1";
export function parseSelection(value: unknown): AnalysisSelection {
  const x = value as AnalysisSelection;
  if (!x || typeof x !== "object" || !/^[a-f0-9]{64}$/.test(x.workbook) ||
    !/^[a-f0-9]{64}$/.test(x.indicators))
    throw new Error("Select both a valid workbook and indicator snapshot");
  return { workbook: x.workbook, indicators: x.indicators };
}
export function currentSelection(): AnalysisSelection | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(selectionKey);
  return value ? parseSelection(JSON.parse(value)) : null;
}
export function hasArchivedSelection() {
  return typeof window !== "undefined" && !!window.sessionStorage.getItem(selectionKey);
}
const companyPaths = new Set(["/api/cv/summary", "/api/cv/dimensions", "/api/cv/carbon-price",
  "/api/cv/pe-comparison", "/api/cv/sdg-growth", "/api/cv/decarb-bands",
  "/api/cv/decarb-terciles", "/api/cv/decarb-gap/summary", "/api/cv/decarb-gap/timeseries", "/api/cv/backtest"]);
const climatePaths = new Set(["/api/projection", "/api/projection/categories",
  "/api/projection/sensitivity", "/api/projection/historical-trend",
  "/api/projection/categories/historical-trend", "/api/indicators/historical",
  "/api/calculation-contract", "/api/emissions/candidate"]);
export function selectedRequest(url: string, selection: AnalysisSelection | null) {
  const parsed = new URL(url, "https://analysis.invalid");
  if (!selection) return { url, workbook: false, indicators: false };
  parseSelection(selection);
  if (parsed.pathname === "/api/projection/regions")
    throw new Error("Historical regional diagnostics unavailable: external intensity is not archived");
  const workbook = companyPaths.has(parsed.pathname);
  const indicators = workbook || climatePaths.has(parsed.pathname);
  if (workbook) {
    const explicit = parsed.searchParams.get("snapshotId");
    if (explicit && explicit !== selection.workbook)
      throw new Error("Requested workbook conflicts with active analysis selection");
    parsed.searchParams.set("snapshotId", selection.workbook);
    parsed.searchParams.delete("uploadId");
  }
  if (indicators) parsed.searchParams.set("indicatorSnapshotId", selection.indicators);
  return { url: indicators ? parsed.pathname + parsed.search : url, workbook, indicators };
}
export async function analysisFetch(url: string, init?: RequestInit) {
  const selection = currentSelection();
  const request = selectedRequest(url, selection);
  const response = await fetch(request.url, init);
  if (response.ok && request.workbook &&
    response.headers.get("X-Analysis-Snapshot") !== selection?.workbook)
    throw new Error("Response does not confirm the selected historical workbook");
  if (response.ok && request.indicators &&
    response.headers.get("X-Indicator-Data-State") !== "archived-approved-indicators")
    throw new Error("Response does not confirm archived indicator inputs");
  return response;
}

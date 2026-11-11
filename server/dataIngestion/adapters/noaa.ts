import { fetchWithTimeout, todayIso, type FetchedValue, type SourceAdapter } from "./types";
import { createHash } from "node:crypto";

const ANNMEAN_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt";
const GROWTH_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_gr_mlo.txt";
const SOURCE = "NOAA Global Monitoring Laboratory (Mauna Loa)";

function parseLatestRow(text: string, sourceUrl: string): { year: number; value: number; line: number; sourceId: string } | undefined {
  let latest: { year: number; value: number; line: number; sourceId: string } | undefined;
  const lines = text.split("\n"), sourceId = createHash("sha256").update(text).digest("hex");
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (!/^\d{4}$/.test(parts[0]) || !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(parts[1] ?? ""))
      throw new Error(`Unsupported NOAA numeric source ${sourceUrl} ${sourceId}:line${index + 1}:column2`);
    const year = Number(parts[0]), value = Number(parts[1]);
    if (!Number.isFinite(value) || value === -99.99 || value === -999.99 ||
        value === 0 && /[1-9]/.test(parts[1].split(/[eE]/)[0]))
      throw new Error(`Missing/unsupported NOAA numeric source ${sourceUrl} ${sourceId}:line${index + 1}:column2`);
    if (!latest || year > latest.year) latest = { year, value, line: index + 1, sourceId };
  }
  return latest;
}

export const noaaAdapter: SourceAdapter = {
  id: "noaa",
  keys: ["atmosphericCO2ppm", "co2GrowthRatePpm"],
  async fetch(): Promise<FetchedValue[]> {
    const out: FetchedValue[] = [];
    const asOfDate = todayIso();

    const annResp = await fetchWithTimeout(ANNMEAN_URL);
    if (annResp.ok) {
      const annLatest = parseLatestRow(await annResp.text(), ANNMEAN_URL);
      if (annLatest) {
        out.push({
          indicatorKey: "atmosphericCO2ppm",
          year: annLatest.year,
          value: annLatest.value,
          source: SOURCE,
          sourceUrl: ANNMEAN_URL,
          asOfDate,
          method: "api",
          rawContext: JSON.stringify({ sourceId: annLatest.sourceId, line: annLatest.line, column: 2, state: "observed", originalValue: annLatest.value, missingness: "Observed numeric source; no blank/token infill or presentation rounding" }),
        });
      }
    } else {
      console.warn(`[noaa] annmean fetch failed: ${annResp.status}`);
    }

    const grResp = await fetchWithTimeout(GROWTH_URL);
    if (grResp.ok) {
      const grLatest = parseLatestRow(await grResp.text(), GROWTH_URL);
      if (grLatest) {
        out.push({
          indicatorKey: "co2GrowthRatePpm",
          year: grLatest.year,
          value: grLatest.value,
          source: SOURCE,
          sourceUrl: GROWTH_URL,
          asOfDate,
          method: "api",
          rawContext: JSON.stringify({ sourceId: grLatest.sourceId, line: grLatest.line, column: 2, state: "observed", originalValue: grLatest.value, missingness: "Observed numeric source; no blank/token infill or presentation rounding" }),
        });
      }
    } else {
      console.warn(`[noaa] growth fetch failed: ${grResp.status}`);
    }

    return out;
  },
};

import { fetchWithTimeout, todayIso, type FetchedValue, type SourceAdapter } from "./types";

const ANNMEAN_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt";
const GROWTH_URL = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_gr_mlo.txt";
const SOURCE = "NOAA Global Monitoring Laboratory (Mauna Loa)";

function parseLatestRow(text: string): { year: number; value: number } | undefined {
  let latest: { year: number; value: number } | undefined;
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    const year = parseInt(parts[0], 10);
    const value = parseFloat(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
    if (!latest || year > latest.year) latest = { year, value };
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
      const annLatest = parseLatestRow(await annResp.text());
      if (annLatest) {
        out.push({
          indicatorKey: "atmosphericCO2ppm",
          year: annLatest.year,
          value: Math.round(annLatest.value * 10) / 10,
          source: SOURCE,
          sourceUrl: ANNMEAN_URL,
          asOfDate,
          method: "api",
        });
      }
    } else {
      console.warn(`[noaa] annmean fetch failed: ${annResp.status}`);
    }

    const grResp = await fetchWithTimeout(GROWTH_URL);
    if (grResp.ok) {
      const grLatest = parseLatestRow(await grResp.text());
      if (grLatest) {
        out.push({
          indicatorKey: "co2GrowthRatePpm",
          year: grLatest.year,
          value: Math.round(grLatest.value * 100) / 100,
          source: SOURCE,
          sourceUrl: GROWTH_URL,
          asOfDate,
          method: "api",
        });
      }
    } else {
      console.warn(`[noaa] growth fetch failed: ${grResp.status}`);
    }

    return out;
  },
};

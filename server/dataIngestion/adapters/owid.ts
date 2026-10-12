import { fetchWithTimeout, todayIso, type FetchedValue, type SourceAdapter } from "./types";

const OWID_URL = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.json";
const SOURCE = "Global Carbon Project via Our World in Data";

interface OwidYearRecord {
  year: number;
  co2?: number; // annual CO2 emissions (Mt), excluding land use
}

interface OwidEntity {
  data?: OwidYearRecord[];
}

export const owidAdapter: SourceAdapter = {
  id: "owid",
  keys: ["fossilCO2GtPerYear"],
  async fetch(): Promise<FetchedValue[]> {
    const resp = await fetchWithTimeout(OWID_URL, {}, 20000);
    if (!resp.ok) {
      console.warn(`[owid] fetch failed: ${resp.status}`);
      return [];
    }

    const json = (await resp.json()) as Record<string, OwidEntity>;
    const world = json["World"];
    if (!world?.data) return [];

    let latest: OwidYearRecord | undefined;
    for (const rec of world.data) {
      if (typeof rec.co2 === "number" && Number.isFinite(rec.co2)) {
        if (!latest || rec.year > latest.year) latest = rec;
      }
    }
    if (!latest || latest.co2 == null) return [];

    return [
      {
        indicatorKey: "fossilCO2GtPerYear",
        year: latest.year,
        value: Math.round((latest.co2 / 1000) * 10) / 10, // Mt -> Gt
        source: SOURCE,
        sourceUrl: "https://github.com/owid/co2-data",
        asOfDate: todayIso(),
        method: "api",
      },
    ];
  },
};

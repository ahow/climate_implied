import { fetchWithTimeout, todayIso, type FetchedValue, type SourceAdapter } from "./types";

const WB_URL =
  "https://api.worldbank.org/v2/country/WLD/indicator/NY.GDP.MKTP.CD?format=json&per_page=10&mrnev=1";
const SOURCE = "World Bank (World GDP, current US$)";

interface WbRecord {
  date: string;
  value: number | null;
}

export const worldBankAdapter: SourceAdapter = {
  id: "worldbank",
  keys: ["gdpTrillionUSD"],
  async fetch(): Promise<FetchedValue[]> {
    const resp = await fetchWithTimeout(WB_URL);
    if (!resp.ok) {
      console.warn(`[worldbank] fetch failed: ${resp.status}`);
      return [];
    }

    const json = (await resp.json()) as [unknown, WbRecord[] | null];
    const records = Array.isArray(json) ? json[1] : null;
    if (!records || records.length === 0) return [];

    let latest: WbRecord | undefined;
    for (const rec of records) {
      if (rec.value != null && Number.isFinite(rec.value)) {
        const year = parseInt(rec.date, 10);
        if (!latest || year > parseInt(latest.date, 10)) latest = rec;
      }
    }
    if (!latest || latest.value == null) return [];

    return [
      {
        indicatorKey: "gdpTrillionUSD",
        year: parseInt(latest.date, 10),
        value: Math.round((latest.value / 1e12) * 10) / 10,
        source: SOURCE,
        sourceUrl:
          "https://data.worldbank.org/indicator/NY.GDP.MKTP.CD?locations=1W",
        asOfDate: todayIso(),
        method: "api",
      },
    ];
  },
};

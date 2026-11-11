import { fetchWithTimeout, todayIso, type FetchedValue, type SourceAdapter } from "./types";
import { createHash } from "node:crypto";

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

    const bytes = await resp.text();
    const sourceId = createHash("sha256").update(bytes).digest("hex");
    const json = JSON.parse(bytes) as Record<string, OwidEntity>;
    const world = json["World"];
    if (!world?.data) return [];

    let latest: OwidYearRecord | undefined;
    let latestIndex = -1;
    const sourceCells = world.data.map((rec, index) => {
      if (!Number.isInteger(rec.year))
        throw new Error(`Unsupported OWID source observation ${sourceId}:/World/data/${index}`);
      if (typeof rec.co2 === "number" && Number.isFinite(rec.co2)) {
        if (!latest || rec.year > latest.year) { latest = rec; latestIndex = index; }
      }
      const observed = typeof rec.co2 === "number" && Number.isFinite(rec.co2);
      return { year: rec.year, locator: `/World/data/${index}/co2`, state: observed ? "observed" : "unavailable",
        originalValue: observed ? rec.co2 : null, reason: observed ? null :
          rec.co2 === undefined ? "not-returned" : rec.co2 === null ? "provider-null" : "unsupported-token-refused" };
    });
    if (!latest || latest.co2 == null) return [];
    const converted = latest.co2 / 1000;
    if (latest.co2 !== 0 && converted === 0)
      throw new Error(`OWID unit conversion underflow ${sourceId}:/World/data/${latestIndex}/co2`);

    return [
      {
        indicatorKey: "fossilCO2GtPerYear",
        year: latest.year,
        value: converted, // Mt -> Gt; presentation rounding must not create an observed zero.
        source: SOURCE,
        sourceUrl: "https://github.com/owid/co2-data",
        asOfDate: todayIso(),
        method: "api",
        rawContext: JSON.stringify({ sourceId, locator: `/World/data/${latestIndex}/co2`,
          state: "observed", originalValue: latest.co2, originalUnit: "Mt CO2/year",
          transformation: "divide by1000; no rounding or missing-value substitution", sourceCells }),
      },
    ];
  },
};

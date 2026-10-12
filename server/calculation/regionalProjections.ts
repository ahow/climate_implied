import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getCurrentIndicators,
  getTemperatureStats,
  type IndicatorData,
  type ForwardProjection,
} from "./forwardProjection";

export interface RegionalProjection {
  region: string;
  regionName: string;
  temperatureRise: number;
  reductionRate: number;
  netZeroYear: number | null;
  carbonIntensity: number;
  carbonIntensitySource: "owid" | "static";
}

interface RegionConfig {
  name: string;
  owidEntity: string;
  carbonIntensity: number;
}

// Static fallback carbon intensities (kg CO2 per $ GDP). Used when the live
// OWID fetch is unavailable so the endpoint never breaks.
const REGIONAL_CARBON_INTENSITIES: Record<string, RegionConfig> = {
  eu: { name: "European Union", owidEntity: "European Union (27)", carbonIntensity: 0.18 },
  us: { name: "United States", owidEntity: "United States", carbonIntensity: 0.28 },
  china: { name: "China", owidEntity: "China", carbonIntensity: 0.58 },
  india: { name: "India", owidEntity: "India", carbonIntensity: 0.72 },
};

const OWID_CO2_URL =
  "https://nyc3.digitaloceanspaces.com/owid-public/data/co2/owid-co2-data.json";
const OWID_FETCH_TIMEOUT_MS = 8000;
const OWID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type IntensityResult = { value: number; source: "owid" | "static" };

let owidCache: { intensities: Record<string, IntensityResult>; fetchedAt: number } | null = null;

/**
 * Resolves per-region carbon intensity (kg CO2 / $ GDP), preferring live OWID
 * `co2_per_gdp` for the latest available year. Any failure (network, parsing,
 * missing data) falls back to the static map so the caller never breaks.
 */
async function getRegionalCarbonIntensities(): Promise<Record<string, IntensityResult>> {
  if (owidCache && Date.now() - owidCache.fetchedAt < OWID_CACHE_TTL_MS) {
    return owidCache.intensities;
  }

  const staticResult: Record<string, IntensityResult> = {};
  for (const [region, config] of Object.entries(REGIONAL_CARBON_INTENSITIES)) {
    staticResult[region] = { value: config.carbonIntensity, source: "static" };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OWID_FETCH_TIMEOUT_MS);
    const res = await fetch(OWID_CO2_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`OWID fetch failed: ${res.status}`);

    const data = (await res.json()) as Record<
      string,
      { data?: Array<{ year: number; co2_per_gdp?: number }> }
    >;

    const result: Record<string, IntensityResult> = {};
    for (const [region, config] of Object.entries(REGIONAL_CARBON_INTENSITIES)) {
      const entity = data[config.owidEntity];
      let latest: number | null = null;
      let latestYear = -Infinity;
      if (entity?.data) {
        for (const row of entity.data) {
          if (
            typeof row.co2_per_gdp === "number" &&
            Number.isFinite(row.co2_per_gdp) &&
            row.year > latestYear
          ) {
            latest = row.co2_per_gdp;
            latestYear = row.year;
          }
        }
      }
      result[region] =
        latest !== null && latest > 0
          ? { value: latest, source: "owid" }
          : staticResult[region];
    }

    owidCache = { intensities: result, fetchedAt: Date.now() };
    return result;
  } catch (err) {
    console.warn(
      "Regional OWID carbon-intensity fetch failed; using static fallback:",
      err instanceof Error ? err.message : err
    );
    owidCache = { intensities: staticResult, fetchedAt: Date.now() };
    return staticResult;
  }
}

function findNetZeroYear(trajectory: ForwardProjection[]): number | null {
  for (const point of trajectory) {
    if (point.p50 <= 5.0) return point.year;
  }
  if (trajectory.length > 0) {
    const finalPoint = trajectory[trajectory.length - 1];
    const firstPoint = trajectory[0];
    const yearsElapsed = finalPoint.year - firstPoint.year;
    const totalReduction = firstPoint.p50 - finalPoint.p50;
    const avgAnnualReduction = totalReduction / yearsElapsed;
    if (avgAnnualReduction > 0 && finalPoint.p50 > 5.0) {
      const yearsToNetZero = (finalPoint.p50 - 5.0) / avgAnnualReduction;
      return Math.round(finalPoint.year + yearsToNetZero);
    }
  }
  return null;
}

export async function calculateRegionalProjections(): Promise<RegionalProjection[]> {
  const baseIndicators = getCurrentIndicators();
  const intensities = await getRegionalCarbonIntensities();

  return Object.entries(REGIONAL_CARBON_INTENSITIES).map(([region, config]) => {
    const intensity = intensities[region] ?? { value: config.carbonIntensity, source: "static" as const };

    const indicators: IndicatorData = {
      ...baseIndicators,
      carbonIntensity: intensity.value,
    };

    const trajectory = calculateEmissionsTrajectory(indicators, 2024, 2100, 1000);
    const tempDist = calculateTemperatureDistribution(trajectory, 1000);
    const tempStats = getTemperatureStats(tempDist, trajectory);

    const emissions2024 = trajectory[0]?.emissions || 60;
    const emissions2034 = trajectory[10]?.emissions || 55;
    const reductionRate = -((Math.pow(emissions2034 / emissions2024, 1 / 10) - 1) * 100);

    return {
      region,
      regionName: config.name,
      temperatureRise: tempStats.median,
      reductionRate,
      netZeroYear: findNetZeroYear(trajectory),
      carbonIntensity: intensity.value,
      carbonIntensitySource: intensity.source,
    };
  });
}

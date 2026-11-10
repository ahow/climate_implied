import {
  calculateEmissionsTrajectory,
  calculateTemperatureDistribution,
  getCurrentIndicators,
  getTemperatureStats,
  type IndicatorData,
  type ForwardProjection,
} from "./forwardProjection";
import { historicalTrajectoryMetrics } from "./historicalMetrics";
import type { ThresholdDiagnostic } from "../../shared/thresholdDiagnostic";
import { selectedTrajectoryThresholdContext, type ThresholdContext } from "./thresholdDiagnostic";
import { calculationKey } from "./identity";
import { getAllHistoricalIndicators } from "./historicalIndicators";

export interface RegionalProjection {
  region: string;
  regionName: string;
  temperatureRise: number;
  reductionRate: number;
  netZeroYear: number | null;
  thresholdDiagnostic: ThresholdDiagnostic;
  carbonIntensity: number;
  carbonIntensitySource: "owid" | "static";
  carbonIntensityBasis: string;
  claim: string;
  milestoneDefinition: string;
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

export type IntensityResult = { value: number; source: "owid" | "static" };

let owidCache: { intensities: Record<string, IntensityResult>; fetchedAt: number } | null = null;

/**
 * Resolves per-region carbon intensity (kg CO2 / $ GDP), preferring live OWID
 * `co2_per_gdp` for the latest available year. Any failure (network, parsing,
 * missing data) falls back to the static map so the caller never breaks.
 */
export async function getRegionalCarbonIntensities(): Promise<Record<string, IntensityResult>> {
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

export async function calculateRegionalProjections(): Promise<RegionalProjection[]> {
  const baseIndicators = getCurrentIndicators();
  const intensities = await getRegionalCarbonIntensities();
  const inputAvailable = getAllHistoricalIndicators().some(row => row.year === 2024);
  return calculateRegionalFromInputs(baseIndicators, intensities, inputAvailable ? undefined :
    region => selectedTrajectoryThresholdContext([], calculationKey("selected-regional-inputs", { baseIndicators, intensities }),
      calculationKey("selected-regional-trajectory", baseIndicators, { region, runs: 1000 })));
}

/** Pure replay boundary: captured inputs never fall through to live data. */
export function calculateRegionalFromInputs(baseIndicators: IndicatorData,
  intensities: Record<string, IntensityResult>,
  thresholdContextForRegion?: (region: string) => ThresholdContext | undefined): RegionalProjection[] {
  for (const region of Object.keys(REGIONAL_CARBON_INTENSITIES)) {
    const value = intensities[region];
    if (!value || !Number.isFinite(value.value) || value.value <= 0
      || !["owid", "static"].includes(value.source))
      throw new Error(`Missing or invalid captured regional intensity: ${region}`);
  }
  return Object.entries(REGIONAL_CARBON_INTENSITIES).map(([region, config]) => {
    const intensity = intensities[region];

    const indicators: IndicatorData = {
      ...baseIndicators,
      carbonIntensity: intensity.value,
    };

    const trajectory = calculateEmissionsTrajectory(indicators, 2024, 2100, 1000);
    const tempDist = calculateTemperatureDistribution(trajectory, 1000);
    const tempStats = getTemperatureStats(tempDist, trajectory);

    const selectedContext = thresholdContextForRegion?.(region) ?? selectedTrajectoryThresholdContext(trajectory,
      calculationKey("selected-regional-inputs", { baseIndicators, intensities }),
      calculationKey("selected-regional-trajectory", indicators, { region, runs: 1000 }));
    const { reductionRate, netZeroYear, thresholdDiagnostic } = historicalTrajectoryMetrics(trajectory, selectedContext);

    return {
      region,
      regionName: config.name,
      temperatureRise: tempStats.median,
      reductionRate,
      netZeroYear,
      thresholdDiagnostic,
      carbonIntensity: intensity.value,
      carbonIntensitySource: intensity.source,
      carbonIntensityBasis: intensity.source === "owid"
        ? "kg CO2 per international dollar GDP (PPP); OWID"
        : "kg CO2 per nominal dollar GDP; legacy static assumption, not comparable to PPP",
      claim: "Legacy global intensity counterfactual; not a regional temperature forecast",
      milestoneDefinition: "Legacy 5 Gt milestone; not net zero; null means not reached by 2100",
    };
  });
}

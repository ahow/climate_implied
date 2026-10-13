import { computeEmpiricalCarbonIntensityDeclineRate, getAllHistoricalIndicators } from "./historicalIndicators";
import { SeededRandom, randomNormalFrom } from "./random";
import { LEGACY_CLIMATE } from "../../shared/calculationContract";

// Projection baseline year. The model's "current" indicators are the values for
// this year (NOT the last historical row). Approved overrides for this year flow
// into the projection; everything else updates history/nowcast only.
const BASELINE_YEAR = 2024;

export interface IndicatorData {
  renewableCapacityGW: number;
  renewableGrowthRate: number;
  renewableAcceleration: number;
  evSalesShare: number;
  evGrowthRate: number;
  policyCoveragePercent: number;
  policyImplementationRate: number;
  netZeroTargetsCoverage: number;
  globalGDP: number;
  carbonIntensity: number;
  carbonIntensityDeclineRate: number;
  sbtiCompaniesPercent: number;
  corporateImplementationRate: number;
  cleanEnergyInvestmentTrn: number;
  fossilFuelInvestmentTrn: number;
  greenBondIssuanceBln: number;
  fossilCO2GtPerYear: number;
  atmosphericCO2ppm: number;
  co2GrowthRatePpm: number;
}

export interface ForwardProjection {
  year: number;
  emissions: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  cumulativeEmissions: number;
}

export interface TemperatureProjection {
  temperature: number;
  probability: number;
  cumulativeProbability: number;
}

function createRNG(seed: number): SeededRandom {
  return new SeededRandom(seed);
}

export const SECTOR_SHARES = {
  power: 0.269,
  transport: 0.144,
  industry: 0.241,
  buildings: 0.096,
  agriculture: 0.171,
  other: 0.080,
};

// --- Renewable displacement (recalibrated) ---
// Empirical marginal avoided-emissions rate per GW of renewable capacity
// (~0.00075 GtCO2/GW, IEA-grade: typical capacity factor x grid emission factor).
// Applied with diminishing returns so the marginal rate is empirical at low
// buildout but aggregate displacement asymptotes to the fossil-power baseline
// (you cannot displace fossil generation that no longer exists), avoiding an
// unrealistic instantaneous zeroing of power-sector emissions.
const RENEWABLE_DISPLACEMENT_FACTOR = 0.00075;

// --- EV stock-turnover (recalibrated) ---
// Transport emissions track the on-road FLEET (stock), not new-car SALES (flow).
// We convert the projected sales-share path into a fleet share via a turnover
// EMA (~15-year average vehicle life), then displace the addressable
// (passenger-vehicle) portion of transport, scaled by the well-to-wheel benefit
// of EVs over ICE given a partially-fossil grid.
const INITIAL_EV_FLEET_SHARE_PCT = 4.0;          // IEA: EV stock ~4% of global car parc, 2024
const EV_FLEET_TURNOVER_RATE = 1 / 15;           // ~15-year average vehicle lifetime
const EV_ADDRESSABLE_TRANSPORT_FRACTION = 0.50;  // passenger-vehicle share of transport emissions
const EV_GRID_EFFECTIVENESS = 0.65;              // well-to-wheel emission reduction vs ICE

export function getCurrentIndicatorsFromHistorical(latest: {
  renewableCapacityGW: number;
  renewableGrowthRate: number;
  evSalesSharePct: number;
  evGrowthRate: number;
  policyCoveragePct: number;
  policyImplementationRate: number;
  gdpTrillionUSD: number;
  carbonIntensityKgPerGDP: number;
  corporateTargetsPct: number;
  corporateImplementationRate: number;
  cleanEnergyInvestmentTrn?: number;
  fossilFuelInvestmentTrn?: number;
  greenBondIssuanceBln?: number;
  fossilCO2GtPerYear?: number;
  atmosphericCO2ppm?: number;
  co2GrowthRatePpm?: number;
}): IndicatorData {
  return {
    renewableCapacityGW: latest.renewableCapacityGW,
    renewableGrowthRate: latest.renewableGrowthRate * 100,
    renewableAcceleration: 1.0,
    evSalesShare: latest.evSalesSharePct,
    evGrowthRate: latest.evGrowthRate * 100,
    policyCoveragePercent: latest.policyCoveragePct,
    policyImplementationRate: latest.policyImplementationRate,
    netZeroTargetsCoverage: latest.policyCoveragePct * 0.9,
    globalGDP: latest.gdpTrillionUSD,
    carbonIntensity: latest.carbonIntensityKgPerGDP,
    carbonIntensityDeclineRate: computeEmpiricalCarbonIntensityDeclineRate(),
    sbtiCompaniesPercent: latest.corporateTargetsPct,
    corporateImplementationRate: latest.corporateImplementationRate,
    cleanEnergyInvestmentTrn: latest.cleanEnergyInvestmentTrn ?? 2.0,
    fossilFuelInvestmentTrn: latest.fossilFuelInvestmentTrn ?? 1.0,
    greenBondIssuanceBln: latest.greenBondIssuanceBln ?? 700,
    fossilCO2GtPerYear: latest.fossilCO2GtPerYear ?? 37.6,
    atmosphericCO2ppm: latest.atmosphericCO2ppm ?? 424.6,
    co2GrowthRatePpm: latest.co2GrowthRatePpm ?? 3.53,
  };
}

// Curated fallback for the baseline year, used only if the historical series is
// somehow missing the baseline row. These values equal the BASELINE_YEAR row of
// HISTORICAL_INDICATORS, so the resolver path and this fallback are identical
// when no overrides are approved.
const BASELINE_FALLBACK = {
  renewableCapacityGW: 4443,
  renewableGrowthRate: 0.151,
  evSalesSharePct: 20.5,
  evGrowthRate: 0.25,
  policyCoveragePct: 87,
  policyImplementationRate: 0.67,
  gdpTrillionUSD: 108.5,
  carbonIntensityKgPerGDP: 0.36,
  corporateTargetsPct: 38,
  corporateImplementationRate: 0.82,
  cleanEnergyInvestmentTrn: 2.0,
  fossilFuelInvestmentTrn: 1.0,
  greenBondIssuanceBln: 700,
  fossilCO2GtPerYear: 37.6,
  atmosphericCO2ppm: 424.6,
  co2GrowthRatePpm: 3.53,
};

export function getCurrentIndicators(): IndicatorData {
  const baseline =
    getAllHistoricalIndicators().find((r) => r.year === BASELINE_YEAR) ??
    BASELINE_FALLBACK;
  return getCurrentIndicatorsFromHistorical(baseline);
}

function projectIndicator(
  currentValue: number,
  growthRate: number,
  years: number,
  acceleration: number = 0,
  saturationLimit?: number
): number {
  let value = currentValue;
  for (let year = 0; year < years; year++) {
    const effectiveGrowth = growthRate * (1 + acceleration * year / 10);
    const dampingFactor = saturationLimit ? (1 - value / saturationLimit) : 1;
    value = value * (1 + effectiveGrowth / 100 * dampingFactor);
    if (saturationLimit) {
      value = Math.min(value, saturationLimit);
    }
  }
  return value;
}

export function calculateEmissionsTrajectory(
  indicators: IndicatorData,
  startYear: number = 2024,
  endYear: number = 2100,
  runs: number = 10000,
  seed: number = startYear * 12345
): ForwardProjection[] {
  const required: (keyof IndicatorData)[] = [
    "renewableCapacityGW", "renewableGrowthRate", "renewableAcceleration", "evSalesShare",
    "evGrowthRate", "policyCoveragePercent", "policyImplementationRate", "netZeroTargetsCoverage",
    "globalGDP", "carbonIntensity", "carbonIntensityDeclineRate", "sbtiCompaniesPercent",
    "corporateImplementationRate", "cleanEnergyInvestmentTrn", "fossilFuelInvestmentTrn",
    "greenBondIssuanceBln", "fossilCO2GtPerYear", "atmosphericCO2ppm", "co2GrowthRatePpm",
  ];
  for (const key of required) if (!Number.isFinite(indicators[key])) throw new Error(`Missing or non-finite indicator: ${key}`);
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear) || endYear < startYear ||
      !Number.isInteger(runs) || runs < 1) throw new Error("Invalid calculation horizon or run count");
  const rng = createRNG(seed);

  const years = endYear - startYear + 1;
  const projections: ForwardProjection[] = [];
  const carbonIntensityScaling = indicators.carbonIntensity / LEGACY_CLIMATE.intensityNormalizer;
  const baselineEmissions = LEGACY_CLIMATE.baselineEmissionsGt * carbonIntensityScaling;

  const baselineSectors = {
    power: baselineEmissions * SECTOR_SHARES.power,
    transport: baselineEmissions * SECTOR_SHARES.transport,
    industry: baselineEmissions * SECTOR_SHARES.industry,
    buildings: baselineEmissions * SECTOR_SHARES.buildings,
    agriculture: baselineEmissions * SECTOR_SHARES.agriculture,
    other: baselineEmissions * SECTOR_SHARES.other,
  };

  const cleanToFossilRatio = indicators.cleanEnergyInvestmentTrn /
    Math.max(0.1, indicators.fossilFuelInvestmentTrn);
  const greenBondMomentum = Math.min(indicators.greenBondIssuanceBln / 1000, 1.0);

  const emissionsValidationFactor = indicators.fossilCO2GtPerYear / 37.0;
  const co2AccelerationSignal = indicators.co2GrowthRatePpm > 2.5 ? 1.0 : 0.0;

  const allSimulations: number[][] = [];

  for (let run = 0; run < runs; run++) {
    const simulation: number[] = [];
    const renewableGrowthUncertainty = randomNormalFrom(rng, 1.0, 0.15);
    const evAdoptionUncertainty = randomNormalFrom(rng, 1.0, 0.20);
    const policyEffectivenessUncertainty = randomNormalFrom(rng, indicators.policyImplementationRate, 0.10);
    const carbonIntensityDeclineUncertainty = randomNormalFrom(rng, 1.0, 0.12);
    const economicGrowthUncertainty = randomNormalFrom(rng, 2.5, 0.8);
    const financialFlowsUncertainty = randomNormalFrom(rng, 1.0, 0.18);
    const emissionsOutcomeUncertainty = randomNormalFrom(rng, 1.0, 0.10);

    let evFleetShare = INITIAL_EV_FLEET_SHARE_PCT;

    for (let yearOffset = 0; yearOffset < years; yearOffset++) {
      let powerEmissions = baselineSectors.power;
      let transportEmissions = baselineSectors.transport;
      let industryEmissions = baselineSectors.industry;
      let buildingsEmissions = baselineSectors.buildings;
      let agricultureEmissions = baselineSectors.agriculture;
      let otherEmissions = baselineSectors.other;

      const renewableCapacity = projectIndicator(
        indicators.renewableCapacityGW,
        indicators.renewableGrowthRate * renewableGrowthUncertainty,
        yearOffset,
        indicators.renewableAcceleration,
        50000
      );
      const renewableBuildout = Math.max(0, renewableCapacity - indicators.renewableCapacityGW);
      const fossilPowerRemaining = Math.exp(
        -renewableBuildout * RENEWABLE_DISPLACEMENT_FACTOR / Math.max(0.001, baselineSectors.power)
      );
      powerEmissions = baselineSectors.power * fossilPowerRemaining;

      const evShare = Math.min(
        projectIndicator(indicators.evSalesShare, indicators.evGrowthRate * evAdoptionUncertainty, yearOffset, -0.5, 100),
        100
      );
      // Sales share (flow) -> fleet share (stock) via turnover EMA, then displace
      // the addressable passenger-vehicle portion of transport relative to today's fleet.
      // Displacement uses the fleet share carried into this year (zero at the base
      // year); the EMA then advances the fleet with this year's sales mix.
      const evFleetDelta = Math.max(0, evFleetShare - INITIAL_EV_FLEET_SHARE_PCT) / 100;
      const evDisplacement = baselineSectors.transport *
        EV_ADDRESSABLE_TRANSPORT_FRACTION * evFleetDelta * EV_GRID_EFFECTIVENESS;
      transportEmissions = Math.max(0, baselineSectors.transport - evDisplacement);
      evFleetShare = evFleetShare * (1 - EV_FLEET_TURNOVER_RATE) + evShare * EV_FLEET_TURNOVER_RATE;

      industryEmissions = baselineSectors.industry * Math.pow(0.995, yearOffset);
      buildingsEmissions = baselineSectors.buildings * Math.pow(0.996, yearOffset);
      agricultureEmissions = baselineSectors.agriculture * Math.pow(0.998, yearOffset);

      const corporateReductionRate = indicators.sbtiCompaniesPercent / 100 *
        indicators.corporateImplementationRate * (yearOffset / 10) * 0.10;

      powerEmissions = Math.max(0, powerEmissions * (1 - corporateReductionRate));
      transportEmissions = Math.max(0, transportEmissions * (1 - corporateReductionRate));
      industryEmissions = Math.max(0, industryEmissions * (1 - corporateReductionRate));
      buildingsEmissions = Math.max(0, buildingsEmissions * (1 - corporateReductionRate));
      agricultureEmissions = Math.max(0, agricultureEmissions * (1 - corporateReductionRate));
      otherEmissions = Math.max(0, otherEmissions * (1 - corporateReductionRate));

      const policyImpactTotal = indicators.policyCoveragePercent / 100 *
        policyEffectivenessUncertainty * (yearOffset / 10) * 0.10;

      powerEmissions = Math.max(0, powerEmissions - policyImpactTotal * SECTOR_SHARES.power);
      transportEmissions = Math.max(0, transportEmissions - policyImpactTotal * SECTOR_SHARES.transport);
      industryEmissions = Math.max(0, industryEmissions - policyImpactTotal * SECTOR_SHARES.industry);
      buildingsEmissions = Math.max(0, buildingsEmissions - policyImpactTotal * SECTOR_SHARES.buildings);
      agricultureEmissions = Math.max(0, agricultureEmissions - policyImpactTotal * SECTOR_SHARES.agriculture);
      otherEmissions = Math.max(0, otherEmissions - policyImpactTotal * SECTOR_SHARES.other);

      const financialFlowImpact = (
        (cleanToFossilRatio - 1.0) * 0.02 +
        greenBondMomentum * 0.015
      ) * financialFlowsUncertainty * (yearOffset / 10);

      const financialReductionFactor = Math.max(0, 1 - financialFlowImpact);
      powerEmissions *= financialReductionFactor;
      industryEmissions *= financialReductionFactor;
      otherEmissions *= financialReductionFactor;

      const gdpGrowth = economicGrowthUncertainty / 100;
      const carbonIntensityDecline = indicators.carbonIntensityDeclineRate / 100 * carbonIntensityDeclineUncertainty;
      const economicGrowthFactor = 1 + (gdpGrowth * yearOffset / years);
      const intensityDeclineFactor = 1 - (carbonIntensityDecline * yearOffset / years);
      const netEconomicFactor = economicGrowthFactor * intensityDeclineFactor;

      powerEmissions *= netEconomicFactor;
      transportEmissions *= netEconomicFactor;
      industryEmissions *= netEconomicFactor;
      buildingsEmissions *= netEconomicFactor;
      agricultureEmissions *= netEconomicFactor;
      otherEmissions *= netEconomicFactor;

      let yearEmissions = Math.max(0,
        powerEmissions + transportEmissions + industryEmissions +
        buildingsEmissions + agricultureEmissions + otherEmissions
      );

      const emissionsAnchor = emissionsValidationFactor * emissionsOutcomeUncertainty;
      const anchorWeight = Math.max(0, 0.3 - yearOffset * 0.005);
      yearEmissions = yearEmissions * (1 - anchorWeight) + yearEmissions * emissionsAnchor * anchorWeight;

      if (co2AccelerationSignal > 0 && yearOffset < 10) {
        yearEmissions *= (1 + co2AccelerationSignal * 0.005 * Math.max(0, 1 - yearOffset / 10));
      }

      if (!Number.isFinite(yearEmissions)) throw new Error("Non-finite emissions outcome");
      simulation.push(yearEmissions);
    }

    allSimulations.push(simulation);
  }

  for (let yearOffset = 0; yearOffset < years; yearOffset++) {
    const yearEmissions = allSimulations.map(sim => sim[yearOffset] || 0).sort((a, b) => a - b);
    const cumulatives = allSimulations.map(sim =>
      sim.slice(0, yearOffset + 1).reduce((sum, val) => sum + val, 0)
    ).sort((a, b) => a - b);

    projections.push({
      year: startYear + yearOffset,
      emissions: yearEmissions[Math.floor(yearEmissions.length / 2)] || 0,
      p10: yearEmissions[Math.floor(yearEmissions.length * 0.1)] || 0,
      p25: yearEmissions[Math.floor(yearEmissions.length * 0.25)] || 0,
      p50: yearEmissions[Math.floor(yearEmissions.length * 0.5)] || 0,
      p75: yearEmissions[Math.floor(yearEmissions.length * 0.75)] || 0,
      p90: yearEmissions[Math.floor(yearEmissions.length * 0.9)] || 0,
      cumulativeEmissions: cumulatives[Math.floor(cumulatives.length / 2)] || 0,
    });
  }

  return projections;
}

export function calculateTemperatureDistribution(
  trajectory: ForwardProjection[],
  runs: number = 10000,
  climateSensitivity: number = 3.0
): TemperatureProjection[] {
  const rng = createRNG(42 * 12345);
  const temperatureOutcomes: number[] = [];
  const finalProjection = trajectory[trajectory.length - 1];
  if (!finalProjection) return [];

  const tcreBase = LEGACY_CLIMATE.tcreCPerGt;
  const baselineWarming = LEGACY_CLIMATE.warmingOffsetC;

  for (let i = 0; i < runs; i++) {
    const ecs = randomNormalFrom(rng, climateSensitivity, 0.5);
    const tcreFactor = ecs / 3.0;
    const cumulativeUncertainty = randomNormalFrom(rng, 1.0, 0.15);
    const cumulative = finalProjection.cumulativeEmissions * cumulativeUncertainty;
    const temperature = baselineWarming + (cumulative * tcreBase * tcreFactor);
    temperatureOutcomes.push(Math.max(1.0, Math.min(5.0, temperature)));
  }

  temperatureOutcomes.sort((a, b) => a - b);

  const pdf: TemperatureProjection[] = [];
  const bandwidth = 0.1;

  for (let temp = 1.0; temp <= 5.0; temp += 0.05) {
    let density = 0;
    for (const outcome of temperatureOutcomes) {
      const distance = (temp - outcome) / bandwidth;
      density += Math.exp(-0.5 * distance * distance);
    }
    density /= (temperatureOutcomes.length * bandwidth * Math.sqrt(2 * Math.PI));

    const cumulativeProb = temperatureOutcomes.filter(t => t <= temp).length / temperatureOutcomes.length;

    pdf.push({
      temperature: parseFloat(temp.toFixed(2)),
      probability: parseFloat(density.toFixed(6)),
      cumulativeProbability: parseFloat(cumulativeProb.toFixed(4)),
    });
  }

  return pdf;
}

export function getTemperatureStats(pdf: TemperatureProjection[], trajectory: ForwardProjection[]) {
  const finalProjection = trajectory[trajectory.length - 1];
  if (!finalProjection) return { median: 0, mean: 0, p10: 0, p90: 0 };

  const tcreBase = LEGACY_CLIMATE.tcreCPerGt;
  const baselineWarming = LEGACY_CLIMATE.warmingOffsetC;
  const rng = createRNG(99 * 12345);
  const runs = 10000;
  const temps: number[] = [];

  for (let i = 0; i < runs; i++) {
    const ecs = randomNormalFrom(rng, 3.0, 0.5);
    const tcreFactor = ecs / 3.0;
    const cu = randomNormalFrom(rng, 1.0, 0.15);
    const temperature = baselineWarming + (finalProjection.cumulativeEmissions * cu * tcreBase * tcreFactor);
    temps.push(Math.max(1.0, Math.min(5.0, temperature)));
  }

  temps.sort((a, b) => a - b);

  return {
    median: temps[Math.floor(temps.length * 0.5)] || 0,
    mean: temps.reduce((s, v) => s + v, 0) / temps.length,
    p10: temps[Math.floor(temps.length * 0.1)] || 0,
    p90: temps[Math.floor(temps.length * 0.9)] || 0,
  };
}

export interface SensitivityResult {
  indicator: string;
  label: string;
  category: string;
  baselineTemperature: number;
  p10Temperature: number;
  p90Temperature: number;
  p10Value: number;
  p90Value: number;
  temperatureRange: number;
  direction: 'positive' | 'negative';
}

export function calculateSensitivityAnalysis(
  baseIndicators: IndicatorData,
  startYear: number = 2024
): SensitivityResult[] {
  const baseTrajectory = calculateEmissionsTrajectory(baseIndicators, startYear, 2100, 2000);
  const baseTempDist = calculateTemperatureDistribution(baseTrajectory, 2000);
  const baseTempStats = getTemperatureStats(baseTempDist, baseTrajectory);
  const baseTemp = baseTempStats.median;

  const indicatorConfigs: Array<{
    key: keyof IndicatorData;
    label: string;
    category: string;
    p10: number;
    p90: number;
    direction: 'positive' | 'negative';
  }> = [
    { key: 'renewableCapacityGW', label: 'Renewable Capacity', category: 'Technology', p10: baseIndicators.renewableCapacityGW * 0.7, p90: baseIndicators.renewableCapacityGW * 1.5, direction: 'negative' },
    { key: 'renewableGrowthRate', label: 'Renewable Growth Rate', category: 'Technology', p10: baseIndicators.renewableGrowthRate * 0.5, p90: baseIndicators.renewableGrowthRate * 1.8, direction: 'negative' },
    { key: 'evSalesShare', label: 'EV Sales Share', category: 'Technology', p10: baseIndicators.evSalesShare * 0.6, p90: Math.min(baseIndicators.evSalesShare * 1.8, 80), direction: 'negative' },
    { key: 'evGrowthRate', label: 'EV Growth Rate', category: 'Technology', p10: baseIndicators.evGrowthRate * 0.3, p90: baseIndicators.evGrowthRate * 2.0, direction: 'negative' },
    { key: 'policyCoveragePercent', label: 'Policy Coverage', category: 'Policy', p10: baseIndicators.policyCoveragePercent * 0.6, p90: Math.min(baseIndicators.policyCoveragePercent * 1.15, 100), direction: 'negative' },
    { key: 'policyImplementationRate', label: 'Policy Implementation', category: 'Policy', p10: baseIndicators.policyImplementationRate * 0.5, p90: Math.min(baseIndicators.policyImplementationRate * 1.4, 1.0), direction: 'negative' },
    { key: 'sbtiCompaniesPercent', label: 'SBTi Coverage', category: 'Corporate', p10: baseIndicators.sbtiCompaniesPercent * 0.5, p90: Math.min(baseIndicators.sbtiCompaniesPercent * 1.8, 100), direction: 'negative' },
    { key: 'corporateImplementationRate', label: 'Corporate Implementation', category: 'Corporate', p10: baseIndicators.corporateImplementationRate * 0.5, p90: Math.min(baseIndicators.corporateImplementationRate * 1.2, 1.0), direction: 'negative' },
    { key: 'carbonIntensity', label: 'Carbon Intensity', category: 'Socioeconomic', p10: baseIndicators.carbonIntensity * 0.8, p90: baseIndicators.carbonIntensity * 1.3, direction: 'positive' },
    { key: 'carbonIntensityDeclineRate', label: 'Intensity Decline Rate', category: 'Socioeconomic', p10: baseIndicators.carbonIntensityDeclineRate * 0.3, p90: baseIndicators.carbonIntensityDeclineRate * 2.0, direction: 'negative' },
    { key: 'cleanEnergyInvestmentTrn', label: 'Clean Energy Investment', category: 'Financial Flows', p10: baseIndicators.cleanEnergyInvestmentTrn * 0.5, p90: baseIndicators.cleanEnergyInvestmentTrn * 2.0, direction: 'negative' },
    { key: 'fossilFuelInvestmentTrn', label: 'Fossil Fuel Investment', category: 'Financial Flows', p10: baseIndicators.fossilFuelInvestmentTrn * 0.5, p90: baseIndicators.fossilFuelInvestmentTrn * 1.5, direction: 'positive' },
    { key: 'greenBondIssuanceBln', label: 'Green Bond Issuance', category: 'Financial Flows', p10: baseIndicators.greenBondIssuanceBln * 0.4, p90: baseIndicators.greenBondIssuanceBln * 2.0, direction: 'negative' },
    { key: 'fossilCO2GtPerYear', label: 'Observed CO2 Emissions', category: 'Emissions Outcomes', p10: baseIndicators.fossilCO2GtPerYear * 0.85, p90: baseIndicators.fossilCO2GtPerYear * 1.1, direction: 'positive' },
    { key: 'co2GrowthRatePpm', label: 'CO2 Growth Rate', category: 'Emissions Outcomes', p10: 1.5, p90: 4.0, direction: 'positive' },
  ];

  const results: SensitivityResult[] = [];

  for (const config of indicatorConfigs) {
    const lowIndicators = { ...baseIndicators, [config.key]: config.p10 };
    const highIndicators = { ...baseIndicators, [config.key]: config.p90 };

    const lowTrajectory = calculateEmissionsTrajectory(lowIndicators, startYear, 2100, 2000);
    const lowDist = calculateTemperatureDistribution(lowTrajectory, 2000);
    const lowStats = getTemperatureStats(lowDist, lowTrajectory);

    const highTrajectory = calculateEmissionsTrajectory(highIndicators, startYear, 2100, 2000);
    const highDist = calculateTemperatureDistribution(highTrajectory, 2000);
    const highStats = getTemperatureStats(highDist, highTrajectory);

    const p10Temp = config.direction === 'negative' ? highStats.median : lowStats.median;
    const p90Temp = config.direction === 'negative' ? lowStats.median : highStats.median;

    results.push({
      indicator: config.key,
      label: config.label,
      category: config.category,
      baselineTemperature: baseTemp,
      p10Temperature: Math.min(p10Temp, p90Temp),
      p90Temperature: Math.max(p10Temp, p90Temp),
      p10Value: config.p10,
      p90Value: config.p90,
      temperatureRange: Math.abs(highStats.median - lowStats.median),
      direction: config.direction,
    });
  }

  results.sort((a, b) => b.temperatureRange - a.temperatureRange);

  return results;
}

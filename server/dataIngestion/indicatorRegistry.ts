import {
  HISTORICAL_INDICATORS,
  type HistoricalIndicatorData,
} from "../calculation/historicalIndicators";

export type FetchTier = "A" | "B" | "C";
export type FetchMethod = "api" | "websearch" | "derived" | "manual";
export type IndicatorCategory =
  | "Technology"
  | "Policy"
  | "Corporate"
  | "Socioeconomic"
  | "Financial Flows"
  | "Emissions Outcomes";

export type IndicatorKey = Exclude<keyof HistoricalIndicatorData, "year">;

export interface IndicatorDef {
  key: IndicatorKey;
  label: string;
  unit: string;
  category: IndicatorCategory;
  source: string;
  tier: FetchTier;
  fetchMethod: FetchMethod;
  decimals: number;
  /** Hint passed to the web-search adapter to pin the source for continuity. */
  searchHint?: string;
}

export const INDICATORS: IndicatorDef[] = [
  // Technology
  { key: "renewableCapacityGW", label: "Renewable Capacity", unit: "GW", category: "Technology", source: "IRENA", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "global total installed renewable electricity capacity in gigawatts (GW) for the most recent year, per IRENA Renewable Capacity Statistics" },
  { key: "renewableGrowthRate", label: "Renewable Growth Rate", unit: "fraction/yr", category: "Technology", source: "Derived (IRENA)", tier: "C", fetchMethod: "derived", decimals: 3 },
  { key: "evSalesSharePct", label: "EV Sales Share", unit: "%", category: "Technology", source: "IEA", tier: "C", fetchMethod: "websearch", decimals: 1, searchHint: "electric vehicles as a percentage share of total new car sales globally for the most recent year, per IEA Global EV Outlook" },
  { key: "evGrowthRate", label: "EV Growth Rate", unit: "fraction/yr", category: "Technology", source: "Derived (IEA)", tier: "C", fetchMethod: "derived", decimals: 2 },
  // Policy
  { key: "policyCoveragePct", label: "Net-Zero Policy Coverage", unit: "%", category: "Policy", source: "Climate Action Tracker", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "percentage of global emissions covered by national net-zero targets for the most recent year, per Climate Action Tracker or Net Zero Tracker" },
  { key: "policyImplementationRate", label: "Policy Implementation Rate", unit: "fraction", category: "Policy", source: "Climate Action Tracker", tier: "C", fetchMethod: "websearch", decimals: 2, searchHint: "share of announced net-zero targets that are enshrined in law or policy (as a fraction between 0 and 1) for the most recent year, per Climate Action Tracker" },
  // Socioeconomic
  { key: "gdpTrillionUSD", label: "Global GDP", unit: "$ tn", category: "Socioeconomic", source: "World Bank", tier: "A", fetchMethod: "api", decimals: 1 },
  { key: "carbonIntensityKgPerGDP", label: "Carbon Intensity of GDP", unit: "kg/$", category: "Socioeconomic", source: "Derived (CO2/GDP)", tier: "A", fetchMethod: "derived", decimals: 3 },
  { key: "climateConcernPct", label: "Global Climate Concern", unit: "%", category: "Socioeconomic", source: "Gallup", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "percentage of people globally who view climate change as a serious or major threat for the most recent year, per Gallup World Risk Poll or similar global polling" },
  { key: "policySupportPct", label: "Climate Policy Support", unit: "%", category: "Socioeconomic", source: "Pew Research", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "percentage of people across surveyed countries who support government action to address climate change for the most recent year, per Pew Research Center" },
  { key: "sacrificeWillingnessPct", label: "Willingness to Sacrifice", unit: "%", category: "Socioeconomic", source: "Survey (Pew/UN)", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "percentage of people willing to make lifestyle changes or sacrifices to reduce climate change for the most recent year, per international survey data" },
  { key: "humanCausationPct", label: "Human Causation Belief", unit: "%", category: "Socioeconomic", source: "Survey", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "percentage of people who believe climate change is mostly caused by human activity for the most recent year, per international survey data" },
  // Corporate
  { key: "corporateTargetsPct", label: "Companies with SBTi Targets", unit: "%", category: "Corporate", source: "SBTi", tier: "C", fetchMethod: "websearch", decimals: 1, searchHint: "share of large/listed companies (e.g. by market capitalization) with validated Science Based Targets initiative (SBTi) emissions targets for the most recent year" },
  { key: "corporateImplementationRate", label: "Corporate Implementation Rate", unit: "fraction", category: "Corporate", source: "SBTi (est.)", tier: "C", fetchMethod: "websearch", decimals: 2, searchHint: "share of companies with science-based targets that are on track to meet them (as a fraction between 0 and 1) for the most recent year" },
  // Financial Flows
  { key: "cleanEnergyInvestmentTrn", label: "Clean Energy Investment", unit: "$ tn", category: "Financial Flows", source: "IEA", tier: "C", fetchMethod: "websearch", decimals: 2, searchHint: "global clean energy / energy transition investment in trillions of US dollars for the most recent year, per IEA World Energy Investment" },
  { key: "fossilFuelInvestmentTrn", label: "Fossil Fuel Investment", unit: "$ tn", category: "Financial Flows", source: "IEA", tier: "C", fetchMethod: "websearch", decimals: 2, searchHint: "global fossil fuel supply investment in trillions of US dollars for the most recent year, per IEA World Energy Investment" },
  { key: "greenBondIssuanceBln", label: "Green Bond Issuance", unit: "$ bn", category: "Financial Flows", source: "Climate Bonds Initiative", tier: "C", fetchMethod: "websearch", decimals: 0, searchHint: "annual green bond issuance in billions of US dollars for the most recent year, per Climate Bonds Initiative" },
  { key: "fossilDivestmentTrn", label: "Fossil Divestment", unit: "$ tn", category: "Financial Flows", source: "Stand.earth", tier: "C", fetchMethod: "websearch", decimals: 1, searchHint: "cumulative assets under management committed to fossil fuel divestment in trillions of US dollars for the most recent year, per the Global Fossil Fuel Divestment Commitments Database" },
  // Emissions Outcomes
  { key: "fossilCO2GtPerYear", label: "Fossil CO2 Emissions", unit: "Gt/yr", category: "Emissions Outcomes", source: "Global Carbon Project (OWID)", tier: "A", fetchMethod: "api", decimals: 1 },
  { key: "atmosphericCO2ppm", label: "Atmospheric CO2", unit: "ppm", category: "Emissions Outcomes", source: "NOAA Mauna Loa", tier: "A", fetchMethod: "api", decimals: 1 },
  { key: "co2GrowthRatePpm", label: "CO2 Growth Rate", unit: "ppm/yr", category: "Emissions Outcomes", source: "NOAA Mauna Loa", tier: "A", fetchMethod: "api", decimals: 2 },
  { key: "remainingBudget15C_Gt", label: "Remaining 1.5°C Budget", unit: "Gt", category: "Emissions Outcomes", source: "Derived (IPCC − emissions)", tier: "A", fetchMethod: "derived", decimals: 0 },
];

export const INDICATOR_KEYS: IndicatorKey[] = INDICATORS.map((d) => d.key);

const DEF_BY_KEY: Record<string, IndicatorDef> = Object.fromEntries(
  INDICATORS.map((d) => [d.key, d])
);

export function getIndicatorDef(key: string): IndicatorDef | undefined {
  return DEF_BY_KEY[key];
}

export const LATEST_CURATED_YEAR =
  HISTORICAL_INDICATORS[HISTORICAL_INDICATORS.length - 1].year;

export function getCuratedSeries(key: IndicatorKey): { year: number; value: number }[] {
  return HISTORICAL_INDICATORS.map((row) => ({
    year: row.year,
    value: row[key] as number,
  }));
}

/** Latest curated value for a key, or the value for a specific year if provided. */
export function getCuratedValue(key: IndicatorKey, year?: number): number | undefined {
  if (year !== undefined) {
    const row = HISTORICAL_INDICATORS.find((r) => r.year === year);
    return row ? (row[key] as number) : undefined;
  }
  const last = HISTORICAL_INDICATORS[HISTORICAL_INDICATORS.length - 1];
  return last ? (last[key] as number) : undefined;
}

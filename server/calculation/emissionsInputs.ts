import { getAllHistoricalIndicators, type HistoricalIndicatorData } from "./historicalIndicators";
import { INDICATORS } from "../dataIngestion/indicatorRegistry";
import { constantScenario, type EmissionsScenario } from "./emissionsCandidate";

/** All inputs use the inventory date. Later estimates are NOT observations of 2024. */
export function resolveEmissionsInputs(history: HistoricalIndicatorData[] = getAllHistoricalIndicators()) {
  const row = history.find(r => r.year === 2024);
  const previous = history.find(r => r.year === 2023);
  if (!row || !previous) throw new Error("Candidate requires dated 2023 and 2024 approved/curated inputs");
  const finite = (value: number, name: string, min: number, max = Infinity) => {
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid dated input: ${name}`);
    return value;
  };
  const capacity = finite(row.renewableCapacityGW, "renewableCapacityGW", 0);
  const previousCapacity = finite(previous.renewableCapacityGW, "previous renewableCapacityGW", 0);
  const sales = finite(row.evSalesSharePct, "evSalesSharePct", 0, 100) / 100;
  // A negative net change must not be silently clipped or called gross additions.
  if (capacity < previousCapacity) throw new Error("Falling renewable capacity requires an explicit retirement scenario");
  if (sales < .04) throw new Error("EV sales below reference fleet share require explicit reversal");
  const diagnostic: EmissionsScenario = {
    ...constantScenario,
    name: "dated-dashboard-input-diagnostic-not-a-policy-forecast",
    renewableCapacityGW: capacity,
    // Net observed addition held constant, zero retirement: do not subtract
    // retirement again. Gross additions require a separate observed series.
    renewableAdditionsGW: capacity - previousCapacity,
    evSalesShare: sales,
  };
  return {
    inventoryYear: 2024,
    indicatorYear: 2024,
    observationBoundary: "curated-or-approved-2024-values; no nowcast",
    diagnostic,
    indicators: INDICATORS.map(d => {
      const role = ["renewableCapacityGW", "evSalesSharePct"].includes(d.key) ? "mechanism-input" :
        ["fossilCO2GtPerYear", "atmosphericCO2ppm", "co2GrowthRatePpm"].includes(d.key) ? "validation" : "context";
      const reasons: Record<string, string> = {
        renewableCapacityGW: "Starting capacity and 2023–2024 net additions; no automatic acceleration.",
        evSalesSharePct: "Starting sales mix; bounded fleet turnover, not immediate fleet replacement.",
        policyCoveragePct: "Target coverage does not specify eligible sector/gas reductions or delivery dates.",
        policyImplementationRate: "Legal/policy status proxy, not measured delivery of emissions reductions.",
        corporateTargetsPct: "Company/market-cap coverage is not an emissions-weighted share.",
        corporateImplementationRate: "Cannot quantify abatement without emissions-weighted coverage and target pathways.",
        renewableGrowthRate: "Not added on top of observed capacity additions.",
        evGrowthRate: "Sales growth is not a logistic share parameter; no undocumented conversion.",
        gdpTrillionUSD: "No verified real/PPP physical activity mapping for sector pathways.",
        carbonIntensityKgPerGDP: "Aggregate intensity would duplicate explicit technology effects.",
      };
      return { key: d.key, label: d.label, unit: d.unit, year: 2024, value: row[d.key],
        role, reason: reasons[d.key] ?? (role === "validation"
          ? "Independent comparison, not an emissions multiplier."
          : "No separately evidenced causal emissions coefficient.") };
    }),
    assumptions: [
      "Diagnostic only: hold 2024 sales mix and net annual renewable additions fixed.",
      "Fleet share 4% is a rounded IEA 2024 reference; 15-year turnover is a scenario assumption.",
      "Capacity factor, fossil generation, passenger-road share and electric load remain diagnostic assumptions.",
      "No quantified policy/corporate effect is inferred from target counts or legal status.",
    ],
    readiness: {
      status: "blocked-evidence-required",
      mainCase: "implemented-policies",
      comparisonCase: "announced-commitments-delivered",
      missing: [
        "Dated implemented measures with sector/gas eligibility and quantified incremental abatement.",
        "Commitment base years, target years, emissions-weighted scope and delivery pathways.",
        "Assessed central sector activity, residual efficiency, non-CO2 and land-use pathways.",
        "Matched calibration and plausibility assessment before the Package 2 acceptance gate.",
      ],
    },
  };
}

import { FIXED_5GT_DESCRIPTOR } from "./quantityDescriptors";
import { THRESHOLD_DIAGNOSTIC_LABEL } from "./thresholdDiagnostic";
import { requireHistoricalType } from "./historicalTypes";
import { categoryExportNames, indicatorExportColumn, indicatorValueColumn } from "./finiteExportSchemas";

/** Finite new export metadata. These are not original field observations or
 * scientific closure. No native/valuation producer can certify these paths. */
export const legacyProducerPaths = [
  "/api/projection", "/api/projection/categories", "/api/projection/sensitivity",
  "/api/projection/historical-trend", "/api/projection/categories/historical-trend",
  "/api/indicators/historical",
  "/api/projection/regions",
] as const;
export type LegacyProducerPath = typeof legacyProducerPaths[number];
export type LegacyConsumerKey = "emissions" | "temperature" | "category-scenarios" | "sensitivity" |
  "historical-trend" | "category-trends" | "indicator-cards" |
  "news-volume" | "news-sentiment-trend" | "news-sentiment-breakdown" | "news-topic" | "regional" | "indicator-detail";
export type LegacyMetric = "temperature" | "reductionRate" | "netZero";
export function legacyProducerScenario(path: LegacyProducerPath) { return `legacy-export:${path}`; }
const categoryNames = categoryExportNames;
function explicitMissing<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_key, v) => {
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("Nonfinite legacy consumer value");
    return v === undefined ? null : v;
  }));
}
export function deriveLegacyExport(parent: any, key: LegacyConsumerKey, metric: LegacyMetric = "temperature") {
  let rows: Record<string, any>[], chartRows: unknown, path: LegacyProducerPath | "/api/news/climate" | "/api/data/indicator/:key", recordPath = "$";
  let filter = "All records; preserve source order and duplicates; missing values are not zero";
  switch (key) {
    case "emissions":
      path = "/api/projection"; recordPath = "$.emissionsTrajectory";
      rows = parent.emissionsTrajectory.map((t: any) => ({
        Year: t.year, "P10 (GtCO2e)": t.p10, "Median P50 (GtCO2e)": t.p50, "P90 (GtCO2e)": t.p90,
      }));
      chartRows = parent.emissionsTrajectory.filter((_: any, i: number, a: any[]) => i % 2 === 0 || i === a.length - 1);
      filter += "; chart only retains even source indices or final source index";
      break;
    case "temperature":
      path = "/api/projection"; recordPath = "$.temperatureDistribution.pdf";
      rows = parent.temperatureDistribution.pdf.map((d: any) => ({
        "Temperature (°C)": d.temperature, "Probability density (1/°C)": d.probability,
      }));
      chartRows = parent.temperatureDistribution.pdf.filter((d: any) => d.probability > 0.001);
      filter += "; chart only retains probability density > 0.001; density is not point probability";
      break;
    case "category-scenarios":
      path = "/api/projection/categories";
      rows = parent.map((c: any) => ({ Category: c.categoryName, "Temperature (°C)": c.temperatureRise,
        "Reduction Rate (%/yr)": c.reductionRate, [FIXED_5GT_DESCRIPTOR.label]: c.netZeroYear,
        [THRESHOLD_DIAGNOSTIC_LABEL]: c.thresholdDiagnostic?.year ?? null,
        "5% diagnostic status": c.thresholdDiagnostic?.status ?? "withheld" }));
      chartRows = parent;
      break;
    case "sensitivity":
      path = "/api/projection/sensitivity";
      rows = parent.map((d: any) => ({ Indicator: d.label, Category: d.category,
        "Baseline (°C)": d.baselineTemperature ?? parent[0].baselineTemperature,
        "Lower scenario median (°C)": d.p10Temperature,
        "Upper scenario median (°C)": d.p90Temperature, "Impact Range (°C)": d.temperatureRange }));
      chartRows = parent.slice(0, 10).map((d: any) => ({ label: d.label, category: d.category,
        low: d.p10Temperature, high: d.p90Temperature, range: d.temperatureRange,
        baseline: parent[0].baselineTemperature, lowOffset: d.p10Temperature - parent[0].baselineTemperature,
        highOffset: d.p90Temperature - parent[0].baselineTemperature }));
      filter += "; chart first ten source records, offsets use first source baseline";
      break;
    case "historical-trend":
      path = "/api/projection/historical-trend";
      rows = parent.map((d: any) => ({ ...requireHistoricalType(d), Year: d.year,
        "Temperature Median (°C)": d.median, "P10 (°C)": d.p10, "P90 (°C)": d.p90,
        "Reduction Rate (%/yr)": d.reductionRate, [FIXED_5GT_DESCRIPTOR.label]: d.netZeroYear ?? null,
        [THRESHOLD_DIAGNOSTIC_LABEL]: d.thresholdDiagnostic?.year ?? null,
        "5% diagnostic status": d.thresholdDiagnostic?.status ?? "withheld", Estimated: d.isNowcast ? "yes" : "no" }));
      chartRows = parent.map((d: any) => {
        const value = metric === "netZero" ? d.thresholdDiagnostic?.year ?? null : d[metric === "temperature" ? "median" : "reductionRate"];
        return { ...d, displayValue: d.isNowcast ? undefined : value,
          nowcastValue: d.isNowcast ? value : undefined, bridgeValue: value };
      });
      if (parent.some((d: any) => d.isNowcast)) {
        const lastYear = parent.filter((d: any) => !d.isNowcast).at(-1)?.year;
        const bridge = (chartRows as any[]).find((d: any) => d.year === lastYear);
        if (lastYear && bridge) bridge.nowcastValue = bridge.bridgeValue;
      }
      break;
    case "category-trends":
      path = "/api/projection/categories/historical-trend";
      rows = parent.map((d: any) => {
        const row: Record<string, any> = { ...requireHistoricalType(d), Year: d.year, Estimated: d.isNowcast ? "yes" : "no" };
        for (const [key, label] of Object.entries(categoryNames))
          row[label] = d[key]?.[metric === "temperature" ? "median" : metric === "reductionRate" ? "reductionRate" : "netZeroYear"] ?? undefined;
        return row;
      });
      chartRows = parent.map((d: any) => {
        const row: Record<string, any> = { year: d.year, isNowcast: d.isNowcast };
        for (const key of Object.keys(categoryNames)) {
          const value = metric === "netZero" ? d[key]?.thresholdDiagnostic?.year :
            d[key]?.[metric === "temperature" ? "median" : "reductionRate"];
          row[key] = d.isNowcast ? undefined : value ?? undefined;
          row[`${key}_nowcast`] = d.isNowcast ? value ?? undefined : undefined;
        }
        return row;
      });
      if (parent.some((d: any) => d.isNowcast)) {
        const chart = chartRows as any[];
        const index = chart.findIndex((d, i) => i + 1 < chart.length && chart[i + 1].isNowcast);
        if (index >= 0) for (const key of Object.keys(categoryNames)) chart[index][`${key}_nowcast`] = chart[index][key];
      }
      break;
    case "indicator-cards": {
      path = "/api/indicators/historical";
      const keys = ["policyImplementationRate", "corporateImplementationRate", "sacrificeWillingnessPct",
        "humanCausationPct", "fossilDivestmentTrn", "remainingBudget15C_Gt", "renewableGrowthRate", "evGrowthRate",
        "renewableCapacityGW", "evSalesSharePct", "policyCoveragePct", "corporateTargetsPct", "carbonIntensityKgPerGDP",
        "climateConcernPct", "gdpTrillionUSD", "policySupportPct", "cleanEnergyInvestmentTrn", "greenBondIssuanceBln",
        "fossilFuelInvestmentTrn", "fossilCO2GtPerYear", "atmosphericCO2ppm", "co2GrowthRatePpm"];
      rows = parent.map((d: any) => {
        const row: Record<string, any> = { Year: d.year, Estimated: d.isNowcast ? "yes" : "no" };
        for (const key of keys) row[indicatorExportColumn(key)] = d[key];
        return row;
      });
      chartRows = keys.map(key => {
        const spark = parent.map((d: any) => ({ year: d.year,
          value: d.isNowcast ? undefined : d[key], nowcastValue: d.isNowcast ? d[key] : undefined }));
        if (parent.some((d: any) => d.isNowcast)) {
          const lastObserved = parent.filter((d: any) => !d.isNowcast).at(-1)?.year;
          const bridge = spark.find((d: any) => d.year === lastObserved);
          if (bridge) bridge.nowcastValue = bridge.value;
        }
        return { key, rows: spark };
      });
      filter += "; all 22 registered indicator keys; native units in literal headings; fraction growth is not percent";
      break;
    }
    case "news-volume": {
      path = "/api/news/climate"; recordPath = "$.volume";
      const weekMap = new Map<string, number>();
      for (const point of parent.volume) {
        const d = new Date(point.date), start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        const key = start.toISOString().split("T")[0];
        weekMap.set(key, (weekMap.get(key) || 0) + point.count);
      }
      const weekly = Array.from(weekMap.entries()).map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));
      rows = weekly.map(w => ({ "Week Of": w.date, "Article Count": w.count }));
      chartRows = weekly;
      filter = "Exact browser local Sunday getDay/setDate buckets, serialized UTC ISO date, ascending localeCompare date; sum daily counts; no week-size normalization";
      break;
    }
    case "news-sentiment-trend":
    case "news-sentiment-breakdown": {
      path = "/api/news/climate"; recordPath = "$.sentiment";
      const trend = parent.sentiment.map((s: any) => ({ ...s,
        positiveShare: s.total > 0 ? Math.round((s.positive / s.total) * 100) : null,
        negativeShare: s.total > 0 ? Math.round((s.negative / s.total) * 100) : null,
        neutralShare: s.total > 0 ? Math.round((s.neutral / s.total) * 100) : null }));
      rows = key === "news-sentiment-trend" ? trend.map((s: any) => ({ Month: s.date, "Avg Sentiment": s.avgSentiment,
        "Positive Articles": s.positive, "Neutral Articles": s.neutral, "Negative Articles": s.negative, "Total Articles": s.total }))
        : trend.map((s: any) => ({ Month: s.date, "Positive (%)": s.positiveShare, "Neutral (%)": s.neutralShare, "Negative (%)": s.negativeShare }));
      chartRows = trend;
      filter += "; counts allocated from pooled non-null sampled sentiment proportions (fallback 0.4/0.15/0.45), each rounded independently; not observed population classifications. Shares use reported volume total, not sum allocated classes; rounding need not sum 100";
      break;
    }
    case "news-topic":
      path = "/api/news/climate"; recordPath = "$.topicBreakdown";
      rows = parent.topicBreakdown.map((t: any) => ({ Topic: t.topic, "Article Count": t.count, "Avg Sentiment": t.avgSentiment }));
      chartRows = parent.topicBreakdown;
      filter += "; exact title substring keyword matches, nonexclusive topics; estimated count round(totalVolume*max(sampleMatchRatio,0.05)); matched non-null sentiment average or pooled fallback. Not observed topic counts; do not sum overlapping estimates";
      break;
    case "regional":
      path = "/api/projection/regions";
      rows = parent.map((r: any) => ({ Region: r.regionName,
        "Legacy global counterfactual warming (°C)": r.temperatureRise, "Reduction Rate (%/yr)": r.reductionRate,
        "Carbon Intensity (kg/$GDP)": r.carbonIntensity, "Intensity basis": r.carbonIntensityBasis,
        [FIXED_5GT_DESCRIPTOR.label]: r.netZeroYear, "Milestone definition": r.milestoneDefinition, Claim: r.claim }));
      chartRows = parent;
      filter += "; regional intensity global counterfactual, not regional temperature; OWID PPP and static nominal bases remain distinct";
      break;
    case "indicator-detail": {
      path = "/api/data/indicator/:key"; recordPath = "$.series";
      rows = parent.series.map((p: any) => ({ Year: p.year, [indicatorValueColumn(parent.def.key)]: p.value,
        Type: p.isNowcast ? "Estimated (nowcast)" : "Retained (not nowcast)", Source: p.source, Method: p.method, "As Of Date": p.asOfDate ?? "" }));
      const first = parent.series.findIndex((p: any) => p.isNowcast);
      chartRows = parent.series.map((p: any, i: number) => ({ year: p.year, actual: p.isNowcast ? null : p.value,
        estimated: p.isNowcast || (first > 0 && i === first - 1) ? p.value : null, source: p.source, isNowcast: p.isNowcast }));
      break;
    }
    default: throw new Error("Unsupported finite legacy export derivation");
  }
  return { rows: explicitMissing(rows), chartRows: explicitMissing(chartRows), derivation: { version: "legacy-export-consumer-1", key, metric,
    scenario: path === "/api/news/climate" ? "source-release:news-allocation-1" :
      path === "/api/data/indicator/:key" ? "safe-report-release:indicator-detail" : legacyProducerScenario(path),
    dateLabelTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    producerPath: path, recordPath, filter, order: "Export source array order; no deduplication",
    units: key.startsWith("news-") ? "Dates are calendar labels in declared timezone; article counts are provider volume or explicitly allocated/extrapolated estimates; sentiment is dimensionless [-1,1]; class shares are rounded percent of reported total, not population observations" :
      key === "indicator-detail" || key === "indicator-cards" ? "Exact registered literal indicator headings and native numeric units; fraction growth is fraction/year, never multiplied by 100 in export; Estimated is a nowcast flag, not availability evidence" :
      key === "regional" ? "°C global counterfactual; reduction %/yr; intensity kg CO2 per GDP dollar with separate OWID PPP versus static nominal basis; milestone is calendar year, not emissions" :
      "Exact literal column units; °C above pre-industrial; annual GtCO2e legacy reporting; density 1/°C; %/yr reduction; years are not emissions",
    claim: path === "/api/news/climate" ? "Provider-derived cached volume and sampled allocation/extrapolation, not population sentiment classifications or original upstream bytes"
      : "Legacy conditional model/revised history, not calibrated forecast, original vintage, source approval or scientific acceptance",
    missingness: "Null and undefined remain missing, not zero; diagnostic fallback status withheld only when absent",
    originalHistoricalExport: false, scientificAcceptance: false } };
}

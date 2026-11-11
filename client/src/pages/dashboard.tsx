import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { QueryReadErrors } from "@/components/query-read-errors";
import { TemperatureGauge } from "@/components/temperature-gauge";
import { EmissionsChart } from "@/components/emissions-chart";
import { EmissionsCandidateReview } from "@/components/emissions-candidate-review";
import { PublishedScenarioReferences } from "@/components/published-scenario-references";
import { TemperatureHistogram } from "@/components/temperature-histogram";
import { IndicatorCards } from "@/components/indicator-cards";
import { CategoryFilter } from "@/components/category-filter";
import { HistoricalTrendChart } from "@/components/historical-trend-chart";
import { RegionalComparison } from "@/components/regional-comparison";
import { MetricToggle } from "@/components/metric-toggle";
import { CategoryComparison } from "@/components/category-comparison";
import { SensitivityChart } from "@/components/sensitivity-chart";
import { CategoryTrendChart } from "@/components/category-trend-chart";
import { Button } from "@/components/ui/button";
import { indicatorFieldSpecs } from "@shared/indicatorFieldSemantics";
import { RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  Category,
  MetricView,
  ProjectionResult,
  HistoricalIndicatorData,
  HistoricalTrendPoint,
  CategoryProjectionResult,
  CategoryHistoricalTrendPoint,
  RegionalProjection,
  SensitivityResult,
} from "@/lib/types";

export default function Dashboard() {
  const [showLegacy, setShowLegacy] = useState(false);
  const { toast } = useToast();
  const reload = useMutation({
    mutationFn: () => queryClient.invalidateQueries({ refetchType: "active" }, { throwOnError: true }),
    onSuccess: () => toast({ title: "Views reloaded", description: "Existing server results were read again. No data collection, server recalculation or model promotion was requested." }),
    onError: () => toast({ title: "Reload failed", description: "Some existing results could not be read. Retry when the service is available.", variant: "destructive" }),
  });
  const { data: indicators, isLoading, isError, refetch } = useQuery<HistoricalIndicatorData[]>({
    queryKey: ["/api/indicators/historical"],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight" data-testid="text-title">Global Decarbonization Dashboard</h1>
          <p className="text-sm text-muted-foreground">Climate evidence and published scenario references</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload.mutate()} disabled={reload.isPending} data-testid="button-refresh-analysis">
          <RefreshCw className="h-4 w-4 mr-1.5" />
          {reload.isPending ? "Reloading views…" : "Re-run Analysis"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Re-run Analysis reloads client queries only. It does not collect data or recalculate server results.
        No new scientific model is ready for use; legacy calculations are not validated climate forecasts.
      </p>
      <PublishedScenarioReferences />
      <EmissionsCandidateReview />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Indicator evidence</h2>
        <p className="text-sm text-muted-foreground">Review source provenance and distinguish observations, curated values and estimates before interpreting these indicators.</p>
        {isError ? <div role="alert" className="rounded-md border p-4">Indicator evidence could not be loaded. <Button variant="outline" onClick={() => void refetch()}>Retry</Button></div>
          : !isLoading && !indicators?.length ? <p className="rounded-md border p-4 text-sm text-muted-foreground">No indicator evidence is available. No values have been substituted.</p>
          : <IndicatorCards historicalData={indicators ?? []} isLoading={isLoading} />}
      </section>
      <section className="rounded-md border p-4 space-y-3">
        <h2 className="text-lg font-semibold">Legacy diagnostic view — opt in</h2>
        <p className="text-sm text-muted-foreground" id="legacy-warning">
          The legacy calculation applies a CO2-only response to aggregate GHG (CO2e), plus a fixed 1.1°C offset.
          Its temperature, net-zero, regional and sensitivity outputs are unsupported diagnostics, not validated physical forecasts.
          “Year emissions reach 5% of 2024” uses only the same selected trajectory's evidenced 2024 baseline; if it is missing the diagnostic is withheld. No crossing means not reached by the actual simulated horizon. The separate fixed-5gt-v1 legacy comparator is not 5% of 2024. Neither residual diagnostic is net zero.
          Regional temperatures are not standalone regional warming estimates. Historical recalculations are not forecast validation.
        </p>
        <Button variant="outline" aria-expanded={showLegacy} aria-describedby="legacy-warning" onClick={() => setShowLegacy(!showLegacy)} data-testid="button-toggle-legacy">
          {showLegacy ? "Hide legacy diagnostics" : "Show legacy diagnostics"}
        </Button>
        {showLegacy && <LegacyDashboard />}
      </section>
    </div>
  );
}

function LegacyDashboard() {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [metricView, setMetricView] = useState<MetricView>("temperature");

  const projectionUrl = activeCategory === "all"
    ? "/api/projection"
    : `/api/projection?category=${activeCategory}`;

  const { data: projection, isLoading: projectionLoading, error: projectionError } = useQuery<ProjectionResult>({
    queryKey: [projectionUrl],
  });

  const { data: historicalIndicators, isLoading: indicatorsLoading } = useQuery<HistoricalIndicatorData[]>({
    queryKey: ["/api/indicators/historical"],
  });

  const { data: historicalTrend, isLoading: trendLoading } = useQuery<HistoricalTrendPoint[]>({
    queryKey: ["/api/projection/historical-trend"],
  });

  const { data: categoryProjections, isLoading: categoriesLoading } = useQuery<CategoryProjectionResult[]>({
    queryKey: ["/api/projection/categories"],
  });

  const { data: regionalProjections, isLoading: regionsLoading } = useQuery<RegionalProjection[]>({
    queryKey: ["/api/projection/regions"],
  });

  const { data: sensitivityData, isLoading: sensitivityLoading } = useQuery<SensitivityResult[]>({
    queryKey: ["/api/projection/sensitivity"],
  });

  const { data: categoryHistoricalTrend, isLoading: categoryTrendLoading } = useQuery<CategoryHistoricalTrendPoint[]>({
    queryKey: ["/api/projection/categories/historical-trend"],
  });

  return (
    <div className="bg-background">
      <QueryReadErrors prefix="/api/projection" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-title">
              Legacy diagnostics
            </h1>
            <p className="text-sm text-muted-foreground">
              Unsupported legacy calculations — not a forecast
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <MetricToggle activeMetric={metricView} onMetricChange={setMetricView} />
            <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {projection?.temperatureDistribution && projection.metrics ? <TemperatureGauge
            temperature={projection.temperatureDistribution.median}
            p10={projection.temperatureDistribution.p10}
            p90={projection.temperatureDistribution.p90}
            reductionRate={projection.metrics.reductionRate}
            netZeroYear={projection.metrics.netZeroYear}
            thresholdDiagnostic={projection.metrics.thresholdDiagnostic}
            metricView={metricView}
            isLoading={projectionLoading}
          /> : <p role={projectionError ? "alert" : "status"} className="rounded-md border p-4 text-sm">Legacy calculation {projectionError ? "read failed for the selected category. No previous result is shown." : projectionLoading ? "loading the selected category…" : "unavailable: the selected response has no complete distribution and metrics. No diagnostic values are substituted."}</p>}

          <div className="lg:col-span-2">
            <EmissionsChart
              trajectory={projection?.emissionsTrajectory ?? []}
              isLoading={projectionLoading}
            />
          </div>
        </div>

        {projection?.temperatureDistribution && [projection.temperatureDistribution.median, projection.temperatureDistribution.p10, projection.temperatureDistribution.p90].every(value => typeof value === "number" && Number.isFinite(value)) && <TemperatureHistogram
          pdf={projection?.temperatureDistribution.pdf ?? []}
          median={projection.temperatureDistribution.median}
          p10={projection.temperatureDistribution.p10}
          p90={projection.temperatureDistribution.p90}
          isLoading={projectionLoading}
        />}

        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-indicators-heading">Key Indicators</h2>
              <p className="text-sm text-muted-foreground">{indicatorFieldSpecs.length} registered indicators across 6 categories; retained observations and estimates have distinct evidence limitations</p>
            </div>
          </div>
          <IndicatorCards
            historicalData={historicalIndicators ?? []}
            isLoading={indicatorsLoading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <SensitivityChart
              data={sensitivityData ?? []}
              isLoading={sensitivityLoading}
            />
          </div>
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Regional Analysis</h2>
            <RegionalComparison
              regions={regionalProjections ?? []}
              isLoading={regionsLoading}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-lg font-semibold">Legacy historical recalculation — not validation</h2>
            </div>
            <HistoricalTrendChart
              data={historicalTrend ?? []}
              metricView={metricView}
              isLoading={trendLoading}
            />
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4">Category Scenario Trends</h2>
            <CategoryTrendChart
              data={categoryHistoricalTrend ?? []}
              metricView={metricView}
              isLoading={categoryTrendLoading}
            />
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-4">Category Impact Analysis</h2>
          <CategoryComparison
            categories={categoryProjections ?? []}
            isLoading={categoriesLoading}
          />
        </div>

        <footer className="border-t pt-6 pb-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-1">
              Data sources: IEA, IRENA, Climate Action Tracker, SBTi, Global Carbon Project, NOAA, World Bank, IMF, Gallup, Pew Research, Climate Bonds Initiative, Stand.earth
            </p>
            <p className="text-xs">
              Legacy Monte Carlo simulation does not establish scientific validity.
              See <a href="/methodology" className="underline hover:text-foreground" data-testid="link-methodology">Methodology</a> for details.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

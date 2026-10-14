import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TemperatureGauge } from "@/components/temperature-gauge";
import { EmissionsChart } from "@/components/emissions-chart";
import { EmissionsCandidateReview } from "@/components/emissions-candidate-review";
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
import { RefreshCw } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const [metricView, setMetricView] = useState<MetricView>("temperature");
  const { toast } = useToast();

  const refreshMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/refresh");
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Analysis refreshed", description: "All projections are being recalculated with the latest data." });
    },
    onError: () => {
      toast({ title: "Refresh failed", description: "Could not refresh the analysis. Please try again.", variant: "destructive" });
    },
  });

  const projectionUrl = activeCategory === "all"
    ? "/api/projection"
    : `/api/projection?category=${activeCategory}`;

  const { data: projection, isLoading: projectionLoading } = useQuery<ProjectionResult>({
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight" data-testid="text-title">
              Global Decarbonization Dashboard
            </h1>
            <p className="text-sm text-muted-foreground">
              Climate-Implied Temperature Projections
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-analysis"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              {refreshMutation.isPending ? "Refreshing..." : "Re-run Analysis"}
            </Button>
            <MetricToggle activeMetric={metricView} onMetricChange={setMetricView} />
            <CategoryFilter activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TemperatureGauge
            temperature={projection?.temperatureDistribution.median ?? 2.7}
            p10={projection?.temperatureDistribution.p10 ?? 2.1}
            p90={projection?.temperatureDistribution.p90 ?? 3.3}
            reductionRate={projection?.metrics.reductionRate ?? 0}
            netZeroYear={projection?.metrics.netZeroYear ?? null}
            metricView={metricView}
            isLoading={projectionLoading}
          />

          <div className="lg:col-span-2">
            <EmissionsChart
              trajectory={projection?.emissionsTrajectory ?? []}
              isLoading={projectionLoading}
            />
          </div>
        </div>

        <EmissionsCandidateReview />

        <TemperatureHistogram
          pdf={projection?.temperatureDistribution.pdf ?? []}
          median={projection?.temperatureDistribution.median ?? 2.7}
          p10={projection?.temperatureDistribution.p10 ?? 2.1}
          p90={projection?.temperatureDistribution.p90 ?? 3.3}
          isLoading={projectionLoading}
        />

        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold" data-testid="text-indicators-heading">Key Indicators</h2>
              <p className="text-sm text-muted-foreground">20 real-world indicators across 6 categories from authoritative sources</p>
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
              <h2 className="text-lg font-semibold">Historical Backtesting</h2>
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
              Projections use Monte Carlo simulation (10,000 iterations) with sector-specific forward modeling.
              See <a href="/methodology" className="underline hover:text-foreground" data-testid="link-methodology">Methodology</a> for details.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

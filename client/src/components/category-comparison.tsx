import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, Shield, Building2, Users } from "lucide-react";
import type { CategoryProjectionResult } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";

interface CategoryComparisonProps {
  categories: CategoryProjectionResult[];
  isLoading?: boolean;
}

function getCategoryIcon(category: string) {
  switch (category) {
    case "technology": return Zap;
    case "policy": return Shield;
    case "corporate": return Building2;
    case "socioeconomic": return Users;
    default: return Zap;
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "technology": return "hsl(168, 76%, 36%)";
    case "policy": return "hsl(43, 86%, 42%)";
    case "corporate": return "hsl(27, 87%, 48%)";
    case "socioeconomic": return "hsl(340, 65%, 50%)";
    default: return "hsl(168, 76%, 36%)";
  }
}

function getTempColor(temp: number): string {
  if (temp <= 1.5) return "text-emerald-500";
  if (temp <= 2.0) return "text-sky-500";
  if (temp <= 2.5) return "text-amber-500";
  if (temp <= 3.0) return "text-orange-500";
  return "text-red-500";
}

export function CategoryComparison({ categories, isLoading }: CategoryComparisonProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </Card>
    );
  }

  const downloadRows = categories.map((c) => ({
    Category: c.categoryName,
    "Temperature (\u00B0C)": c.temperatureRise,
    "Reduction Rate (%/yr)": c.reductionRate,
    "Net-Zero Year": c.netZeroYear ?? "Never",
  }));

  return (
    <Card className="p-6" data-testid="card-category-comparison">
      <div className="mb-4 flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Category Scenario Analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Illustrative input-shock scenarios, not forecasts or category contributions.
            The full model evolves in each case; the socioeconomic scenario also changes policy and corporate inputs.
            See Methodology for exact shocks and baseline differences.
          </p>
        </div>
        <DownloadDataButton
          filename="category-scenario-analysis"
          sheetName="Category Scenarios"
          rows={downloadRows}
          testId="button-download-category-scenarios"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {categories.map((cat) => {
          const Icon = getCategoryIcon(cat.category);
          const color = getCategoryColor(cat.category);

          return (
            <Card key={cat.category} className="p-4 hover-elevate" data-testid={`card-category-impact-${cat.category}`}>
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-md"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color }} />
                </div>
                <div>
                  <p className="text-sm font-medium">{cat.categoryName}</p>
                  <p className="text-[10px] text-muted-foreground">Stylized scenario</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Temperature</span>
                  <span className={`text-sm font-bold tabular-nums ${getTempColor(cat.temperatureRise)}`} data-testid={`text-category-temp-${cat.category}`}>
                    {cat.temperatureRise.toFixed(2)}&deg;C
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Reduction Rate</span>
                  <span className="text-sm font-semibold tabular-nums" data-testid={`text-category-rate-${cat.category}`}>
                    {cat.reductionRate.toFixed(2)}%/yr
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Net-Zero</span>
                  <span className="text-sm font-semibold tabular-nums" data-testid={`text-category-netzero-${cat.category}`}>
                    {cat.netZeroYear || "Never"}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}

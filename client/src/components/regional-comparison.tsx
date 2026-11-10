import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, MapPin } from "lucide-react";
import type { RegionalProjection } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";
import { ThresholdDiagnosticDetails } from "./threshold-diagnostic-details";

interface RegionalComparisonProps {
  regions: RegionalProjection[];
  isLoading?: boolean;
}

function getRegionColor(region: string): string {
  switch (region) {
    case "eu": return "hsl(197, 71%, 38%)";
    case "us": return "hsl(168, 76%, 36%)";
    case "china": return "hsl(43, 86%, 42%)";
    case "india": return "hsl(27, 87%, 48%)";
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

function getTempBgColor(temp: number): string {
  if (temp <= 1.5) return "bg-emerald-500";
  if (temp <= 2.0) return "bg-sky-500";
  if (temp <= 2.5) return "bg-amber-500";
  if (temp <= 3.0) return "bg-orange-500";
  return "bg-red-500";
}

export function RegionalComparison({ regions, isLoading }: RegionalComparisonProps) {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  const downloadRows = regions.map((r) => ({
    Region: r.regionName,
    "Legacy global counterfactual warming (\u00B0C)": r.temperatureRise,
    "Reduction Rate (%/yr)": r.reductionRate,
    "Carbon Intensity (kg/$GDP)": r.carbonIntensity,
    "Intensity basis": r.carbonIntensityBasis,
    "Legacy fixed-5gt-v1 year (5 GtCO2e)": r.netZeroYear,
    "Milestone definition": r.milestoneDefinition,
    Claim: r.claim,
  }));

  return (
    <Card className="p-6" data-testid="card-regional-comparison">
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Global intensity counterfactual</h3>
            <p className="text-xs text-muted-foreground mt-0.5">What if the world followed each region's carbon intensity?</p>
            <p className="text-xs text-muted-foreground mt-1">Legacy diagnostic, not a regional temperature forecast. The Legacy 5 Gt milestone (fixed-5gt-v1) is a positive-emissions comparator, not net zero or the 5%-of-2024 diagnostic. These values are global intensity counterfactuals, not source-evidenced regional inventories. No date means not reached by 2100; dates are not extrapolated.</p>
          </div>
        </div>
        <DownloadDataButton
          kind="legacy"
          filename="legacy-global-intensity-counterfactual"
          sheetName="Global Counterfactual"
          rows={downloadRows}
          fieldBindings={{
            Region:{id:"regional.regionName",transform:"Identity"},
            "Legacy global counterfactual warming (\u00B0C)":{id:"regional.temperatureRise",transform:"Identity"},
            "Reduction Rate (%/yr)":{id:"regional.reductionRate",transform:"Identity"},
            "Carbon Intensity (kg/$GDP)":{id:"regional.carbonIntensity",transform:"Identity; read companion basis column"},
            "Intensity basis":{id:"regional.carbonIntensityBasis",transform:"Identity"},
            "Legacy fixed-5gt-v1 year (5 GtCO2e)":{id:"regional.netZeroYear",transform:"Identity; fixed-5gt-v1; null preserved; not 5% or net zero"},
            "Milestone definition":{id:"regional.milestoneDefinition",transform:"Identity"},
            Claim:{id:"regional.claim",transform:"Identity"},
          }}
          testId="button-download-regional"
        />
      </div>

      <div className="space-y-3">
        {regions.map((region) => {
          const barWidth = Math.min(100, Math.max(5, ((region.temperatureRise - 1.0) / 4.0) * 100));
          const color = getRegionColor(region.region);

          return (
            <div key={region.region} className="group" data-testid={`card-region-${region.region}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-sm font-medium">{region.regionName}</span>
                </div>
                <span className={`text-lg font-bold tabular-nums ${getTempColor(region.temperatureRise)}`} data-testid={`text-region-temp-${region.region}`}>
                  {region.temperatureRise.toFixed(2)}&deg;C
                </span>
              </div>

              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${getTempBgColor(region.temperatureRise)}`}
                  style={{ width: `${barWidth}%`, opacity: 0.7 }}
                />
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span data-testid={`text-region-reduction-${region.region}`}>Reduction: {region.reductionRate.toFixed(1)}%/yr</span>
                <span data-testid={`text-region-intensity-${region.region}`}>Carbon Intensity: {region.carbonIntensity.toFixed(2)} — {region.carbonIntensityBasis}</span>
                <span data-testid={`text-region-netzero-${region.region}`}>Separate legacy fixed-5gt-v1: {region.netZeroYear ?? "Not reached by 2100"}</span>
              </div>
              <ThresholdDiagnosticDetails diagnostic={region.thresholdDiagnostic} contextLabel={region.regionName} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

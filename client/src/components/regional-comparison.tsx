import { FIXED_5GT_DESCRIPTOR } from "@shared/quantityDescriptors";
import { REGIONAL_COUNTERFACTUAL, regionalCounterfactualRows, regionalCounterfactualBindings, regionalCounterfactualExportNotes } from "@shared/regionalCounterfactual";
import { Card } from "@/components/ui/card";
import { ScientificEvidenceStrands } from "./scientific-evidence-strands";
import { Skeleton } from "@/components/ui/skeleton";
import { Globe, MapPin } from "lucide-react";
import type { RegionalProjection } from "@/lib/types";
import { DownloadDataButton } from "@/components/download-data-button";
import { bindProducerLegacyConsumer } from "@/lib/producer-download";
import { ThresholdDiagnosticDetails } from "./threshold-diagnostic-details";
import { displayDiagnostic } from "@/lib/valuation-claims";

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

  if (!regions.length) return <Card className="p-6"><h3>{REGIONAL_COUNTERFACTUAL.title}</h3><p role="status">{REGIONAL_COUNTERFACTUAL.unavailable}</p></Card>;

  const downloadRows = regionalCounterfactualRows(regions);
  bindProducerLegacyConsumer(regions, "regional", downloadRows);

  return (
    <Card className="p-6" data-testid="card-regional-comparison">
      <ScientificEvidenceStrands compact />
      <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">{REGIONAL_COUNTERFACTUAL.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{REGIONAL_COUNTERFACTUAL.question}</p>
            <p className="text-xs text-muted-foreground mt-1">{REGIONAL_COUNTERFACTUAL.claim}. {REGIONAL_COUNTERFACTUAL.description} {FIXED_5GT_DESCRIPTOR.description} No date means not reached by 2100; dates are not extrapolated.</p>
            <p className="text-xs text-muted-foreground mt-1">{REGIONAL_COUNTERFACTUAL.source}</p>
          </div>
        </div>
        <DownloadDataButton
          kind="legacy"
          filename="legacy-global-intensity-counterfactual"
          sheetName="Global Counterfactual"
          rows={downloadRows}
          jsonCompanion
          interpretationNotes={regionalCounterfactualExportNotes()}
          fieldBindings={regionalCounterfactualBindings}
          testId="button-download-regional"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{REGIONAL_COUNTERFACTUAL.warmingLabel}</p>
        {regions.map((region) => {
          const hasTemperature = typeof region.temperatureRise === "number" && Number.isFinite(region.temperatureRise);
          const barWidth = hasTemperature ? Math.min(100, Math.max(5, ((region.temperatureRise - 1.0) / 4.0) * 100)) : 0;
          const color = getRegionColor(region.region);

          return (
            <div key={region.region} className="group" data-testid={`card-region-${region.region}`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" style={{ color }} />
                  <span className="text-sm font-medium">{region.regionName}</span>
                </div>
                 <span title={REGIONAL_COUNTERFACTUAL.warmingLabel} aria-label={REGIONAL_COUNTERFACTUAL.warmingLabel} className={`text-lg font-bold tabular-nums ${getTempColor(region.temperatureRise)}`} data-testid={`text-region-temp-${region.region}`}>
                   {displayDiagnostic(region.temperatureRise, "°C")}
                </span>
              </div>

              <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 rounded-full transition-all ${getTempBgColor(region.temperatureRise)}`}
                  style={{ width: `${barWidth}%`, opacity: 0.7 }}
                />
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span data-testid={`text-region-reduction-${region.region}`}>Reduction: {displayDiagnostic(region.reductionRate, "%/yr")}</span>
                <span data-testid={`text-region-intensity-${region.region}`}>Carbon Intensity: {displayDiagnostic(region.carbonIntensity)} — {region.carbonIntensityBasis ?? "Basis not returned"}</span>
                <span title={FIXED_5GT_DESCRIPTOR.description} data-testid={`text-region-netzero-${region.region}`}>{FIXED_5GT_DESCRIPTOR.label}: {region.netZeroYear === undefined ? "Unavailable — not returned" : region.netZeroYear === null ? "Not reached by 2100" : region.netZeroYear}</span>
              </div>
              {![region.temperatureRise, region.reductionRate, region.carbonIntensity].every(value => typeof value === "number" && Number.isFinite(value)) &&
                <p role="status" className="text-xs text-muted-foreground">This region has missing or invalid diagnostic inputs. Unavailable fields are not substituted.</p>}
              <ThresholdDiagnosticDetails diagnostic={region.thresholdDiagnostic} contextLabel={`${region.regionName} intensity — global counterfactual`} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

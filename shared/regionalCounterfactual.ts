import { FIXED_5GT_DESCRIPTOR, residualQuantityExportNotes } from "./quantityDescriptors";
import type { ExportFieldBinding } from "./outputFieldSemantics";

/** Presentation only: compatibility API keys are not scientific claim names. */
export const REGIONAL_COUNTERFACTUAL = Object.freeze({
  title: "Global intensity counterfactual",
  question: "What if the world followed each region's carbon intensity?",
  claim: "Legacy global intensity counterfactual; not a regional temperature forecast",
  description: "One selected regional carbon-intensity value replaces the global model's intensity input; it is not an observed regional emissions allocation, regional temperature, inventory or regional intensity pathway. All other legacy global assumptions remain in place. Unsupported conditional diagnostic, not a calibrated forecast.",
  source: "OWID co2_per_gdp uses GDP in international dollars (PPP). Static fallback values are legacy nominal-dollar assumptions, not observations; they are not interchangeable with PPP. The response does not supply an observation year.",
  warmingLabel: "Legacy global counterfactual warming (°C)",
  reductionLabel: "Reduction Rate (%/yr)",
  intensityLabel: "Carbon Intensity (kg/$GDP)",
  unavailable: "Global intensity counterfactual unavailable for the selected inputs. No diagnostic values are substituted.",
  milestoneDefinition: FIXED_5GT_DESCRIPTOR.description,
});

export interface RegionalCounterfactualRowInput {
  regionName: string;
  temperatureRise?: number | null;
  reductionRate?: number | null;
  carbonIntensity?: number | null;
  carbonIntensityBasis?: string | null;
  netZeroYear?: number | null;
  milestoneDefinition?: string | null;
  claim?: string | null;
}

// Keep the finite existing column order and identity projection. Do not fill
// missing data with zeros, thresholds, current inputs or a scientific claim.
export function regionalCounterfactualRows(regions: RegionalCounterfactualRowInput[]) {
  return regions.map(r => ({
    Region: r.regionName,
    [REGIONAL_COUNTERFACTUAL.warmingLabel]: r.temperatureRise,
    [REGIONAL_COUNTERFACTUAL.reductionLabel]: r.reductionRate,
    [REGIONAL_COUNTERFACTUAL.intensityLabel]: r.carbonIntensity,
    "Intensity basis": r.carbonIntensityBasis,
    [FIXED_5GT_DESCRIPTOR.label]: r.netZeroYear,
    "Milestone definition": r.milestoneDefinition,
    Claim: r.claim,
  }));
}

export const regionalCounterfactualBindings: Record<string, ExportFieldBinding> = {
  Region: { id: "regional.regionName", transform: "Identity" },
  [REGIONAL_COUNTERFACTUAL.warmingLabel]: { id: "regional.temperatureRise", transform: "Identity" },
  [REGIONAL_COUNTERFACTUAL.reductionLabel]: { id: "regional.reductionRate", transform: "Identity" },
  [REGIONAL_COUNTERFACTUAL.intensityLabel]: { id: "regional.carbonIntensity", transform: "Identity; read companion basis column" },
  "Intensity basis": { id: "regional.carbonIntensityBasis", transform: "Identity" },
  [FIXED_5GT_DESCRIPTOR.label]: { id: "regional.netZeroYear", transform: "Identity; fixed-5gt-v1; null preserved; not 5% or net zero" },
  "Milestone definition": { id: "regional.milestoneDefinition", transform: "Identity" },
  Claim: { id: "regional.claim", transform: "Identity" },
};

export function regionalCounterfactualExportNotes() {
  return [
    { Field: "Counterfactual", Value: REGIONAL_COUNTERFACTUAL.question },
    { Field: "Claim", Value: REGIONAL_COUNTERFACTUAL.claim },
    { Field: "Scope", Value: REGIONAL_COUNTERFACTUAL.description },
    { Field: "Intensity source and basis", Value: REGIONAL_COUNTERFACTUAL.source },
    ...residualQuantityExportNotes(),
  ];
}

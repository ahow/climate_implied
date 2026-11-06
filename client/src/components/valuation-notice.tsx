import { useLocation } from "wouter";
export function ValuationNotice() {
  const [path] = useLocation();
  if (!["/climate-valuation", "/decarb-signal", "/decarb-gap"].includes(path)) return null;
  return <aside role="note" className="mx-6 mt-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
    <strong className="text-foreground">Valuation interpretation:</strong> Growth differences, carbon prices and
    temperatures inferred from valuations are illustrative heuristics, not measured decarbonisation,
    causal carbon prices or validated physical forecasts. Workbook currency compatibility is unverified.
    Annualised target comparisons are unavailable where target base years and comparable boundaries are absent;
    no 2024 base year is assumed. Raw source data is retained.
  </aside>;
}

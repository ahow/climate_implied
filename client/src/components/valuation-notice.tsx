import { useLocation } from "wouter";
export function ValuationNotice() {
  const [path] = useLocation();
  if (!["/climate-valuation", "/decarb-signal", "/decarb-gap"].includes(path)) return null;
  return <aside role="note" className="mx-6 mt-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
    <strong className="text-foreground">Valuation interpretation:</strong> Valuation-derived temperature,
    carbon-price and net-zero outputs are withheld: no defensible valuation-to-activity mapping is established.
    Gordon steady-state earnings-growth baselines and peer-relative earnings-yield gaps are descriptive
    valuation diagnostics, not decarbonisation rates or market climate expectations. Gordon growth is not
    five-year reverse-DCF growth. Intensity is emissions per market cap, not per revenue.
    Workbook currency compatibility is unverified.
    Retrospective portfolio results are research diagnostics, not validated investment evidence.
    Annualised target comparisons are unavailable where target base years and comparable boundaries are absent;
    no 2024 base year is assumed. Raw source data is retained.
  </aside>;
}

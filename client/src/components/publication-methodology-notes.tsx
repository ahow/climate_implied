import { Card } from "@/components/ui/card";

const scenarios = [
  ["Technology", "Renewable capacity = 5,000 GW; EV sales share = 50%"],
  ["Policy", "Coverage = 100%; implementation = 1.0"],
  ["Corporate", "Target coverage = 80%; implementation = 1.0"],
  ["Socioeconomic", "Carbon intensity ×0.85; policy coverage ×1.3; policy implementation ×1.3; corporate implementation ×1.2"],
  ["Financial flows", "Clean investment ×2.5; fossil investment ×0.3; green bonds ×3"],
  ["Emissions outcomes", "Fossil CO₂ ×0.85; atmospheric CO₂ growth = 1.5 ppm/year"],
];

export function PublicationMethodologyNotes() {
  return (
    <Card className="p-5 mb-8 space-y-5" data-testid="publication-methodology-notes">
      <section>
        <h2 className="text-lg font-semibold mb-2">Interpretation and API contract</h2>
        <p className="text-sm text-muted-foreground">
          These outputs are exploratory. Emissions accounting, temperature conversion and the mapping from
          valuation spreads to physical decarbonisation remain subject to validation. Historical projections
          are retrospective reconstructions using current methodology and revised inputs, not archived forecasts
          made with information available at the time.
        </p>
      </section>
      <section className="space-y-2 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground">Backtest requests and units</h3>
        <p><code>trackingError=2</code> means 2% annualised TE; <code>trackingError=0.02</code> means 0.02%.
          Default: 2; accepted range: greater than 0 and at most 20 percentage points. Optional <code>trackingErrorUnit=percent</code> makes units explicit.</p>
        <p>Default response: <code>{"{series, summary}"}</code>. Summary includes target and full-period realised TE
          in percentage points, calibrated tilt, calibration dates and status. Series TE uses decimal units and an expanding
          window. Legacy array clients can request <code>format=series</code>.</p>
        <p>Carbon intensity, SDG and ambition support pooled <code>method=absolute</code> only (the default).
          Decarb Gap supports absolute, sector-relative (default), sub-sector-relative and industry-relative methods.
          Unsupported combinations return an error rather than silently ignoring the method.</p>
        <p className="break-all font-mono text-xs">/api/cv/backtest?signal=carbon_intensity&amp;method=absolute&amp;trackingError=2&amp;trackingErrorUnit=percent</p>
        <p className="break-all font-mono text-xs">/api/cv/backtest?signal=decarb_gap&amp;method=sector_relative&amp;trackingError=2</p>
        <p>The former “Valuation-Aware” line is Decarb Gap; there is no separate strategy parameter.
          Fixed-score backtests are retrospective; quarter-lagged Decarb Gap data are not verified publication-date vintages.
          Calibration uses the full sample and returns exclude transaction costs.</p>
      </section>
      <section className="space-y-2 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground">Carbon prices and cost of equity</h3>
        <p>First request <code>/api/cv/uploads</code> and select the numeric ID of a completed upload.
          Both <code>uploadId</code> and <code>method</code> (absolute or sector_relative) are required for carbon prices.</p>
        <p className="break-all font-mono text-xs">/api/cv/carbon-price?uploadId=&lt;completed-id&gt;&amp;method=sector_relative&amp;inferenceMethod=carbon_intensity</p>
        <p>An upload ID is a cache namespace, not an immutable dataset snapshot. Cache misses use current shared data.
          Reproduction requires retaining inputs, outputs and code versions; fixed random seeds are not sufficient.</p>
        <p><code>costOfEquity</code> is supported on SDG growth, decarb terciles and decarb-gap summary/timeseries:
          default 0.08, greater than 0 and at most 1. A common rate cancels in growth differences, so 7%, 8% and 9%
          change absolute growth but not differential-based rates or temperatures. Carbon prices and gap backtests
          use fixed 8%. Decarb bands select the highest-P/E target band and do not use cost of equity.</p>
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">Illustrative category scenarios: exact shocks</h3>
        <p className="text-sm text-muted-foreground">Only the listed starting inputs change. The full model then evolves;
          other categories are not frozen. Shocks do not represent comparable effort, probabilities or category contributions.</p>
        <dl className="text-sm space-y-2">
          {scenarios.map(([name, shock]) => <div key={name}><dt className="font-medium">{name}</dt><dd className="text-muted-foreground">{shock}</dd></div>)}
        </dl>
        <p className="text-sm text-muted-foreground">Socioeconomic multipliers are not capped in the current scenario function.
          The standalone categories endpoint starts from 2024 indicators; the main projection's category option uses the latest nowcast.
          These paths are not interchangeable. Baseline alignment remains pending model remediation.</p>
      </section>
    </Card>
  );
}

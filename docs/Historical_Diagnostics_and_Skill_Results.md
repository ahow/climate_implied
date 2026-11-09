# Historical calculation repairs and short-horizon emissions diagnostic

## Implemented repairs

The overall historical diagnostic previously computed its carbon-intensity
decline input from the whole resolved series, including years after each
historical origin. It now restricts that fit to observations through the
origin. The category historical diagnostic uses the same origin-specific
method instead of its separate hardcoded 2.5% rate.

This removes one source of look-ahead, not all historical-vintage limitations.
Observations remain revised history; historical approvals are not necessarily
the values actually available at the time. The existing legacy 2% fallback
for fewer than two intensity observations is retained, including the first
curated year, and is not presented as an estimated historical rate.

Both historical paths now share annualised ten-year emissions CAGR for the
reduction-rate diagnostic. The overall path previously used a linear percentage
change scaled by ten, which was not annual CAGR. Missing/nonfinite trajectory
values fail explicitly instead of substituting 60 or 55.

Both paths now return null when the median trajectory does not reach the
legacy 5 Gt reporting threshold by the simulated horizon. They no longer
extrapolate an unsupported threshold date beyond 2100. The API's legacy
`netZeroYear` name remains for compatibility; this threshold is not physical
net zero or a member-level event distribution.

These changes affect opt-in legacy historical diagnostics, not the default
published-reference headline or the unpromoted native-gas candidate.
No collection, approval or refresh procedure changed.
The calculation identity is advanced to `historical-diagnostics-6` so newly
computed results are not represented as the previous calculation version.

## Actual short-horizon experiment

Ran the [fixed protocol](Short_Horizon_Emissions_Protocol.md) against the existing
curated 2010–2025 fossil CO2 series. Eight common annual origins (2015–2022),
six training observations per origin, three horizons and no future observations
in each fit. This is 24 origin/horizon predictions.

Mean absolute error, Gt fossil CO2/year:

| Horizon | Log-trend candidate | Persistence | Linear trend | Diagnostic gate |
|---|---:|---:|---:|---|
| 1 year | 0.9063 | 0.9875 | 0.9000 | Failed |
| 2 years | 1.2705 | 1.5000 | 1.2430 | Failed |
| 3 years | 1.1531 | 1.3625 | 1.1231 | Failed |

The candidate beats persistence by point MAE, but not linear trend at any
horizon. All six paired improvement intervals include zero. No horizon passes
the prespecified gate; no model is promoted. A failed candidate is retained as
a research result, not tuned until it passes.

Source content SHA-256:
`77adcac740b9f9b50f3b2be9a87bd67a92f4d35e797f81db978de89c903ef652`.
Private evidence is content-addressed under
`generated-artifacts/short-horizon-emissions/` and includes the exact observations,
protocol hash, all predictions, metrics and intervals.

Reproduce with `npx tsx script/short-horizon-emissions.ts`.

## Limits and unfinished scope

The curated series' original publication vintages and scope consistency have
not been independently certified. This evaluates a simple fossil-CO2 trend,
not the dashboard's aggregate-GHG model or 2100 warming. It is annual, not
quarterly. Eight overlapping origins give limited statistical precision.

Stage 9 remains partial: actual vintage-correct quarterly reconstructions
and a completed physical model's short-horizon evaluation are still missing.
The wider outstanding register remains
[Valuation and research completion status](Valuation_and_Research_Completion_Status.md).
Other calibrated drivers, the full emissions/climate ensemble, empirical
company/valuation/signal/portfolio work, historical-mode integration and
independent acceptance are not completed by this experiment.

## Verification

173 TypeScript tests and 32 Python tests passed; all 18 existing stage check
groups (including available data checks), type checking and the production
build passed. Passing checks do not imply stage acceptance.
Both affected development routes returned 17 historical/nowcast rows. All
returned category threshold dates were null or within the simulated horizon.
The overall route's 2026 diagnostic returned a 2.5025% annual reduction rate
and a null threshold year; this is a legacy diagnostic, not an accepted forecast.

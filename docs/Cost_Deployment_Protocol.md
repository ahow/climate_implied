# Fixed cost-versus-deployment diagnostic

Fit log cost against log cumulative deployment on 2010–2018. Evaluate 2019–2024
conditional on **observed** deployment, against 2018 cost persistence and an
exponential calendar-time cost trend trained over the same years. Report MAE
in source cost units and apparent cost decline per doubling, `1 - 2^slope`.
This coefficient is an association, not an identified causal learning rate.

Require all nine positive, finite training cost/deployment pairs and all six
holdout pairs. Never reduce the evaluation window to obtain a result. Training
fits may be reported when holdout coverage is incomplete, but no performance
gate can pass. Duplicate years and nonpositive/nonfinite supplied values fail.
Exclude 2025. Use 1,000 length-three circular residual block bootstraps, seed
20261109, for coefficient uncertainty; these do not include source or future
deployment uncertainty. No automatic scientific promotion follows any score.

Sources are frozen by hash, with metadata and protocol hashes retained:

- Solar: OWID solar-pv-prices-vs-cumulative-capacity. Cost is constant 2025 USD/W
  for module prices, not installed-system cost. Deployment is global installed
  MW, not manufactured output. Prices from 2010 are European benchmarks; the
  series changes from thin-film to an index around 2013, then to mainstream
  modules in 2020. The holdout crosses a known source-definition discontinuity.
- Battery: OWID battery-price-vs-cumulative-production. Constant 2024 USD/kWh
  cell prices, not battery-pack prices; cumulative output is GWh across multiple
  applications, not just EVs or stationary storage. The 2024 production value is
  absent, so the specified full evaluation cannot be completed from this source.

Source schemas and coverage were inspected before this specification. This is
not an externally preregistered or blinded study. The diagnostic deliberately
reports source incompatibility rather than silently replacing the series.
No company margins, price forecasts, emissions or dashboard defaults are changed.

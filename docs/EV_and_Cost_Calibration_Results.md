# EV and cost/deployment calibration results

These are actual frozen-source diagnostic studies, not synthetic fixtures or
approved central-model parameters. Neither study changes the dashboard's
headline, live input approval process or existing data collection.

## EV sales-share diagnostic

[Protocol and fixed choices](EV_Calibration_Protocol.md).
[OWID/IEA source](https://ourworldindata.org/grapher/electric-car-sales-share).
BEV plus PHEV sales share is not fleet share or zero-emission mileage.

Nine training years (2010–2018), six holdout years (2019–2024); 2025 excluded.
Errors below are mean absolute errors in percentage points:

| Entity | Logistic trend | Persistence | Linear trend | Diagnostic gate |
|---|---:|---:|---:|---|
| World | 12.0827 | 9.3333 | 9.0849 | Failed |
| China | 25.7559 | 18.9167 | 18.7552 | Failed |
| India | 0.9961 | 0.9977 | 1.0000 | Passed, very small improvement |
| United States | 12.1321 | 3.8500 | 3.5499 | Failed |
| European Union (27) | 9.7794 | 13.9167 | 13.3276 | Failed uncertainty criterion |
| Rest of World | Unavailable | Unavailable | Unavailable | Missing 2013, 2015, 2019, 2022 |

EU paired improvement intervals cross zero: −5.73 to 12.38 points versus
persistence and −6.63 to 11.93 versus linear trend. Its lower average error is
not sufficient for the diagnostic gate.

India's mean improvement is only 0.00159 points versus persistence and 0.00392
versus linear trend. The block-bootstrap intervals exclude zero, but six
holdout years, rounded inputs, limited structural stability and no
multiple-testing adjustment make scientific promotion unjustified. The code
keeps `centralModelEligible: false` even when the diagnostic gate passes.

The chart cites Global EV Outlook 2026, whereas the column metadata citation
says 2025. Both are retained as an unresolved source-metadata discrepancy.
The study uses a hash-frozen revised-history extract, not an asserted original
publication vintage.

CSV SHA-256:
`45969bb5f9a809c45792d8986f53023754d0fa141e74c7e24ad9af6ad041059b`.
Result content hash:
`73fc45f20b51fbe58f4f873607df6faac24c53b15d45628d178baf2ab018c53a`.

## Cost versus deployment

[Protocol, units and limitations](Cost_Deployment_Protocol.md).

| Technology | Apparent decline per doubling | Parameter interval | Full holdout |
|---|---:|---:|---|
| Solar modules | 36.47% | 29.83%–41.41% | Available, definition break flagged |
| Battery cells | 39.07% | 31.52%–46.16% | Unavailable: 2024 production missing |

These are cost/deployment associations, **not causally identified learning
rates**. Intervals reflect the specified training-residual bootstrap, not
structural/source uncertainty.

Solar conditional holdout MAE is **0.05199 constant-2025 USD/W**, versus 0.19074
for persistence and 0.08222 for a calendar-time exponential trend. The
cost/deployment fit uses observed future capacity; this is not a genuine
ex-ante cost forecast. The source changes price definitions around 2013 and
2020, and combines European price benchmarks with global installed capacity.
Lower error cannot resolve those comparability issues.

Battery training fits are available, but the specified six-year holdout cannot
be completed without 2024 cumulative production. The script does not shorten
the window or invent output. Cell prices also cannot be substituted for pack
prices or installed stationary-storage costs.

Sources:
- https://ourworldindata.org/grapher/solar-pv-prices-vs-cumulative-capacity
- https://ourworldindata.org/grapher/battery-price-vs-cumulative-production

Result content hash:
`fdac89277193d6f5f88ef02910ae6efed064051e66b07ba91e6913a4aa574425`.
Individual source CSV hashes and metadata hashes are retained in that result.

## Reproduction

Store the three named Grapher CSV files and their matching `.metadata.json`
files under generated-artifacts/driver-calibration. The fixed hashes are checked
before fitting. Source extracts and full parameter draws remain out of GitHub.

```
uv run python script/ev_sales_calibration.py
uv run python script/cost_deployment_calibration.py
```

Tests cover exact known curves, future-year exclusion, repeatability,
non-promotion, invalid/duplicate values and missing-window refusal. Both studies
are included in the opt-in workplan data checks.

Verification completed: 179 TypeScript tests and 44 Python tests passed, along
with type checking, the production build, and all 18 existing stage check groups.
The scientific failures and unavailable evaluations above are retained as results;
passing software tests does not turn them into accepted models.

## What remains

No central-model promotion follows these studies. Fleet turnover, BEV/PHEV
usage, charging demand, heat pumps, storage deployment, policy delivery and
joint driver uncertainty still require compatible data and implementation.
Battery evaluation needs the missing production observation; solar needs
compatible price definitions or an explicitly validated source-break treatment.
The full calibrated regional ensemble and downstream policy attribution remain
unfinished. Existing engineering for snapshots, company/valuation studies,
portfolio tests, interface integration and operational acceptance is not
completed by these diagnostic results.

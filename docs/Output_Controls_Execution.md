# Output controls and full-stage regression — 9 November 2026

## Implemented

All 20 spreadsheet controls now require an explicit evidence class:
legacy diagnostic, source indicators, descriptive valuation, retrospective
backtest or descriptive news. Each workbook includes an Interpretation sheet.
The sheet retains warnings about unsupported forecasts, non-net-zero residual
thresholds, regional counterfactuals, mismatched growth definitions, vintage
limitations and missingness as appropriate. Export failures now display an
accessible error instead of only logging to the console.

The data worksheet is unchanged. Export timestamps are explicitly not source
publication dates. These view exports are not represented as immutable runs.

The [system output register](System_Output_Register.md) is generated from
source registrations, frontend API references and download controls. Its
coverage boundary is explicit; it is not a complete field-level semantic
audit. CI rejects stale inventories and unclassified downloads.

## Verification

`uv run python script/run-workplan.py --data-checks --timeout 180`
executed all 18 existing stage groups. Every group passed, including the
available actual-data checks for calibration, vintage audit and financial
coverage. The runner exited **2**, intentionally signalling that implementation
acceptance remains incomplete; this is not an execution failure.

Additional export checks verify all 20 controls have valid evidence contracts,
check for alternate client writers bypassing the shared control, round-trip
all five contract types through XLSX serialization, and retain zero versus
missing values. The source census consistency check passed.

Full TypeScript regression: **155 passed**. Python discovery: **26 passed**.
Type checking and the production build passed. The restarted preview served
the signal page without browser errors; spreadsheet contents were verified
through serialization tests, not an interactive browser download.

## Meaning of the stage results

| Stage | Check result | Remaining acceptance |
|---|---|---|
| 0 Safety | Passed | Production recovery and deliberate failed-commit deployment-gate rehearsal |
| 1 Outputs | Passed | Field-level legacy/API interpretation review beyond the source census |
| 2 Reproducibility | Passed | Complete overlay/run coverage, production archive provisioning, historical recalculation |
| 3 Evidence | Passed | Complete uncertainty, licensing and vintage evidence |
| 4 Calibration | Passed | Remaining driver fits and predictive/structural-break validation |
| 5 Emissions | Passed | Calibrated parameter bundle and actual 10,000-member ensemble/convergence |
| 6 References | Passed | Complete compatible native-gas commitments coverage and infill sensitivity |
| 7 Climate | Passed | Independent reference, historical forcing reconciliation and production coupling |
| 8 Attribution | Passed | Actual coupled member/coalition attribution, not only exact accounting utilities |
| 9 Skill | Passed | Audited past-input evaluations and horizon-specific empirical skill |
| 10 Companies | Passed | Independent identity approvals, lifecycle/FX and fundamentals coverage |
| 11 Valuation | Passed | Actual common-sample D8 comparison and financial-sector model |
| 12 Projections | Passed | Sourced company mappings and three actual worked companies |
| 13 Identification | Passed | Defensible mappings and separately evidenced identification argument |
| 14 Signal | Passed | Actual new paired-gap history and full-family empirical evaluation |
| 15 Portfolios | Passed | New-gap portfolios with lifecycle, borrow, FX and cost sensitivities |
| 16 Integration | Passed | Full historical selection and accepted analytical-stage integration |
| 17 Acceptance | Passed | Full-model clean reproduction and independent review |

These are engineering/check results, not scientific acceptance. Independent
review, unavailable original vintages and managed production provisioning are
external dependencies. The remaining implementation is **not** blocked by a
missing token or another routine user approval.

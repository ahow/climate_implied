# D8 paired valuation comparison protocol

This fixes the comparison before any real-data D8 scoring. It does not claim
that historical prediction inputs or validation signals have been assembled.

## Common definitions and primary endpoints

The primary forecast outcome is completed three-year annualised cash-flow
growth, on one explicitly selected FCFE or FCFF basis. Earnings and revenue
are not substitutes. For FCFE, use OCF minus positive capital expenditure plus
net borrowing; provider capex sign must be explicitly reconciled. Non-positive
starting or ending cash flow does not define a real-valued CAGR and is excluded
with a reason, not winsorised or silently set to zero.

The Gordon comparator is the separately labelled conditional three-year
cash-flow path obtained by extending its implied constant growth. Its
steady-state economic meaning is not equated with a five-year DCF parameter.
Both models' actual first-three-year cash-flow paths must be converted to
three-year CAGR before scoring. Same origin, company, cash-flow basis,
nominal currency and endpoint are required. The cash-flow forecast endpoint
must not use future financial statements.

For validation signal IC, supply the two matched model-specific signals and
the same validation return. Signal construction, return horizon, controls and
publication availability must be documented in the input manifest; this
numerical evaluator does not construct them or verify their economic meaning.

## Frozen numerical choices

- At least ten common companies at every annual origin and at least six
  consecutive annual origins; smaller samples report unavailable.
- Complete cases are shared by both models and both endpoints. Coverage
  exclusions remain explicit. No model-specific samples.
- Primary loss is absolute error in three-year cash-flow CAGR, averaged
  within each origin and then equally across origins.
- IC is cross-sectional Spearman correlation, with average ranks for ties,
  calculated per origin and averaged equally. Constant ranks are unidentified.
- Paired circular blocks of three consecutive annual origins, 2,000
  replications, seed 20261110. All companies on each date remain together;
  the same blocks score both endpoints. This accounts for some overlapping
  three-year outcomes, not arbitrary long-memory or regime dependence.
- Percentile 95% intervals. DCF must improve both primary forecast MAE and
  signal IC with both lower bounds strictly above zero.
- Reject duplicate company/origins, nonfinite values, premature outcomes,
  missing annual origins and mixed FCFE/FCFF models.

A numerical pass is only a candidate for review, never automatic promotion.
These minimum sample thresholds are engineering eligibility floors, not a
power calculation or proof of adequate inferential precision.

## Reproduction

`npx tsx script/compare-valuation-models.ts input.json`

The input has evidenceMode, evaluationAsOf and rows matching
`server/calculation/valuationComparison.ts`. The CLI binds this file's hash
and the frozen numerical choices, refusing caller overrides. Output is
content-addressed under generated-artifacts, not committed source data.

Revised-history results must remain labelled retrospective. A supplied
point-in-time label is not proof of source vintages. Independent checks of
identities, dates, source availability, actual valuation histories and
economic definitions are still required.

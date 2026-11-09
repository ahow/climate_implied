# Member analysis and currency execution

This is a partial execution report, not completion of the 18-stage workplan.
The tests were committed before implementation. No scientific promotion
threshold was changed. No new company identity was approved.

## Stages 5 and 7 — convergence and reproducible metrics: partial

The saved-member tooling now compares a nested 5,000-member set with all
10,000 members. Member IDs are sorted before selecting the nested sample;
simulation IDs must be assigned before sampling, never by ranking outcomes.
Reordering the input does not change the analysis or its content identity.

The check evaluates P10, median and P90 for 2100 warming and 2050/2100 GHG
emissions. Temperature differences must be strictly below 0.01°C.
The emissions tolerance must be supplied explicitly and frozen in the study
protocol before examining results; no empirical tolerance is invented here.

Durable CO2 and GHG net-zero dates are checked separately. Unconditional
event quantiles retain never-reaching members in the denominator. A jointly
censored quantile remains null; it is not represented as a crossing in 2100
or a measured zero-year difference. A censoring mismatch fails. Observed
quantile differences must be below one year, and the never-reaching share
must change by less than one percentage point.

**Tests:** a synthetic 10,000-member fixture passes; shifting the second
half's warming fails. Missing members, duplicate IDs and a zero emissions
tolerance are rejected. A separate fixture verifies complete member metrics
and hashes are invariant to paired-array reordering.

**Before/after:** no production climate headline changed. This is a diagnostic
calculation on supplied members, not a newly calibrated emissions ensemble.
Actual 10,000-member physical-model convergence remains untested because that
ensemble has not been implemented and generated. This is unfinished
engineering and calibration, not a credentials blocker.

## Stage 8 — exact member-level attribution: partial

Exact Shapley attribution now accepts all coalition outputs for up to eight
driver groups and 10,000 paired members. It requires a declared manifest,
baseline, target and physical unit. Baseline and full-model coalitions are
mandatory. Duplicate coalitions, missing coalitions, inconsistent dimensions,
duplicate identities and non-finite values are rejected.

Each member's contributions must reconcile to its total change within
0.001 native units (0.001°C for temperature). Groups and member IDs are
canonicalised. There is no permutation approximation, so sampling
approximation error is zero; this does not mean model uncertainty is zero.

**Tests:** an interacting two-driver model splits interaction effects equally:
contributions [3, 4] for a total change of 7, and [6, 8] for 14 in the second
member. Maximum reconciliation residual is zero. Coalition/group reordering
returns identical output. Negative input tests pass.

**Evidence state:** Bounded/conditional estimate. **Claim:** contribution
within the model and chosen baseline, not causal attribution.

**Remaining:** producing all physically consistent regional/member coalition
runs, real-data attribution and regional drilldowns. The calculator does not
pretend submitted coalition values are independently verified climate runs.

## Stage 10 — minor-unit currencies: partial

Identity review now accepts GBp, ZAc and ILA. Explicit unit normalization maps
these to GBP, ZAR and ILS with a factor of 0.01. Original value, native unit
and factor remain attached. Case is significant: GBP is not GBp.

Statement history compares its major currency to the quote's major currency.
It never rescales cash-flow statements merely because a price is in pence.
Snapshot review requires an explicit market-cap currency for minor-unit
quotes: market capitalisation cannot silently inherit the quote price scale.
The P/E calculation uses normalized market cap and the compatible statement
currency. Real FX conversion remains unavailable without dated FX evidence.

**Tests:** all three minor-unit conversions pass; missing, non-finite and
incorrect-case values fail. A GBp quote paired with GBP statements preserves
FCFE of 85. An explicitly GBP-denominated market cap of 1,000 and earnings
of 100 yields P/E 10, while the price of 1,200 GBp becomes £12. Missing cap
denomination and USD/GBP mismatches are rejected.

**Remaining:** independent identity review, dated FX, issuer coverage,
fundamentals expansion and live minor-unit provider evidence. No coverage
increase is claimed from synthetic currency fixtures.

## Reproduction

```sh
npx tsx --test script/ensemble-convergence.test.ts script/member-metrics.test.ts \
  script/member-attribution.test.ts script/minor-currencies.test.ts

# Requires actual saved coalition inputs, not an illustrative fallback:
npx tsx script/analyze-saved-members.ts attribution input.json output.json

# Requires 10,000 saved simulation members and an explicit protocol tolerance:
npx tsx script/analyze-saved-members.ts convergence input.json output.json

# Full annual 2024–2100 member bundle. Optional second argument is the
# predeclared emissions tolerance in GtCO2e, enabling convergence:
npx tsx script/summarize-member-ensemble.ts member-bundle.json 0.1
```

The 0.1 command argument illustrates syntax, not an adopted empirical threshold.
The attribution operation is also available through the existing bounded
`POST /api/calculation/research-contracts` interface as `member-attribution`.
Large production bundles should use the offline command rather than raising
public request-size limits. Result files retain content hashes and claim labels.

## Release and limitations

Local release verification: **145 TypeScript tests and 24 Python tests passed**;
TypeScript checking and production build passed. These counts describe software
regression checks, not scientific acceptance of the unfinished workplan.

## Stages 1 and 16 — legacy regional consumer correction: partial

The optional regional comparison and its download now say **Global intensity
counterfactual**, not Regional Projections. Its warming value is explicitly a
legacy global result, not standalone regional warming. The positive residual
threshold is labelled **Legacy 5 Gt milestone**, not net zero; extrapolation
beyond 2100 remains disclosed. The API returns the same claim and milestone
definition, and exports include them.

Intensity metadata distinguishes OWID international-dollar GDP (PPP) from the
legacy nominal-dollar static assumption. These bases must not be silently
treated as comparable. No numerical model was changed or promoted. This
preserves the named legacy comparator; replacement with the new regional
accounts remains unfinished.

A committed source regression checks the UI/export labels and metadata.

The existing monthly collection/review/approval process is unchanged.
Raw inputs and generated bundles are excluded from the source export.
The live headline remains the published-reference view, not these diagnostics.
Actual per-stage effort was not instrumented and is not represented as measured.
See the remaining-workplan record for the broader unfinished stages.

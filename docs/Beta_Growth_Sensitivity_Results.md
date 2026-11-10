# Frozen beta growth sensitivity — 10 November 2026

Applied protocol 73095d6 and unchanged retained rates
cb928aace43911cad97897d1cbcc5a10e4e7d5b65a1327829f78ad305539d1a4.
No refitting, tuning, return scoring or D8 reselection. Common-8% files remain
unchanged. Today's requested outcome comparison uses the existing three-origin
circular bootstrap, 2,000 draws, seed 20261110 and paired percentile intervals.

Exactly 88 pairs remain: 14/12/15/18/13/16 across 2017–2022. Filing selections,
outcome availability, actual cash-flow growth and validation returns are asserted
equal before comparisons. Original 2026-11-09 evaluation cutoff retained.

| Model | Mean absolute implied-growth change | Outcome MAE improvement vs common 8% | 95% interval |
|---|---:|---:|---:|
| Gordon | 0.6890 percentage points | -0.2137 pp | [-0.3881, -0.0392] pp |
| Reverse DCF | 1.9557 percentage points | -0.3734 pp | [-0.8777, +0.1308] pp |

Negative improvement means worse forecasting error. Gordon worsened under this
sensitivity; reverse DCF's change is inconclusive. This is not the D8 comparison
between models and is not Stage 14. Gordon remains primary.

Files/functions: server/financialData/asOfValuation.ts:buildAsOfRows optional
explicit per-origin rates (missing rates never fall back); script/compare-beta-growth.ts
hash-verifies frozen rates/source set and asserts unchanged outcomes; tests in
script/asof-valuation.test.ts cover rate effects and outcome/filing isolation.

Private result:
generated-artifacts/company-beta/growth-b4f7f4b28405d3d3c46fb57fed9ecfab4a8c4c76a2f76365e8c6621e99a09d98.json.
Narrow peer proxy, assumed RF/ERP, revised financial history, unapproved
identities and exact-fiscal-date exclusions remain limitations.

# D8 as-of Gordon vs reverse-DCF comparison — results

Executed 2026-11-09 under `AsOf_Valuation_Prediction_Protocol.md` (frozen in
commit b5286ea, amendment A1 in 718b4db, both before any prediction was computed)
and the unchanged `Valuation_Comparison_Protocol.md` gate and decision rule.
**First executed empirical company-valuation study in this workplan.**

## Sample (ex-ante, outcome-blind)

- 11 previously retained candidates plus 16 added by the frozen rule (largest US
  non-financial, non-real-estate issuers by workbook market cap in January 2016,
  after removing already-selected issuers): GOOGL, GE, AMZN, META, T, WMT, VZ,
  PFE, KO, V, DIS, ORCL, MRK, INTC, CMCSA, PM. All 16 passed provider identity
  candidate checks; none replaced. 27 issuers; identities remain unapproved.
- 138 company-origins built, 88 complete. Complete rows by origin (July 31):
  2017: 14, 2018: 12, 2019: 15, 2020: 18, 2021: 13, 2022: 16. The unchanged
  eligibility gate (≥10 per origin, ≥6 consecutive) was therefore met.
- Exclusions (counted, not repaired): missing exact FY t+1/t+4 endpoint 25;
  workbook/provider profit ratio outside ×0.5–2 (gross unit/boundary screen) 20;
  non-positive outcome FCFE 16; DCF unavailable for non-positive base FCFE 9;
  Gordon unavailable for non-positive earnings 9; no statement filed before the
  origin 4; outcome filed before origin+3 years (D8 maturity rule; MSFT files in
  late July) 4. The maturity exclusion was added after the comparison CLI refused
  those rows — the gate itself was not changed.

## Results (revised history; 2,000 paired circular-block replications, seed 20261110)

| Metric | Value | 95% interval |
|---|---:|---|
| Forecast MAE improvement of DCF over Gordon (3-yr FCFE CAGR) | −0.92 pp | [−1.09, −0.70] pp |
| Signal IC improvement of DCF over Gordon (12-month return) | +0.048 | [−0.183, +0.279] |
| Numerical gate (both lower bounds > 0) | **fail** | |

Per origin, Gordon MAE was lower than DCF MAE at all six origins
(e.g. 2017: 12.8% vs 13.5%; 2020: 15.6% vs 16.7%). IC was unstable for both
(Gordon −0.03 to 0.20; DCF −0.21 to 0.42). Absolute errors of 13–25 percentage
points show neither model forecasts three-year cash-flow growth precisely.

## Scientific decision

- **Negative result for reverse DCF:** it did not improve on Gordon; Gordon's
  forecast error was significantly lower under this protocol. The reverse DCF is
  NOT promoted. The Gordon measure remains the application's primary measure.
- Signal comparison is **inconclusive**, and uses each model's implied growth as a
  proxy signal, not the Stage 14 new-gap signal, so S11-034 is not satisfied.
- Limitations: revised-history provider statements (not as-first-reported);
  common 8% cost of equity (company-specific beta variant not run); large-cap US
  convenience universe; exact fiscal-date rule excludes 52/53-week years;
  overlapping horizons handled only by three-origin blocks; identities unapproved.

## Reproduction

```
npx tsx script/collect-company-worked-inputs.ts --manifest <private manifest>
npx tsx script/build-asof-valuation-rows.ts generated-artifacts/company-worked-inputs/*.json
npx tsx script/compare-valuation-models.ts generated-artifacts/valuation-comparison/asof-input-808e0c6b….json
```

Result `generated-artifacts/valuation-comparison/6969aece…b3f835a9.json`;
audit `asof-audit-3df0abd9….json`. Private, not committed (provider data).
Code: `server/financialData/asOfValuation.ts:buildAsOfRows`, tests
`script/asof-valuation.test.ts` (3 pass).

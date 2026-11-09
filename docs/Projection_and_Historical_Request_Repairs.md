# Projection consistency and historical-request repairs

## Scope and completion boundary

This increment addresses remaining calculation-consumer inconsistencies in
Stages 1, 2, 7 and 16. It does **not** complete those stages or the workplan.
No scientific model or source observation was promoted.

## Implemented

1. Main projections, category projections, regional counterfactuals and the
   valuation diagnostic's internal projected-rate calculation now share the
   validated trajectory-metrics routine already used by historical diagnostics.
2. Removed linear extrapolation of the positive 5 Gt residual threshold beyond
   the simulated horizon. A missing crossing returns null, not a manufactured
   future year. This threshold remains explicitly **not physical net zero**.
3. Removed 60/55/20 Gt fallback values. Reduction rates and accompanying start,
   decade and end emissions now consistently use the median trajectory.
   At least eleven consecutive valid annual points and positive initial
   emissions are required. Invalid inputs fail rather than fabricate a rate.
4. Changed calculation identity so existing cached results cannot serve the
   superseded metric definitions. Updated gauge, regional, methodology,
   dashboard and export interpretation text.
5. Historical selectors now have an explicit endpoint support contract.
   Workbook selectors apply only to supported company-analysis routes.
   Indicator selectors apply only to supported calculations. Unsupported or
   malformed selectors return 422 before data loading; they cannot silently
   be ignored while the response advertises historical inputs.
6. The legacy regional endpoint rejects historical indicator selection because
   it still uses externally refreshed regional intensity data. This is an
   explicit limitation, not a claim of complete historical regional replay.
7. Input-independent endpoints (published references, archive inventory,
   provider status and similar routes) no longer require approved-indicator
   loading. Their response header states that indicators were not read.
8. Archived workbook summaries no longer query the current upload record.
   Their `latestUpload` remains null; the selected workbook identity supplies
   the historical provenance instead.

## Verification

- 182 TypeScript tests and 47 Python tests passed.
- Type checking and production build passed.
- Actual development main projection: reduction 2.4884828019%/year,
  legacy temperature 2.4011521377°C, residual milestone null.
  These are diagnostic values, not validated forecasts.
- All six category projections and four legacy regional counterfactuals
  returned null residual milestones rather than dates after 2100.
- Unsupported reference, regional and upload-list selectors returned 422.
- Published references returned 200 with `not-read-by-endpoint` input state.
- Existing archived workbook summary returned 200, 2,442 companies and
  `latestUpload: null`.
- Existing category calculations are tested against their own full trajectories,
  not just source-text assertions. Regression checks prevent restoring the
  removed fallback and extrapolation paths.

The first targeted regression caught another fallback in the valuation rate
helper; that code was corrected before the full passing test run.

## Remaining work

Full global historical mode, immutable financial/carbon/SDG overlays, managed
production archive provisioning and migration of every data reader remain
unfinished. Native-gas ensemble calibration, independent physical validation,
new company/valuation research and full acceptance also remain unfinished.
These repairs do not justify removing the current scientific warnings or
replacing published-reference headlines with candidate model outputs.

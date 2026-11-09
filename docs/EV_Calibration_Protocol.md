# Fixed EV sales-share diagnostic

Purpose: evaluate whether a bounded logistic trend improves historical EV
sales-share predictions over simple baselines. This is revised-history research,
not a vintage-correct forecast evaluation or a causal policy model.

## Locked choices before fitting

- Source: OWID electric-car-sales-share, IEA-derived BEV plus PHEV new-car sales
  share, in percent. Convert to fractions for fitting.
- Entities: World, China, India, United States, European Union (27), Rest of World.
  World overlaps the regional series; it is not an independent regional member.
  International transport is not assigned a passenger-car adoption share.
- Complete training window: 2010–2018, nine annual values strictly inside (0,1).
- Holdout: 2019–2024, six annual values. Values in [0,1] are valid.
- 2025 values are excluded from fitting and scoring.
- Missing, duplicate, invalid or zero/unit training shares are not silently
  imputed, clipped or logit-transformed. Incomplete windows are unavailable.
- Candidate: OLS logit share against year since 2010, saturation fixed at 100%.
- Baselines: 2018 persistence and OLS share trend bounded to [0,1].
- Score: mean absolute error in percentage points.
- Parameter uncertainty: 1,000 centred-residual circular block bootstraps of
  length three over the nine training years, seed 20261109. The same sampled
  year indices apply across complete entities. These are parameter intervals,
  not predictive intervals including future shocks.
- Paired error-improvement uncertainty: 1,000 circular block resamples of
  length two over the six holdout years, seed 20261109. Baseline-minus-logistic
  MAE differences use the same resampled years; report 2.5/97.5 percentiles.
- Diagnostic gate: beat both baseline MAEs and have both paired improvement
  intervals strictly above zero. This is not a multiple-testing-adjusted
  scientific acceptance rule and cannot promote any central-model input.
- Stability: separately report 2010–2014 and 2015–2018 logit slopes; not a formal
  structural-break test.

The series and selected page values were inspected before this protocol was
written. It is a fixed analysis specification, not an externally preregistered
or blinded experiment. Choices will not be revised to obtain favourable scores.

## Source and evidence controls

Freeze CSV and metadata using hashes. Preserve the source's chart/column citation
discrepancy, rather than inferring a release from the latest observation year.
Keep raw source extracts private. Record the protocol hash with the report.
No existing collection, manual approval, refresh or headline calculation changes.

Passing this diagnostic does not identify lifetime fleet turnover, BEV/PHEV
electric mileage, displaced fuel, rebound, charging demand, policy causality or
emissions effects. Those require separate calibration and compatible inputs.

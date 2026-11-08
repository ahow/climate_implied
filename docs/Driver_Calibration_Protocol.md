# Frozen driver calibration protocol — 8 November 2026

This protocol is frozen before the new regional electricity study is run.
It does not reuse hardcoded dashboard histories as independently observed data.

- Source: OWID energy dataset; original CSV is retained privately with SHA-256.
  Underlying source attribution and licence must be checked before publishing
  extracts. This study exports aggregate fit metrics only.
- Targets: solar and wind shares of electricity generation, separately.
- Entities: World, United States, China, India, European Union (27).
  Missing entities are reported unavailable, not silently substituted.
- Training: annual 2010–2018; evaluation: 2019–2024, complete years only.
- Model: logistic adoption with saturation fixed at 1 (the physical maximum
  share). Fit logit share against year on training data only. The saturation
  assumption is not an empirically estimated regional ceiling.
- Baselines: last training share (persistence); OLS linear trend in share,
  bounded to [0,1]. No future values enter fitting.
- Primary metric: mean absolute error in percentage points over all six
  evaluation years. No incomplete-window selection.
- Eligibility: at least six training observations strictly between 0 and 1,
  and all six evaluation observations. Otherwise unavailable.
- Acceptance: logistic MAE strictly smaller than both baseline MAEs.
  A failure is sensitivity-only, not a central calibrated input.
- Uncertainty: not quantified in this first fit diagnostic. No central
  eligibility until parameter intervals, structural-break analysis, uncertainty
  dependence and independent source compatibility are implemented.
- Classification: revised-history retrospective evaluation, not original-vintage
  prediction or causal learning-rate estimation.
- No substitution of generation shares for EV sales, heat pumps, storage,
  corporate delivery, finance abatement or policy implementation.
- Report every declared entity/technology combination, including failures.

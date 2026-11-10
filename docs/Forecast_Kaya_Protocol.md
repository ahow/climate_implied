# Frozen forecast-Kaya and energy-intensity diagnostic

Operational supplement frozen before inspecting this study's outcomes. Original
Stage 4 activity/intensity, holdout and efficacy clauses are the target; this does
not replace historical Kaya accounting or completed demand/adoption studies.

Selection: retained policy observations do not identify implementation-weighted
effects; demand levels and predictive diagnostics already have completed studies.
The retained Kaya CSV supports a new forecast test without purchasing data.
Use exactly the CSV/codebook hashes and revision in Kaya_Protocol.md. No splicing,
new vintage claims, or inference of publication dates from download time.

Use World, China, India, United States, European Union (27), Rest of World and
International transport, exactly as named in Kaya_Protocol.md. Require complete,
positive finite P, GDP, primary energy and fossil/industrial CO2 for 2010–2024.
Missing windows are unavailable; duplicates/nonfinite/nonpositive values fail.
No interpolation or shortened windows. Train 2010–2018; hold out 2019–2024.

Fit each log factor P, GDP/P, E/GDP, C/E independently by OLS on year minus 2010.
Forecast each factor and multiply to predict CO2 in Mt/year. Score each factor
and CO2 using six-year MAE and MAE/holdout mean, against last-value persistence
and OLS linear level trend (bounded at zero). A diagnostic winner must strictly
beat BOTH baselines. This factor trend product algebraically equals a log-CO2
trend, so it is not incremental predictive evidence for an independent mechanism.
No actual holdout factor may enter a forecast.

Uncertainty: 1,000 repetitions, seed 20261110, circular blocks of three centred
training residual years; refit intercept and slope jointly. Share indices across
all factors and regions. Independently sample six future residual years in two
blocks with the same joint timing; multiply shocked factors for CO2. Report 95%
predictive intervals, coverage, width and proper interval score (40 × tail miss).
Reject nonfinite draws rather than clip. Numerical identity tolerance 1e-9 relative.
Fixed break at 2015, RSS reduction and plus-one bootstrap p values as in the
existing demand predictive protocol; Holm correction over all 28 factor tests,
including unavailable cases with p=1; alpha .05. No post-break model substitution.

Supplementary robustness gate: 2,000 circular three-year holdout block resamples,
seed 20261111, shared indices for all targets/entities/baselines. Report paired
absolute-error-improvement 95% intervals. Robust winner requires both lower bounds
strictly above zero as well as the original MAE gate. Six dependent holdout years
cannot establish nominal interval calibration. No criterion changes after scoring.

All outputs remain revised-history, model-assisted diagnostics. Winners are
sensitivity-only pending independent vintages, physical compatibility and
uncertainty validation; failures are rejected forecast candidates, not causal
disproof. Central eligibility is always false. No driver registry/default changes,
no causal policy attribution, and no calibrated 10,000-member claim.
Keep raw inputs and full numerical results private/content-addressed; publish only
aggregate results, exact hashes, commands, source attribution and limitations.

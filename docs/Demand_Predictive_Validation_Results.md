# Electricity-demand predictive validation

Executed the [frozen supplemental protocol](Demand_Predictive_Validation_Protocol.md)
against the retained OWID source, not a replacement download. All five cases
have complete training and holdout windows.

| Region | 95% predictive coverage, six holdout years | Mean interval width, TWh | Mean interval score, TWh | Holm break p |
|---|---:|---:|---:|---:|
| World | 5/6 | 990.94 | 3,395.44 | 0.04995 |
| US | 3/6 | 186.45 | 829.62 | 0.49750 |
| China | 6/6 | 1,256.76 | 1,256.76 | 0.04995 |
| India | 0/6 | 130.32 | 5,345.94 | 0.41159 |
| EU27 | 4/6 | 224.10 | 485.45 | 0.04995 |

Intervals now include resampled future residuals as well as parameter
uncertainty. Wider intervals are not automatically better: the interval score
penalises width as well as misses. Scores are in regional TWh and should not
be compared as scale-free rankings across regions.

The fixed 2015 break diagnostic crosses the prespecified 0.05 Holm threshold
for World, China and EU27 **only narrowly**. With 1,000 bootstrap repetitions,
these values are sensitive to Monte Carlo variation near the boundary; they
are not strong independent evidence of a structural break. No seed or threshold
was adjusted after seeing results. Failure to reject for US/India does not
establish stability.

World and China previously beat both point-forecast baselines. Their new
stability diagnostics give additional reason not to extrapolate the historical
trend into a central long-run scenario. India's 0/6 coverage and poor US
coverage demonstrate that this residual model is not a generally adequate
predictive distribution. Six holdout observations cannot establish nominal
95% coverage even for China.

**Conclusion:** no central-model promotion; no change to headline warming or
live scenario inputs. Stage 4 remains partial. Other drivers, cross-driver
dependence, alternative structural models, and validation of the final joint
distribution remain outstanding. These diagnostics are revised-history
research, not vintage-correct forecast performance.

## Evidence and reproducibility

Run `uv run python script/demand_predictive_validation.py`.
The runner checks the source hash against the original adoption study and
records the supplemental protocol hash. Deterministic, content-addressed
evidence is retained privately in `generated-artifacts/driver-calibration/`.
It cannot silently replace a different existing result.

Tests cover deterministic replay, ordering invariance, holdout perturbations
not affecting intervals or break tests, interval-score penalties, missing
windows, duplicate years, invalid demand and Holm adjustment. Raw source data
and result extracts are not exported to GitHub.

# Frozen electricity-demand calibration protocol

Frozen before execution, 9 November 2026. Supplemental Stage 4 study.

- Target: annual electricity demand in TWh, not primary energy or emissions.
- Source: the existing privately retained OWID energy CSV, with SHA-256.
  Codebook identifies electricity demand as Ember yearly electricity data.
- Regions: World, US, China, India, EU27, using exact existing entity names.
  Missing entities remain unavailable.
- Train: all nine annual observations 2010–2018. Holdout: all six annual
  observations 2019–2024. All must be positive and finite. No zero filling,
  extrapolation of missing observations or shortening the holdout.
- Candidate: OLS log(demand) = intercept + slope × (year − 2010).
- Baselines: 2018 persistence and OLS linear level trend on the same training
  window. Negative trend predictions are bounded at zero, explicitly.
- Evaluation: six-year MAE in TWh and MAE divided by mean observed holdout
  demand. Candidate must strictly beat both baselines. Otherwise sensitivity-only.
- Bootstrap: 1,000 circular three-year blocks of centred training log residuals,
  seed 20261109. Use the same sampled year indices for every region to preserve
  cross-region residual timing. Resample residuals around each fitted trend and
  refit; retain paired intercept/slope draws.
- Report annual holdout coverage of 95% parameter-only intervals. These are
  not predictive intervals and are not used to claim calibrated probabilities.
- Report log slopes on 2010–2014 and 2015–2018 separately as a stability
  diagnostic, not a formal structural-break test.
- Parameters never use holdout outcomes. Reordered observations must not change
  results. Modifying holdout observations must not change parameters or draws.
- No central-model promotion: successful demand fits remain candidates pending
  source-version reconciliation, full predictive uncertainty and physical
  compatibility with regional power accounts.
- The evaluation is revised-history reconstruction, not a real-time forecast.

## Source transition found before execution

On 9 November 2026 the OWID repository README explicitly described its GitHub
energy files as legacy and no longer updated. It linked a replacement dataset
at https://catalog.ourworldindata.org/energy/owid_energy/owid_energy.csv and
warned that primary-energy methodology changed. This study deliberately retains
the earlier frozen release for comparability. It neither treats that release
as a current feed nor splices new primary-energy values into old histories.
An assessment of the replacement dataset remains separate.

Source documentation: https://github.com/owid/energy-data
Legacy codebook:
https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-codebook.csv

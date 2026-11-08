# Supplemental driver uncertainty protocol

This is supplemental uncertainty analysis, not a replacement or relaxation of
the original frozen solar/wind holdout test. No new model is promoted by it.

- Reuse the same hashed OWID source and original train/evaluation windows.
- Training-logit residual bootstrap: circular moving blocks of length three,
  1,000 replications per region/technology, fixed seed 20261108.
- Refit intercept and slope in each replication; retain paired parameters.
  Do not independently sample their marginal intervals.
- Report 2.5%, 50%, 97.5% parameter and annual prediction quantiles.
- Report holdout predictive coverage of parameter-uncertainty intervals. These
  are not full observation/process-noise predictive intervals.
- Report early (2010–2014) versus late (2015–2018) training slopes as a
  structural-stability diagnostic, not a significant-break hypothesis test.
- All original baseline failures remain sensitivity-only. Baseline winners
  remain candidates requiring source/physical/dependence validation.
- Missing or invalid windows return unavailable. Do not fabricate observations.
- Source, original protocol and this protocol hashes accompany every report.

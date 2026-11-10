# US stationary battery storage — frozen capacity diagnostic

2026-11-10. Freeze and commit before fitting. Source table inspected for scope,
units and completeness; this is not blinded research.

Source: US Energy Information Administration, Battery Storage in the United
States, release March 17 2026, 2025 Battery Storage Figures workbook, Figure 1b.
https://www.eia.gov/analysis/studies/electricity/batterystorage/
Permission: EIA government data are public domain, with attribution:
https://www.eia.gov/about/copyrights_reuse.php
No third-party photographic/illustration material is reused.

Targets, separately: US large-scale net cumulative battery nameplate power MW
and energy MWh. Neither is annual additions, battery manufacturing, generation
share, or worldwide installed storage. Small-scale storage excluded.

Train 2010–2018; holdout 2019–2024, all six years required, unchanged Stage 4
baseline gate. No 2025/2026 plans included. Missing values stay unavailable.
Candidate: OLS log capacity against year (exponential adoption in levels).
Baselines: 2018 persistence and OLS linear capacity trend, floored at zero.
Primary metric MAE in native units; MAPE secondary.
Gate: candidate MAE strictly below both baselines; report paired improvement
95% intervals from 2,000 circular date-block bootstrap draws, block 2, seed
20261110. Passing does not promote to central model.
Parameter intervals: 2,000 centred log-residual training bootstraps, block 3,
same seed; report growth and prediction intervals as parameter-only uncertainty.
No retuning, shortened holdout, additional models or chosen regions after scoring.

Logistic/Gompertz saturation: **unidentified**. No sourced finite ceiling for
US MW or MWh has been established. Do not invent one from holdout data or force
capacity into a 0–1 share. A bounded diffusion curve requires a separately frozen
sourced saturation prior and is not completed by this exponential diagnostic.
If either baseline wins, sensitivity-only; if both lose, still prior/sensitivity
pending saturation, regional applicability and structural uncertainty.

This revised-history reconstruction does not establish storage dispatch,
duration evolution, displacement, emissions effects or original-vintage skill.
Record source and protocol hashes, all results and exclusions. No live driver
approvals or headline changes.

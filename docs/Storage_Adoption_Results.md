# Battery-storage adoption diagnostic — 10 November 2026

Protocol and acceptance tests committed in 2155948 before fitting.
Source: US Energy Information Administration, March 17 2026, 2025 Battery
Storage Figures, Figure 1b; public-domain government data. Workbook SHA-256
a894ce66d4923295649b4ab8406913ceb2101fb604ddc50b93cf3660b4de5a41.
Annual net cumulative capacity, not annual additions; US large-scale only.

Training 2010–2018, unchanged holdout 2019–2024.

| Target | Exponential MAE | Persistence MAE | Linear MAE |
|---|---:|---:|---:|
| Power, MW | 6,589.37 | 9,204.32 | 9,027.87 |
| Energy, MWh | 16,218.66 | 25,405.17 | 25,302.87 |

Paired improvements (baseline minus candidate), 95% circular date-block intervals:
- MW vs persistence: 2,614.95 [864.84, 4,626.04]; vs linear: 2,438.50 [813.85, 4,324.13].
- MWh vs persistence: 9,186.50 [2,064.22, 17,515.18]; vs linear: 9,084.21 [2,147.44, 17,180.99].

Both candidate curves beat both baselines. Absolute forecast errors are still
large: MAPE 47.0% MW and 47.6% MWh. No central promotion. Saturation remains
unidentified without a sourced capacity ceiling; no logistic curve, global
storage share, dispatch/emissions effect or calibrated uncertainty is claimed.
Both targets remain sensitivity-only. Parameter intervals omit future shocks.

Commands: node script/extract-eia-storage.cjs; python script/storage_adoption.py
generated-artifacts/driver-calibration/eia-storage-2025.json.
Full source, parameter intervals and holdout rows retained privately; output
content hash and executed command logs are recorded in the completion ledger.
Four focused tests cover exact exponential recovery, deterministic ordering,
future-input isolation, missing windows and invalid input rejection.

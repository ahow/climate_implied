# Frozen physical-history diagnostic

Freeze before calculating discrepancies. No tuning or new acceptance threshold.
Use the retained IGCC revision852f4f7b0733fa4d573c145cdfaf556da5589231
ERF1750–2024 and GMST1850.5–2024.5, and the already-computed full
FaIR2.2.4 upstream benchmark trajectory. Do not rerun endpoint studies.

Compare only1850–2014: later SSP trajectories are not observed history.
Convert each annual FaIR surface-layer bounding pair to its midpoint mean;
match IGCC's explicit year+.5 coordinates. Rebase both histories independently
to their1850–1900inclusive mean. Report mean/maximum-absolute/RMSE discrepancy
of member-median simulated temperature against observed GMST, by scenario.
Do not pool scenarios as independent observations or convert member ranges to
calibrated probabilities. Record scenario divergence over the overlap.

Read IGCC ERF components as W/m² relative1750; sum all components, with
solar+volcanic separated from the anthropogenic component sum. Report1750,
2014 and2024 totals. Do not fabricate a model-forcing comparison: the retained
benchmark file contains temperature, not its annual forcing/emissions histories.

This is total surface-temperature versus observed-GMST compatibility analysis,
not human-attribution, matched annual SSP-reference validation, the original
0.01°C independent-reference gate, or a new calibrated-ensemble acceptance.
Missing coordinates/nonfinite values/hash mismatch fail before analysis.

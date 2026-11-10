# Frozen Stage 6 NGFS-reference missing-gas comparison

Freeze before outcome inspection. This bounded study advances the original
Stage 6 clauses: harmonise to the 2024 inventory with 2050 convergence and 2030
sensitivity; document four missing gases with at least two alternatives; require
inventory agreement within 1e-6 relative and 2100 median spread <0.01 C.
It does not establish an implemented-policy central model or all commitments.

Read existing NGFS_Pathway_Compatibility_Assessment.md,
Minor_Gas_History_Sensitivity.md, Additional_FaIR_Species.md and the existing
ngfs_pathway_adapter.py/pathway_gap_sensitivity.py methods. Retain their unit,
isomer, missing-value and scenario restrictions. No completed study is rerun.

Source: retained NGFS Phase V 5.1 World extract, REMIND-MAgPIE 3.3-4.8 (not the
excluded IntegratedPhysicalDamages variant), Current Policies and Nationally
Determined Contributions (NDCs), exclusively the AR6 Infilled emissions stage.
Input extract SHA256 65a73a469ef668da467af654af14e56f1e7d91b5e28147f592136a1d27881e06;
archive SHA256 acae7160abbd34d10b4eda5226a1fc3ebb5591205203a82c48ab9b5d5ad7c31b.
Inventory SHA256 fa5dbe5e8b7c6ab31e8b75805534ad249d5d5056df86f011db34d4038e0a27ea.

Use existing reviewed SERIES mappings and native conversion to Mt gas/year.
Interpolate only interior populated source years, without extrapolation or blank
to zero. All inventory gases except HFC-134, HFC-143, HFC-245fa and HFC-41 must
exist. Never substitute HFC-245ca, HFC-134a or HFC-143a. Do not mix GCAM raw
HFC-245fa with REMIND infilled series.

For represented positive-baseline gases, multiply annual source values by
1 + (inventory2024/source2024 - 1)*max(0,(convergence-year)/(convergence-2024)).
For signed land CO2, add (inventory2024-source2024) times that taper.
Run convergence=2050 and 2030 without selection after scoring.
Require finite values, nonnegative non-CO2, exact end convergence within 1e-9
relative and inventory matching within 1e-6 relative; reject invalid pathways.

Missing four gases: preserve existing frozen stress definitions: constant-2024,
linear-zero-2050, zero-after-2024. All start at the real native inventory anchor.
These are assumed future alternatives, not observed zeros, statistical bounds
or accepted infill estimates. No data-driven calibration is claimed.

Hold history fixed across all twelve runs: retained EDGAR-derived carry-forward
file (SHA256 758542f7dae28886ced6c5117f867a05abedd389afcfe9951dd280f0816c5de0).
This includes assumed zero pre-1970 and carried Mexican HFC-134 blanks; it is
not complete observed history. Physical parameters remain the existing AR6
minor-gas treatment. Use unchanged pinned FaIR 2.2.4 and all 841 constrained
calibration configurations, fresh instances, identical member order/forcing.
No clipping, point tuning, or uncertainty resampling.

Boundary limitation: replace only the native inventory gases in the existing
FaIR reference bridge. Non-inventory species/aerosols, natural forcing and
historical initialisation remain the pinned upstream reference, identical across
the infill alternatives. Consequently these are controlled NGFS-derived inventory
pathway sensitivities, NOT full NGFS climate reproduction or independent FaIR
validation. This limitation is declared before outcomes and prevents central
promotion even if the narrow infill spread passes.

For each scenario/convergence stratum compare all three full saved ensembles:
identical year/member/baseline/calibration/history coordinates; report 2100
P10/P50/P90, range of the three medians (strict <0.01 C), maximum absolute paired
temperature difference and paired 2100 quantiles for each pair. Report every
stratum, including failures. Report the 2030-vs-2050 convergence changes without
a new acceptance threshold. Preserve output/input/code/protocol hashes.

Policy cutoff is March 2024; NDC includes conditional 2030 targets, not long-term
net-zero commitments. Observation-specific information availability remains
unknown; source revision/release and file retention do not establish that date.
No blanket source redistribution licence is asserted. Outputs stay private.
Central promotion, accepted infill, full commitments, full annual independent
reference and calibrated 10,000-member efficacy remain unavailable.

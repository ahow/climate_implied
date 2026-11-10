# Independent upstream SSP endpoint benchmark — frozen before scoring

Fallback from unavailable complete forecast-Kaya windows; advances original
Stage 7 independent reference work, not dashboard promotion. Use FaIR 2.2.4.
Reference: OMS-NetZero/FAIR revision ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79,
tests/reproduction_test.py and its test_data. These published upstream numerical
outputs are independent of our execution, not invented expectations.

Freeze all eight SSP cases and all model/run calibrations in the upstream
4xCO2_cummins_ebm3.csv. Replicate upstream deterministic seeds (1355763 plus
399 per configuration), stochastic settings, native units, default species,
CH4 lifetime/baseline and N2O baseline, and timebounds 1750–2100. Use upstream
RCMIP v5.1.0 inputs with its three pinned MD5 checks; retain SHA256 hashes.
Use upstream interpolation unchanged, not invented missing observations.
No dashboard regional pathway, constant control, additive warming offset or tuning.

Predeclared endpoint tests: max absolute 2100 timebound surface temperature
difference <=0.01 C across ALL scenario/member cells; concentration and forcing
must satisfy abs(actual-reference) <= 1e-8 + 1e-5*abs(reference), the upstream
xarray default allclose tolerance. Require exact dimension/coordinate agreement,
finite full temperature trajectory and finite endpoint values. Missing inputs or
unsupported runtime fail explicitly. Never regenerate reference outputs.

Frozen SHA256:
- calibration CSV: aff935fa3108a7c022f7f4ae1445033fd7fd117bbd709c67cc5223e4a712ce0d
- temperature NetCDF: 5a211aba211865388bfc2aefef74c053937df10a44d3204c28582c6c0b6176b7
- CO2 NetCDF: 694350f6731029b5d0698472b8699e7eb47ed1bef2ad4d093cd13dced797b34b
- forcing NetCDF: 80444806dc454aaae1631caf7593c8dda632f95b689fab9e562b66c14f528e79

Critical scope: the upstream published arrays cover only the 2100 timebound.
The original Stage 7 maximum ANNUAL <=0.01 C acceptance therefore remains
UNAVAILABLE even if this endpoint passes. This is an independent numerical
regression benchmark, not full physical validation, the 841-member constrained
ensemble, current-policy warming, a calibrated 10k ensemble or a probability
claim. Publication/availability date is unknown; revision identifies content,
not observation-specific publication vintage. Retain raw source/reference inputs
privately; no redistribution licence is asserted for RCMIP underlying sources.

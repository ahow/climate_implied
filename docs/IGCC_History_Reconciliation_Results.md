# Executed IGCC physical-history diagnostic

Protocol frozen before discrepancy calculation:
`1fa60cb7c948c915dffaf4fb967578aa8c6aadd689845577d63ad201c879f20d`.
Executable: `script/reconcile_igcc_history.py`; test:
`script/test_igcc_history_reconciliation.py`.

Actual retained FaIR annual surface-layer histories were midpoint-averaged and
compared with pinned IGCC GMST only over1850–2014. Both were independently
recentered to1850–1900inclusive. All eight scenario histories have identical
medians over this historical overlap; they are NOT eight independent samples.

- Median-history bias: **+0.0064422683°C**
- RMSE: **0.1210392023°C**
- Maximum absolute annual discrepancy: **0.3172782516°C**
- Maximum cross-scenario median spread: **0°C**

These are observed-GMST/model-history discrepancies, not the matched independent
SSP annual-reference test. The0.01°C gate was not applied or retuned. No
human-attribution, calibrated probability, or central promotion follows.
FaIR's surface-temperature observable and the observational GMST product are
not established here as identical GSAT/GMST definitions. No empirical conversion
factor was invented. Consequently these are raw aligned-history differences,
not an accepted model-accuracy score; observable-definition reconciliation remains.

IGCC ERF component sums, as delivered, W/m²:

| Year | All components | Solar+volcanic | Anthropogenic components |
|---|---:|---:|---:|
|1750|0.3012700292|0.3012700292|0|
|2014|2.5959286755|0.2434398836|2.3524887920|
|2024|3.3028279002|0.3287914823|2.9740364178|

**Post-execution interpretation clarification:** the protocol's shorthand
“relative1750” must not be read as requiring every natural component to be zero
in1750. The retained table's anthropogenic sum is zero then; its natural terms
are not. No forcing values were re-zeroed or altered. Natural-component source
reference periods require further source reconciliation. The model's annual
forcing/emission matrices were not retained in this benchmark artifact, so
model-versus-IGCC forcing/emissions reconciliation is still unavailable.
Observed total GMST is not human-induced warming.

Source byte hashes and computed trajectory hash are checked before calculation.
The current-revision source dates are not asserted to be original vintages.
The IGCC repository notes registration/restrictions on some ancillary datasets;
none was bypassed or redistributed.

Execution: `uv run --with h5netcdf --with h5py python -m unittest discover -s script -p test_igcc_history_reconciliation.py -v`
then the same environment's `python script/reconcile_igcc_history.py`.
One focused test and real analysis passed at2026-11-10T08:12:46Z:
`generated-artifacts/workplan-completion/20261110T081246321430Z.log`.
Initial CSV BOM failure is retained in
`generated-artifacts/workplan-completion/20261110T081222932872Z.log`;
using UTF-8-sig fixed parsing, with no protocol/window/tolerance change.
Private result:
`generated-artifacts/igcc-history-reconciliation/5b579d7e67adf9383af693cd408ad20fbded09ea35746cc3a37eff29c695c3f1.json`.

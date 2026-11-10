# Bounded Stage 6 reference-gas infill efficacy — executed

## Conclusion: conditional numerical pass; Stage 6 remains partial

Executed 10 November 2026 UTC. Twelve fresh FaIR 2.2.4 runs used retained real
NGFS Phase V 5.1 native-gas trajectories, the real 2024 inventory anchors and
the same 841 calibrated climate configurations in each run. All four
scenario/convergence strata pass the frozen **2100 median spread <0.01°C**
criterion across the three missing-gas alternatives. All 27 native inventory
accounts match 2024 within **7.373e-14 relative**, below **1e-6**.

This is a new future missing-gas comparison, not a rerun of the earlier
historical Mexican-gap control, 528-cell SSP endpoint benchmark, EV, fleet,
beta or demand studies. Central promotion remains false. The repeated 841
configurations are not 10,092 independent calibrated driver/climate members.

## Original clauses advanced

Read original Stage 6 in
`attached_assets/Climate_Dashboard_—_Developer_Work_Plan_1794133884617.docx`,
the existing NGFS compatibility assessment, minor-gas history sensitivity,
additional-species documentation and native-pathway/gap methods.

| Original Stage 6 clause | Actual result / limit |
|---|---|
| Harmonise pathways to 2024, converging by 2050, with 2030 sensitivity | Both convergence settings executed for both dated reference scenarios; represented gases converge within 1e-9 relative numerical tolerance |
| Infill HFC-134, HFC-143, HFC-245fa, HFC-41 with a documented method and ≥2 alternatives | Existing constant-2024, linear-zero-2050 and zero-after-2024 stress definitions executed; three **assumptions**, not accepted calibrated infill |
| Both cases match inventory within 1e-6 relative | Pass for these two **reference-derived controls**, not the unavailable implemented-policy/all-commitments production cases |
| All required gases present; 2100 median moves <0.01°C | All 27 inventory accounts present; four conditional passes below |
| No NDC-only pathway labelled all commitments | Preserved: NDC is explicitly the March 2024 pledge-set/2030-target reference |
| Full commitments including long-term strategies; confirmed licence | Unavailable/not established here; no substitution of NDC or net-zero scenarios |
| Reference values match hashed sources | Source hashes verified; no displayed reference values or UI modified |

## Frozen design and provenance

Protocol/test hashes were recorded **2026-11-10T05:38:24Z**, before outcome
execution. No thresholds, scenario selection, model choice or stress paths
were retuned. The study uses only REMIND-MAgPIE 3.3-4.8, not its excluded
IntegratedPhysicalDamages variant, and only the AR6 **Infilled** emissions stage.
No GCAM raw HFC-245fa was mixed in; no HFC-245ca/fa or 134/134a or 143/143a
isomer substitution occurred. Interior interpolation uses populated source years,
not zeros for blank decadal cells. Non-CO2 units are converted to native Mt/year;
signed land CO2 stays signed. CO2e is never a climate-model species.

The source is **NGFS Phase V 5.1**, DOI `10.5281/zenodo.17901363`,
official access https://data.ece.iiasa.ac.at/ngfs/#/downloads.
Current Policies and NDCs have a **March 2024 policy cutoff**. NDCs does not
represent long-term net-zero commitments. Infilled series are postprocessed
estimates, not independent observations. Information-availability dates remain
unknown; the release label, present retention and execution date are not
publication-vintage evidence.

For positive-baseline represented gases, the initial inventory/source ratio
tapers to one at the fixed convergence year. Signed land CO2 uses a tapering
additive offset. This explicitly differs from the older permanent-ratio
diagnostic, which remains unchanged. Missing four-gas alternatives all begin at
the real inventory anchor, never a fabricated observed zero.

## Actual results

Temperatures below are **bounded/conditional model outputs**, annual 2100 °C
above 1850–1900. They are NOT dashboard forecasts or full NGFS reproductions.
Each row uses 841 identical ordered climate members.

| Dated reference | Converge | Constant median | Linear-zero-2050 median | Zero-after-2024 median | Median spread °C | <0.01°C |
|---|---:|---:|---:|---:|---:|---|
| Current Policies | 2050 | 2.836187 | 2.835368 | 2.835348 | 0.000838400 | Pass |
| Current Policies | 2030 | 2.842725 | 2.841907 | 2.841887 | 0.000838264 | Pass |
| NDCs | 2050 | 2.219793 | 2.219060 | 2.219043 | 0.000749905 | Pass |
| NDCs | 2030 | 2.224315 | 2.223582 | 2.223565 | 0.000749874 | Pass |

Constant-alternative P10/P50/P90:
- Current Policies, 2050 convergence: **2.200311 / 2.836187 / 3.642991°C**.
- Current Policies, 2030 convergence: **2.205595 / 2.842725 / 3.652589°C**.
- NDCs, 2050 convergence: **1.713191 / 2.219793 / 2.874874°C**.
- NDCs, 2030 convergence: **1.716435 / 2.224315 / 2.880119°C**.

Maximum absolute paired differences across **all years and members**, over
all infill pairs in each stratum, are respectively **0.001461834, 0.001461250,
0.001412757 and 0.001412661°C**. The saved report includes every alternative's
quantiles and every pair; these paired differences are not differences between
independently sampled marginal distributions.

The 2030 rather than 2050 convergence sensitivity is appreciably larger than
the infill spread. For constant missing gases, paired 2100 median change is
**+0.006944888°C** (Current Policies) and **+0.004923252°C** (NDCs).
Largest all-year/member convergence differences are approximately **0.0350584°C**
and **0.0209167°C** across alternatives. These are diagnostic changes, not
failures of the differently scoped infill gate; no convergence-temperature
threshold was invented after scoring.

**Positive:** 12/12 runs completed; 4/4 infill strata pass; 27/27 accounts
present; anchors and source convergence pass; ensembles finite and paired.
**Negative:** no numeric rejection among the prespecified real-study gates.
Tests deliberately reject negative non-CO2, zero ratio baselines, excessive
infill spread and reordered members.
**Unavailable:** accepted empirical infill distributions, true implemented-policy
central case, all-commitments case, independently dated vintages, confirmed
redistribution rights, full NGFS physical reproduction and full annual independent
FaIR validation. No success is asserted for these unavailable criteria.

## Boundary limitations preventing promotion

Non-inventory species/aerosols, natural forcing and most historical initialisation
remain the pinned upstream medium-extension reference. They are held identical
across each paired comparison rather than silently described as NGFS inputs.
Thus the real NGFS inventory-gas trajectories provide a meaningful controlled
infill test, but the absolute temperatures do not reproduce NGFS's own climate
diagnostics.

The three additional species share the retained EDGAR carry-forward history,
including assumed zero pre-1970 emissions and missing Mexican HFC-134 treatment.
Those are assumptions, not complete measurements. Future alternatives are not
confidence bounds. Unknown historical emissions, common aerosol-path errors and
uncertain physical parameters are not bounded by the small conditional spread.
No inference of causality or calibrated climate probabilities follows.

## Exact evidence and reproduction

New executable: `script/reference_gas_infill.py`; tests:
`script/test_reference_gas_infill.py`.

```
uv run python -m unittest discover -s script -p test_reference_gas_infill.py -v
uv run python script/reference_gas_infill.py
uv run python -m py_compile script/reference_gas_infill.py script/test_reference_gas_infill.py
```

**3 focused tests pass**, compilation passes. The study refuses an existing
output root; preserve it rather than overwriting a completed run.

Report:
`generated-artifacts/reference-gas-infill/result-a79eee60240c9cf69a209381a7a16ec78099446e46f83c35105b969130ba8e56.json`.
All twelve pathway files, complete ensembles and per-run provenance are in that
private directory. Every pathway and ensemble hash, comparison, code dependency
hash and calibration-input receipt is recorded in the result.

| Source/artifact | SHA256 |
|---|---|
| Protocol | `a0edb772e567d4a477a416dd92fa13392f2659385c4f0717a97dc8a89ac4f139` |
| Preimplementation tests | `86edcee632eda69ec1d6ddb1fbd9c3f59c81c677a1add431552a6546305ec63a` |
| New executable | `62b7c5f13977ca6724a229ed8c6b46a5e043e91953de0c50c22b45cc89672c9b` |
| NGFS archive | `acae7160abbd34d10b4eda5226a1fc3ebb5591205203a82c48ab9b5d5ad7c31b` |
| NGFS World extract | `65a73a469ef668da467af654af14e56f1e7d91b5e28147f592136a1d27881e06` |
| 2024 inventory | `fa5dbe5e8b7c6ab31e8b75805534ad249d5d5056df86f011db34d4038e0a27ea` |
| EDGAR original workbook | `1109c2459bd95b296ce2797046b72070ff9180ee7a62e72a6e953090a7f0b5c1` |
| Retained carry-forward history | `758542f7dae28886ced6c5117f867a05abedd389afcfe9951dd280f0816c5de0` |
| AR6 physical-parameter PDF | `4290518ef9418a4157ddb9481e589131eeb110614c3aa7b62641d3241d39ce58` |
| FaIR calibration parameters | `7b6c5d9fa0b0b0d3eb47189bf5d63cbf77e752ddac682947abee5ff529206780` |
| FaIR species properties | `42d04aa1a8f385cc53eae22beab26f857c535c5aa7dfdb98176d712bfc0c95a0` |
| FaIR reference emissions | `fcf994bb97bd08aae04bb4373ee7b8639e007f44055af1aa3d458aefc14b61ae` |
| FaIR natural forcing | `621b551dafa6ff0e5a789b94a81a12876d796832c0e15f627545af40d6de58e5` |
| Execution log | `1e56925c08045fbb5741db805d27369b510a6eab8260fcd69ace81947e3c4465` |
| Test log | `7681dab5a773d6f96502abf6d1f843121cab9384d201844a06b510b5d07884e4` |

Logs are `generated-artifacts/ngfs/reference-gas-infill-execution.log` and
`reference-gas-infill-tests.log`. FaIR inputs are from upstream revision
`ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79`; EDGAR workbook source revision
`e81bb760b66ab182f9052d8d4218d42a97acbd75` in ClimateIndicator/GHG-Emissions-Assessment;
AR6 physical parameters are Table 7.SM.7 of the final WGI Chapter 7 supplement.
Raw/reference content remains private; no purchases, collector changes, DDL,
approvals, production writes, package edits, ledgers, routes, semantics, company
or pipeline files were touched. No application/UI work was performed.

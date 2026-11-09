# Stage 4 — electricity demand and source compatibility

9 November 2026. **Status: Partial.** No central-model promotion.

## What changed

Regional electricity demand now has a reproducible, frozen historical
evaluation, rather than an assumed growth rate alone. The log-trend candidate
is compared with persistence and a linear trend, using only 2010–2018 for
training and all six years 2019–2024 for evaluation.

The source investigation also found that OWID retired the legacy energy feed.
The replacement release was assessed separately without overwriting earlier
results or changing the collection/review/approval process.

## Efficacy results

MAE is in **TWh**. Lower is better. Eligibility requires strictly lower MAE
than both baselines; close failures remain failures.

| Entity | Candidate | Persistence | Linear trend | Decision | Parameter-interval coverage |
|---|---:|---:|---:|---|---:|
| World | 249.237 | 2,090.208 | 512.130 | Candidate, further validation required | 5/6 |
| US | 77.484 | 87.483 | 77.462 | Sensitivity-only | 3/6 |
| China | 132.859 | 1,534.695 | 526.507 | Candidate, further validation required | 6/6 |
| India | 195.069 | 199.212 | 58.235 | Sensitivity-only | 0/6 |
| EU27 | 79.602 | 119.490 | 79.571 | Sensitivity-only | 4/6 |

Each fit includes 1,000 circular three-year residual-block bootstrap draws.
The same sampled year indices are used across regions to preserve training
residual timing. Intercept/slope pairs stay together. The reported 95%
intervals reflect **parameter uncertainty only**, not full predictive
uncertainty or calibrated future probabilities.

Training-period implied annual demand growth:

| Entity | Annual growth |
|---|---:|
| World | 2.5925% |
| US | 0.2162% |
| China | 6.2383% |
| India | 6.3356% |
| EU27 | −0.0913% |

These are historical fitted coefficients, **not recommended projections
through 2100**. Early/late training slopes are retained as diagnostics, not
a formal structural-break assessment.

Software tests passed:

- Reordered observations produce identical results.
- Changed holdout outcomes do not alter fitted parameters or bootstrap draws.
- A known exponential fixture is recovered to less than 1e-9 TWh MAE.
- Missing training/holdout years return unavailable.
- Duplicate years, zero and invalid demand are rejected.

## Replacement-source assessment

The publisher now recommends its catalog release and explicitly warns that
primary-energy measurement changed from the substitution method to total
energy supply. That series cannot be silently spliced.

For the three electricity fields actually tested:

- All **225** entity/target/year observations matched across releases.
- Maximum electricity-demand revision: **0.001000000000204 TWh**.
- Maximum solar/wind-share revision: **0.000488924 percentage points**.
- Demand classifications were unchanged: two candidates and three failures.
- Adoption classifications were unchanged: EU27 solar remains the sole
  candidate among ten solar/wind fits; the other nine remain sensitivity-only.
- No 2025 outcome was added to the frozen evaluation.

These results establish only the reported overlap for these electricity
fields. They do not establish compatibility of other columns or original
publication vintages.

## Evidence, claims and lineage

**Evidence state:** Model-assisted estimate of historical demand relationships.
**Claim:** revised-history evaluation, not real-time forecast validation,
causal identification or emissions/climate-model acceptance.

Frozen legacy source SHA-256:
`266f2e2baad7975351bc9bb4aa061d22b1da9fe4c47d51d2ac6071e01e171f76`.

Replacement source SHA-256:
`9d8efc4a9b1cc2ffdfa7f7f6f1e171b2922e0be2d97c0edf2982e874357ed6de`.

Demand protocol SHA-256:
`5a686bae5a4b29112175b351fadcc6994955793722ef9c65ab6eb3981416d87e`.

Private evidence under `generated-artifacts/driver-calibration/`:
`electricity-demand.json`, `source-compatibility.json`, the two raw releases,
publisher column mapping, codebook and source metadata. Raw files and parameter
draws are excluded from the GitHub source export.

Protocols were committed before their corresponding numerical runs:
[Demand protocol](Electricity_Demand_Calibration_Protocol.md) and
[source compatibility protocol](Energy_Source_Compatibility_Protocol.md).

## Before/after and remaining dependencies

No dashboard warming, valuation ranking or approved input changed. The result
adds actual empirical evidence; it does not complete Stage 4 or Stage 5.

Still required: predictive residual uncertainty, formal stability assessment,
EV/storage/heat-pump and learning-curve work, policy evidence, recent-emissions
reconstruction, regional physical parameter mapping, and a justified joint
distribution across the full model. The three rejected demand fits cannot be
promoted merely because the engine accepts their parameter format.

The legacy feed retirement is a source-maintenance issue to address through
the existing review process, not permission to replace approved data silently.
No acceptance threshold was changed. Per-stage effort was not instrumented.

## Reproduction

Full local release checks passed: **152 TypeScript tests, 26 Python tests**,
type checking and production build. The empirical runs above are additional
to those software checks.

```sh
PYTHONPATH=script uv run python -m unittest script/test_electricity_demand.py
uv run python script/electricity_demand_calibration.py
uv run python script/compare_energy_sources.py
```

The first data command requires the retained legacy file and its prior hash
record. The compatibility command downloads the replacement only if absent,
retains both releases, and reports their hashes.

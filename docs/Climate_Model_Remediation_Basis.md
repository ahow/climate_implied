# Priority 2A: evidence and proposed scientific basis

Status: investigation started; scientific-basis approval pending. No model constants or calculations changed.

## Before-change capture — 8 October 2026

Development responses, effective projection inputs, historical input series and calculation source were saved in:

`exports/climate-baselines/2026-10-08T17-21-10.367Z/`

The manifest records capture times, code commit and SHA-256 hashes. All five response hashes were verified. This is not a reconstruction of the reviewer's October 4 production release, a complete runtime archive, or a transactionally consistent database snapshot. Existing caches were not forcibly refreshed.

Current development outputs:

| Quantity | Captured value |
|---|---:|
| Projection start | 2026 |
| Starting annual emissions, currently labelled GtCO₂e | 65.8421 |
| Annual emissions ten years later | 51.1499 |
| Annual emissions in 2100 | 27.6140 |
| Median warming | 2.40771°C |
| P10–P90 | 2.04842–2.82015°C |
| First-decade compound decline | 2.49338%/year |
| Current residual-emissions threshold year | 2144 |

Unrounded sensitivity ranges are nonzero: policy coverage 0.00307°C, policy implementation 0.00511°C, atmospheric CO₂ growth 0.000757°C and renewable capacity 0.000693°C. Rounding explains some displayed zeros, but does not validate the mechanisms or their relative magnitudes.

## Confirmed implementation concerns

- Starting emissions are scaled from 60.3 by carbon intensity, then adjusted; this is not a reconciled inventory.
- Aggregate emissions are accumulated and passed through a CO₂ TCRE formula without separate treatment of methane, nitrous oxide, fluorinated gases or aerosol changes.
- Temperature uncertainty is reconstructed from median cumulative emissions rather than consistently propagating each emissions draw.
- The PDF and reported temperature statistics use separate samples; the statistics routine does not derive its values from the supplied PDF.
- Policy effects are small absolute emissions subtractions; other mechanisms use proportional reductions. Their units and relative strength need evidence-based calibration.
- Scenario endpoints use different baseline-selection paths.
- Reduction-rate and residual-emissions threshold definitions differ across main, historical and finance calculations.

## Primary-source findings

### UNEP Emissions Gap Report 2025

The European Commission JRC record for Chapter 2 confirms **57.7 GtCO₂e in 2024**, including discussion of land-use emissions. This supports the reviewer's cited report vintage; it does not establish that 57.7 is the only valid current estimate.

Sources:
- https://www.unep.org/resources/emissions-gap-report-2025
- https://publications.jrc.ec.europa.eu/repository/handle/JRC143107

### Indicators of Global Climate Change 2025, published in 2026

The peer-reviewed update reports a WGIII-consistent estimate for 2024 of **56.8 ± 5.5 GtCO₂e**:

| Component | 2024 emissions |
|---|---:|
| Fossil-fuel and industrial CO₂ | 38.6 GtCO₂ |
| Net land-use-change and forestry CO₂ | 4.6 GtCO₂ |
| Methane | 9.3 GtCO₂e |
| Nitrous oxide | 2.6 GtCO₂e |
| UNFCCC fluorinated gases | 1.7 GtCO₂e |

CO₂e reporting uses **AR6 GWP100**. The source explains inventory-boundary differences and revisions; it is not appropriate to mix gas components from different vintages merely to match a preferred total. Non-CO₂ physical modelling requires species-level emissions in native mass units, not these rounded CO₂e aggregates.

The same update estimates **2025 annual human-induced warming at 1.37°C** relative to 1850–1900. This is distinct from its **2016–2025 human-induced decadal average of 1.24°C**. It must not be substituted blindly for a baseline referring to another period.

The paper provides provisional 2025 CO₂ estimates but states that 2025 non-CO₂ projections were unavailable at publication. The proposed full-inventory anchor is therefore 2024; later years must be labelled by component as provisional, estimated or scenario-based.

Source: https://essd.copernicus.org/articles/18/3889/2026/

### FaIR climate-response model

FaIR provides an established gas/forcing-resolved modelling framework with published constrained parameter ensembles. It requires historical initialization and consistent future emissions/forcing inputs; installing it does not validate the dashboard's pathways.

The documentation's example ensemble is constrained through 2022. It cannot automatically be claimed to match 2025 observations. The implementation must pin a compatible release, ensemble and input vintage, reproduce reference results, then evaluate the historical fit against the later evidence.

Source: https://docs.fairmodel.net/en/latest/examples/calibrated_constrained_ensemble.html

## Approved scientific basis

The user approved this basis, including replacing the fixed warming offset only after historical validation. Approval authorizes implementation; it does not certify the new model or its outputs.

1. Use the IGCC 2025 update's gas-resolved, WGIII-consistent 2024 inventory as the reporting anchor, retaining UNEP 2025 as a separately labelled comparison.
2. Keep total GHG reporting in AR6 GWP100 CO₂e, but never pass this aggregate into a CO₂-only temperature calculation.
3. Introduce a pinned FaIR climate-response component, with historical initialization, sourced gas/aerosol pathways and constrained ensemble parameters. Preserve the existing model as a before-change reference rather than silently replacing its meaning.
4. Use the 2025 human-induced warming estimate as a historical validation target, not an arbitrary additive offset. This supersedes the fixed 1.1°C assumption only once the revised pathway and historical fit are verified.
5. Report uncertainty conditional on the specified scenario and ensemble; do not label it comprehensive uncertainty over all policy futures.
6. Align all category and current-projection calculations to the same dated inputs. Preserve reconstructed historical outputs as such, without claims of real-time forecasting.
7. Report first-decade compound decline and straight-line decline explicitly. Rename the residual-emissions milestone “near-zero”; use a disclosed 5%-of-start threshold consistently and return “not reached by 2100” rather than presenting a speculative extrapolation as a modelled net-zero date.

This is a substantial scientific/engineering change, not a constant adjustment. It adds a climate-response dependency and may materially change headline temperatures and intervals. No new result should be promoted solely because it appears plausible or supports a desired policy conclusion.

## Verification gates after approval

- Source gas components and total reconcile within published rounding; units and land-use boundary are explicit.
- Gas-native inputs and CO₂e display totals cannot be interchanged silently.
- Historical initialization and reference FaIR scenarios reproduce documented benchmark results before dashboard pathways are evaluated.
- Revised policy/technology scenarios have dimensionally consistent mechanisms and disclose overlap/double counting.
- All ensemble draws propagate consistently to emissions, cumulative CO₂ and temperature statistics.
- Main/category/historical/finance consumers expose consistent units, baseline dates and metric definitions, with incompatible finance temperature claims qualified rather than silently treated as validated.
- Before/after comparison explains changes in starting emissions, 2030/2050/2100 trajectories, median warming and P10/P90.
- No claim of full Priority 2A completion until these gates pass.

## Implementation status

The pinned FaIR 2.2.4 reference runner is available as `uv run python script/fair-reference.py`.
It runs the upstream medium-extension example with all 841 constrained members,
historically initialized from 1750, with annual temperatures relative to 1850–1900.
Input URLs, immutable upstream revision and SHA-256 hashes are recorded with results
in `generated-artifacts/fair-reference/result.json` (excluded from deployment and Git).

The first execution produced a 2003–2022 median warming of 1.027°C
(5th–95th percentiles 0.858–1.135°C), broadly consistent with the calibration's
documented target. This is an execution/sanity check, not an independent numerical
benchmark or validation against the newer human-induced warming assessment.

**Not complete / not promoted:** the upstream example uses draft scenario extensions
and a calibration constrained through 2022. Native-gas historical updates, independent
reference comparison, dashboard mechanism coupling, shared metrics and UI migration
remain required. Existing dashboard results have not been replaced.

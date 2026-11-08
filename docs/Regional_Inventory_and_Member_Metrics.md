# Regional accounting and coherent member metrics

## Status

Stages 5, 7 and 8 remain **partial**. This increment implements actual
source-based regional inventory accounting and supplied-member metric
calculation. It does not supply calibrated regional scenario distributions or
an independently verified climate ensemble.

## Regional inventory: actual source test

The source revision and all four EDGAR workbook SHA-256 hashes are verified
against the existing pinned inventory before parsing. Native Gg are converted
to Mt; fossil CO2 uses the existing GCB global scaling, with EDGAR geographic
and sector proportions. Missing cells are counted, not converted to zero.
Signed corrections are retained. EU27 excludes the UK; AIR and SEA are separate
international transport accounts.

The reconstruction contains **482 region/sector/native-gas cells**. Every
global non-land-use gas/sector total reconciles within relative tolerance
1e-9 (absolute floor 1e-21 Mt for zero-scale comparison).

| Region | 2024 GtCO2e, AR6 GWP100, excluding net land-use CO2 |
|---|---:|
| China | 15.2231812070 |
| EU27 | 3.1114658619 |
| India | 4.2990083513 |
| International transport | 1.3256033129 |
| Rest of World | 22.4683765513 |
| US | 5.7991188433 |

Evidence state: **Model-assisted estimate**. These are not independent regional
GCB observations: fossil CO2 is an explicit allocation.

Private output: `generated-artifacts/regional-inventory/inventory.json`.
Content identity:
`61bfbe3404ec5fef56807bd44494bc11642828a22c96d8b4a9aed891afaeb068`.
Reproduce with `npx tsx script/build-regional-inventory.ts`.

The remaining global **4.585508213 GtCO2 net land-use term has no regional
allocation in this baseline**. Inspection of the pinned source repository found
national land-use workbooks for 2022 and 2023, not a reconciled national 2024
source. Older shares have not silently been substituted. Production eligibility
remains false. A source-compatible regional land-use allocation and calibrated
regional drivers are prerequisites for the complete scenario ensemble.

## Coherent metrics: implemented and fixture tested

`summarizeMemberMetrics` requires unique aligned members, annual data from
2024 through 2100, finite temperature/GHG/CO2 arrays, a 1850–1900 temperature
baseline and positive starting emissions. It supports up to 10,000 members.

It returns:

- Temperature mean, median, P10/P90, density and exceedance probabilities from
  the same temperature members.
- First and durable-through-2100 net-zero crossings separately for GHG and CO2.
- Model-conditional P(net zero by 2050); censored unconditional quantiles and
  conditional-on-reaching summaries. No artificial 2100 or 2200 event dates.
- A separately named durable 5%-of-own-2024 GHG milestone.
- Compound annual reduction rates for 2024–2030, 2030–2050 and 2050–2100 only
  where both endpoint emissions are positive. Otherwise the rate is unavailable,
  with absolute annual mass change still reported.
- A hash of the complete submitted member bundle.

Boundary fixtures pass for rebound, never-reaching members, mismatched arrays,
duplicate identities, and missing annual observations. A test member crossing
GHG zero in 2050 and rebounding in 2060 has durable net zero in 2061, while its
separate CO2 crossing remains 2040. Its 5% milestone is 2050, not net zero.

The resource-limited diagnostic endpoint accepts operation `member-metrics`
at POST `/api/calculation/research-contracts`. Its existing request-size limit
is unchanged; large 10,000-member bundles are processed offline:

`npx tsx script/summarize-member-ensemble.ts <member-bundle.json>`

Outputs are private, content-addressed files under
`generated-artifacts/member-metrics/`. No missing-input fallback or scientific
promotion is performed. These supplied-member calculations remain
**Bounded/conditional estimates**, not independently validated forecasts.

## Remaining work

Regional land-use source reconciliation, calibrated joint regional parameter
distributions, the full 10,000-member emissions run, convergence, physical
reference verification, real attribution and UI headline migration remain open.
Passing these accounting and metric tests does not complete those requirements.

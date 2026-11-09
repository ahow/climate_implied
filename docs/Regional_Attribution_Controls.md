# Regional climate attribution controls

## Question and counterfactual

This experiment exercises exact member-level regional attribution using actual
FaIR executions, rather than synthetic temperature fixtures.

The target is the retained constant-input regional accounting control. The
baseline removes all six regions' inventoried greenhouse-gas emissions and net
land-use CO2 flux from 2025 onward. Every coalition restores the selected
regions' annual native-gas trajectory. History through 2023 and the 2024
inventory anchor remain unchanged in every case.

The six groups are China, EU27, India, International transport, Rest of World
and US. A removed region loses both its sources and any net land-use sink.
Consequently, removing a sink is not treated as an emissions reduction.

These are not feasible mitigation scenarios or causal responsibility estimates.
Aerosols, ozone precursors outside the inventoried gases, upstream natural
forcing and other non-inventory inputs remain fixed. Regional attribution
therefore concerns only this defined native-gas counterfactual.

## Implementation

`script/regional_coalition_controls.py`:

- Verifies the completed regional member stream against its SHA-256.
- Validates all annual native regional totals against the global member.
- Preserves the fossil/land CO2 split, including signed land sinks.
- Retains the full 2024 baseline even when a region is excluded.
- Builds every one of the 64 coalitions.
- Executes a fresh FaIR 2.2.4 instance for each coalition using the same 841
  upstream climate configurations and the same additional-species history.
- Reuses input files only after checking their exact pinned content hashes.
- Retains all 2100 member temperatures and individual run summaries privately.
  Large full temporal ensembles are not duplicated for every coalition.

The history is the explicit zero-missing research sensitivity documented in
[Minor Gas History Sensitivity](Minor_Gas_History_Sensitivity.md). Its assumed
pre-1970 zeros and missing Mexican values remain assumptions, not observations.

`script/regional-attribution.ts` applies the existing exact Shapley implementation
to the complete paired coalition table. Contributions reconcile to the difference
between the all-region and no-region controls separately for each climate member.
Percentiles are calculated from those member-level contributions, not by
subtracting separately calculated marginal percentiles. Marginal regional medians
need not add up to the median total.

## Reproduction

```
uv run python script/regional_coalition_controls.py <member-stream> <history-file> <new-private-output-directory>
npx tsx script/regional-attribution.ts <completed-private-output-directory>
```

The source member, history, baseline inventory and upstream files must be
available. An existing output directory is refused. A completion marker is
written only after all 64 runs finish. The attribution command refuses an
incomplete run or unexpected member/coalition counts.

## Executed results

All 64 coalitions completed with 841 configurations each: 53,824 climate-member
projections. Exact Shapley reconciliation's maximum absolute residual was
8.881784197001252 × 10−16°C, below the 0.001°C accounting tolerance.
The all-region coalition exactly reproduced the previously retained full
regional control for all 841 members (maximum absolute difference 0°C).

| Region | P10 contribution °C | Median contribution °C | P90 contribution °C |
|---|---:|---:|---:|
| China | 0.37452 | 0.48284 | 0.61097 |
| EU27 | 0.08326 | 0.10667 | 0.13609 |
| India | 0.12269 | 0.15636 | 0.19985 |
| International transport | 0.02880 | 0.03738 | 0.04734 |
| Rest of World | 0.75462 | 0.96772 | 1.24411 |
| US | 0.15607 | 0.20065 | 0.25478 |

The paired total 2100 temperature difference is P10/P50/P90:
1.52243 / 1.95000 / 2.49130°C. This is the difference between two specified
controls, **not** total warming, a policy benefit estimate or an approved forecast.
All historical emissions remain present in both controls. No historical
responsibility attribution is attempted.

The retained attribution result is content-addressed:
`a74d9963a93e674bd66da9493b20cf9ef2a63563a4019bc99a5df7b46a640ecd`.
Raw histories, coalitions, member temperatures and run outputs remain excluded
from GitHub. Code, documentation and compact numerical interpretation are exported.

Verification also passed 179 TypeScript tests, 40 Python tests, type checking,
the production build and the existing 18-stage check groups. The workplan's
overall acceptance remains incomplete despite these passing checks.

## Remaining scope

This is a single conditional regional-accounting member with 841 climate
configurations, **not** a calibrated 10,000-member joint driver ensemble.
Shapley reconciliation verifies accounting, not the validity of the chosen
counterfactual. Exact enumeration removes Shapley sampling error; it does not
remove climate, emissions, historical or structural uncertainty.

No headline forecast, model approval, regional policy recommendation or user
interface readiness follows from this experiment. Calibrated regional inputs,
complete forcing treatment, accepted history, independent validation and
production integration remain separate work.

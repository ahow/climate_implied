# Native-gas history audit and regional FaIR sensitivity

## Source recovered

The same pinned EDGAR v2025 F-gas workbook used for the frozen 2024 inventory
contains native annual histories from 1970–2024 for HFC-41, HFC-134 and HFC-143.
The downloaded workbook was verified against the inventory's SHA-256:
`1109c2459bd95b296ce2797046b72070ff9180ee7a62e72a6e953090a7f0b5c1`.

Source:
https://raw.githubusercontent.com/ClimateIndicator/GHG-Emissions-Assessment/e81bb760b66ab182f9052d8d4218d42a97acbd75/sources/EDGAR/EDGAR_F-gases_1970_2024.xlsx

The ten gas/country/sector rows contain:

- HFC-41: two rows, no missing cells in 1970–2024.
- HFC-143: three rows, no missing cells in 1970–2024.
- HFC-134: five rows; Mexico, sector 2.F, is missing for 2020–2024.

The audit retains missing global totals as null and reports known subtotals
separately. No omitted cell is labelled as an observed zero. The 2024 reported
subtotals reconcile with the existing frozen inventory, which omitted those
missing source cells. This reconciliation does not establish complete coverage.
Pre-1970 observations are not provided by this workbook.

## Explicit, unapproved sensitivity histories

Three histories were constructed for research, not approved model inputs:

1. Missing Mexican values treated as zero.
2. Missing Mexican values carried forward from the last reported observation.
3. Missing Mexican values set to the highest earlier reported observation,
   as an additional stress case, not an estimated history or rigorous upper bound.

All three share assumed zero emissions before 1970. This is a modelling
assumption, not a recovered measurement. Only 1750–2023 histories vary.
The same frozen 2024 baseline and constant-input regional future pathway
remain fixed, including the inventory's omitted Mexican 2024 cell. The stress
case therefore contains a deliberate return to the fixed baseline in 2024.

The first two histories proved identical because the last Mexican observation
was zero. That equality is **not** a robustness finding. The third case was
added as an explicitly separate exploratory stress, without changing a
prespecified hypothesis or acceptance threshold.

## Actual coupled runs

All three cases completed the full FaIR 2.2.4 run using the regional control
member and all 841 pinned climate configurations. Historical/future unit
conversion is native gas mass; GWP totals are never used as CO2 inputs.
Fresh model instances isolate the experiments.

The comparison verifies matching member IDs, years, temperature baseline,
future pathway, upstream revision and calibration input hashes.

| Comparison | Maximum absolute paired temperature difference over all years and members |
|---|---:|
| Zero vs last-observation carry-forward | 0°C, identical input histories |
| Zero vs historical-peak stress | 1.385676 × 10−7°C |

For the peak stress, the 2100 paired P10/P50/P90 differences are approximately
2.02 × 10−9 / 4.66 × 10−9 / 9.81 × 10−9°C.

The constant-input control itself gives 2100 P10/P50/P90 temperatures of
2.20935 / 2.84082 / 3.64085°C. **These are not dashboard forecasts.**
The future regional inputs are uncalibrated constant-accounting controls;
the 841 climate configurations are not a calibrated 10,000-member joint
regional/driver ensemble. No default value or scientific readiness gate changed.

## Reproduction and retained evidence

Raw workbook, constructed histories and full ensembles remain private under
generated-artifacts; only source references, code and this interpretation are
exported to GitHub.

```
npx tsx script/build-minor-gas-histories.ts
uv run python script/fair-reference.py --pathway <retained-regional-pathway> --species-history <history-file> --output-directory <new-output-directory>
uv run python script/compare_fair_histories.py <zero-directory> <carry-directory> <peak-directory>
```

The history builder requires the retained hash-matching workbook in
generated-artifacts/species-research. Candidate runs refuse an existing output
directory. Comparisons and histories use content-addressed evidence files.

## Conclusion and remaining work

End-to-end regional native-gas coupling is now demonstrated **under explicit
research assumptions**. Missing gas implementation is no longer an engineering
block to such controls. The tested Mexican historical gap has very small
impact in this control, but the experiment does not bound unknown actual
emissions or validate pre-1970 history.

Historical forcing reconciliation, accepted missing-data treatment, independent
climate validation, calibrated regional drivers, 10,000-member convergence and
actual attribution remain unfinished. Company/valuation/portfolio work,
dashboard-wide historical mode, recovery and independent acceptance remain
as listed in the wider workplan register.

Verification: 179 TypeScript tests, 37 Python tests, type checking and production
build passed. All 18 existing stage check groups passed; the runner explicitly
retains incomplete implementation acceptance. These counts do not certify the
assumed histories or the uncalibrated control scenario.

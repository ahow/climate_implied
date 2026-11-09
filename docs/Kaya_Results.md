# Kaya accounting results and remaining calibration requirements

## Implementation and actual source evaluation

`script/kaya_decomposition.py` implements additive LMDI, with endpoint and
chained annual accounts, immutable source checks and strict complete-window
requirements. The [protocol](Kaya_Protocol.md) defines interpretation and units.
This is Stage 4 progress, **not completion of Stage 4 or the workplan**.

Actual 2010–2018 endpoint contributions, MtCO2 (rounded):

| Region | Population | GDP/person | Energy/GDP | CO2/energy | Total change |
|---|---:|---:|---:|---:|---:|
| China | 460.287 | 4,741.073 | −2,563.336 | −901.282 | 1,736.742 |
| India | 210.981 | 918.844 | −347.258 | 134.131 | 916.697 |
| United States | 409.700 | 546.278 | −785.404 | −478.588 | −308.014 |

These are descriptive allocations under an identity, not causal estimates
of policy effects. Maximum endpoint reconciliation error among these accounts
is 3.37e-11 MtCO2. Chained annual results are retained separately.

All seven 2019–2024 regional windows are unavailable under the fixed
complete-window rule. China, India, US and World lack two required cells each;
EU27 lacks six; Rest of World and International transport lack all 24.
In 2010–2018, World lacks four cells, EU27 nine, and the last two accounts all
36. No data were invented or carried forward to manufacture completion.
The private report lists the exact years and missing fields.

Frozen evidence:
`generated-artifacts/driver-calibration/kaya-827a9def3c32da2711918871a6f0640b79c5f432854f2a112b38b54e05b6e0d6.json`.
Raw input hashes and source revision are retained in that report and executable.
Raw sources are excluded from the GitHub export.

## Tests

Three focused test groups pass: known single-driver/offsetting-driver accounts;
annual chaining, ordering, future-data isolation, missing windows and duplicate
years; invalid/nonfinite/nonpositive input and near-equal endpoints.
The full workplan verification runner also executes the actual source study.

## What this does not resolve

- Complete regional GDP/energy observations and compatible aggregation.
- Calibrated policy-delivery, fleet, heat-pump and storage pathways.
- Out-of-sample forecasts of each factor and their joint uncertainty.
- Independent identification of drivers or avoidance of overlap in policy
  coefficients; accounting reconciliation alone cannot establish these.
- Promotion of the regional emissions/temperature ensemble into the dashboard.

The dashboard headline and collection/approval process are unchanged.

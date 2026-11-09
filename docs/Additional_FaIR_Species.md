# Additional native species: sourced parameters and FaIR controls

**Follow-on:** [EDGAR history sensitivity](Minor_Gas_History_Sensitivity.md)
recovered 1970–2024 histories, identified specific missing Mexican cells and
completed three regional-control FaIR runs under explicit unapproved assumptions.
The original missing-history failure below remains the record of that earlier run.

## Published basis

The final IPCC AR6 WGI Chapter 7 Supplementary Material, Table 7.SM.7,
provides the following physical parameters:

| Gas | Formula | Lifetime, years | Radiative efficiency, W m−2 ppb−1 |
|---|---|---:|---:|
| HFC-41 | CH3F | 2.8 | 0.025 |
| HFC-134 | CHF2CHF2 | 10.0 | 0.194 |
| HFC-143 | CH2FCHF2 | 3.6 | 0.128 |

[Final IPCC source](https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter07_SM.pdf).
Downloaded PDF SHA-256:
`4290518ef9418a4157ddb9481e589131eeb110614c3aa7b62641d3241d39ce58`.
The source PDF remains private under generated-artifacts, not redistributed.

The gases are added separately. HFC-134a and HFC-143a remain unchanged; no isomer
substitution or conversion of GWP-weighted emissions into CO2 is performed.
Molecular weights are calculated from the chemical formulas and rounded to
34.03, 102.03 and 84.04 g/mol respectively.

## Implementation and assumptions

Custom configs use the pinned FaIR minor-gas structural convention: one active
gas box, constant species-specific lifetime, no lifetime feedback, unit forcing
efficacy/scale and zero tropospheric adjustment. The 100-year integrated
airborne fraction and lifetime-scaling coefficients are calculated from each
gas's lifetime, not copied from an isomer.

Zero preindustrial baseline concentration is a declared modelling assumption.
Actual historical accumulation must be driven by an explicitly supplied
1750–2023 emissions series. This does not justify silently inserting zero
emissions in missing historical years.

The candidate runner accepts `--species-history` alongside `--pathway`.
The historical input must specify all three gases, native Mt/year, every year
1750–2023, nonnegative finite values, a source URL and a measurement or
reconstruction basis. Source declarations are not independent verification.
History is converted to FaIR's kt units. Future slots remain missing until
the existing strict 2024–2100 native-pathway bridge fills them. Unused template
years beyond the simulation are removed, not extrapolated.

Without a history file, the candidate run continues to fail explicitly and
records the available physical parameters and remaining historical dependency.
No source history has been invented or silently supplied.

## Executed physical controls

Three fresh FaIR 2.2.4 instances received isolated one-kt emissions pulses,
starting from a deliberately empty control atmosphere. A simple fixed climate
response was used only to check positive response, not to estimate warming.

| Gas | Burden remaining ten years after the pulse year | Absolute error vs exp(−10/lifetime) |
|---|---:|---:|
| HFC-41 | 0.02811566 | 2.8 × 10−17 |
| HFC-134 | 0.36787944 | 2.2 × 10−16 |
| HFC-143 | 0.06217652 | 2.1 × 10−17 |

All forcing and temperature responses were positive and finite. These checks
exercise real FaIR execution, not only formula fixtures.

Run `uv run python script/fair_minor_gas_controls.py`.
Tests additionally check loading into FaIR, preservation of existing isomers,
unit conversion, missing-history refusal and full future-pathway insertion.

## Remaining limitations

The previous **physical parameter/model support** gap is resolved under the
stated assumptions. Sourced historical emissions are still missing, so the
actual regional-control pathway has not produced an accepted temperature run.
Parameter uncertainty, current historical forcing, independent climate
validation and the calibrated 10,000-member regional ensemble remain open.
No headline warming, live model eligibility, approval or collection process
changes result from this work.

The retained actual regional control was rerun without a fabricated history
file. It correctly refused the three missing historical series and recorded
the sourced parameter evidence. No regional-control temperature was produced.

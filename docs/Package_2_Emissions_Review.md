# Package 2 — emissions repair workbench

## Status: partial implementation, not approved for promotion

This workbench is separate from the legacy dashboard calculation. Package 2
is **not yet complete**: source allocation assessment and evidence-based
parameterization of the central scenario remain outstanding. It must not be
mistaken for the final repaired forecast. Packages 3 and 4 have not started.

The dashboard now contains a read-only candidate review below the headline.
Switch between a constant-activity diagnostic and an illustrative transition.
Neither selection changes the existing headline temperature. No temperature is
computed from candidate CO2e totals.

## Inventory reconciliation (B1)

Source: Forster et al. (2026), IGCC 2025, Table 1 and section 2:
https://essd.copernicus.org/articles/18/3889/2026/

Reference inventory year is 2024, not the current calendar year. The approved
reporting total is 56.8 ± 5.5 GtCO2e (90% uncertainty, AR6 GWP100).
The separate UNEP 57.7 comparison is not used as a calibration target.

Native gas records come from the source assessment's EDGAR v2025 workbooks.
The preparation script pins the assessment repository and GWP source revision.
All source hashes, excluded missing records and signed source-record counts
are recorded in the compact inventory JSON. Large workbooks are not exported.

- CO2-FFI and LULUCF totals use the pinned IGCC release's unrounded GCB values.
- CH4 and N2O native emissions use Gg -> Mt conversion, not reverse conversion
  of rounded headline CO2e. Reporting factors follow the assessment: 27.9 and 273.
- UNFCCC F-gases are retained species by species with AR6 GWP100 factors.
  HCFCs are excluded from this reporting boundary, not assumed absent from
  atmospheric forcing. Package 3 will require those additional forcing inputs.
- Net LULUCF follows GCB's BLUE/OSCAR/LUCE bookkeeping convention. It is not the
  national-inventory managed-land sink and is not scaled by GDP.
- EDGAR fossil-CO2 sector shares allocate the GCB fossil-CO2 total. This is an
  explicitly reconstructed allocation, not independent measured sector totals.
- The preparation script verifies each gas-group total against the unrounded
  source CSV within 1e-7 GtCO2e, and against the rounded table within 0.051.
- As in the upstream assessment, missing country/sector cells are omitted when
  summing; their counts are retained as a quality flag. Signed country-level
  adjustments are preserved before aggregation, not clipped to zero.

The aggregate EDGAR 1.A.4 category is not split artificially into separate
residential/commercial/agricultural combustion records. It is retained in
the candidate's “other” bucket pending a defensible crosswalk.

## Implemented mechanism tests (B2–B5)

These are deterministic conditional scenarios, not an uncertainty ensemble.
The published inventory uncertainty is not presented as a forecast interval.

| Mechanism | Candidate treatment |
|---|---|
| Policy | Incremental coverage × implementation × maximum abatement × lagged saturating delivery; all fractions bounded |
| Corporate | Coverage × delivery × same bounded implementation curve |
| Overlap | Complete overlap: maximum delivered technical/policy/corporate reduction, not their sum |
| EV sales | Bounded logistic share; negative adoption trend requires explicit reversal |
| EV fleet | Annual turnover; prior year's sales mix affects this year's fleet |
| EV displacement | Only road-transport fossil CO2; passenger fraction is a fraction of eligible road emissions despite the internal legacy-style parameter name |
| Electricity | Annual additions and retirements, capacity × capacity factor × 8.76 -> TWh; demand, EV electricity and available fossil displacement constrain use |
| Activity | Annual physical activity index compounded independently of end year; not a nominal/PPP GDP series |
| Residual intensity | Explicit annual efficiency scenario parameter; excludes reductions already represented by technology, policy and corporate mechanisms |
| Finance | No causal multiplier from investment ratios or bond issuance |
| Non-CO2 / land | Separate, constant native-gas pathways in these diagnostic scenarios; no unjustified automatic decay |

The illustrative values (including policy delivery, renewable additions,
capacity factor, fleet/grid assumptions and power demand) are **not fitted
or scientifically validated defaults**. Zero autonomous decay replaces the old
unexplained industry/buildings/agriculture decay in this candidate only.

EV displacement removes direct tailpipe emissions; its extra electricity is
accounted for in the power balance. A well-to-wheel reduction factor is not
also applied, which would count the grid-emissions penalty twice.

## Indicator roles (B6)

The workbench intentionally does not read the mixed-year dashboard nowcast.
Its inputs are the 2024 inventory plus explicit scenario parameters.

- Renewable capacity/additions, EV sales/fleet and policy/corporate delivery
  are candidate mechanism inputs; dashboard indicator values are not yet
  wired in as calibrated assumptions.
- GDP and aggregate carbon intensity are contextual/comparison data until
  price basis and residual-intensity overlap are resolved. No 0.32 divisor.
- Fossil CO2 is an inventory/reference quantity, not an outcome multiplier.
- Atmospheric concentration and its growth rate are validation inputs for
  the physical climate model, not emissions accelerators.
- Finance flows, green bonds and target counts have no independent causal
  coefficient without evidence. They remain contextual.

## Remaining work before completing Package 2

1. Assess the sector crosswalk and GCB/EDGAR allocation, particularly combined
   combustion categories; retain uncertainty rather than inventing splits.
2. Establish evidence-based central sector activity, efficiency, electrification,
   industrial-process and agricultural pathways. Constant pathways are controls,
   not completed sector models.
3. Parameterize policy/corporate delivery and overlaps with independent evidence;
   controlled monotonicity tests are not empirical calibration.
4. Connect appropriate approved indicators to the central scenario with explicit
   date/basis checks, then run and explain matched before/after trajectories.

The legacy headline stays unchanged while these are unfinished. FaIR conversion,
historical validation and consumer promotion remain Packages 3–4. Collection,
approval, source overrides, deployment and finance calculations are unchanged.

The central policy case must also be explicit: implementation of existing
policies and delivery of all announced commitments are different scenarios.
The illustrative transition is neither, and should not be used as a substitute.

## Verification of the current workbench

Seven candidate tests and nineteen existing regression tests passed. The
production build succeeded; type checking still reports the eight pre-existing
upload/schema errors, with no new errors. Both candidate API scenarios returned
200; invalid scenario names returned 400. A Preview screenshot confirmed that
the new review section renders. Its scenario selector changes the query URL;
both corresponding API responses were checked.

The constant-activity control remains 56.81226 GtCO2e throughout. The
illustrative transition returns 53.94627 in 2030, 46.50376 in 2050 and 38.49126
in 2100. These are diagnostic outputs of the disclosed assumptions, not new
forecasts. The existing headline API remained 2.401152°C.

## Developer checks

```sh
npx tsx script/build-emissions-inventory.ts
npx tsx --test script/emissions-candidate.test.ts script/calculation-foundations.test.ts script/priority1.test.ts
```

Read-only endpoints:

- `/api/emissions/candidate?scenario=constant`
- `/api/emissions/candidate?scenario=transition`

Invalid scenario names return 400. Responses include native Mt by gas, reporting
GtCO2e by sector, annual energy accounting and a version/input/settings identity.
Source preparation is a manual research operation, not a new scheduled import.

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

The workbench does not read the mixed-year dashboard nowcast. The additional
`dashboard` diagnostic reads the **effective 2024 curated/approved row** plus
2023 capacity to calculate net additions. It does not import proposals or change
the collection/approval process. A same-year approved override changes the
effective inputs and calculation identity. A later-year override cannot be
silently applied to the 2024 inventory.

- Renewable capacity and EV sales are connected in this diagnostic, not in a
  calibrated central forecast. The diagnostic holds the latest dated sales mix
  and net annual additions constant, with no inferred acceleration. Net
  additions are paired with zero retirements to avoid subtracting retirements
  twice. A gross-additions scenario requires separate retirement evidence.
- All registered dashboard indicators have an explicit mechanism-input,
  validation or context role and a reason, exposed by the API and review panel.
- GDP and aggregate carbon intensity are contextual/comparison data until
  price basis and residual-intensity overlap are resolved. No 0.32 divisor.
- Fossil CO2 is an inventory/reference quantity, not an outcome multiplier.
- Atmospheric concentration and its growth rate are validation inputs for
  the physical climate model, not emissions accelerators.
- Finance flows, green bonds and target counts have no independent causal
  coefficient without evidence. They remain contextual.

## Remaining work before completing Package 2

The pinned NGFS 5.1 archive has now been obtained and assessed. See
[NGFS pathway compatibility assessment](NGFS_Pathway_Compatibility_Assessment.md)
for measured baseline differences, native-gas coverage, licensing and the
adapter-development recommendation. This resolves source acquisition and
initial assessment, not central-scenario calibration or Package 2 completion.

1. Assess the sector crosswalk and GCB/EDGAR allocation, particularly combined
   combustion categories; retain uncertainty rather than inventing splits.
2. Establish evidence-based central sector activity, efficiency, electrification,
   industrial-process and agricultural pathways. Constant pathways are controls,
   not completed sector models.
3. Parameterize policy/corporate delivery and overlaps with independent evidence;
   controlled monotonicity tests are not empirical calibration.
4. Connect appropriate approved indicators to the central scenario with explicit
   date/basis checks, then run and explain matched before/after trajectories.

The dated diagnostic connection is now implemented, but it is not the central
scenario in item 4. The API explicitly returns `blocked-evidence-required`.

## Additional mechanism repairs and evidence assessment

The engine now supports separately documented sector activity and residual
efficiency pathways, each with a fixed trend end year independent of the
requested output horizon. They operate on native gas masses, including
agricultural methane and nitrous oxide. They are not automatically populated
with assumed central rates.

Scoped abatement measures require exact source-sector codes, native gas names,
bounded emissions coverage, implementation, reduction potential, delivery
timing and an evidence description. Policy, corporate and process measures
use complete overlap, not additive savings. An evidence description is a
required audit field, **not automatic scientific validation**.

Generic policy multipliers no longer reduce power CO2 independently of the
electricity balance. A scoped power measure is rejected until a fuel-mix or
capture mechanism can represent it. Nuclear generation can be supplied
separately from renewables. EV electricity load now accounts for passenger
activity growth while removing the initial EV load from the non-EV demand
base, avoiding double counting. Reversal uses the same baseline-relative
tailpipe denominator as adoption. Plug-in hybrids may have partial direct
tailpipe displacement; grid emissions are still accounted for separately.

### What the source review establishes—and does not establish

- [IEA WEO 2025 Current Policies Scenario](https://www.iea.org/reports/world-energy-outlook-2025/current-policies-scenario):
  total final consumption grows around 1.3% annually over the next decade,
  solar additions average 540 GW to 2035 and energy-related CO2 approaches
  40 Gt in the early 2030s. These are global scenario aggregates, **not
  gas-by-sector implementation coefficients**. Applying 1.3% to every sector
  or solar additions to the entire renewable mix would be unjustified.
- [IEA Global Energy Review 2025](https://www.iea.org/reports/global-energy-review-2025/electricity):
  2024 electricity demand grew 4.3%, compared with a 2.7% 2010–2023 average.
  Neither single rate is silently extrapolated through 2100. The report also
  distinguishes nuclear generation and plug-in hybrids, motivating their
  explicit accounting above.
- [UNEP Emissions Gap Report 2025](https://www.unep.org/resources/emissions-gap-report-2025):
  current policies and full NDC implementation are different cases. Its
  temperature headlines are not used to tune emissions or replace FaIR.
- The existing policy implementation collection definition measures legal
  status, and corporate coverage is company/market-cap based. Neither supplies
  the emissions-weighted eligibility or abatement timing needed by the repaired
  mechanism. Both remain context rather than receiving invented coefficients.

Consequently, the approved two policy cases are not yet produced. Finishing
the acceptance gate requires a quantified, dated sector/gas reference pathway
or a calibrated set of measures—not simply setting implementation to 100%.
No claim of completed Package 2, calibration or readiness for Package 3 is made.

The legacy headline stays unchanged while these are unfinished. FaIR conversion,
historical validation and consumer promotion remain Packages 3–4. Collection,
approval, source overrides, deployment and finance calculations are unchanged.

## Approved central policy basis

The main projection will use **implemented policies**. Delivery of all
**announced commitments** will be a separate comparison scenario, not an
additional reduction added to the main case. The user approved this basis.

Retain both policy coverage and policy implementation indicators. Coverage
describes the reach of targets; implementation must represent evidence of
measures actually in place and their expected effects. The existing collection
definition (targets enshrined in law or policy) is not, on its own, evidence of
delivered reductions. Keep that value available as target/legal-status context
until its suitability as a quantitative input is established.

Implementation requirements within Package 2:

- Build the central case from evidenced measures and technology pathways;
  do not credit uncovered or unimplemented promises automatically.
- Specify the additional measures and delivery assumptions needed to achieve
  commitments in the comparison case. Do not obtain this case merely by
  setting the old implementation indicator to 100%.
- Apply explicit sector eligibility, timing and overlap accounting so policy,
  technology and corporate measures do not receive duplicate credit.
- Identify each dashboard indicator as a mechanism input, validation measure
  or context; preserve the existing collection and approval workflow.
- Compare the cases using the same starting inventory and disclose differences
  in assumptions and resulting emissions.

These are approved requirements, not completed calibration. The existing
illustrative transition is neither policy case and must not be relabeled as
one. The legacy headline remains unchanged pending the validation gates.

## Verification of the current workbench

Twelve candidate tests and nineteen existing regression tests cover the
mechanisms and foundations. The
production build succeeded; type checking still reports the eight pre-existing
upload/schema errors, with no new errors. Both candidate API scenarios returned
200; invalid scenario names returned 400. A Preview screenshot confirmed that
the new review section renders. Its scenario selector changes the query URL;
both corresponding API responses were checked.

The constant-activity control remains 56.81226 GtCO2e throughout. Diagnostic
outputs are not new forecasts. The existing headline calculation is unchanged.
The additional dated-dashboard diagnostic is sensitive to approved 2024 input
changes, but saturates once fossil power displacement is exhausted; extra
renewable capacity then cannot produce negative emissions.

## Developer checks

```sh
npx tsx script/build-emissions-inventory.ts
npx tsx --test script/emissions-candidate.test.ts script/calculation-foundations.test.ts script/priority1.test.ts
```

Read-only endpoints:

- `/api/emissions/candidate?scenario=constant`
- `/api/emissions/candidate?scenario=transition`
- `/api/emissions/candidate?scenario=dashboard`

Invalid scenario names return 400; invalid effective dated inputs return 422,
not fabricated fallback values. Responses include native Mt by gas, reporting
GtCO2e by sector, annual energy accounting and a version/input/settings identity.
Source preparation is a manual research operation, not a new scheduled import.

# Regional emissions and company operating engines

Execution date: 9 November 2026. **Stages 5, 8 and 12 remain partial.**
This report distinguishes real inventory accounting from synthetic parameter
tests. Neither is presented as empirical calibration or completion of the
entire workplan.

## Stages 5 and 8: regional native-emissions engine

The existing physical mechanism kernel can now operate on explicit regional
native-gas inventories. Each of China, EU27, India, US, Rest of World and
International transport must have a separate supplied scenario. No regional
scenario is inferred from a global intensity or silently filled in.

Inputs must reconcile against the frozen global inventory at 1e-9 relative
tolerance. Missing accounts, duplicate cells, duplicate scenarios and extra
gas/sector accounts fail. Negative land-use sinks are retained. Annual member
outputs contain regional gas/sector cell arrays, gas totals, sector totals,
fossil CO2 and signed land-use CO2. Global totals are formed by adding the
regional accounts—not by rerunning a global climate model.

The mechanism kernel retains its existing displacement, electricity-demand,
EV stock-turnover, scoped abatement and conservative overlap rules. The
original global comparator remains available with unchanged baseline inputs.
The engine produces no regional temperature.

### Actual inventory accounting test

Inventory ID:
`855acf26d6662c67a21f5c49556bc57ff2c9eb0f6fc7cee8048aaf451e280d55`.

| Check | Observed | Criterion |
|---|---|---|
| Global 2024 GHG | 56.81226234083023 GtCO2e | Reconcile frozen native inventory |
| Constant-control drift, 2024–2100 | 0 GtCO2e | <= 1e-9 GtCO2e |
| US-only activity shock | Other five accounts unchanged | Identical hashes |
| Negative land sinks | China, EU27, India retained | No zero clipping |
| Streamed control members | 2 accepted, 0 rejected | All controls accepted |
| Gzip replay | Exact SHA-256 match | Exact |
| Saved gas/sector cells | Every region/year reconciled | < 1e-9 GtCO2e |

These use the real inventory with **synthetic constant and activity-shock
dynamics**. They are not two calibrated scenario forecasts.

Private report: `generated-artifacts/regional-inventory/engine-accounting.json`.
Private streamed evidence: `generated-artifacts/regional-control-run/`.
Uncompressed member stream SHA-256:
`153c25928cc97d0439e3ac8b172683fb8b6fb34e73fdc82e818505d883901e38`.

### Joint sampling and storage

Complete joint parameter rows are resampled with a seeded RNG, preserving
the supplied cross-driver and cross-region dependence rather than sampling
marginals independently. Parameter rows have immutable identifiers and an
evidence/version record. The first 5,000 member draws are the same prefix of
a 10,000-member run. Reordered rows produce the same draws.

The offline runner streams compressed member records and a content hash.
Invalid physical draws are listed as rejected, not silently replaced or
clipped; any rejection gives a nonzero exit status. Existing run directories
cannot be overwritten. Raw member outputs stay outside source control.

**Fixture result:** 10,000 parameter draws passed deterministic order/prefix
and joint-dependence tests. This is a sampler test, **not** a 10,000-member
physical forecast or convergence result.

**Remaining:** sourced regional parameter distributions, defensible dependence
estimates, full calibrated ensemble execution, empirical convergence,
FaIR pairing, real attribution and public drilldowns. Corporate assumptions
are still diagnostic; no coefficient is promoted into a central case.

## Stage 12: conditional company operating engine

The supplied-input engine accepts up to 1,000 paired members and five annual
operating ledgers per member. All values must use one explicit nominal major
currency. Operating exposures must uniquely sum to one; headquarters fallback
is separately labelled. Each exposure follows its own activity path rather
than silently rebalancing fixed weights annually.

Revenue follows weighted cumulative activity and the supplied relative market
share. Emissions by scope are baseline emissions × activity × the supplied
baseline-relative intensity multiplier. No separate target abatement is
stacked on that intensity path.

Carbon drag is:

`(Scope1 × liableFraction1 + Scope2 × liableFraction2) × effectivePrice × (1 − passThrough)`

Scope 2 denotes the explicitly supplied electricity-price channel. Scope 3
never creates a direct charge. Demand effects must already be represented in
activity. Margin bounds and their evidence are required; invalid draws are
rejected rather than clipped into acceptable margins.

FCFE is:

`EBIT before carbon − carbon drag − interest + nonoperating income − cash tax + income attribution adjustment + depreciation + other cash adjustments − capex − increase in working capital + net borrowing`

The [sourced accounting controls](Company_Accounting_Controls.md) added the
required explicit non-operating, attribution and other-cash bridge terms.
These are not assumed zero or deemed recurring without source review.

Cash tax is nonnegative; tax losses do not create an assumed immediate refund.
Positive starting and ending FCFE give five-year CAGR. A nonpositive ending
FCFE returns unavailable growth rather than a fabricated rate. Financial
institutions return not modelled under this industrial operating model.

### Tests

- A 1,000-member utility fixture produces first-year revenue 1,020, Scope 1
  emissions 102 tonnes, carbon drag 51 and FCFE 40.8 in the fixture currency.
- Increasing only Scope 3 leaves FCFE growth unchanged.
- Member reordering returns identical results and hashes.
- Incomplete operating mappings, duplicate members, invalid pass-through and
  missing exposure trajectories are rejected.
- Financial institutions are returned as not modelled.

These are synthetic fixtures. No real-company projection or investment result
is inferred from them. Actual utility, oil-and-gas and industrial worked
examples remain outstanding, as do sourced operating data, price/pass-through
assumptions, valuation pairing and historical runs.

**Evidence state:** Bounded/conditional estimate.
**Claim:** conditional company operating projection, not empirically validated.

## Reproduction

```sh
npx tsx --test script/regional-engine.test.ts script/regional-sampling.test.ts \
  script/company-projection.test.ts
npx tsx script/verify-regional-accounting.ts
npx tsx script/run-regional-ensemble.ts inventory.json joint-parameters.json \
  generated-artifacts/new-regional-run
npx tsx script/project-company-members.ts supplied-company-input.json
```

The input files must be explicitly supplied; the production engine does not
substitute example assumptions. The company calculator is also exposed as
`company-projection` in the existing bounded research-contract endpoint.
Large bundles use the offline command; public request limits are unchanged.

## Corrections, defaults and release

Local full regression: **152 TypeScript tests and 24 Python tests passed**.
Type checking and production build passed. The real-inventory accounting and
compressed-stream replay checks above were executed separately.

The readiness response's default-engine label was also corrected to
`published-scenario-references`, matching the existing homepage. This is a
presentation correction, not candidate promotion; the scientific checks remain
unpassed. A separate regression asserts that distinction.

The first regional fixture referenced a nonexistent reporting-total property.
Before implementing the engine it was corrected to sum the frozen inventory's
native mass × GWP / 1,000 directly. The corrected test is stricter (1e-9 GtCO2e),
not a relaxed empirical acceptance threshold.

No production data migration, company approval, collection-cadence change,
scientific promotion or independent review was performed. No effort estimate
is represented as measured time. Full scientific and integrated acceptance
remain unfinished; this is not an all-stage completion statement.

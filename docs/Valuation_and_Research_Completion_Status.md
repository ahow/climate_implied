# Valuation and research continuation: implementation and remaining work

## Changes implemented

### Stage 11: paired D8 comparison

The comparison implementation now enforces a shared sample for Gordon and
reverse DCF, completed three-year cash-flow outcomes, separate FCFE/FCFF
comparisons and consecutive annual origin dates. It reports common-sample
coverage and rejects duplicate observations and premature outcome dates.

Both improvements must pass: lower cash-flow forecast MAE and higher
validation-signal Spearman IC, with paired 95% intervals strictly above zero.
Paired date-block resampling retains companies together within origins.
Constant signals report unavailable rather than an invented zero correlation.
The [fixed protocol](Valuation_Comparison_Protocol.md) binds the command-line
runner to a three-year block length, 2,000 repetitions and a fixed seed.

This implements the numerical comparison, not the missing empirical study.
Historical model predictions, model-specific signals and returns have not
been assembled on a sufficient common eligible universe. No winner is declared.

### Stages 10–11: actual historical FCFE outcomes

The retained, hash-verified FMP annual financial histories were assessed without
new provider requests or changing identity approvals. FCFE is OCF plus the
provider's negative capex plus net debt issuance. Working capital is not
subtracted again. Exact three-year fiscal endpoints and consistent currency
are mandatory.

| Company | Annual statements | Usable three-year outcomes | Exclusions |
|---|---:|---:|---|
| Caterpillar | 10 | 7 | 3 missing future endpoints |
| Chevron | 10 | 6 | 3 missing future endpoints; 1 non-positive FCFE endpoint |
| NextEra | 10 | 7 | 3 missing future endpoints |

These 20 outcomes are revised-history financial observations, not forecasts.
Only three companies are represented. They cannot satisfy the protocol's ten
common issuers per origin or establish investment usefulness.
Issuer ownership, statement classifications and publication-vintage checks
remain unresolved. The pre-existing Exxon identity mismatch is not bypassed.

Evidence is retained privately under `generated-artifacts/valuation-comparison/`.
Reproduction:

```
npx tsx script/audit-completed-cash-flow.ts generated-artifacts/company-worked-inputs/CAT-*.json generated-artifacts/company-worked-inputs/CVX-*.json generated-artifacts/company-worked-inputs/NEE-*.json
```

### Stage 14: full-family statistical adjudication

Added a runnable adjudicator for the frozen model × peer × target family and
all three primary hypotheses: evaluation R², signal IC and after-cost
long–short performance. Holm correction covers the entire declared family.
Unavailable tests stay in the family as non-rejections. Every endpoint must
have a positive estimate, a paired 95% interval above zero and a corrected
p-value at most 0.05.

Duplicate, undeclared and malformed results are rejected. The command takes a
separate frozen protocol file and scored result file and writes content-addressed
evidence. It does not generate or independently verify the supplied estimates,
p-values or intervals. Actual new-gap research remains incomplete.

```
npx tsx script/adjudicate-research-family.ts protocol.json scored-results.json
```

The protocol must contain `evidenceMode: "revised-history"`, a specifications
array of model/peer/target objects and `primaryEndpoints` in the order
evaluation-r2, signal-ic, after-cost-long-short. Retain and hash the protocol
before scoring; supplying its hash afterward does not prove precommitment.
Passing results are labelled locked retrospective revised-history research,
never validated investment evidence.

## Checks

Nine new regression tests cover paired improvement requirements, common-sample
coverage, unavailable outcomes, deterministic resampling, duplicates, invalid
cash-flow inputs, missing fiscal endpoints, constant-signal IC and full-family
correction. A TypeScript compatibility error was found and corrected before
release; no compiler setting was loosened.

The full regression run passed **167 TypeScript tests and 32 Python tests**.
All **18 existing stage check groups**, including opt-in retained-data checks,
passed; type checking and production build also passed. The workplan runner
deliberately returned exit code 2, meaning checks passed but implementation
acceptance remains incomplete. Test success is not full-stage acceptance.

## Whole-workplan areas still not implemented or accepted

The following is an explicit remaining-scope register, not a claim that all
unfinished engineering is externally blocked.

| Stage | What remains | Dependency type |
|---|---|---|
| 0 Safety | Actual recovery rehearsal, deliberate remote CI failure test, single enabled collection host verification | Operational work remains |
| 1 Outputs | Field-level semantic audit beyond the existing route/consumer/export census | Engineering/review remains |
| 2 Immutable history | All overlays/readers and full historical selection; production snapshot schema provisioning | Engineering plus supported production provisioning |
| 3 Driver evidence | Complete licence/vintage/uncertainty evidence for all quantitative drivers | Source assessment remains |
| 4 Calibration | Other technology, learning, policy and emissions drivers; validated joint dependence | Scientific implementation remains |
| 5 Ensemble | Calibrated 10,000-member run and actual convergence | Depends on accepted driver distributions |
| 6 References | Complete native-gas and all-commitments coverage; actual infill sensitivity | Source coverage and modelling remain |
| 7 Climate | Three unsupported native species, reconciled historical forcing, independent benchmark | Scientific inputs/implementation and independent review |
| 8 Attribution | Actual matched coalition/member runs and presentation | Depends on completed physical ensemble |
| 9 Historical skill | Quarterly reconstructions and one-to-three-year emissions evaluation | Engineering plus genuine original-vintage availability |
| 10 Companies | Broad reviewed identities, lifecycle, FX and financial coverage | Engineering plus independent evidence review |
| 11 Valuation | Actual common-sample historical D8 predictions/signals; financial-sector model | Engineering and evidence assembly remain |
| 12 Company projections | Calibrated activity/policy/geography/margin paths and three actual climate cases | Scientific mappings remain; financial controls are not climate cases |
| 13 Identification | Defensible valuation-to-activity mappings and separately evidenced identification | Scientific evidence remains; unavailable is valid |
| 14 Signal research | Actual paired new-gap estimates and all frozen-family outcomes | Depends on historical model signals; adjudicator alone is insufficient |
| 15 Portfolios | Actual new-gap portfolios and borrow, FX, lifecycle and factor sensitivities | Depends on signal history and market evidence |
| 16 Integration | Complete candidate/historical UI, API and export consistency | Depends partly on unfinished analytical outputs; reader work remains |
| 17 Acceptance | Clean full-model reproduction, independent/owner acceptance | Depends on preceding work; implementer cannot supply independent approval |

No private source extracts, financial histories or credentials are published.
No scientific threshold has been relaxed to mark a stage complete.

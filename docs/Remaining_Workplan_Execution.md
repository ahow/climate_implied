# Remaining workplan execution — 8 November 2026

This is an execution record, **not an all-stage completion statement**.
The [electricity-demand calibration report](Electricity_Demand_Calibration_Results.md)
adds five real-data holdout evaluations and a 225-observation comparison of
OWID's retired and replacement electricity datasets. Two demand candidates
beat both baselines; three remain sensitivity-only. No model was promoted.
The [regional and company engine report](Regional_and_Company_Engine_Execution.md)
adds six-account native projections, joint-parameter sampling, streamed member
storage and conditional company operating ledgers. Real-data calibration,
worked companies and downstream validation remain unfinished.
The subsequent [member analysis and currency report](Member_Analysis_and_Currency_Execution.md)
covers exact attribution, 5,000/10,000 convergence checks, order-invariant
member metrics and minor-unit currency handling. Those stages remain partial;
synthetic fixtures are not real-data ensemble validation.
The existing [stage matrix](Workplan_Status_and_Conclusions.md) remains binding.
No scientific acceptance threshold was relaxed.

## Stage 0 — safety: partial

Collection now acquires a PostgreSQL session advisory lock around the entire
provider job. Manual and scheduled callers share it. A competing host skips;
success/error releases the lock, and an unlock failure destroys the session.
The monthly cadence and manual approval requirement are unchanged.

Tests: mocked contention/error/unlock cases passed; two actual development
PostgreSQL sessions verified contention and subsequent reacquisition. This
does not prove that an older, independently deployed collector uses this lock.
Exactly-one-host configuration remains a separate operational check.

CI now has a promotion job dependent on successful TypeScript/Python tests,
type checking and build. It advances `production-validated` without force
pushing; obsolete source runs cannot promote over a newer main revision.
Railway must follow that branch for this to be an effective deployment gate.
The first real CI run successfully promoted source `500c14f4928b5aa8100c8b02209ff5a93d7b42a0`.
Railway was then switched from `main` to `production-validated`; its source
configuration was verified through the service API. The same source identity
was verified through the live application's build-info endpoint, with health 200.
The workflow structural regression passes; a deliberately failing remote
commit has not been tested. Recovery rehearsal is still outstanding.

## Stage 4 — uncertainty: partial, no promotion

The supplemental protocol was committed before running the new study.
Each of the ten original region/technology fits received 1,000 circular
three-year residual-block bootstrap replications, preserving paired
intercept/slope draws. Training-only reproducibility and future-observation
perturbation tests pass.

Holdout coverage of the 95% **parameter-only** intervals:

| Region | Solar | Wind |
|---|---:|---:|
| World | 0/6 | 0/6 |
| US | 0/6 | 3/6 |
| China | 0/6 | 0/6 |
| India | 0/6 | 3/6 |
| EU27 | 6/6 | 3/6 |

These are not full predictive intervals. Original nine baseline failures remain
sensitivity-only. EU solar remains a candidate, not a promoted central input.
Early/late training slopes are reported, not presented as a formal break test.
Other technologies, learning curves, Kaya decomposition, policy calibration,
recent-emissions reconstruction and cross-driver dependence remain unfinished.

Private evidence: `generated-artifacts/driver-calibration/uncertainty.json`.

## Stage 5 — regional land allocation: accounting passed, ensemble partial

Found and verified the GCB 2025 national land-use workbook:
https://globalcarbonbudget.org/datahub/the-latest-gcb-data-2025/

Raw SHA-256:
`7dcf3e8706ab79e989d0346a2878c04b0d8dc7bfc6eea3a299060221aab02474`.
Use and attribution follow the published GCB fair-use statement and workbook
source-citation instructions; raw files are not exported to GitHub.

The equal BLUE/OSCAR/LUCE 2024 mean is 4,585.505258 MtCO₂, versus the
frozen anchor 4,585.508213 MtCO₂. Relative difference: 6.44485e-7.
A disclosed common factor of 1.0000006444858676 reconciles this rounding/source
precision difference. Larger-than-1e-6 disagreement is rejected.
Published EU27, US, China and India totals are used directly; Rest of World
is the residual against the published global account. Negative sinks are
retained. International transport has structural-zero land-use emissions.

Complete 2024 inventory, GtCO₂e AR6 GWP100:

| Region | Total |
|---|---:|
| China | 14.974943081 |
| EU27 | 3.075746700 |
| India | 4.198642240 |
| International transport | 1.325603313 |
| Rest of World | 27.345966319 |
| US | 5.891360689 |

All 488 cells reconcile to global native gas/sector accounts at 1e-9 relative
tolerance. Content identity:
`855acf26d6662c67a21f5c49556bc57ff2c9eb0f6fc7cee8048aaf451e280d55`.

Test correction disclosed: exact binary equality for -36.64 Mt differed by
about 1e-14 Mt. The fixture now uses 1e-10 Mt numerical tolerance.
No empirical compatibility threshold changed.

The former missing-regional-land-source dependency is resolved. A calibrated
10,000-member projection engine and its convergence study remain unfinished;
this accounting result is a Model-assisted estimate, not a forecast.

## Stage 7 — pulse checks: diagnostic passed, physical acceptance incomplete

The pulse protocol was committed before execution. Real FaIR 2.2.4 runs use
all 841 configurations and previously pinned input hashes. Each case gets a
fresh model instance.

| Diagnostic | Observed result | Criterion |
|---|---:|---|
| 100 GtCO₂ pulse, median 2035 response | +0.038907°C | Positive: passed |
| 100 GtCO₂ pulse, median 2100 response | +0.033265°C | Positive: passed |
| 100 MtCH₄ pulse, median excess in 2026 | 33.685438 ppb | Positive: passed |
| CH₄ excess in 2036 / 2056 | 16.562238 / 4.145640 ppb | Declining: passed |
| CH₄ median excess e-folding time | 15 years | Reported, no tuned cutoff |

Initial failure: reusing one FaIR object across runs contaminated response
state; resetting output arrays was insufficient. Fresh instances corrected
the harness; the frozen criteria were unchanged.

These sign/decay checks are not an independent reference or standard TCRE
comparison. Historical forcing reconciliation, current native-gas coupling,
10,000-member convergence and independent validation remain open.
Private evidence: `generated-artifacts/fair-reference/pulse-checks.json`.

## Stage 10 — matching root-cause audit: audit passed, approvals incomplete

### Follow-on venue repair

Added conservative venue joins for ASX (AU/AT), JPX (JP/JT), Shanghai
(C1) and Shenzhen (C2), using the retained ISIN-first cross-provider audit
evidence. The shared Chinese CH composite is deliberately not used to merge
the two exchanges. Existing ADR, inactive-listing and identity-review gates
are unchanged.

Offline reassessment of the **same 100-case sample**, with no new provider
requests, recovers 16 candidates: 34 unmatched, 50 ambiguous and 16 awaiting
review. Zero approvals were created. This is not full-universe coverage.
The original audit remains unchanged; derived evidence is stored separately
in `generated-artifacts/financial-data/reassessed-root-causes.json`.

Tests were committed before implementation. Venue-positive, wrong-exchange,
ADR and Shanghai/Shenzhen separation fixtures pass. Full regression:
139 TypeScript tests, 24 Python tests, type checking and build pass.
Remaining matching work includes other venues, ticker aliases, minor-unit
currencies, primary-listing review and issuer-level approval.

Collected fresh FMP/OpenFIGI evidence for a deterministic hash-sampled 50
unmatched and 50 ambiguous cases from the completed 2,442-company census.
All 100 completed; resumable checkpoints retain evidence privately.

- 50 ambiguous cases: multiple listings of the same share class.
- 50 unmatched cases: no supported exchange/ticker/share-class join.
- Overlapping additional flags: 10 provider-reported inactive listings, one ADR.

These diagnoses do not approve identity or lifecycle status, select a primary
listing, or merge issuer exposure. Restricted exchange coverage is an
engineering limitation, not proof that the company cannot be matched.
Independent identity review, full fundamentals/FX coverage and lifecycle
evidence remain incomplete.

Private evidence: `generated-artifacts/financial-data/root-cause-audit.json`.

## Regression and outstanding-stage record

137 TypeScript tests, 24 Python tests, type checking and production build pass.
Real-data checks above are additional to those counts.

| Stages | Status / exact remaining dependency |
|---|---|
| 1 | Partial: exhaustive output/export register and remaining legacy consumers |
| 2 | Partial: complete overlays/recalculation; production managed snapshot provisioning |
| 3 | Partial: per-source uncertainty, vintage and licence evidence |
| 6 | Partial: complete commitments/native-gas pathways and actual temperature infill comparison |
| 8 | Partial: regional time paths and member-level attribution require completed ensemble |
| 9 | Partial: quarterly reconstructions/skill runs not implemented; original vintages cannot be invented |
| 11 | Partial: complete financial inputs, paired model/projection validation and D8 comparison |
| 12 | Partial: defensible sector/geography/margin mappings and three actual worked companies |
| 13 | Partial: defensible valuation-to-activity mappings and independent identification evidence |
| 14 | Partial: new paired-growth histories and frozen full-family empirical evaluation |
| 15 | Partial: new-gap portfolios, lifecycle/borrow/FX evidence and real sensitivities |
| 16 | Partial: integration of those analytical stages and complete historical mode |
| 17 | Not accepted: clean full-model reproduction and independent owner review |

These are not all external blockers. Substantial implementation remains.
No research result above changes headline warming, valuation rankings or
investment-evidence status.

## Execution limitations

The production database requires supported managed provisioning; independent
review and identity approvals cannot be supplied by the implementing agent.
Those are genuine external dependencies. Other uncompleted implementation in
the table above is not reclassified as externally blocked. Actual per-stage
effort was not instrumented; no estimate is presented as measured time.

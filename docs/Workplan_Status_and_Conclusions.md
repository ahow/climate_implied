# Workplan implementation, tests and conclusions

## Overall conclusion

See [the latest remaining-workplan execution record](Remaining_Workplan_Execution.md)
for collector locking, CI promotion, actual bootstrap uncertainty, completed
regional land-use accounting, calibrated FaIR pulse diagnostics and the
100-company provider root-cause audit. The former regional land-source gap
is resolved; the projection ensemble is still incomplete.

The [automatic archival and completed-result replay increment](Automatic_Archive_and_Result_Replay.md)
adds transactional approval snapshots, stored company-analysis responses and
corrected legacy threshold labels. Its actual-data and regression checks pass;
production archival still depends on database provisioning.

The subsequent [regional inventory and member-metrics increment](Regional_Inventory_and_Member_Metrics.md)
adds real regional source accounting and coherent member calculations; its
remaining scientific and integration gaps are explicit.

The full 18-stage workplan is **not complete**. The sequential check runner
executes existing implementations; it is not an implementation agent.
Passing numerical fixtures does not accept real-data research or production
integration. The following table distinguishes those things explicitly.

This report supplements the detailed historical
[continuation results](Workplan_Continuation_Results.md) and
[binding amendments](Developer_Workplan_Amendments.md). It does not change any
predeclared scientific threshold or claim independent validation.

| Stage | Implemented | Test/evidence | Conclusion and remaining acceptance |
|---|---|---|---|
| 0 Safety | Restricted writes, operator CLI, opt-in scheduler, CI/local release checks, no startup mutation | Safety/source-boundary regressions pass; previous release identity verified in live HTTP | Partial: single scheduler, recovery rehearsal and complete remote CI gating remain |
| 1 Outputs | Published context by default, legacy opt-in, unsupported valuation physical fields removed; legacy gauge/chart/toggle explicitly label the positive threshold as not net zero | Public-response and UI claim tests pass | Partial: exhaustive output/export register and remaining legacy consumers |
| 2 Reproducibility | Immutable workbook capture; request isolation; automatic transactional approval archives; historical summary selector; completed company-analysis response archive/retrieval | Actual 2,442-company summary stored/retrieved exactly; concurrent approval and rollback checks passed; 132 TypeScript and 22 Python regression tests passed | Partial: financial/carbon/SDG overlays, full historical recalculation, other run types and production provisioning remain |
| 3 Drivers | All 22 indicators classified; evidence disclosure; strict missingness/interpolation | Registry and missingness fixtures pass | Partial: complete source/uncertainty/vintage evidence is not supplied |
| 4 Calibration | Frozen regional solar/wind holdout study on observed revised history | 1 of 10 fits (EU solar) beat both baselines; nine fail that promotion rule | No central promotion: uncertainty/structural-break checks and remaining technologies incomplete |
| 5 Emissions | Native-gas candidate mechanisms, power balance, EV turnover and overlap safeguards | Candidate/accounting fixtures pass | Partial: actual regional 10,000-member production ensemble and convergence not built |
| 6 References | Native pathway adapters, source distinctions and missing-gas checks | Adapter/coverage/sensitivity fixtures pass | Partial: complete commitments source, compatible gases and actual temperature infill spread not accepted |
| 7 Climate response | Pinned FaIR tooling, strict native bridge, coherent summary and censored-year utilities | Bridge/ensemble/censoring fixtures pass; upstream execution is not independent validation | Partial: independent reference, updated forcing, pulse/convergence tests and production coupling remain |
| 8 Attribution | Research accounting/attribution utilities | Mechanism fixtures pass | Partial: actual additive regional/member ledgers and attributed warming results not implemented |
| 9 Historical skill | Vintage audit and historical-validation contracts | Existing workbook is revised history, not a genuine archived forecast | Partial: verified past-input evaluations and horizon-specific empirical skill remain |
| 10 Company inputs | Full-universe candidate search, review contracts, provider normalizer, annual statement collector | All 2,442 searched: 350 candidates, 474 ambiguous, 1,618 unmatched; Bayer 20 annual periods, 18 positive FCFE | Candidate search complete; identity approval, lifecycle, FX and universe financial coverage incomplete |
| 11 Valuation | Gordon comparator and bounded conditional FCFE/FCFF solvers with explicit currency and debt bridge | Solver repricing/perpetuity/refusal fixtures pass | Partial: common-sample empirical D8 model comparison, financial-sector model and UI coverage remain |
| 12 Company projections | Shared-definition paired-growth safeguards | Definition/horizon/currency mismatch fixtures pass | Partial: actual climate/activity/margin/cost mappings and worked companies not implemented |
| 13 Identification | Evidence-gated eligibility and valid unavailable results | Missing mapping/identification refuses stronger claims | Partial: actual defensible valuation-to-activity mappings and assumption registry remain |
| 14 Signal | Locked research utilities; supplementary old-intensity full-universe study | 343,547 eligible observations; relative MSE improvement −0.000097660174; four block-length intervals cross zero | Negative supplementary result; **not** the required new valuation-gap evaluation, which remains unimplemented |
| 15 Portfolios | Separate hypothetical long-short accounting, costs, borrow and financing contracts | Long-short/turnover/cost fixtures pass | Partial: actual historical new-gap portfolios and lifecycle/borrow/FX evidence remain |
| 16 Integration | Honest unavailable states, metadata disclosures, historical summary preview | Type checking and API/contract checks; preview does not change other pages | Partial: full historical analysis switch and integration of remaining analytical stages |
| 17 Acceptance | Reproduction commands, source-only export and live source-identity endpoint | Existing source releases independently checked against live build-info | Not accepted: full clean reproduction, completed scientific gates and independent review remain |

## Latest implementation details

Indicator captures reuse the append-only snapshot tables and five database
guards. Canonical content includes the indicator key/year/value/source/method
and available source metadata, not administrative timestamps. A zero remains
zero. Duplicate cells, nonfinite values, changed payloads and count mismatches
fail explicitly. Request hashes and stored archive identities agree.

`script/capture-indicator-snapshot.ts` is a development-only operator command.
It does not approve data, alter collection cadence, migrate production or claim
publication-vintage evidence. Capture and replay succeeded on the actual current
approved inputs. Capture is now also automatic inside approval transactions when
immutable storage is provisioned. A missing production archive is not hidden.

GET requests can select an archived driver set using `indicatorSnapshotId`.
Company calculations independently select a workbook using `snapshotId`.
A non-workbook archive cannot be used as a workbook. The historical summary
preview only affects its own read-only view; it is not presented as a global
historical mode. Explicit missing archives fail rather than substituting current
inputs. Production without snapshot tables remains explicitly unavailable.

## Blockers versus unfinished engineering

- Production managed snapshot schema/guards require the supported managed
  production action; source deployment alone does not install them.
- Publication-vintage evidence, source licences and independent scientific
  review cannot be invented or replaced by passing fixtures.
- **Most remaining model and integration work above is unfinished engineering,
  not blocked by a missing user instruction or token.**
- No additional approval to continue ordinary implementation is needed.

Remaining implementation includes complete overlay/run coverage, the regional
emissions ensemble and the independent company-model track. Dependent
scientific outputs must remain unavailable until their actual acceptance
criteria pass.

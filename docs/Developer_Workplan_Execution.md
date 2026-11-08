# Amended workplan — execution evidence

Date: 8 November 2026.

**The 18-stage programme is NOT complete.** This is a partial implementation
record, not a scientific acceptance statement. Permission to continue has
already been given; remaining engineering is not waiting for routine approval.

## Amendments

The controlling changes are in `Developer_Workplan_Amendments.md`.
`script/amend-developer-workplan.py` creates the downloadable amended Word
document with a controlling amendment section and the full original plan.
Uploaded originals are unchanged; the generated Word document is not exported
to GitHub.

## Verification performed

- Baseline: 87 TypeScript tests and 16 Python tests passed; typecheck/build passed.
- Final coherent increment: **104 TypeScript tests and 16 Python tests passed**;
  typecheck and production build passed.
- Four corrected-research tests: cash-flow working capital, right-censored
  net-zero years, paired growth differences, identification restrictions.
- Three valuation-solver tests: closed-form fixture, known-growth recovery and
  unavailable/invalid cases. These do not establish empirical company coverage.
- Two release-safety tests: opt-in scheduling; actual HTTP denial, diagnostic
  rate limiting and read access.
- Seven frontend source-contract tests; one nested public valuation-contract test.
- Development workflow restarted cleanly; scheduler disabled in this instance.
- Development HTTP: health 200; public collection POST 403 without running it;
  corrected diagnostic endpoint 200. Test OCF 100, capex 30 and net borrowing 10
  returned FCFE 80; [2040,2050,null,null,null] returned unconditional median null,
  probability by 2050 0.4 and never-reaching fraction 0.6.
- Main page screenshot showed real published references, not the legacy gauge
  by default, and no browser errors. No full interactive or mobile acceptance.

## Stage-by-stage status

| Stage | Status in this increment | What remains |
|---|---|---|
| 0 | Partial: public HTTP writes disabled before request parsing; pure diagnostics have body/rate bounds; operator collection/approve/reject CLI; scheduler explicitly opt-in; response rows no longer copied into HTTP logs; CI file and local release checks added | Railway management API requested platform approval; deployment gate, production scheduler ownership and release identity not verified. Full golden baseline/recovery acceptance incomplete. |
| 1 | Partial: published references in default view; legacy diagnostics opt-in with explicit warning; physical valuation fields stripped from CV API; descriptive UI/exports; public mutation controls disabled with notices | Full backend output register and physical-gap contract cleanup; correct 5%-of-2024 milestone not implemented. Legacy fixed-5-Gt/extrapolated year is not relabelled. |
| 2 | Not implemented: next-request approved-override reload is only a propagation repair, NOT immutable snapshots | Transactional immutable importer, schema/migration rehearsal, overlay storage, manifests, archived replay and concurrency acceptance. |
| 3 | Not implemented in this pass | Full evidence/role/uncertainty registry and census. |
| 4 | Not implemented | Sourced training data, frozen calibration protocol, actual fits/holdouts. |
| 5 | Not implemented | Coherent regional-sector-gas ensemble and convergence. Existing candidate mechanisms remain diagnostic. |
| 6 | Not implemented in this pass | Verify source releases/licences; compatible commitments case; species infill evidence and sensitivities. |
| 7 | Partial utility only: correct censored net-zero summary callable through diagnostic API | Native-pathway climate execution, independent physical evidence, full headline ensemble and promotion gates. |
| 8 | Not implemented | Regional reconciliation and within-model attribution. |
| 9 | Not implemented | Vintage audits, archived runs, historical re-estimation and horizon-limited skill evaluation. |
| 10 | Not implemented in this pass | Whole-universe mapping/lifecycle review, currencies/fundamentals, independent approval and coverage. Existing earlier 200-company pilot is not completion. |
| 11 | Partial utility only: FCFE formulas and bounded three-stage earnings/reinvestment equity solver with synthetic fixtures | Company data integration, financial-sector model, sensitivity/coverage study and paired validation model choice. |
| 12 | Not implemented | Company projections, matched exposures/valuation definitions and worked examples. |
| 13 | Partial contract only: no mapping => unavailable; global expansion needs review; supplied references never authorize a market-expectation claim | Actual sector mappings, identification assessment, frozen thresholds and real scenarios. |
| 14 | Partial utility only: aligned member differences and definition validation | Locked protocol, multiplicity family, completed outcomes, actual research and prospective signal archive. |
| 15 | Not implemented in this pass | Separate long–short engine, borrow/financing, evidence tracks and new study. Existing accounting tests still pass. |
| 16 | Partial frontend integration of claim containment/operator restrictions | Integration of the not-yet-built analytical stages; full responsive/interactive acceptance. |
| 17 | Not complete | Clean end-to-end reproduction, owner review and verified production acceptance. |

## Important operational consequences

- Public collection, approvals, manual edits, workbook upload/reset and cache
  mutation endpoints now return 403. The UI explicitly disables these controls.
- Authorized shell operations:
  `npx tsx script/operator-indicators.ts collect`,
  `approve <proposal-id>` or `reject <proposal-id>`.
  Production-mode shells require `--production-authorized`.
  That flag acknowledges operator intent; the actual trust boundary is shell
  and database access, not possession of a command-line flag.
- Existing financial review CLI remains available. No identities were approved
  in this pass. No production data was migrated.
- Safe workbook replacement and manual-value CLI are not implemented; those
  operations are unavailable rather than exposing the old destructive upload.
- Diagnostic rate budget is process-local, not a distributed quota.
- Full CI exists in source, but Railway waiting for its success still requires
  configuration and verification. Local release checks do not prove that gate.
- The new reverse-valuation module is an explicit internally funded
  earnings/reinvestment model. It is not claimed to be a complete company DCF.

## Release evidence

Workspace commits record acceptance fixtures and implementation separately.
Source export was attempted after passing all local checks. GitHub rejected
the push because the configured credential cannot update workflow files.
No new source export succeeded. The workflow was not silently removed to
bypass the requested CI controls.

Railway's management API separately required platform approval, so no new
production deployment or CI gating configuration was verified. These access
limits do not explain the remaining unimplemented engineering stages; those
are explicitly recorded above rather than marked complete or data-blocked.

# Workplan implementation report

## Continuation: actual company-history expansion

Eight additional cases were collected under a protocol committed before provider
requests: all eight passed the explicit provider/workbook candidate checks.
Ten annual histories of each statement type and 193 workbook observations per
case were retained privately. The outcome audit now covers eleven candidates:
56 completed three-year FCFE outcomes and 54 exclusions from 110 annual records.
No identity approvals or application financial updates were made.

Fixed a genuine audit bug: its hard-coded three-company blocker is replaced
with input-derived coverage; duplicate retained versions of an issuer are
rejected. Fiscal-end years are not silently treated as common valuation origins.
No D8 model comparison or signal efficacy has been completed.
See `Company_Coverage_Expansion_Results.md`.

## Continuation: regional replay and retained-input baselines

Actual missing application behaviour was implemented: immutable regional
external-input capture and loading, paired regional/indicator request validation,
live-cache bypass, response identity checks, optional archive selection in the
application header and archive IDs in exports. No new production schema,
collection approval or scheduler operation was performed.
See `Regional_Historical_Replay.md` for precise files and behaviour.

Two fresh processes matched all four OWID-backed regional results and the
retained-workbook engines: 187 valuation groups, 193 SDG rows and 187 tercile
rows. Hash `0f872b95f3b28d3527f313fd3b8d58ff40f5ba46c4201b7a81b50305576ea89d`.
Initial worker stdout truncation failed; the fixed private-file transport passed.
Both executions remain in the ledger.
The baseline was subsequently expanded from engine calls to actual HTTP routes
in two fresh Express servers, using captured workbook, indicator and regional
IDs. All response identities matched and public response payloads were exactly
equal, hash `e8674592be19ad13956fd9da94e90245456e5170a5f65a48528baf10756166bf`.
Group counts remain 187/193/187 and regions four. Workers explicitly disable
scheduling and provider health credentials. These are reproducibility checks,
not an investment or climate efficacy study.

An actual regional archive was captured/reloaded successfully in development.
HTTP checks returned four historical regions with matching regional and
indicator headers; repeated calculations were identical. An incomplete archive
pair returned 422. Preview rendered without browser errors.
Full suite: 195 TypeScript and 51 Python passed, zero failures/skips; type
checking and build passed. These tests do not establish physical validity.

### Scheduler evidence and remaining operational dependency

Railway's deployment log query (2026-11-09) reports scheduler disabled, including
the latest startup at 22:28:10 UTC. Development startup is also disabled.
Replit deployment metadata reports an active successful autoscale deployment;
the previously captured startup logs show its legacy scheduler started. Current
production environment-variable lookup returned no non-secret scheduler
configuration. Therefore single-owner enforcement across that legacy autoscale
runtime is not certified. No second scheduler was enabled. Inspect/replace the
legacy deployment's actual scheduler ownership through its supported controls;
do not treat Railway's disabled state as proof that the whole topology passes.

### Calibration source investigation

IEA's “Heat pump sales for selected regions, 2019–2024” chart was found and its
source page read. It cites EHPA, AHRI, JRAIA and ChinaIOL and labels the chart
CC BY 4.0, but says chart data are not available for download. A direct HTML
request returned HTTP 403. No observations were invented or extracted from
unread numeric graphics. This is an unsuccessful acquisition attempt for this
source, not proof that all heat-pump data are inaccessible. Investigate the
named primary providers next; other engineering remains actionable.

## Continuation: additional baseline coverage

On 2026-11-09 at 22:25 UTC the fresh-process baseline was extended to Gordon
growth, Decarb Gap scores, four legacy finance-conversion cases and the complete
30-month walk-forward series (including twelve warm-up months). Two processes
matched exactly, hash
`e0dfd93c0089d778d84cb76f5192081d7eac0318f514224ea82cb99b8e0ac2d0`.
The command was `npx tsx script/verify-process-baseline.ts`; type checking
also passed. Exact logs are in run_executions. This is characterization only:
no company research, scientific validation or stage completion is inferred.
Regional external-input and database-backed grouped company endpoints remain
outside this fixture's coverage. No application runtime code changed.
Source export `72a6ae6e66a5c0c391b6436fcecd8e474baeee54` was verified
at production build-info after the normal validation/promotion pipeline.
The remainder of the assignment is still actionable and incomplete; the
continuation ledger retains its unresolved requirement IDs and exact next steps.

## Scope and evidence rules

Execution began 2026-11-09. The original amended workplan was read in full.
The authoritative per-requirement record is
`workplan_completion_ledger.json`; the Markdown ledger is its readable rendering.
Original clauses are retained even where a binding amendment overrides them.

Existing evidence reports are leads for reconciliation, not automatically
verified acceptance. Tests recorded in earlier reports are not this run's tests.
No scientific thresholds are relaxed. No raw licensed data is exported.
Collection cadence, review/approval and CI promotion controls remain unchanged.

## This run

- Created requirement-level ledger tooling and records, preserving all original
  implementation and efficacy clauses and the binding amendments.
- No application behaviour changed by ledger creation.
- No test suite, scientific study or production migration is claimed completed
  at this point.

## Execution evidence — 9 November 2026

- Full regression: **192 TypeScript passed, 0 failed, 0 skipped**;
  **51 Python passed, 0 failed, 0 skipped**. Type check and build passed.
  Exact commands/timestamps/logs are in the JSON ledger's `run_executions`.
- Actual development recovery: **2,442 companies, 470,341 observations and
  63 indicator records** captured in a single read-only repeatable-read
  transaction. A separate process restored the files to temporary tables.
  All three ordered row hashes and counts matched exactly; public writes: zero.
  Inputs: `generated-artifacts/recovery/20261109/manifest.json`.
  This is not full production disaster recovery or independent model validation.
- Privileged-route test inventories all 14 declared mutating routes:
  seven diagnostics allowed, seven mutations refused before execution;
  oversized diagnostic JSON rejected with 413. Existing rate-limit test passes.
- Archive guard checks now require the correct public relation, event mask,
  function and enabled state. Wrong-table, wrong-function, wrong-event,
  disabled, missing and duplicate guards fail closed in fixtures.
- Production read-only catalog query returned headers=false, chunks=false,
  guards=0. The documented database is Replit-managed; a Railway release does
  not provision it. No prohibited production DDL was attempted.

## Stage-by-stage outcome of this execution

| Original stages | Changes/evidence this run | Acceptance |
|---|---|---|
| 0 | Full regression; comprehensive mutating-route harness and diagnostic size test | Partial; complete baseline, scheduler and operational recovery remain |
| 1 | Scope preserved in ledger; existing output tests passed in regression | Field-level semantic reconciliation not completed |
| 2 | Stronger guard verification; actual-data temporary recovery with exact hashes | Partial; full overlays and production provisioning remain |
| 3–9 | Original clauses and amendments retained; existing tests rerun | No new empirical study; climate acceptance unchanged |
| 10–15 | Eight additional company histories acquired; actual eleven-candidate outcome audit and coverage correction | 56 outcomes, 54 exclusions; D8 and signal/portfolio studies still incomplete |
| 16 | Existing historical-selection tests passed | Remaining integration unchanged |
| 17 | Durable evidence and restart records created | Clean full reproduction and owner review not completed |

No numerical scientific threshold was changed and no model was promoted.
Recovery protocol and guard tests were committed before their implementation.

## Release

Tested source exported successfully to GitHub as
`52c03861535cd45c8061288ba2c4b5b3f9d9435f` (workspace
`c62078bbe0dcf1d0c4d89bc1c200e4f724758b34`).
Initial production check still reported the preceding revision while Railway
was building. GitHub validation run 42710316922 succeeded. At 22:19 UTC,
production build-info reported `52c03861535cd45c8061288ba2c4b5b3f9d9435f`,
confirming the tested implementation reached production through the existing
gate. Archive provisioning remains unavailable; no schema changes were made.

## Further baseline execution

Two fresh Node processes independently computed the fixed-input legacy baseline
and all six category trajectories, 2024–2100, 1,000 draws and seed 123.
Exact payload hash agreement:
`1db4085aee9d6b395b54b3412024b26859eb42cfdf9a5a5edd1069336b49cc4e`.
Evidence is in the corresponding baseline JSON under
`generated-artifacts/workplan-completion/`; the execution log and repeat type
check are recorded in the ledger. Regional external inputs and full company/
walk-forward baseline coverage remain. These are synthetic/public-number
characterization fixtures, not empirical validation.

## Continuation instructions

This execution is incomplete. The finite agent run has not reconciled or
implemented all 300 clauses. Most remain explicitly `not-yet-reconciled`, not
falsely accepted. The ledger contains each open requirement ID and next action.
No scientific studies were newly completed in this run.

Resume with:
1. Verify GitHub validation/promotion and Railway release identity.
2. Complete S00-003/S00-007 fixed-input two-process baseline coverage.
3. Complete S00-005/S00-010 single scheduler ownership verification.
4. Finish full-schema recovery scope; corrupt recovery-file rejection has passed.
5. Continue complete overlay replay and the 22-driver evidence audit, followed
   by the original dependency-ordered climate and company research requirements.

No agent or research job remains running in the background. The continuation
callback is a handoff notification, not proof that a receiving agent has started.

## Latest verification before continuation handoff

- Deliberately altered company recovery file was rejected before import, with
  expected child-process exit 1. The enclosing negative test passed (exit 0);
  exact command and evidence log are in the ledger.
- Subsequent source export `f17ba9f5c17dabbfce1c23f5dd9f186ad597acbd` was
  observed at production build-info, with health HTTP 200.
- Ledger audit: 300 original clauses retained, plus 14 binding amendments.
  One clause verified in this reconciliation, eight partial, two production
  archival clauses blocked, 289 not yet individually reconciled. This does not
  mean the old implementations for those 289 clauses do not exist; their
  requirement-level acceptance has not been established in this run.
- The private callback destination is ignored by Git and absent from exported
  source. Only checkpoint metadata is sent; no source data or credentials.

## Remaining work

Every unverified requirement remains open. The ledger's restart entry identifies
the next concrete action; it is not a claim that work continues while idle.

## Continuation callback

{
  "checkpoint_id": "1fc69cdf-2073-4faa-a928-46f8f63c9a8d",
  "ledger_hash": "fbb9d556ad297dca3411099f9b43852944d3d09bdc4f3e0e2348d56371d0c213",
  "attempted_at": "2026-11-09T22:23:38.344173+00:00",
  "outcome": "http-success",
  "http_status": 202
}

## Continuation callback

{
  "checkpoint_id": "8cdb125a-2659-4982-9e50-df3ce9d9a329",
  "ledger_hash": "f8216ebf548790fb4941fc499dafa1c3bbb134f2f9780c8ef4232cda0a791b99",
  "attempted_at": "2026-11-09T22:28:35.686283+00:00",
  "outcome": "http-success",
  "http_status": 202
}

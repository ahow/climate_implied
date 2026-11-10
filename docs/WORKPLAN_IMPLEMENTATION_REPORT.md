# Workplan implementation report

## Latest continuation: carbon/SDG lifecycle and material replay

Additional verified work: real overlapping SDG review/request isolation test passes
with complete synthetic rollback. New request changes; suspended baseline request
retains its exact hash. See script/check-overlay-concurrency-db.ts.
Field audit also found and removed p25ImpliedRate/p75ImpliedRate from the current
public response filter; the two focused withholding tests pass.
The later verifier/evidence export e1067d9 passed CI42733997496 and deployed as
Railway8de8fa40 SUCCESS, with matching live build-info. The withholding change
and concurrency script are a subsequent increment, tracked by later release receipts.

**Expanded evidence:** all nine archived company-analysis result paths now have
actual API-to-fresh-process matching JSON hashes at tested settings. Bands and
terciles are empty due to absent targets, not calibrated predictions. No refresh
concurrency or Stage14 acceptance is inferred. Full commands/results are in
run_executions and Development_Review_Material_Replay.md.

**Confirmed core release:** workspace fca066b → GitHub02afe6457d6e20b96e281b43fa76e0fcd462ce26;
CI42732701451 succeeded; Railway483ce3e1-33b5-4873-a14a-e3cb5d5fd124 SUCCESS.
Live health/build-info/field-semantics200, matching SHA and16 definitions.
Subsequent verifier/ledger edits are separately recorded.

Starting HEAD ac25e9d; preceding checkpoint confirmed matched by owner and
not resent. This increment implements real transactional carbon/SDG operator
review helpers, immutable proposal/decision/overlay archives and actual
rollback-only database tests. Existing workbook upload and collector unchanged.
See Development_Review_Material_Replay.md for exact paths and boundaries.

Material archives now retain source/config/embedded data/dependency-lock/runtime
versions and consumed workbook/overlay/indicator identities and values. Real SDG
response aea13b6b was recalculated identically in two fresh processes:
JSON hash 9b664a9e2d81e73c9fb8b392d02bdc49680cf9834910ea225d796c8b1f29463e.
Failed first attempts (missing public withholding filter in the verifier) and
passing corrected attempts are both retained in run_executions. Later source
changes intentionally invalidate same-executable replay of that earlier manifest.
This is one actual endpoint, NOT all-material replay acceptance for the whole app.

16 core field definitions now reach API, expandable UI and XLSX. Export rows
have a normalized-data SHA-256. All 22 curated driver histories have retained
series hashes, period coverage and explicit non-original-vintage semantics;
publication availability and causal calibration gaps are not invented away.
Stage12 gains an all-leaf input-evidence/cutoff guard around the existing operating
projection model. This is a dependency, not actual Stage14 research.

Verification at this point: full 212 TypeScript + 63 Python suite passed,
subsequent Stage12 guard test passed, typecheck/build passed, real carbon/SDG
rollback tests passed, development workflow healthy and screenshot clean.
Final source changes and release receipts are recorded below/in the JSON ledger.
No beta refit, owner approval, central-model promotion, purchase, DDL or production
data mutation. All remaining original stages continue to be tracked individually.

## Latest continuation: frozen beta comparison and transactional archive

Starting HEAD verified c0f0c36. Owner confirmed the preceding continuation
checkpoint matched; it was not resent.

Applied the ALREADY-frozen 73095d6 beta protocol/rates to the same 88 completed
company-origins. Gordon implied growth moved 0.6890 pp on average in absolute
terms; DCF 1.9557 pp. Outcome MAE improvement vs common 8%: Gordon -0.2137 pp
[-0.3881,-0.0392]; DCF -0.3734 pp [-0.8777,+0.1308]. Original outcomes,
availability and filings are asserted unchanged; no return scoring or D8
reselection. See Beta_Growth_Sensitivity_Results.md. Gordon remains primary.

Existing real financial review transaction now archives approved current input,
review ID and approval timestamp into existing guarded immutable tables. Archive
failure rolls back the approval when provisioned; unprovisioned deployments
retain existing approval behavior with explicit warning. Rejected transitions
do not create archives; duplicate approval does not create a second archive.
This current-only archive is NOT silently injected into historical workbook data.

Actual existing review helper exercised in a rollback-only development database
fixture: approval, repeat approval, conflicting rejection, exactly one immutable
archive with matching hash, then complete rollback of both review and archive.
No real issuer approved, no synthetic immutable rows left behind, no DDL.
Files: server/financialData/approvalArchive.ts:archiveFinancialApproval;
server/financialData/reviewStore.ts:reviewInTransaction;
script/check-financial-review-db.ts.

Verification: 207 TypeScript and 63 Python pass, type check/build pass. Exact
commands/counts/logs retained in run_executions. This increment is local only;
last verified deployment remains GitHub 3bc1ddf / Railway e2219151.

Still incomplete: complete reviewed carbon/SDG refresh lifecycle; all-material
manifest and result/export replay; field-level semantics; actionable driver
metadata repairs; compatible Stage 12 projections and actual Stage 14 signal.
These are actionable scope, not external blockers or accepted completion.

## Latest increment — 10 November 2026

### Verified release and subsequent offline sensitivity

Workspace b3b41b78481cd1157e080c0dcc3f33c402c466f1 exported to GitHub
3bc1ddf5379b5dd3783116c2b19011b97f192c67. Source validation run 42729165070
succeeded; production-validated matches. Railway deployment
e2219151-fe29-4711-bf1c-ca3140d7d4fb reached SUCCESS. Live health 200 and
build-info sourceCommit match. No deployment or approval shortcut was used.

After that release, a distinct beta sensitivity protocol and tests were frozen
in 73095d6, before fitting. Past-only 60-month leave-one-out peer-proxy betas,
50% shrinkage to one, assumed 3% risk-free/5% ERP produced 162/162 available
company-origin rates ranging 4.6092%–9.7954%. Private result hash
cb928aace43911cad97897d1cbcc5a10e4e7d5b65a1327829f78ad305539d1a4.
Two additional tests and type checking pass. This is a narrow peer-proxy rate
diagnostic, not a broad-market CAPM estimate. Implied-growth comparison and the
actual Stage 14 signal remain unexecuted; no D8 reselection or promotion.
These subsequent offline files and final evidence records have not been exported
or deployed. The full released regression remains 204 TypeScript/63 Python;
the two later focused tests are recorded separately, not claimed as a new full run.

**Still partial, not workplan completion.** Prior chronological entries below
are retained as history and are superseded where this section states newer evidence.

- Fixed the confirmed continuation bug. `script/handoff_contract.py` validates
  the exact project tag and three supported events. The sender chooses
  continuation_ready while actionable work remains, reserves a stable checkpoint
  exclusively before transport, uses an Idempotency-Key, and cannot resend an
  attempted checkpoint. Six automated contract tests include mocked transport;
  no test callback was sent. HTTP 202 is transport acceptance, not matching.
  The owner's evidence establishes that the previous run-end callback was NOT matched.
- Storage study: frozen protocol/tests commit 2155948, EIA public-domain data,
  nine training years/six holdout years. Both MW and MWh exponential fits beat
  persistence and linear baselines, with positive paired 95% improvement intervals.
  MAPE remains ~47%; saturation unidentified, sensitivity-only, no promotion.
  See Storage_Adoption_Results.md for exact metrics/source hash.
- Existing EV protocol rerun unchanged: original result hash retained; most
  regions fail, India passes only a tiny diagnostic improvement, no promotion.
- All 22 drivers audited: 0 have complete date/vintage metadata and 0 are
  central-model eligible. Driver_Evidence_Audit.md enumerates every entry and
  code reference. Audit completeness is not scientific calibration.
- Development overlays: financial/carbon/SDG contracts, guarded archive storage,
  request-local application, ordered identities/cutoff in manifest/selector/
  exports, invalid or unavailable archive rejection. Private synthetic overlays
  on the retained 2,442-company/470,341-observation dataset reproduce exactly in
  two fresh processes. This does not complete real approval-flow integration or
  all-material-input application replay. See Development_Overlay_Replay.md.
- Private owner review pack: 27 issuers, 270 fiscal-period checks, source hashes,
  currencies/filings/exact-date missingness; zero approvals and no fiscal-rule change.
- Full regression: **204 TypeScript and 63 Python tests pass**, no failures/skips;
  type check and build exit 0. Actual commands/timestamps/logs in run_executions.
  Restart clean, development scheduler disabled, preview renders without browser
  errors. Development health 200; unsupported/missing overlay archives return 422.

No production data, scheduler setting, approval gate or D8 rule changed.
Gordon remains primary. Field-level semantics, full real overlay/result replay,
company-specific cost-of-equity sensitivity, actual Stage 14 signal, and broader
clause reconciliation remain incomplete. None is falsely marked completed.
Owner acceptance has not been performed by the developer.

## Continuation 2026-11-09 (late): first empirical studies

### D8 as-of Gordon vs reverse-DCF — executed, negative for reverse DCF
Protocol frozen (b5286ea, amendment A1 718b4db) before any prediction. Ex-ante
expansion by January-2016 market cap to 27 US issuers. 138 origins built, 88
complete (2017–2022: 14/12/15/18/13/16), so the unchanged gate was eligible.
DCF-minus-Gordon forecast MAE improvement −0.92 pp [−1.09, −0.70]; IC
improvement +0.048 [−0.183, +0.279]. Gate fail: reverse DCF not promoted,
Gordon remains primary. Exclusions are counted in
`AsOf_Valuation_Comparison_Results.md`. Ledger S11-007/008/009/010/012/014/030/031
partial, acceptance "negative-DCF-not-promoted".

### Scheduler ownership verified (S00-005/S00-010)
Replit production autoscale deployment logs `[scheduler] Started` at each cold
start (2026-10-20 to 2026-11-09); Railway logs disabled; development disabled —
one scheduling environment. Simultaneous instances (e.g. two starts at
2026-11-07T07:00:31Z) are serialized by the Postgres advisory lock in
`server/dataIngestion/collectionLock.ts` plus the running-row check and the
persisted 30-day cadence. Read-only production `indicator_fetch_runs` shows one
scheduled run per ~30 days (06-07, 07-07, 08-06, 09-06, 10-06), no duplicates.
Nothing was toggled. If the collector moves host, switch both flags together.

### Heat-pump primary source and diagnostic (S04-001, partial)
AHRI publishes US air-source heat-pump shipments 2006–2025 publicly (table
image, SHA-256 recorded). Frozen protocol 7c8121d. Evaluation 2019–2025 MAPE:
2011–2018 training — persistence 21.0%, linear 9.0%, log-linear 11.3%;
2006–2018 sensitivity — 21.0/22.7/21.2%. Window-sensitive. AHRI furnace
history and most monthly PDFs require login (HTTP 403); EHPA/JRAIA are paid, so
no share denominator exists and no logistic share model was fitted. Heat-pump
diffusion remains uncalibrated; the levels trend is sensitivity-only.

### Regression for this continuation
200 TypeScript and 53 Python tests passed (0 failed/skipped); type check and
build exit 0. Commands and timestamps are in `run_executions`.

### Release
Workspace c5b0aa8 exported to GitHub main 7837936; Source validation run
42720723531 succeeded and advanced production-validated; Railway deployment
9071ab3f reached SUCCESS; live `/` 200, `/api/health` 200, build-info reports
7837936. Ledger: 5 verified, 17 partial, 2 blocked, 276 not yet reconciled.
The following docs-only record commit is pushed but its deployment is not checked.

### Next
Company-specific beta variant (S11-004) and the Stage 14 signal on the D8 rows;
EV/storage diffusion fits; 22-driver audit; overlay replay; field semantics.
Production archive provisioning remains blocked on managed schema publish.

## Release verification for this run (2026-11-09)

Workspace commit `daa136d893bb6f8f4153ec19de8fa9e7f9e6ef62` was exported to
GitHub main `1aba6d08e9df2c771722a8d1b301b59477164d93`. GitHub "Source
validation" completed successfully and advanced `production-validated` to the
same SHA. Railway deployment `620cf31a-d6a3-4a85-827a-11738c0b41f2` reached
SUCCESS for commit 1aba6d0. Live checks: home page HTTP 200; current regional
endpoint HTTP 200; a historical regional request naming unavailable archives
returned HTTP 422 rather than falling back to live inputs. Production has no
supported archive tables provisioned, so production historical replay remains
blocked by managed-schema provisioning, as recorded for S02.
Pre-release: 197 TypeScript and 51 Python tests passed, zero failures/skips;
type check and build exit 0. An earlier type-check failure in the same run
(ES5 Map iteration) was fixed and remains recorded.

Ledger status after this run (300 clauses): 3 verified, 11 partial, 2 blocked
on production provisioning, 284 not yet reconciled. The workplan is NOT
complete and no scientific efficacy study has been accepted.

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

## Continuation transport receipt (matching not verified)

{
  "checkpoint_id": "ckpt-20261110-beta-overlay-continuation",
  "event": "continuation_ready",
  "attempted_at": "2026-11-10T00:37:51.921545+00:00",
  "outcome": "transport-accepted",
  "continuation_matched": "unverified",
  "http_status": 202
}

## Continuation transport receipt (matching not verified)

{
  "checkpoint_id": "ckpt-20261110-frozen-beta-approval-2b04ff6",
  "event": "continuation_ready",
  "attempted_at": "2026-11-10T00:44:56.109383+00:00",
  "outcome": "transport-accepted",
  "continuation_matched": "unverified",
  "http_status": 202
}

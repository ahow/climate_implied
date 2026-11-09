# Workplan completion ledger

Generated from `workplan_completion_ledger.json`. Original requirements remain individually tracked.
**Not a completion statement.** Report pointers are not verified evidence; unexecuted tests have no pass counts.

Updated: 2026-11-09T22:23:29.744935+00:00

Binding amendments override conflicting original wording; see `Developer_Workplan_Amendments.md`.

## Stage 0 — Baseline and safety net

### S00-001 — not-yet-reconciled
Confirm the GitHub main SHA and Railway deployment identity; record whether 80a9315 is the live release.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-002 — verified
Run all TypeScript and Python tests, npm run check and npm run build; record counts and any pre-existing failures.

- Section: implementation; origin: existing-plus-this-run
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: Full current-worktree regression executed: 192 TypeScript and 51 Python tests; type check/build passed.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["uv", "run", "python", "-m", "unittest", "discover", "-s", "script", "-p", "test_*.py"], "executed_at": "2026-11-09T22:12:47.538211+00:00", "exit_code": 0, "elapsed_seconds": 11.427, "counts": {"tests": 51, "pass": 51, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221247538211Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["npm", "run", "check"], "executed_at": "2026-11-09T22:12:59.337405+00:00", "exit_code": 0, "elapsed_seconds": 13.085, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221259337405Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["npm", "run", "build"], "executed_at": "2026-11-09T22:13:12.812454+00:00", "exit_code": 0, "elapsed_seconds": 19.952, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221312812454Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["npm", "run", "check"], "executed_at": "2026-11-09T22:19:05.773525+00:00", "exit_code": 0, "elapsed_seconds": 6.571, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221905773525Z.log", "workspace_revision": "c62078bbe0dcf1d0c4d89bc1c200e4f724758b34", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: 
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-003 — partial
Capture golden fixtures with fixed inputs and seeds: legacy headline temperature and net-zero year, category and regional views, Gordon growth, Decarb Gap, implied carbon price and walk-forward results. Hash only analytical content: exclude timestamps and administrative identifiers, and set numerical tolerances where cross-environment floating-point differences are expected.

- Section: implementation; origin: existing-plus-this-run
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: Two fresh Node processes recomputed fixed-input baseline and all six category trajectories through 2100 (1,000 draws each, seed 123); exact full-payload hash agreement.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["npx", "tsx", "script/verify-process-baseline.ts"], "executed_at": "2026-11-09T22:18:56.797862+00:00", "exit_code": 0, "elapsed_seconds": 8.229, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221856797862Z.log", "workspace_revision": "c62078bbe0dcf1d0c4d89bc1c200e4f724758b34", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: Regional external-input, company valuation, implied-carbon-price and full walk-forward fixtures remain.; Synthetic/public-number characterization is not scientific validity.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-004 — partial
Inventory every privileged operation: database writes, paid-provider calls, cache clears and scheduler triggers. Do not assume a fixed list. Put mutating operations behind operator authorisation that embeds no reusable secret in the browser bundle (for example a server-side operator session or the existing CLI pattern). Protect diagnostic POST endpoints with resource limits rather than operator authorisation.

- Section: implementation; origin: existing-plus-this-run
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: All 14 declared mutating routes exercised in isolated Express harness: 7 diagnostics allowed, 7 mutations denied; oversized diagnostic body rejected with HTTP 413. Existing rate-limit test also passes.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["npx", "tsx", "--test", "script/snapshot-guards.test.ts", "script/privileged-route-inventory.test.ts", "script/analysis-selection.test.ts"], "executed_at": "2026-11-09T22:10:05.285355+00:00", "exit_code": 0, "elapsed_seconds": 4.343, "counts": {"tests": 5, "pass": 5, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221005285355Z.log", "workspace_revision": "5b15ce21abcf405e59d4597e0abc59cf05aa70ab", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: GET paid-provider inventory, authorised CLI positive paths and client secret scan need separate acceptance.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-005 — not-yet-reconciled
Make the scheduler opt-in (DATA_SCHEDULER_ENABLED=true required) and enable it on exactly one host.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-006 — not-yet-reconciled
Add GitHub CI that gates deployment: Railway deploys only commits that have passed both test suites and the build, for example from a branch that CI updates on success.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-007 — partial
Legacy fixtures reproduce in two clean processes: exact hashes for analytical content, declared tolerances elsewhere.

- Section: acceptance; origin: existing-plus-this-run
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: Two fresh Node processes recomputed fixed-input baseline and all six category trajectories through 2100 (1,000 draws each, seed 123); exact full-payload hash agreement.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["npx", "tsx", "script/verify-process-baseline.ts"], "executed_at": "2026-11-09T22:18:56.797862+00:00", "exit_code": 0, "elapsed_seconds": 8.229, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221856797862Z.log", "workspace_revision": "c62078bbe0dcf1d0c4d89bc1c200e4f724758b34", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: Regional external-input, company valuation, implied-carbon-price and full walk-forward fixtures remain.; Synthetic/public-number characterization is not scientific validity.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-008 — partial
Every inventoried privileged operation is refused without operator authorisation and works with it in development. No secret appears in the built client bundle.

- Section: acceptance; origin: existing-plus-this-run
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: All 14 declared mutating routes exercised in isolated Express harness: 7 diagnostics allowed, 7 mutations denied; oversized diagnostic body rejected with HTTP 413. Existing rate-limit test also passes.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["npx", "tsx", "--test", "script/snapshot-guards.test.ts", "script/privileged-route-inventory.test.ts", "script/analysis-selection.test.ts"], "executed_at": "2026-11-09T22:10:05.285355+00:00", "exit_code": 0, "elapsed_seconds": 4.343, "counts": {"tests": 5, "pass": 5, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221005285355Z.log", "workspace_revision": "5b15ce21abcf405e59d4597e0abc59cf05aa70ab", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: GET paid-provider inventory, authorised CLI positive paths and client secret scan need separate acceptance.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-009 — partial
Diagnostic POST endpoints reject oversized or excessive requests.

- Section: acceptance; origin: existing-plus-this-run
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: All 14 declared mutating routes exercised in isolated Express harness: 7 diagnostics allowed, 7 mutations denied; oversized diagnostic body rejected with HTTP 413. Existing rate-limit test also passes.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["npx", "tsx", "--test", "script/snapshot-guards.test.ts", "script/privileged-route-inventory.test.ts", "script/analysis-selection.test.ts"], "executed_at": "2026-11-09T22:10:05.285355+00:00", "exit_code": 0, "elapsed_seconds": 4.343, "counts": {"tests": 5, "pass": 5, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221005285355Z.log", "workspace_revision": "5b15ce21abcf405e59d4597e0abc59cf05aa70ab", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: GET paid-provider inventory, authorised CLI positive paths and client secret scan need separate acceptance.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-010 — not-yet-reconciled
Exactly one environment logs “scheduler enabled” at startup.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

### S00-011 — not-yet-reconciled
A deliberately broken commit fails CI and is not deployed.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/CI_Negative_Control.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Inventory privileged routes; rehearse isolated recovery; verify single scheduler.

## Stage 1 — Output register and honest labels

### S01-001 — not-yet-reconciled
Scan all pages, APIs and exports to build docs/output_register with label, equation, unit, population, engine, evidence state and replacement stage for each output.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-002 — not-yet-reconciled
Interim actions:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-003 — not-yet-reconciled
Withhold the implied carbon price and the valuation-implied temperature and net-zero year.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-004 — not-yet-reconciled
Relabel the implied decarbonisation rate as “Gordon baseline (r = 8%)”.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-005 — not-yet-reconciled
Note on Decarb Gap: “equivalent to within-peer earnings-yield rank”.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-006 — not-yet-reconciled
Correct the carbon-intensity label (per market cap, not per revenue).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-007 — not-yet-reconciled
Rename “Projected Net-Zero Year” to “Year emissions reach 5% of 2024” and drop the On track/Delayed verdict.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-008 — not-yet-reconciled
Move the legacy temperature gauge out of the headline position into an optional “Legacy comparison” view. Give it a direct warning explaining its known limitation: it applies a CO₂-only temperature response to all greenhouse gases and adds a fixed 1.1°C offset. Show CAT and UNEP published estimates in the headline area as context.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-009 — not-yet-reconciled
Generate indicator counts from one registry (fixes the 20 vs 22 discrepancy).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-010 — not-yet-reconciled
Create a shared constants module for the inventory basis and base year. Store 1.37°C (2025 annual human-induced warming, IGCC 2025) as a dated validation reference, kept distinct from the decadal estimate and the inventory year, not as a constant inside calculations.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-011 — not-yet-reconciled
Replace general warning banners with concise metadata beside each value, except where a specific, known limitation needs a direct warning (as in step 3).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-012 — not-yet-reconciled
Zero API or export fields absent from the register; zero register entries lacking equation or unit.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-013 — not-yet-reconciled
Withheld fields absent from API responses, the UI bundle and exports.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-014 — not-yet-reconciled
Each renamed label is identical across UI, API descriptions and exports.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-015 — not-yet-reconciled
Indicator counts agree on the main page, Methodology and Data Management.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

### S01-016 — not-yet-reconciled
A text scan finds no positive residual threshold labelled “net zero”.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Output_Controls_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit each response field and export against formula/unit/population register.

## Stage 2 — Versioned data and reproducible runs

### S02-001 — partial
Keep the workbook as an immutable baseline; add ordered, immutable overlays for financial, carbon, SDG and driver updates, each storing source, observation date, availability date, native value, unit/currency and content hash.

- Section: implementation; origin: existing-plus-this-run
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: Archive readiness now checks exact public table, trigger event mask, function and enabled state, rather than global trigger-name counts.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["npx", "tsx", "--test", "script/snapshot-guards.test.ts", "script/privileged-route-inventory.test.ts", "script/analysis-selection.test.ts"], "executed_at": "2026-11-09T22:10:05.285355+00:00", "exit_code": 0, "elapsed_seconds": 4.343, "counts": {"tests": 5, "pass": 5, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221005285355Z.log", "workspace_revision": "5b15ce21abcf405e59d4597e0abc59cf05aa70ab", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["env", "NODE_ENV=development", "npx", "tsx", "script/verify-workbook-snapshot.ts"], "executed_at": "2026-11-09T22:14:43.708712+00:00", "exit_code": 0, "elapsed_seconds": 29.349, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221443708712Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: Complete financial/carbon/SDG overlay archival and readers remain unimplemented.; Production has no archive tables or guards.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-002 — not-yet-reconciled
Implement analysis manifests: code SHA, model and assumption versions, dataset hashes, scenario, settings, seeds, ensemble size and output hashes, using canonical serialisation and SHA-256.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-003 — not-yet-reconciled
Resolve one manifest at the start of each request and use it throughout; include it in cache keys; prevent reduced responses populating full-result caches.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-004 — not-yet-reconciled
Version the company denominator; keep lifecycle status (active, acquired, delisted) separate from identity-review status (accepted, ambiguous, unmatched, out of scope).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-005 — blocked-production-provisioning
Archive the manifest and headline outputs of every production run from now on, at least at each monthly collection.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Confirm supported managed rollout includes required guards, obtain owner publish action, then verify and capture production archive.

### S02-006 — partial
Rehearse the additive migration on a development copy; back up production; test rollback.

- Section: implementation; origin: existing-plus-this-run
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: Actual development records exported in one read-only repeatable-read transaction, restored from files in a separate process into temporary tables, and exact hashes verified with zero public writes.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["env", "NODE_ENV=development", "npx", "tsx", "script/rehearse-analytical-recovery.ts", "capture", "generated-artifacts/recovery/20261109"], "executed_at": "2026-11-09T22:11:52.521397+00:00", "exit_code": 0, "elapsed_seconds": 12.181, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221152521397Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["env", "NODE_ENV=development", "npx", "tsx", "script/rehearse-analytical-recovery.ts", "restore", "generated-artifacts/recovery/20261109"], "executed_at": "2026-11-09T22:12:05.069693+00:00", "exit_code": 0, "elapsed_seconds": 7.828, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221205069693Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["python", "-c", "import pathlib,shutil,subprocess,os; root=pathlib.Path(\"generated-artifacts/recovery/20261109-corrupt\"); root.mkdir(exist_ok=False); source=pathlib.Path(\"generated-artifacts/recovery/20261109\"); shutil.copyfile(source/\"manifest.json\",root/\"manifest.json\"); shutil.copyfile(source/\"cv_companies.jsonl\",root/\"cv_companies.jsonl\"); f=(root/\"cv_companies.jsonl\").open(\"a\"); f.write(\"{}\\n\"); f.close(); result=subprocess.run([\"npx\",\"tsx\",\"script/rehearse-analytical-recovery.ts\",\"restore\",str(root)],env={**os.environ,\"NODE_ENV\":\"development\"},capture_output=True,text=True); assert result.returncode != 0; assert \"Recovery content mismatch: cv_companies\" in result.stderr; print(\"PASS: deliberately corrupted actual-data file rejected before import; expected nonzero exit:\",result.returncode)"], "executed_at": "2026-11-09T22:20:26.624330+00:00", "exit_code": 0, "elapsed_seconds": 2.091, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T222026624330Z.log", "workspace_revision": "22043120d8a90e6c3b1549f420db1649f77c3dec", "worktree_dirty": false, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: This is not production backup/recovery or a complete schema migration rehearsal.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-007 — not-yet-reconciled
An earlier manifest reproduces its analytical output hashes (excluding timestamps and administrative identifiers; declared tolerances for cross-environment floating point) after one refresh of each type (financial, carbon, SDG, driver).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-008 — not-yet-reconciled
A concurrent-write test shows no request mixes data versions.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-009 — not-yet-reconciled
Cold and warm caches return identical values and identities.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-010 — partial
Migration preserves row counts and hashes of original workbook, carbon, SDG and target data.

- Section: acceptance; origin: existing-plus-this-run
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: Actual development records exported in one read-only repeatable-read transaction, restored from files in a separate process into temporary tables, and exact hashes verified with zero public writes.
- Scientific acceptance: not-applicable-operational
- Executions: [{"command": ["env", "NODE_ENV=development", "npx", "tsx", "script/rehearse-analytical-recovery.ts", "capture", "generated-artifacts/recovery/20261109"], "executed_at": "2026-11-09T22:11:52.521397+00:00", "exit_code": 0, "elapsed_seconds": 12.181, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221152521397Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["env", "NODE_ENV=development", "npx", "tsx", "script/rehearse-analytical-recovery.ts", "restore", "generated-artifacts/recovery/20261109"], "executed_at": "2026-11-09T22:12:05.069693+00:00", "exit_code": 0, "elapsed_seconds": 7.828, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T221205069693Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["bash", "-c", "npx tsx --test script/*.test.ts"], "executed_at": "2026-11-09T22:12:20.589269+00:00", "exit_code": 0, "elapsed_seconds": 26.531, "counts": {"tests": 192, "pass": 192, "fail": 0, "skipped": 0}, "log": "generated-artifacts/workplan-completion/20261109T221220589269Z.log", "workspace_revision": "2776d32597bf5f544a2c9d08a1f735a54e0cdb5c", "worktree_dirty": true, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}, {"command": ["python", "-c", "import pathlib,shutil,subprocess,os; root=pathlib.Path(\"generated-artifacts/recovery/20261109-corrupt\"); root.mkdir(exist_ok=False); source=pathlib.Path(\"generated-artifacts/recovery/20261109\"); shutil.copyfile(source/\"manifest.json\",root/\"manifest.json\"); shutil.copyfile(source/\"cv_companies.jsonl\",root/\"cv_companies.jsonl\"); f=(root/\"cv_companies.jsonl\").open(\"a\"); f.write(\"{}\\n\"); f.close(); result=subprocess.run([\"npx\",\"tsx\",\"script/rehearse-analytical-recovery.ts\",\"restore\",str(root)],env={**os.environ,\"NODE_ENV\":\"development\"},capture_output=True,text=True); assert result.returncode != 0; assert \"Recovery content mismatch: cv_companies\" in result.stderr; print(\"PASS: deliberately corrupted actual-data file rejected before import; expected nonzero exit:\",result.returncode)"], "executed_at": "2026-11-09T22:20:26.624330+00:00", "exit_code": 0, "elapsed_seconds": 2.091, "counts": null, "log": "generated-artifacts/workplan-completion/20261109T222026624330Z.log", "workspace_revision": "22043120d8a90e6c3b1549f420db1649f77c3dec", "worktree_dirty": false, "scope": "Execution evidence only; does not establish scientific validity or full requirement acceptance"}]
- Gaps: This is not production backup/recovery or a complete schema migration rehearsal.
- Next: Investigate production database ownership; provision through supported route; implement complete overlay replay.

### S02-011 — blocked-production-provisioning
The archive holds at least one replayable production run.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Confirm supported managed rollout includes required guards, obtain owner publish action, then verify and capture production archive.

## Stage 3 — Driver registry and evidence standard

### S03-001 — not-yet-reconciled
Build the registry schema: identifier, definition, publisher, raw and transformed units, geography, category, observation period, availability date, vintage, update cadence and licence.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-002 — not-yet-reconciled
Give each indicator one or more roles: mechanism input, level anchor, validation target, context, or candidate leading indicator. Only mechanism inputs move the forecast.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-003 — not-yet-reconciled
Store each indicator's uncertainty distribution, overlap group, regional applicability and missing-data method.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-004 — not-yet-reconciled
Implement the missing-data standard: observed zero, unavailable, not applicable and below-threshold are distinct; interpolate interior gaps only; infill with sampled uncertainty; never fill with zero.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-005 — not-yet-reconciled
Generate indicator cards and methodology counts from the registry.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-006 — not-yet-reconciled
Record the licence status of every source in the registry.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-007 — not-yet-reconciled
100% of indicators have every mandatory field.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-008 — not-yet-reconciled
Negative test: a blank source cell never becomes zero; every infilled value can be traced back to its original blank.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-009 — not-yet-reconciled
Every indicator that moves the headline has a mechanism role.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

### S03-010 — not-yet-reconciled
UI counts equal registry counts.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit all 22 registry entries against every mandatory source/evidence field.

## Stage 4 — Calibrating drivers to evidence (new)

### S04-001 — not-yet-reconciled
Technology diffusion. Fit logistic curves, with Gompertz or Bass as alternatives, to regional adoption data: solar and wind shares of generation, EV share of new car sales, heat-pump sales, battery storage. Estimate saturation (bounded by a sourced prior), midpoint and steepness, with bootstrap intervals. Set a training window per technology: heat pumps and storage may have too little history before 2019, so declare a shorter window or treat them as priors.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-002 — not-yet-reconciled
Learning curves. Fit cost against cumulative deployment for solar, wind and batteries. Report learning rates with intervals, as associations rather than causal effects.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-003 — not-yet-reconciled
Activity and intensity. Decompose regional emissions into GDP, energy intensity and carbon intensity of energy (Kaya identity); estimate trends and test for structural breaks.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-004 — not-yet-reconciled
Policy. Where data exist, use implementation-weighted measures such as carbon price × emissions coverage. Record what these miss: exemptions, free allocation, enforcement and behavioural response. Where no estimate is identifiable, use a bounded literature elasticity with its source.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-005 — not-yet-reconciled
Recent emissions. Estimate 2024–2026 from high-frequency sources (monthly power-sector data, daily CO₂ estimates) rather than decaying momentum. A comparison with today's revised inventory is a retrospective reconstruction check, not a real-time nowcast test, and is labelled so.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-006 — not-yet-reconciled
Holdout. Fit on data to the end of each technology's training window; predict the following years to 2024; compare with persistence and linear trend.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-007 — not-yet-reconciled
Fallback rule, fixed before fitting. A driver that does not beat both baselines out of sample becomes a bounded sensitivity, not a central-model input. The exception is a separately documented physical or empirical basis for its central role.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-008 — not-yet-reconciled
Store fitted parameter distributions in the registry as versioned inputs for Stage 5, each tagged calibrated, prior or sensitivity-only.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-009 — not-yet-reconciled
Each fitted driver's out-of-sample error is reported against persistence and linear trend, and the fallback rule is applied exactly as committed.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-010 — not-yet-reconciled
No driver that failed its baselines remains a central input without a documented justification.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-011 — not-yet-reconciled
Every saturation prior and literature elasticity has a cited source; every training window is declared.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

### S04-012 — not-yet-reconciled
The recent-emissions estimate is compared with the latest Global Carbon Budget figure within a predeclared tolerance, and labelled a retrospective reconstruction check.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/EV_and_Cost_Calibration_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Complete heat-pump/storage/policy/nowcast studies and persist qualified parameter distributions.

## Stage 5 — Coherent emissions ensemble

### S05-001 — not-yet-reconciled
Freeze the 2024 inventory anchor: IGCC 2025 basis (about 56.8 GtCO₂e), with UNEP's 57.7 Gt shown separately. Use native gases and keep fossil CO₂ separate from signed land-use CO₂. Treat land use and international aviation and shipping explicitly and consistently. Use five regions (EU27, US, China, India, Rest of World) plus international transport as its own account.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-002 — not-yet-reconciled
Build the member-level engine. For each member, sample the Stage 4 driver distributions, structural parameters and correlated uncertainties once. Compute annual region × sector × gas emissions to 2100 and persist member outputs.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-003 — not-yet-reconciled
Document the sampling scheme: how many socioeconomic (emissions) members, how many climate-response members, and how they pair (for example each emissions member matched to a sampled climate configuration).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-004 — not-yet-reconciled
Port mechanisms with explicit eligibility, lag, saturation, bounds and overlap groups: renewable displacement, EV stock turnover, activity and intensity, and policy. Charge EV electricity to the power sector. Port corporate and finance mechanisms only where a defensible coefficient exists; otherwise keep them as labelled sensitivities outside the central case.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-005 — not-yet-reconciled
Reject or bound physically impossible draws and report counts.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-006 — not-yet-reconciled
Run 10,000 emissions members in production. Keep the legacy model as a named comparator and publish 2030, 2050 and 2100 emissions before/after differences.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-007 — not-yet-reconciled
Global emissions equal the sum of regional, international-transport and sector accounts for every member and year (relative tolerance 1e-9).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-008 — not-yet-reconciled
Same manifest and seed give identical member hashes; reordered inputs make no difference.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-009 — not-yet-reconciled
Boundary fixtures pass: renewables cannot displace more than eligible fossil generation; EVs cannot make transport emissions negative; overlap groups prevent double counting.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-010 — not-yet-reconciled
Perturbing one driver changes only its declared mechanisms.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-011 — not-yet-reconciled
2024 emissions reconcile to the inventory by gas, sector and land-use treatment.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-012 — not-yet-reconciled
Emissions convergence between 5,000 and 10,000 members: 2050 and 2100 emissions quantiles move by less than a predeclared tolerance. Temperature and net-zero convergence is tested in Stage 7, with explicit rules for members that never reach net zero.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

### S05-013 — not-yet-reconciled
No corporate or finance mechanism is in the central case without a documented coefficient.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_and_Company_Engine_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Connect qualified distributions; run actual 10,000-member ensemble and convergence.

## Stage 6 — Scenarios and reference pathways

### S06-001 — not-yet-reconciled
Central case: the Stage 5 forecast under implemented policies.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-002 — not-yet-reconciled
Commitments case: evaluate candidate sources, including Climate Resource's NDC + long-term-strategy pathways and the NGFS Phase V NDC case. Verify each source's current release, content and licence before it becomes a binding input; record the evidence. Default definition (D-1): national targets plus long-term net-zero targets, corporate targets excluded.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-003 — not-yet-reconciled
Harmonise each pathway to the 2024 inventory, converging by 2050, with a 2030-convergence sensitivity.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-004 — not-yet-reconciled
Infill the four missing gases (HFC-134, HFC-143, HFC-245fa, HFC-41) with a documented method and at least two alternatives.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-005 — not-yet-reconciled
Pin published references (CAT, UNEP, NGFS) with exact labels after verifying the current releases, including any around COP31.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-006 — not-yet-reconciled
Build the pathway adapter so NGFS Phase VI can be swapped in when released.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-007 — not-yet-reconciled
Both cases match the 2024 inventory within 1e-6 relative.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-008 — not-yet-reconciled
All required gases present. The 2100 warming spread across infill alternatives is reported against a 0.01°C materiality threshold. If it exceeds the threshold, it is reported as a material uncertainty; the infill is never adjusted to pass.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-009 — not-yet-reconciled
No NDC-only pathway is labelled “all commitments”.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

### S06-010 — not-yet-reconciled
Displayed reference values match hashed, verified source files.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: Not reconciled
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Locate compatible commitments inputs; run missing-gas and harmonisation sensitivities.

## Stage 7 — Climate response and the four headline measures

### S07-001 — not-yet-reconciled
Use pinned FaIR 2.2.4 with its calibrated ensemble, a native-unit bridge and validation of supported gases.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-002 — not-yet-reconciled
Precompute versioned member ensembles offline in Python and serve them from Node, with explicit errors if missing; no Python in the request path.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-003 — not-yet-reconciled
Keep three evidence strands separate, each with its own status:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-004 — not-yet-reconciled
Physical-response verification: an independent reference run, historical forcing reconciliation and pulse tests.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-005 — not-yet-reconciled
Emissions-model evaluation: taken from Stage 9 skill results; not established here.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-006 — not-yet-reconciled
Scenario interpretation: what the pathway assumes and represents.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-007 — not-yet-reconciled
Independent reference: reproduce a published FaIR calibration output for a standard SSP case.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-008 — not-yet-reconciled
Reconcile historical emissions and forcing to the IGCC 2025 dataset. Compare 2025 human-induced warming with the dated 1.37°C reference, and 2016–2025 with 1.24 [1.0–1.5]°C. Report the share of members in range; do not tune to a point.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-009 — not-yet-reconciled
Define the metrics:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-010 — not-yet-reconciled
2100 warming: median, mean, P10 and P90.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-011 — not-yet-reconciled
Net-zero GHG year (AR6 GWP100, including land use, durable through 2100) and net-zero CO₂ year, computed separately. First crossing is a secondary output; “not reached by 2100” returns null and is counted.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-012 — not-yet-reconciled
P(net zero by 2050): the share of valid members reaching it.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-013 — not-yet-reconciled
Reduction rates for 2024–2030, 2030–2050 and 2050–2100, using the sign rules in the colleague's plan.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-014 — not-yet-reconciled
Keep the 5%-of-2024 milestone only under its own name. Label probabilities “model-conditional”, with a calibration drilldown.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-015 — not-yet-reconciled
Headline presentation: once physical verification and accounting checks pass, the new result may become the headline, labelled “conditional scenario estimate”. It is relabelled “forecast” only when Stage 9 evaluation meets its predeclared criteria. This does not supersede the existing readiness gates; it records which are passed.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-016 — not-yet-reconciled
Headline, quantiles, density and P2050 recompute exactly from saved members.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-017 — not-yet-reconciled
Code audit and perturbation tests find no 1–5°C clipping, no 1.1°C offset and no aggregate-CO₂e shortcut.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-018 — not-yet-reconciled
Independent reference: maximum annual difference ≤ 0.01°C.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-019 — not-yet-reconciled
A CO₂ pulse response matches the ensemble TCRE; a CH₄ pulse decays on its lifetime.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-020 — not-yet-reconciled
Net-zero fixtures (rise, fall, rebound, never crossing) return correct answers.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-021 — not-yet-reconciled
Convergence between 5,000 and 10,000 members: warming quantiles move < 0.01°C. Net-zero quantiles move < 1 year, computed with never-reaching members treated as censored at 2100. The never-reaching share moves < 1 percentage point.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

### S07-022 — not-yet-reconciled
UI, API and exports return identical headline values and the same claim label.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Minor_Gas_History_Sensitivity.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce independent SSP benchmark; reconcile history; couple accepted ensemble.

## Stage 8 — Regional pathways and driver attribution

### S08-001 — not-yet-reconciled
Build regional accounts from regional drivers, covering the global inventory exactly once (with international transport as its own account).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-002 — not-yet-reconciled
Regional outputs are emissions pathways, reduction rates and net-zero milestones, plus each region's contribution to global warming under the attribution method. No “regional temperature” is produced by running the global climate model on a region alone.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-003 — not-yet-reconciled
Keep “what if the world followed this region's intensity” only as a named counterfactual.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-004 — not-yet-reconciled
Implement Shapley attribution per member for (a) the forecast against a declared baseline and (b) the change between two forecast dates. Use exact Shapley values where the number of driver groups makes it affordable. If permutation sampling is used, report its approximation error. Label results “contribution within the model and chosen baseline”, not causal attribution.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-005 — not-yet-reconciled
Keep one-at-a-time shocks as sensitivities, with separate endpoints and labels.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-006 — not-yet-reconciled
Add region × sector × gas × driver drilldowns and downloads on the headline's manifest.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-007 — not-yet-reconciled
Regions and international transport cover the inventory exactly once; their sums equal global for every member, gas, sector and year.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-008 — not-yet-reconciled
Contributions sum to the total change within 0.001°C per member. Exact Shapley values are order-independent by construction; sampled values report approximation error below a predeclared bound.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-009 — not-yet-reconciled
Sensitivities and contributions carry different labels and endpoints; contributions carry the “within-model” label.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

### S08-010 — not-yet-reconciled
Drilldowns resolve to the headline's manifest.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Regional_Attribution_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Run policy and between-vintage attribution; expose manifest-linked drilldowns.

## Stage 9 — Forecast history and skill

### S09-001 — not-yet-reconciled
Implement three historical labels with distinct type codes:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-002 — not-yet-reconciled
Actual archived forecast: what the application produced at the time (from the Stage 2 archive onwards).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-003 — not-yet-reconciled
Retrospective simulation on verified past inputs: today's model re-run at a past date. This label applies only where every input meets that date's information cutoff, and only where model parameters were estimated without later data, so Stage 4 fits must be re-estimated on data available at each date. Relevant inputs include original filings, historical emissions, classifications, universe membership, macro and policy data.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-004 — not-yet-reconciled
Revised-history reconstruction: everything else.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-005 — not-yet-reconciled
Re-run the model quarterly from 2015, assigning each run the correct label. Record, per run, which inputs met the cutoff and which did not.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-006 — not-yet-reconciled
Decompose revisions between consecutive runs into new data, data revisions, model or code changes, assumption changes and ensemble noise.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-007 — not-yet-reconciled
Freeze the evaluation protocol before running it: targets (global and regional emissions 1–3 years ahead, with completed outcomes only), baselines (persistence, linear trend), metrics (bias, MAE, interval coverage, calibration), and the criteria that would justify the “forecast” label in Stage 7.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-008 — not-yet-reconciled
Export sector and region trajectories for every quarterly run, carrying its label and manifest, for Stages 12 and 15.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-009 — not-yet-reconciled
Two archived runs replay exactly (analytical hashes).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-010 — not-yet-reconciled
Adding a later observation cannot change an earlier run, and parameters used in a retrospective simulation are shown to be fitted only on data available at that date.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-011 — not-yet-reconciled
No run is labelled a retrospective simulation unless every input passes the cutoff audit.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-012 — not-yet-reconciled
The protocol hash predates the results.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-013 — not-yet-reconciled
Skill against persistence and trend is reported for every target. This passes when it is reported, not only when the model wins.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

### S09-014 — not-yet-reconciled
A trajectory export, with its label, exists for every quarter.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Historical_Diagnostics_and_Skill_Results.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement quarterly origin runs and vintage audits; export every quarterly trajectory.

## Stage 10 — Company identity, currencies and fundamentals data

### S10-001 — not-yet-reconciled
Record lifecycle status (listed, acquired, merged, delisted) only from verified listing evidence: provider listing status, corporate-action records or exchange data. A company's last workbook observation is not evidence; without verification, status is “unknown”. Publish the denominator and eligibility rules before measuring coverage.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-002 — not-yet-reconciled
Keep identity-review states distinct: not queried, provider error, candidate awaiting review, accepted, ambiguous, unmatched, out of scope. None of the first three may be merged into another.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-003 — not-yet-reconciled
Root-cause audit of 50 unmatched and 50 ambiguous cases from the earlier 200-company run.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-004 — not-yet-reconciled
Improve the matcher: OpenFIGI ISIN-first with includeUnlistedEquities, a primary-listing rule, share-class and ADR evidence, and minor-unit currencies (GBp, ZAc, ILA).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-005 — not-yet-reconciled
Run the full matching job with checkpoints; produce a batch review file for ambiguous cases; approve through the existing review workflow, never by the developer alone.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-006 — not-yet-reconciled
Load FMP statement history as versioned overlays: revenue, EBITDA, operating cash flow, capital expenditure, working capital, net income, net debt, shares and segments where available. Record each value's filing date, and flag whether it is the original or a restated value.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-007 — not-yet-reconciled
Audit workbook profit and market-cap currencies; use a dated FX source for every conversion.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-008 — not-yet-reconciled
All 2,442 companies have both a lifecycle status (including “unknown”) and an identity-review state, and counts reconcile.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-009 — not-yet-reconciled
No lifecycle status other than “unknown” lacks a verification source.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-010 — not-yet-reconciled
At least 95% of verified-listed eligible companies are accepted; otherwise the restricted coverage is reported, with no shrinking of the denominator.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-011 — not-yet-reconciled
A stratified audit of 50 accepted matches finds zero unexplained errors.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-012 — not-yet-reconciled
Re-running creates no duplicates, and no issuer exposure is counted twice in aggregates.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-013 — not-yet-reconciled
Currency fixtures pass; no aggregate mixes currencies without conversion.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

### S10-014 — not-yet-reconciled
Coverage of cash-flow and net-debt history, and the share of values flagged as restated, are reported by sector and region.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Remaining_Workplan_Execution.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Audit lifecycle/identity census; assemble review batches and broader financial coverage.

## Stage 11 — Market-implied growth: Gordon versus reverse DCF

### S11-001 — not-yet-reconciled
Specify before building (record each choice in the parameter register):

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-002 — not-yet-reconciled
Cash-flow basis: free cash flow to equity (FCFE), discounted at the cost of equity, as primary. Free cash flow to the firm (FCFF) at WACC, with net debt subtracted, is a cross-check where debt data are reliable.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-003 — not-yet-reconciled
Cash flows: operating cash flow less capital expenditure and working-capital investment, plus net borrowing for FCFE. Reinvestment is tied to return on capital, so growth is not free.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-004 — not-yet-reconciled
Discount rate: company-specific cost of equity, using beta from the workbook return index over 60 months shrunk towards 1, with stated risk-free and equity-risk-premium ranges. WACC uses observed debt costs where available. Keep a common-8% variant.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-005 — not-yet-reconciled
Banks and insurers: standard industrial cash-flow models do not apply. Use an excess-return (residual income) formulation on book equity, or return “not modelled”.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-006 — not-yet-reconciled
Loss-makers: use revenue × a normalised margin only where a margin can be identified from company history or close peers. Otherwise return “no defensible solution”.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-007 — not-yet-reconciled
Gordon. g = r − E/P. Loss-makers return “unavailable” and are counted.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-008 — not-yet-reconciled
Reverse DCF. Three stages:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-009 — not-yet-reconciled
Solve for the stage-1 growth (years 1–5) that equates present value to market value.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-010 — not-yet-reconciled
Fade linearly over years 6–15 to a terminal nominal growth rate (range 2.5–4%). Terminal growth must be below the discount rate.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-011 — not-yet-reconciled
Finite-period growth may legitimately exceed the discount rate.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-012 — not-yet-reconciled
Default (D-9): solve purely from price. An analyst-anchored version using FMP estimates is a sensitivity.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-013 — not-yet-reconciled
Compute monthly histories of both measures across the workbook period, labelled revised history.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-014 — not-yet-reconciled
Commit the criteria and decision rule (D-8) before computing any results. Then follow the model-selection sequence in Section 4: both models feed Stage 12 and a validation-period Stage 14 run before the choice is made.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-015 — not-yet-reconciled
Criterion

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-016 — not-yet-reconciled
Measure

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-017 — not-yet-reconciled
Preferred

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-018 — not-yet-reconciled
Analytical coverage

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-019 — not-yet-reconciled
Share of eligible companies with a well-posed solution, reported by sector (financials separately)

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-020 — not-yet-reconciled
Higher, reported, not a pass threshold

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-021 — not-yet-reconciled
Plausibility

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-022 — not-yet-reconciled
Share of solutions whose implied stage-1 growth lies outside the empirical range of realised 5-year growth for comparable companies (for example below the 1st or above the 99th percentile)

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-023 — not-yet-reconciled
Lower

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-024 — not-yet-reconciled
Stability

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-025 — not-yet-reconciled
Month-on-month rank correlation where fundamentals and prices are little changed

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-026 — not-yet-reconciled
Higher

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-027 — not-yet-reconciled
Incremental information

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-028 — not-yet-reconciled
Explanatory power for realised growth and returns beyond earnings yield, tested with controls (not raw correlation with earnings yield)

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-029 — not-yet-reconciled
Higher

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-030 — not-yet-reconciled
Forecast validity

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-031 — not-yet-reconciled
Rank correlation with realised 3-year cash-flow, earnings and revenue growth, completed windows only

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-032 — not-yet-reconciled
Higher

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-033 — not-yet-reconciled
Signal value

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-034 — not-yet-reconciled
Validation-period information coefficient of the Stage 14 signal built on each model

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-035 — not-yet-reconciled
Higher, with intervals suited to overlapping returns

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-036 — not-yet-reconciled
Assumption sensitivity

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-037 — not-yet-reconciled
Ranking change for ±1 pp discount rate and ±1 pp terminal growth

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-038 — not-yet-reconciled
Lower

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-039 — not-yet-reconciled
For well-posed cases (positive, identifiable cash flows; terminal growth below the discount rate), the solver converges reliably and reproduces a textbook fixture to 0.01 pp. Cases without a defensible solution are returned as such and counted, not forced.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-040 — not-yet-reconciled
Gordon fixtures pass for positive, negative, zero and missing earnings; the financials method passes its own fixtures.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-041 — not-yet-reconciled
The criteria-and-rule commit predates any results.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-042 — not-yet-reconciled
The comparison pack covers all seven criteria with intervals.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

### S11-043 — not-yet-reconciled
Stage 11 is reported as accepted only after the Section 4 model-selection step is complete.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Assemble common-sample historical predictions; complete seven-criterion D8 comparison.

## Stage 12 — Company projected growth and emissions pathways

### S12-001 — not-yet-reconciled
Map each company to model sectors and regions by operating geography (where it produces and sells), using FMP revenue segments, workbook data and disclosures. Headquarters country is a fallback only, and is flagged.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-002 — not-yet-reconciled
Activity growth: the model's regional sector trajectories applied to the company's mix, with its market share mean-reverting to the sector.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-003 — not-yet-reconciled
Margins bounded by company history and peer ranges. Carbon drag applies only to emissions that bear a charge:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-004 — not-yet-reconciled
Scope 1 under the regional carbon-pricing regimes that apply.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-005 — not-yet-reconciled
Scope 2 through electricity prices where relevant.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-006 — not-yet-reconciled
Scope 3 is not a direct liability; it enters only through demand effects already in activity growth.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-007 — not-yet-reconciled
Drag = liable emissions × projected effective carbon price × (1 − pass-through), with sector pass-through ranges from the literature.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-008 — not-yet-reconciled
Produce cash-flow projections that correspond line by line to the Stage 11 valuation (same cash-flow basis, horizon, nominal terms and treatment of reinvestment), so projected and implied growth are directly comparable.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-009 — not-yet-reconciled
Company emissions = activity × intensity, by scope. The intensity path comes from regional sector technology trajectories. A separate abatement term is used only for measures not already in those trajectories, with a check that no improvement is counted twice. Targets count only through explicit delivery assumptions backed by credibility evidence.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-010 — not-yet-reconciled
Sample activity, share, margin, carbon price and pass-through across 1,000 members, paired with the valuation inputs, to give each company a projected-growth distribution.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-011 — not-yet-reconciled
Historical projections use Stage 9 runs and carry their labels. They count as retrospective simulations only where all company inputs also meet the cutoff (original filings, contemporaneous classifications); otherwise they are revised history.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-012 — not-yet-reconciled
Changing one company's fundamentals changes its projected growth and leaves peers unchanged.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-013 — not-yet-reconciled
A common additive adjustment applied to every company cannot reorder within-peer gap rankings. Non-additive global changes may legitimately reorder companies with different exposures; that is reported, not tested against.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-014 — not-yet-reconciled
Company emissions reconcile to activity × intensity (× any separate abatement) by scope, and a double-counting check passes.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-015 — not-yet-reconciled
Carbon drag uses only liable emissions; a fixture confirms Scope 3 creates no direct charge.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-016 — not-yet-reconciled
A unit test confirms projected and implied growth share cash-flow basis, unit, horizon and definition.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-017 — not-yet-reconciled
Three worked companies are documented end to end: a utility, an oil and gas producer and an industrial.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

### S12-018 — not-yet-reconciled
Coverage of market cap and emissions, and the share mapped by operating geography versus headquarters fallback, are reported.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Company_Accounting_Controls.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Source operating exposures and carbon assumptions; execute three climate-linked cases.

## Stage 13 — Valuation-consistent climate scenarios (gated research)

### S13-001 — not-yet-reconciled
Sector-first identification. Begin with segments where valuation links tightly to physical activity:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-002 — not-yet-reconciled
Oil, gas and coal producers: implied production decline from the valuation of reserves and cash flows.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-003 — not-yet-reconciled
Coal-heavy utilities: implied retirement pace of fossil capacity.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-004 — not-yet-reconciled
Clean-technology pure plays: implied deployment growth (solar, wind, EVs, batteries).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-005 — not-yet-reconciled
For each, state every assumption needed to go from valuation to physical activity: commodity price deck, margins, discount rate, capital allocation.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-006 — not-yet-reconciled
Diversified companies (extension). Regress implied growth on conventional drivers (sector, region, size, profitability, capital intensity, commodity exposure, leverage, past growth) plus transition exposure. Treat the result as a conditional association, not as climate-attributable growth.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-007 — not-yet-reconciled
Identification assessment, predeclared. For each segment, test whether the implied physical path is pinned down:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-008 — not-yet-reconciled
Is the result stable across alternative control sets and price decks?

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-009 — not-yet-reconciled
Does it move as expected when known climate policy news arrives (event checks)?

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-010 — not-yet-reconciled
Is the range across defensible assumptions narrower than a stated width?

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-011 — not-yet-reconciled
Two threshold sets are predeclared (D-13). Segments passing the looser set qualify for the Tier 2 “market-implied” label in the dashboard. The tighter set is also tested for every segment and reported in the stage report, without changing the dashboard.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-012 — not-yet-reconciled
Tier 1, always produced. For each declared assumption set, convert implied activity paths into emissions (activity × intensity, never growth × 100). Aggregate the covered universe, expand to global with an explicit sector and region model and alternative coverage assumptions, and run each pathway through the Stage 7 ensemble. Report the range of the four measures across assumption sets.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-013 — not-yet-reconciled
Tier 2, only if earned. Where identification passes, publish “market-implied” measures for that segment and, if enough of global emissions qualifies, for the covered universe. Otherwise return “not identifiable” with the reason.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-014 — not-yet-reconciled
Valuation–emissions association. Estimate the cross-sectional valuation difference associated with emissions after controls, and report it as an association, not a carbon price. Translate it into a carbon-price equivalent only through a separately documented model covering emissions duration, discounting, tax treatment, pass-through and which emissions are actually charged. It shares data with step 2, so it is not an independent check. EU ETS futures are contextual evidence only.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-015 — not-yet-reconciled
Produce monthly revised-history series of Tier 1 ranges, and of Tier 2 measures where earned.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-016 — not-yet-reconciled
Identification tests and both threshold sets (looser, which qualifies; tighter, which is reported only) are confirmed by the owner and committed before results; tighter-set results are reported for every segment.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-017 — not-yet-reconciled
Every Tier 1 scenario lists its full assumption set, and the reported range covers all declared sets.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-018 — not-yet-reconciled
A lineage test confirms emissions come through activity × intensity.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-019 — not-yet-reconciled
The listed universe's share of global emissions is reported, with the sensitivity of results to the expansion assumption.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-020 — not-yet-reconciled
Covered and expanded aggregates reconcile to their populations.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-021 — not-yet-reconciled
No output is labelled “market-implied” unless its segment passed identification. “Not identifiable” is a passing outcome if correctly evidenced.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

### S13-022 — not-yet-reconciled
The valuation–emissions association is reported with sign, interval and units, and is not labelled a carbon price unless the translation model is documented.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Developer_Workplan_Amendments.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Implement evidenced sector mappings and assumption registry; locate confirmed identification thresholds.

## Stage 14 — Valuation-gap research signal and locked evaluation

### S14-001 — not-yet-reconciled
Compute the gap from paired member differences. Each member m carries matched projection and valuation inputs; the gap is the median of the paired differences, not a difference of medians. Keep the full distribution. A positive gap gives a positive score.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-002 — not-yet-reconciled
Score: within-peer rank mapped to [−1, +1], with sector peers as primary and absolute and sub-industry peers as variants.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-003 — not-yet-reconciled
Lock the protocol before evaluation:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-004 — not-yet-reconciled
Targets: next-month and 12-month total return, excess over sector. Include only observations whose outcome window is complete. The data end 22 January 2026, so 12-month outcomes run to about January 2025.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-005 — not-yet-reconciled
Universe and information rule: universe version; filing date plus lag.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-006 — not-yet-reconciled
Periods: training, validation and evaluation periods, with purged and embargoed boundaries wherever 12-month or 3-year outcome windows overlap the next period.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-007 — not-yet-reconciled
Disclosure: the earlier pilot examined data from 2020 onwards, so the evaluation is labelled a “locked retrospective evaluation (prior exposure: 2020 onward)”. Any period genuinely never examined is reserved and reported separately.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-008 — not-yet-reconciled
Controls: value, size, momentum, quality, sector, region and carbon intensity.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-009 — not-yet-reconciled
Thresholds, on the locked evaluation period:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-010 — not-yet-reconciled
Mean rank information coefficient with a 95% interval excluding zero, using methods suited to overlapping returns (date-block bootstrap with block length at least the outcome horizon, or Newey–West).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-011 — not-yet-reconciled
Out-of-sample R² above controls-only, with interval.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-012 — not-yet-reconciled
Factor-adjusted return of a defined long–short research portfolio positive after costs, with interval. Costs are 25 bp per unit of one-way traded notional; turnover is the sum of absolute weight changes.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-013 — not-yet-reconciled
All three = supported; two = supported for further research; fewer = no demonstrated improvement.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-014 — not-yet-reconciled
Factor data aligned to the universe's geography and currency: regional developed-market factors from the Kenneth French Data Library, converted consistently, plus factors built from the workbook universe itself.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-015 — not-yet-reconciled
Ablation: baseline growth only; then add transition demand, carbon drag and intensity in turn.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-016 — not-yet-reconciled
Define the multiple-testing family before testing. The family is the set of primary specifications (models × peer definitions × targets) declared in the protocol; apply Holm within it. Robustness variants are reported but are not part of the family.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-017 — not-yet-reconciled
Prospective archive: from this stage onwards, store every month's live signal, with its manifest, before outcomes are known. This becomes the genuine out-of-sample record.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-018 — not-yet-reconciled
Run the sector-level version of the signal as secondary analysis.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-019 — not-yet-reconciled
The protocol hash, including the multiple-testing family, is committed before the evaluation period is scored.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-020 — not-yet-reconciled
No observation with an incomplete outcome window enters the evaluation; purge and embargo boundaries are verified by test.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-021 — not-yet-reconciled
The prior-exposure disclosure appears on every output of this evaluation.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-022 — not-yet-reconciled
The gap is computed from paired member differences (fixture checks against a known joint distribution).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-023 — not-yet-reconciled
Perturbing one company's gap moves its score in the expected direction.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-024 — not-yet-reconciled
A common additive change cannot reorder within-peer ranks.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-025 — not-yet-reconciled
Every declared specification appears in the results.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

### S14-026 — not-yet-reconciled
The prospective archive records at least one month's signal before its outcome is observed.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Valuation_and_Research_Completion_Status.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Freeze complete research protocol before scoring; generate actual paired new-gap histories.

## Stage 15 — Backtests

### S15-001 — not-yet-reconciled
Long-only tilt (existing engine): market-cap benchmark, weight = benchmark weight × max(0, 1 + tilt × score), normalised. Keep past-only risk scaling (2% target tracking error), the 12-observation warm-up, tilt cap of 5, drift, turnover, costs and terminal-loss handling.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-002 — not-yet-reconciled
Long–short research portfolio (separate definition): top versus bottom quantile within sectors, equal- or cap-weighted as declared, used for the Stage 14 spread test.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-003 — not-yet-reconciled
Constraint variants for the long-only tilt: sector-neutral, maximum active weight, liquidity limits.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-004 — not-yet-reconciled
Evidence tracks:

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-005 — not-yet-reconciled
Track A: revised history.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-006 — not-yet-reconciled
Track B: point-in-time. It applies only to periods where projections are retrospective simulations on verified past inputs (Stage 9) and fundamentals are original, not restated, filings. Track B is “unavailable” wherever these requirements are unmet.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-007 — not-yet-reconciled
Live archived signals from Stage 14 form a third, prospective track.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-008 — not-yet-reconciled
Delisting treatment: apply delisting-return stresses (0%, −30%, −100%) only to companies with evidence of delisting, or with an unexplained terminal observation flagged by Stage 10. Never apply them to every company's final observation.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-009 — not-yet-reconciled
Data quality: reconcile 50 random return-index observations against FMP prices plus dividends as a quality check (not as verification of the full history), and report break rates.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-010 — not-yet-reconciled
Factor attribution with factors aligned to geography and currency; report alpha with intervals suited to the return frequency.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-011 — not-yet-reconciled
Costs at 0/10/25/50/100 bp per unit of one-way traded notional; monthly and quarterly rebalancing; sub-periods; drawdowns; a liquidity-based capacity proxy.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-012 — not-yet-reconciled
Issue the research decision under the locked protocol.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-013 — not-yet-reconciled
Zero cost recovers gross returns, and costs reconcile to traded notional in an independent recomputation, using the stated cost and turnover definitions.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-014 — not-yet-reconciled
Long-only and long–short results are reported under separate labels; neither is used to evidence the other's test.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-015 — not-yet-reconciled
Perturbing future returns or fundamentals cannot change earlier holdings.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-016 — not-yet-reconciled
Data refreshes cannot alter earlier runs (golden analytical hashes).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-017 — not-yet-reconciled
Track B shows “unavailable” for every period failing its evidence requirements.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-018 — not-yet-reconciled
Delisting stresses apply only to evidenced or flagged companies (fixture check).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

### S15-019 — not-yet-reconciled
Every declared variant is reported; every displayed metric recomputes from the stored series.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Workplan_Status_and_Conclusions.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Execute actual new-gap portfolios and full cost/rebalance/lifecycle sensitivity family.

## Stage 16 — Application integration and routine data refreshes

### S16-001 — not-yet-reconciled
Main page: the observable forecast's four measures (labelled conditional scenario estimate or forecast, per Stage 7) beside the Stage 13 Tier 1 range. Show any Tier 2 market-implied measures only where earned. Include a measure toggle, fan charts, scenario selector (implemented policies / commitments) and published references. The legacy gauge stays in its optional comparison view.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-002 — not-yet-reconciled
Regional, attribution and forecast-history views on the headline's manifest, each showing its claim label (within-model; archived / retrospective simulation / revised history).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-003 — not-yet-reconciled
Company pages: projected versus implied growth, paired gap distribution, valuation-model selector, emissions pathway and a worked-company drilldown.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-004 — not-yet-reconciled
Backtest page: protocol and prior-exposure disclosure, long-only and long–short results under separate labels, Track A/B (with “unavailable” where applicable), prospective-archive record, factor-adjusted results and robustness.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-005 — not-yet-reconciled
Support unavailable and partial results everywhere. No component may assume all four market-implied measures, or any Tier 2 output, exists. Each shows the specific reason when absent.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-006 — not-yet-reconciled
Data Management: versioned refresh for carbon, SDG, financial and driver data, with diffs, approval state, affected analyses and one scheduler.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-007 — not-yet-reconciled
Generate methodology pages from the registries; attach the manifest and claim label to every download.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-008 — not-yet-reconciled
Remove a Stage 1 interim warning only when its underlying limitation is resolved and evidenced, not merely because a replacement calculation exists. Record each removal and its evidence in the stage report.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-009 — not-yet-reconciled
UI, API and exports return identical values and claim labels for every headline measure.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-010 — not-yet-reconciled
Every page renders correctly when market-implied measures, Tier 2 outputs or Track B results are unavailable (fixture with all absent).

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-011 — not-yet-reconciled
An approved refresh updates intended outputs on the next request; rejected or failed refreshes change nothing; earlier manifests are unchanged.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-012 — not-yet-reconciled
An end-to-end company perturbation propagates through the gap to backtest weights.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-013 — not-yet-reconciled
Each removed interim warning has a linked resolution record.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

### S16-014 — not-yet-reconciled
A desktop and mobile review of every page finds no fabricated numbers in loading, empty or error states.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Analysis_Wide_Historical_Selection.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Integrate remaining analyses and verify UI/API/export/approval consistency.

## Stage 17 — Integrated acceptance and clean reproduction

### S17-001 — not-yet-reconciled
Assemble the acceptance matrix: every stage's criteria with status, evidence link, SHA and check type (exact, numerical, operational, judgement).

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-002 — not-yet-reconciled
Reproduce in a clean environment (fresh checkout, Node 22, pinned Python, staging database):

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-003 — not-yet-reconciled
the global ensemble and four measures;

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-004 — not-yet-reconciled
one regional and attribution analysis;

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-005 — not-yet-reconciled
two forecast vintages;

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-006 — not-yet-reconciled
one company valuation and emissions analysis;

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-007 — not-yet-reconciled
one backtest.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-008 — not-yet-reconciled
The owner, as independent reviewer (D-12), re-runs or checks the Stage 11 comparison, the Stage 14 locked evaluation and the Stage 15 accounting, using the developer's reproduction pack. The developer answers questions but does not run the checks on the owner's behalf.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-009 — not-yet-reconciled
Retire legacy comparators from the production UI, keeping them in code and tests.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-010 — not-yet-reconciled
Update the handover documentation, parameter register, glossary and four worked examples.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-011 — not-yet-reconciled
Write the completion statement and research backlog: calibration gaps, NGFS Phase VI, more regions, valuation refinements, live signal track record.

- Section: implementation; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-012 — not-yet-reconciled
Every mandatory criterion passes or has an owner-approved scope change.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-013 — not-yet-reconciled
The clean reproduction matches stored output hashes or numerical tolerances.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-014 — not-yet-reconciled
The owner's review, using the reproduction pack, matches the developer's results within tolerance.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

### S17-015 — not-yet-reconciled
Production SHA, health and displayed model and data versions agree.

- Section: acceptance; origin: pre-existing-scope
- Existing evidence: docs/Application_Logic_and_Implementation.md
- Delivered this run: None recorded
- Scientific acceptance: not-assessed
- Executions: []
- Gaps: Reconcile this exact requirement with code and direct evidence.
- Next: Reproduce completed analyses in clean environment; prepare owner review pack.

## Restart
{
  "next_requirement": "S00-003",
  "unfinished_requirement_ids": [
    "S00-001",
    "S00-003",
    "S00-004",
    "S00-005",
    "S00-006",
    "S00-007",
    "S00-008",
    "S00-009",
    "S00-010",
    "S00-011",
    "S01-001",
    "S01-002",
    "S01-003",
    "S01-004",
    "S01-005",
    "S01-006",
    "S01-007",
    "S01-008",
    "S01-009",
    "S01-010",
    "S01-011",
    "S01-012",
    "S01-013",
    "S01-014",
    "S01-015",
    "S01-016",
    "S02-001",
    "S02-002",
    "S02-003",
    "S02-004",
    "S02-005",
    "S02-006",
    "S02-007",
    "S02-008",
    "S02-009",
    "S02-010",
    "S02-011",
    "S03-001",
    "S03-002",
    "S03-003",
    "S03-004",
    "S03-005",
    "S03-006",
    "S03-007",
    "S03-008",
    "S03-009",
    "S03-010",
    "S04-001",
    "S04-002",
    "S04-003",
    "S04-004",
    "S04-005",
    "S04-006",
    "S04-007",
    "S04-008",
    "S04-009",
    "S04-010",
    "S04-011",
    "S04-012",
    "S05-001",
    "S05-002",
    "S05-003",
    "S05-004",
    "S05-005",
    "S05-006",
    "S05-007",
    "S05-008",
    "S05-009",
    "S05-010",
    "S05-011",
    "S05-012",
    "S05-013",
    "S06-001",
    "S06-002",
    "S06-003",
    "S06-004",
    "S06-005",
    "S06-006",
    "S06-007",
    "S06-008",
    "S06-009",
    "S06-010",
    "S07-001",
    "S07-002",
    "S07-003",
    "S07-004",
    "S07-005",
    "S07-006",
    "S07-007",
    "S07-008",
    "S07-009",
    "S07-010",
    "S07-011",
    "S07-012",
    "S07-013",
    "S07-014",
    "S07-015",
    "S07-016",
    "S07-017",
    "S07-018",
    "S07-019",
    "S07-020",
    "S07-021",
    "S07-022",
    "S08-001",
    "S08-002",
    "S08-003",
    "S08-004",
    "S08-005",
    "S08-006",
    "S08-007",
    "S08-008",
    "S08-009",
    "S08-010",
    "S09-001",
    "S09-002",
    "S09-003",
    "S09-004",
    "S09-005",
    "S09-006",
    "S09-007",
    "S09-008",
    "S09-009",
    "S09-010",
    "S09-011",
    "S09-012",
    "S09-013",
    "S09-014",
    "S10-001",
    "S10-002",
    "S10-003",
    "S10-004",
    "S10-005",
    "S10-006",
    "S10-007",
    "S10-008",
    "S10-009",
    "S10-010",
    "S10-011",
    "S10-012",
    "S10-013",
    "S10-014",
    "S11-001",
    "S11-002",
    "S11-003",
    "S11-004",
    "S11-005",
    "S11-006",
    "S11-007",
    "S11-008",
    "S11-009",
    "S11-010",
    "S11-011",
    "S11-012",
    "S11-013",
    "S11-014",
    "S11-015",
    "S11-016",
    "S11-017",
    "S11-018",
    "S11-019",
    "S11-020",
    "S11-021",
    "S11-022",
    "S11-023",
    "S11-024",
    "S11-025",
    "S11-026",
    "S11-027",
    "S11-028",
    "S11-029",
    "S11-030",
    "S11-031",
    "S11-032",
    "S11-033",
    "S11-034",
    "S11-035",
    "S11-036",
    "S11-037",
    "S11-038",
    "S11-039",
    "S11-040",
    "S11-041",
    "S11-042",
    "S11-043",
    "S12-001",
    "S12-002",
    "S12-003",
    "S12-004",
    "S12-005",
    "S12-006",
    "S12-007",
    "S12-008",
    "S12-009",
    "S12-010",
    "S12-011",
    "S12-012",
    "S12-013",
    "S12-014",
    "S12-015",
    "S12-016",
    "S12-017",
    "S12-018",
    "S13-001",
    "S13-002",
    "S13-003",
    "S13-004",
    "S13-005",
    "S13-006",
    "S13-007",
    "S13-008",
    "S13-009",
    "S13-010",
    "S13-011",
    "S13-012",
    "S13-013",
    "S13-014",
    "S13-015",
    "S13-016",
    "S13-017",
    "S13-018",
    "S13-019",
    "S13-020",
    "S13-021",
    "S13-022",
    "S14-001",
    "S14-002",
    "S14-003",
    "S14-004",
    "S14-005",
    "S14-006",
    "S14-007",
    "S14-008",
    "S14-009",
    "S14-010",
    "S14-011",
    "S14-012",
    "S14-013",
    "S14-014",
    "S14-015",
    "S14-016",
    "S14-017",
    "S14-018",
    "S14-019",
    "S14-020",
    "S14-021",
    "S14-022",
    "S14-023",
    "S14-024",
    "S14-025",
    "S14-026",
    "S15-001",
    "S15-002",
    "S15-003",
    "S15-004",
    "S15-005",
    "S15-006",
    "S15-007",
    "S15-008",
    "S15-009",
    "S15-010",
    "S15-011",
    "S15-012",
    "S15-013",
    "S15-014",
    "S15-015",
    "S15-016",
    "S15-017",
    "S15-018",
    "S15-019",
    "S16-001",
    "S16-002",
    "S16-003",
    "S16-004",
    "S16-005",
    "S16-006",
    "S16-007",
    "S16-008",
    "S16-009",
    "S16-010",
    "S16-011",
    "S16-012",
    "S16-013",
    "S16-014",
    "S17-001",
    "S17-002",
    "S17-003",
    "S17-004",
    "S17-005",
    "S17-006",
    "S17-007",
    "S17-008",
    "S17-009",
    "S17-010",
    "S17-011",
    "S17-012",
    "S17-013",
    "S17-014",
    "S17-015"
  ],
  "instruction": "Do not re-plan or repeat passed checks unless code changes invalidate them. Finish S00-003/S00-007 regional/company/walk-forward process baselines (global and six category cases already verified), then S00-005/S00-010 scheduler ownership. Continue clause-by-clause reconciliation (most 300 clauses remain not-yet-reconciled). Actual-data temporary restore and corrupt-file rejection passed; full production/schema recovery remains. Production archive depends on supported managed schema/guards; no direct DDL. Next independent substantive work: full overlay replay, 22-driver evidence, remaining calibration. Research work is NOT complete.",
  "background_tasks": []
}

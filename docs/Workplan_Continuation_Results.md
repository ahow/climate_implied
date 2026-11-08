# Continued implementation — 8 November 2026

This supplements the historical execution ledger. It does **not** declare the
18-stage workplan complete. Development, deployment and scientific acceptance
are separate.

## Implemented and tested

Verification of this increment: **112 TypeScript tests and 18 Python tests
passed**, including TypeScript tests with DATABASE_URL removed. Type checking
and the production build passed. Development HTTP confirmed the snapshot
identity and all 22 driver records; the Data Management page rendered without
browser errors. Railway's next-build command now also runs type checking before
its TypeScript test/build gate.

- Immutable workbook tables and transactionally published chunks. Full source
  capture: 2,442 companies, 470,341 observations. Snapshot identity:
  `271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac`.
  Repeated capture was idempotent. Consumer replay preserved company and
  observation content. Database guards rejected modification, deletion and
  late insertion into sealed snapshots.
- Shared company readers resolve a request-bound snapshot. CV requests accept
  `snapshotId`; response headers identify data state, snapshot and manifest.
  CV summary now uses the same reader. An absent explicitly requested snapshot
  fails; the unprovisioned legacy path is labelled, not described as immutable.
- Authorized **development-only** workbook importer validates before atomic
  publication. It does not delete or replace old observations. Whole-workbook
  parsing retains parsed numeric precision, not original workbook formatting.
  Existing stored float precision cannot be reconstructed.
- Public snapshot status/inventory and methodology driver-evidence disclosure.
- All 22 indicators have explicit roles, causal-evidence limitations,
  uncertainty availability and licensing-review status. Missing evidence remains
  unavailable. Interior interpolation preserves zeros and does not extrapolate.
- Frozen regional electricity calibration on actual OWID energy data:
  training 2010–2018; evaluation 2019–2024; World, US, China, India and EU27;
  solar/wind separately. Only EU solar beat both persistence and linear-trend
  baselines. Nine fits are sensitivity-only. Even EU solar is not promoted:
  parameter uncertainty and structural-break validation remain absent.
- Frozen full-universe supplementary diagnostic: 343,547 eligible observations,
  126,794 excluded; four date-block lengths (1,3,6,12). Relative MSE improvement
  was -0.000097660174 (a small deterioration). Every confidence interval crossed
  zero. All four results: exploratory-no-improvement. This tests the **old
  emissions-intensity signal**, not the new valuation-gap signal. Revised history,
  prior exposure and unresolved currency/unit reconciliation prevent investment
  claims.
- Separate hypothetical long-short engine: sector-balanced long/short baskets,
  drift-aware traded notional, transaction costs, borrow availability, borrow
  costs, financing and terminal loss handling. Fixture tests verify both traded
  legs and future-outcome separation. It is not an investable historical study.
- Database connections now initialize on actual use rather than pure-module
  import. Calculation tests can run in CI without database credentials.

## Reproduction

```sh
env -u DATABASE_URL npx tsx --test script/*.test.ts
uv run python -m unittest discover -s script -p 'test_*.py'
npm run check
npm run build
# Development only, provisioned snapshot schema/guards required:
npx tsx script/capture-workbook-snapshot.ts
npx tsx script/verify-workbook-snapshot.ts
uv run python script/driver_calibration.py
npx tsx script/research-full-universe.ts
```

Protocols are committed in `Driver_Calibration_Protocol.md` and
`Full_Universe_Diagnostic_Protocol.md`. Private raw data and detailed generated
evidence remain under ignored `generated-artifacts/`; they are not redistributed.

## Still incomplete — do not infer completion from fixtures

0. Railway has an inline TypeScript-test build gate, but GitHub check-suite
   waiting, complete recovery acceptance and production scheduler ownership
   are not established.
1. Complete backend physical-gap cleanup and new milestone semantics.
2. Managed production snapshot schema/guards and baseline capture; immutable
   financial/indicator overlays, historical UI selection, every direct reader,
   complete concurrent-request/import acceptance and persisted manifests.
   Railway source deployment alone does not migrate the Replit-managed database.
   The production reader explicitly reports unprovisioned if guards are absent.
3–4. Source uncertainty/licence/vintage completion and the remaining technology,
   cost and demand calibrations. Nine failed fits must not enter a central model.
5–9. Regional native-gas ensemble, complete compatible policy/pledge scenarios,
   missing-gas assessment, independently verified modern FaIR coupling,
   regional attribution and historical-vintage climate skill remain incomplete.
10. Full-universe identity candidate collection is running separately; candidates
   are not issuer approvals. Lifecycle, financial histories, currency and
   independent approval coverage remain incomplete.
11–13. Actual cash-flow-based company-model coverage, locked empirical model
   comparison, company climate-growth mappings and identified valuation
   scenarios remain incomplete. Existing solver fixtures are not replacements.
14. The new paired-growth-gap research is not implemented. The supplementary
   negative emissions-intensity finding does not complete it.
15. Actual long-short historical research, cost/borrow/FX/dividend/lifecycle
   verification and genuine-vintage comparison remain incomplete.
16–17. Full-interface/export consistency, clean-environment reproduction and
   independent acceptance remain incomplete.

Some items need external evidence or managed production actions; others are
unfinished engineering. They must not all be described as external blockers.

### Subsequent contract repair

Descriptive CV responses now also withhold projected physical reduction rates,
physical gaps and their summary rates/distributions, including nested cached
records. The two peer-relative endpoints no longer run a climate simulation to
obtain a common ranking offset: setting that internal common offset to zero
leaves ranks unchanged. Their physical outputs remain withheld. The revised
near-zero milestone is still outstanding. An additional contract test passes.

### Concurrent input isolation

Approved indicator values are now captured once per GET request. Concurrent
calculations keep separate maps across asynchronous work; duplicate approved
cells fail explicitly rather than selecting an arbitrary winner. Responses
include the indicator hash, and company manifests include that hash alongside
the workbook identity. This is request isolation, **not** persistent historical
indicator-overlay storage.

Approval/supersession and manual entry now use atomic database transactions
with per-cell advisory locking. A development acceptance run exercised competing
proposals, repeated approval and competing manual entries: exactly one approved
value remained in each case. The test removed only its own synthetic rows.
A read-only production check found no duplicate approved cells before rollout.
Two new request-isolation fixtures pass. Total TypeScript coverage is now 115
tests; the unchanged Python suite has 18 tests.

### Annual financial histories and conditional cash-flow valuation

The FMP adapter now supports annual cash-flow and balance-sheet statements.
Collection verifies the reviewed issuer/listing against the current profile,
retains raw records privately and does not approve them or replace workbook
history. The reviewed Bayer identity returned 20 annual periods: all 20
reconciled on cash-flow/net-debt component checks; 18 had positive calculated
FCFE. These records remain pending analysis approval, not point-in-time data.

The normalizer uses signed provider capex and net debt issuance:
FCFE = operating cash flow + signed capex + net borrowing. It does not deduct
working capital again. Missing values, inconsistent currencies, duplicate
periods and unexpected capex signs remain explicit. FMP documents that
international filing dates may be reporting-date proxies; they are not accepted
as verified historical availability dates.

An additional **conditional cash-flow solver** now distinguishes FCFE/cost of
equity from FCFF/WACC, including the explicit net-debt/minority/preferred bridge
only for FCFF. It models five-year cash-flow growth followed by a ten-year fade.
Financial institutions, non-positive starting cash flow and values outside the
declared growth interval remain not-modelled. Synthetic perpetuity, repricing,
bridge and refusal tests pass. This is distinct from the earlier
earnings/reinvestment model. Neither is empirically selected by the D8 gate.

Five additional tests cover these additions. The actual company-model comparison
and UI activation remain incomplete; collecting 20 annual records for one company
does not establish universe coverage or validate a valuation-gap strategy.

Latest verification: **120 TypeScript tests passed**, including a run without
database credentials; type checking and production build passed. The unchanged
18-test Python suite remains passing. The running diagnostic API recovered zero
growth for a 100-per-year, 10%-discount perpetuity priced at 1,000, with relative
repricing error below 1e-15, and explicitly returned modelPromoted=false.

### Startup and read-only safety

Server startup no longer deletes duplicate workbook rows, creates an index,
changes upload outcomes or clears the legacy carbon-price cache. Listing uploads
no longer changes their status. Financial-review reads check that their managed
table exists rather than issuing CREATE TABLE. A read-only production check
confirmed that this table already exists. The existing monthly collection and
approval cadence is unchanged.

Two source-contract regression tests cover these read/startup boundaries.
These repairs do not replace the outstanding production recovery rehearsal or
single-scheduler ownership verification.

The subsequent full suite passed **122 TypeScript tests**, type checking and
production build. `/api/build-info` exposes the hosting-provided Git revision
when available, independently of database availability; missing metadata is
explicitly null rather than an invented version.

# Implementation run — steps 1–10

This records the resumed implementation, separate from the earlier partial pass.
Implementation tests are not equivalent to scientific or data-coverage acceptance.
Production promotion remains restricted to validated behavior.

## 1. Documentation and validation

Added executable checks for local handover links and workbook insert contracts.
Removed invalid omissions of generated-always identity columns from Drizzle/Zod
insert schemas; these columns are already excluded by the schema generator.
No database schema or stored data is changed.

Tests: both new handover/schema tests passed. `npm run check` now passes,
resolving all eight previously reported type errors.

## 2. Reviewed security identities

Added explicit evidence-backed acceptance of a provider-checked candidate,
issuer-level deduplication, frozen eligibility rules and whole-universe coverage
reconciliation. A review must agree with the ISIN, listing, share class and
currency already checked against providers. Difficult records stay in the
denominator. This does not fabricate issuer reviews to achieve 95% coverage.

Tests: all eight mapping/identity fixtures passed. Full database census:
2,442 eligible, zero accepted reviews, 2,442 unresolved. Counts reconcile;
the real-data 95% coverage gate remains failed.

## 3. Staged financial updates

Implemented a durable PostgreSQL review journal, provider-backed staging command,
idempotent approval/rejection, serialised transactional issuer-conflict checks,
supersession of older approvals, strict currency/date/finite-value validation,
and new financial calculation identities. Quotes, annual earnings and freshness
are visible in Data Management via a read-only API. Originals remain untouched.

Run `npx tsx script/financial-review.ts stage <review.json>`, inspect the pending
record, then `approve <id>` or `reject <id>`. This is an authorized workspace
operator workflow, not an unauthenticated public approval button. The reviewed
identity schema is in server/financialData/identity.ts. Keep review inputs in
ignored generated-artifacts, never source control. No automatic refresh job was
added, preserving the existing collection/approval cadence.

Approved snapshots calculate price-to-last-annual-earnings separately; they do
not inject raw FMP currency amounts into an unverified workbook currency basis.
Production refresh remains restricted by Step 2 identity evidence.

Tests: three review suites passed; the real PostgreSQL rollback-only integration
passed approval, repeated approval, conflicting rejection and rollback cleanup.
Typecheck and production build passed. No fixture rows remain. Public approval
is deliberately unavailable; the UI shows the actual operator workflow.

## 4. Native emissions pathway ingestion

Implemented an executable two-scenario contract/API: correct native units,
complete gas coverage, contiguous 2024–2100 years, identical inventory anchors,
signed CO2 removals, rejection of negative non-CO2 values, explicit source/
processing/infilling metadata and 2030/2050/2100 plus cumulative comparisons.
An NDC-only source is rejected as an all-commitments scenario. The endpoint
validates against the real stored inventory, not a client-selected baseline.
Passing this contract means accounting-valid, not scientifically promoted.

Tests: 15 native/mechanism tests and 12 Python assessment tests passed; typecheck
passed. The real NGFS adapter still reports four missing HFC pathways, so
complete scientific scenario acceptance is not claimed.

## 5. FaIR input bridge and shared uncertainty

Added a strict native-Mt-to-FaIR CSV bridge (explicit mass-unit conversions,
untouched pre-2024 history, unsupported species fail), and `--pathway` candidate
input to the pinned runner. The runner exports the actual member-level annual
ensemble. One shared implementation now produces quantiles, exceedance
probabilities, density and headline from that same ensemble without clipping
or adding a warming offset. Added aligned-member independent-reference numeric
comparison at a maximum 0.01°C tolerance.

Tests: three TypeScript ensemble tests and two Python bridge tests passed;
the real FaIR reference run completed with 841 members. Its submitted-ensemble
2100 median was 2.80252556°C, NOT the dashboard forecast. No independent
reference was supplied, so that comparison remains unpassed. Updated historical
forcing and all native species are still required before scientific promotion.
Run `uv run python script/fair-reference.py [--pathway file.json]`, then
`npx tsx script/summarize-fair.ts [ensemble.json] [independent-reference.json]`.
Outputs stay in ignored generated-artifacts; the live default is unchanged.

## 6. Historical evaluation and promotion

Implemented predeclared holdout protocol validation, availability/training-boundary
checks, bias/MAE versus persistence or trend, interval coverage and protocol
hashing. Reconstructed histories cannot pass point-in-time acceptance. Added
seven explicit promotion prerequisites to Data Management. Requesting an
unapproved FaIR engine returns an explicit conflict instead of silently serving
legacy numbers. Production promotion is still disabled, not implied by unit tests.

Tests: all three holdout/promotion suites passed, including deliberate
future-information and missing-gate failures. Typecheck passed. Real historical
holdout evidence is still absent; no default scientific promotion was made.

## 7. Valuation integrity

Required carbon scopes must be present and finite; known zero emissions remain
zero. Invalid P/E no longer becomes zero growth, and invalid aggregate groups
are excluded. Signed 2050 cumulative changes are no longer made positive with
absolute value or capped at 99%. Annualisation requires an explicit base year;
the existing workbook lacks that metadata, so those comparisons are unavailable.
The finance screens now explicitly disclose heuristic physical interpretations,
unverified workbook currencies and unavailable target boundaries. Reviewed FMP
snapshots enforce matching currencies without guessing conversion factors.

Tests: six valuation/integrity fixtures passed; typecheck passed. Calculation
identity was bumped to prevent old cached finance outputs bypassing the repairs.

## 8. Distinct climate-signal research

Implemented preregistered train/holdout evaluation against supplied conventional
controls, nested least squares, incremental out-of-sample MSE and deterministic
paired-bootstrap uncertainty. Future publications/training outcomes are rejected;
changing holdout outcomes cannot alter fitted coefficients. This produces a
restricted go/no-go for the supplied specification, not a claim of investment
alpha. Real source vintages and time/sector stability still need evidence.

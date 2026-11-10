# Development review and material replay evidence

## Final expanded replay and release observations

The verifier was subsequently extended to all nine archived CV result paths.
Actual API requests followed by fresh-process calculation matched exact JSON
hashes for summary, P/E comparison, carbon-price diagnostic, SDG growth,
decarb bands, decarb terciles, decarb-gap summary, decarb-gap timeseries and
the existing backtest. No synthetic overlays were used for these nine requests.
Band/tercile results are empty because the baseline has no targets, so their
nonempty cases remain untested. This does not establish all-refresh/concurrent
acceptance or actual Stage14 efficacy. Per-endpoint IDs, hashes, commands and
logs are retained under generated-artifacts/material-replay and run_executions.

Core workspace fca066b exported as 02afe6457d6e20b96e281b43fa76e0fcd462ce26.
GitHub run42732701451 validation/promotion succeeded. Railway deployment
483ce3e1-33b5-4873-a14a-e3cb5d5fd124 SUCCESS; production health and build-info
200 with matching source SHA; field-semantics API200 returns16 definitions.
Later verifier expansion and ledger reconciliation are tracked separately from
that confirmed runtime deployment.

Starting HEAD ac25e9d; prior matched checkpoint not resent. Beta comparison was
not rerun, refitted or relabelled. Gordon stays primary.

## Carbon and SDG lifecycle

Investigation found no separate pre-existing carbon/SDG approval endpoint:
these fields entered via workbook upload. That path and collector cadence are
unchanged. New operator CLI script/overlay-review.ts stages, approves or rejects
content-addressed proposals through server/snapshots/overlayReview.ts. Existing
immutable archive tables hold proposals, decisions and approved overlays.
No new table, direct DDL, public approval endpoint or real issuer acceptance.

One transaction serializes decisions, authenticates proposal content, checks
company/observation existence, rejects future availability on approval, and
captures the resulting overlay. Repeated same decisions return the existing
record; opposite decisions fail. Approval timestamps prevent backdating;
source availability remains in the immutable proposal. UTC day cutoffs are
explicit. Older-to-newer approval ordering is enforced on application.

script/check-overlay-review-db.ts exercises real helpers for both carbon and
SDG, including loader roundtrip, content hash, repeated staging/approval/rejection,
opposite-decision rejection, immutable-update rejection in a savepoint and
complete rollback of all synthetic proposal/decision/overlay archives.
The initial test exposed a header-count mismatch, fixed before final verification.

## Material/result replay

server/snapshots/materialInputs.ts archives an explicit source allowlist:
server/shared/client TypeScript and embedded JSON/CSV, package manifest and lock,
TypeScript config and Node runtime version. No environment values or secrets.
It also records workbook/ordered overlay identities, approved override values,
effective historical/nowcast indicator rows, cutoff and nonconsumed sources.
Request manifests reference this immutable material record and source hash.
Stored-result retrieval verifies referenced material/source/workbook/overlay
archives and rejects unavailable, corrupt or conflicting content.

An actual GET /api/cv/sdg-growth?costOfEquity=0.08 returned archived result
aea13b6b0c9644d810c75f0bda578f9f0db7a0060cfb70be2ef0dc72365c8b77.
Two fresh processes ran the real calculator from its retained workbook/overrides
and reproduced JSON hash
9b664a9e2d81e73c9fb8b392d02bdc49680cf9834910ea225d796c8b1f29463e.
The first attempts failed because the verifier omitted the public-response
withholding filter; the verifier was corrected, not the scientific output.
Exact failed and passing commands/logs remain in the JSON ledger.
Subsequent source changes are deliberately refused by this old manifest's
source-version check; stored-output retrieval remains available.

This proves actual SDG calculation replay at that source version, not all
endpoints, original publication vintages, archived executable installation,
concurrent refreshes or scientific acceptance. Those remain unmet.

## Semantics and driver provenance

shared/fieldSemantics.ts provides 16 core Input/Calculated/Output definitions,
formula/dependencies/units and source/vintage/as-of rules to API, expandable
download UI and XLSX semantics sheets. Exported normalized rows also receive
a SHA-256 identity. Full column-to-calculation mapping remains incomplete.

All 22 retained driver histories now have deterministic per-series hashes,
row counts and coverage periods, explicit curated-history vintage meaning,
derivation dependencies where applicable and links to existing frozen studies.
Original publication dates remain null: curated retention is not original-vintage
evidence. No coefficients changed, EV failures and storage sensitivity retained.
The audit now identifies the narrower remaining publication-availability gap,
not three undifferentiated null fields. Licence and causal-calibration gaps persist.

## Stage 12 dependency

companyProjectionAsOf.ts adds a fail-closed input-evidence wrapper around the
existing operating ledger. Every input leaf, including currency/geography and
member assumptions, needs an exact hash, source archive reference and availability
timestamp no later than the cutoff. Missing, duplicate, conflicting and future
evidence are refused. Evidence order is normalized.
This does not resolve or independently review the supplied source IDs.
Actual Stage 14 cannot use it as a proxy: reviewed operating-geography exposure,
source-compatible regional activity/intensity paths, margin/pass-through evidence,
complete paired member assumptions and eligible historical inputs are still absent.

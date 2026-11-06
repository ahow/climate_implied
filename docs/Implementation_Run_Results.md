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

# Immutable regional historical replay

## Implementation

The existing regional legacy calculator now has a pure input boundary,
`calculateRegionalFromInputs`. Missing, invalid or non-positive captured
intensities fail rather than falling through to a live fetch.

`capture-regional-snapshot.ts` is a development-only operator capture using the
existing immutable header/chunk tables and guards. No new schema, production
DDL, approval or scheduler operation is performed. Captures retain resolved
OWID PPP or explicitly tagged nominal static assumptions; these are not original
publication vintages and do not reconstruct the source observation year.

`/api/projection/regions` accepts `regionalSnapshotId` only together with
`indicatorSnapshotId`. Historical requests bypass live fetching and the current
route cache. The endpoint confirms the regional identity in
`X-Regional-Snapshot`; incomplete/malformed pairs or unavailable archives fail.
These remain global intensity counterfactuals, not regional temperatures.

The application selector offers an optional regional archive alongside the
existing workbook/indicator pair, verifies it before changing selection, and
reloads the cache. Exports carry its ID. Omitting the optional archive leaves
historical regional diagnostics unavailable, not current.

## Scope boundaries

This completes a previously missing historical external-input path; it does
not complete financial/carbon/SDG overlays, all result archival, source-vintage
evidence, calibrated regional forecasts or scientific acceptance.
Production remains dependent on supported managed archive provisioning.

## Actual baseline execution

Two fresh processes calculated the endpoint engines against the retained
workbook and captured external inputs. All four regional observations came
from OWID, with no static fallback. Outputs were identical:
4 regional cases, 187 valuation groups, 193 SDG rows, 187 tercile rows.
Input hash: d27410bcee9e6fb0cd65c30d54e11aadf2ace15ccf8e219d0596880a398dc495.
Output hash: 0f872b95f3b28d3527f313fd3b8d58ff40f5ba46c4201b7a81b50305576ea89d.
The first attempt failed because large stdout was truncated at process exit;
workers now await private result-file writes. Both attempts are retained in
the workplan ledger. This is actual-input reproducibility, not efficacy.

# Historical selection, inventory and stored-result replay

## Implemented

- Explicit empty, malformed, repeated or non-string snapshot identifiers fail
  rather than silently selecting current data. An omitted identifier still
  means current inputs where supported.
- Stored-result replay no longer loads current approved indicators. Replay
  retrieves and verifies the archived result and its original manifest; it
  does not recalculate using today's inputs.
- Supplying workbook or indicator overrides to stored-result replay is rejected.
  Replay responses explicitly state that current indicators were not read.
- Snapshot inventory supports a validated kind filter and bounded keyset
  pagination: 100 items, with `nextCursor` when another page exists. Ordering is
  by content ID, not date; the cursor is the last returned content ID.
- The Data Management inventory requests workbook snapshots before the server
  limit is applied and offers “Load more workbook snapshots.” Archived results
  can no longer displace workbook choices merely by being more numerous.

Pagination is traversal of an append-only inventory, not a frozen database
transaction. A concurrently inserted ID below the current cursor will appear
on a fresh traversal, not necessarily during the traversal already underway.
Existing IDs do not shift between pages as they can with offset pagination.

## Boundaries

These are read-path and interface repairs for stages 2 and 16, not completion
of global historical mode. The workbook selector still affects only its
labelled summary preview. It does not switch every dashboard page.

Stored-output replay is not independent recalculation. Immutable inputs do
not establish original publication vintages. These changes do not provision
production snapshot tables, alter the approval process, approve identities,
promote a climate model or certify investment evidence.

The remaining stages and dependencies are tracked in
[the outstanding-work register](Valuation_and_Research_Completion_Status.md).

## Verification

176 TypeScript tests, 32 Python tests, type checking and production build passed.
All 18 available stage check groups passed; overall implementation acceptance
remains incomplete.

Development HTTP checks returned 422 for empty workbook/indicator identities,
invalid inventory kinds/cursors and attempts to override a stored replay.
Workbook and result inventories returned 200. An existing archived result
returned 200 with its manifest and the explicit
`not-read-stored-output-replay` indicator-state header.
The current development inventory has one workbook and five results; actual
multi-page database traversal is not established by those small populations.
The Data Management page rendered without browser errors.

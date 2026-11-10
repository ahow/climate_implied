# Development overlay replay — partial completion

Added ordered, content-addressed financial/carbon/SDG overlay contracts and
immutable archive persistence using existing guarded tables; no DDL.
Native fields retain explicit nulls and observed zero. Units, kind, duplicate
cells, orphan companies, missing baseline dates and information cutoff are
validated. Every record requires source and review evidence; the archive helper
is not an approval operation and is not exposed as a public mutation.

Company requests accept overlaySnapshotIds (comma-separated ordered IDs) and
asOf with an immutable snapshotId. Missing or corrupt archives fail closed;
the manifest includes ordered overlay hashes. Supported company calculations
apply the overlays in request-local context. Existing result recording stores
the returned JSON and manifest. Current calculation code is still required
for recalculation; stored-output retrieval does not prove recalculation.

The existing input selector now supports ordered IDs/cutoff, verifies response
identity before changing selection, and exports carry the same identities.
No current financial proposal, identity or fiscal-date rule is auto-approved.
SDG remains revised-history static metadata, never a point-in-time strategy.

Actual retained development baseline: 2,442 companies / 470,341 observations.
Three private synthetic overlays were applied in two fresh processes with exact
result hash 46cc9662b8d7233137d2cbefdf30ea3b578c6fb064a09ff91a5966b926128b3a.
Baseline hash remained unchanged; cutoff and corrupt-hash negatives passed.
No synthetic records were persisted into immutable database tables.

Remaining: real reviewed overlay capture wired into all existing approval
transactions; real refresh/rejection/concurrent-write application journeys;
complete all-material-input manifest coverage and archived executable replay.
The file fixture does NOT establish these criteria. Production provisioning
remains separate. This is not full Stage 2 acceptance.

# Isolated analytical-data recovery protocol

Frozen before execution on 2026-11-09.

## Scope

Development-only logical export of cv_companies, cv_time_series and
indicator_values. This includes the workbook company/SDG/target fields,
carbon and financial observations, and approved/pending driver records.
No users, passwords, connection strings or provider credentials are exported.
Licensed rows remain under ignored generated-artifacts storage.

This is NOT a production backup, full database disaster recovery, or independent
reproduction of the complete scientific model. Those requirements remain open.

## Acceptance

1. Capture all three tables in one repeatable-read, read-only transaction.
2. Record exact row counts and SHA-256 of ordered JSON records.
3. Restore in a separate process from retained files, not source-table SELECTs.
4. Restore only to transaction-local temporary tables. Never overwrite public.
5. Restored ordered record hashes and counts must equal captured values exactly.
6. Reject an altered file before importing its contents.
7. Roll back temporary restoration and close the connection.

The source schema supplies column definitions only. Consequently this tests
analytical-data restoration under the current schema, not recovery from schema
loss. A future full recovery test must include separately verified schema backup.

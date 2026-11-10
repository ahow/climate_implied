# Prospective capture infrastructure

New `server/calculation/prospectiveSignal.ts` validates paired-company definitions,
origin and full expected universe, freezes the input digest and preserves
unavailable scores. Execution must be later than the database capture clock and
outcomes later than execution. Input order does not change request identity.
No signal can be promoted to scientific or owner-approved status by this module.

`server/snapshots/prospectiveSignal.ts` uses the existing immutable snapshot
tables inside an advisory-locked transaction, with no DDL. Database time is not
accepted from CLI input. Duplicate identical requests return the original
timestamp/id, including after execution; conflicting requests for the same
protocol/universe/origin cannot replace history. `script/capture-prospective-signal.ts`
is operator CLI only; no public HTTP mutation route was introduced.

`script/check-prospective-signal-db.ts` executed real DEVELOPMENT helpers in a
rollback-only transaction: first capture, repeat, conflict, past execution
rejection and complete rollback passed on2026-11-10T05:27:31Z.
Log generated-artifacts/workplan-completion/20261110T052731877325Z.log.
Synthetic identities are engineering tests, not real prospective monthly signals.
Final changed-code285TS tests/typecheck/build passed05:29:21Z.

Remaining: protocol/universe identities are caller-submitted hashes, not original
source authenticity proof. Genuine reviewed projections/universe/current signals
must be resolved against their immutable archives before research acceptance.
This infrastructure does not mark Stage14 prospective-month acceptance complete,
does not change collectors/cadence and does not create a monitoring service.

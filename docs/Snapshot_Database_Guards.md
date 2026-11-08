# Snapshot database guard specification

The declarative tables are in `shared/schema.ts`. The additional guards below
were installed and tested in **development only** using the database tooling.
These are a specification for the managed schema rollout, not an instruction to
run a production migration from the application or a Railway startup command.

The application refuses snapshot writes unless all five named guards are
enabled. Snapshot status also requires those guards. Table creation alone is
insufficient. A production schema publish and guard deployment must be verified
separately before production capture can be enabled.

```sql
CREATE FUNCTION cv_snapshot_reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Immutable analysis snapshot';
END $$;

CREATE FUNCTION cv_snapshot_guard_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cv_analysis_snapshots
    WHERE id = NEW.snapshot_id AND inserted_tx = txid_current()::text
  ) THEN
    RAISE EXCEPTION 'Snapshot is already sealed';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER cv_snapshot_header_immutable
BEFORE UPDATE OR DELETE ON cv_analysis_snapshots
FOR EACH ROW EXECUTE FUNCTION cv_snapshot_reject_mutation();
CREATE TRIGGER cv_snapshot_chunk_immutable
BEFORE UPDATE OR DELETE ON cv_analysis_chunks
FOR EACH ROW EXECUTE FUNCTION cv_snapshot_reject_mutation();
CREATE TRIGGER cv_snapshot_header_truncate
BEFORE TRUNCATE ON cv_analysis_snapshots
FOR EACH STATEMENT EXECUTE FUNCTION cv_snapshot_reject_mutation();
CREATE TRIGGER cv_snapshot_chunk_truncate
BEFORE TRUNCATE ON cv_analysis_chunks
FOR EACH STATEMENT EXECUTE FUNCTION cv_snapshot_reject_mutation();
CREATE TRIGGER cv_snapshot_chunk_insert
BEFORE INSERT ON cv_analysis_chunks
FOR EACH ROW EXECUTE FUNCTION cv_snapshot_guard_insert();
```

Metadata and every chunk are inserted in the same transaction; later inserts
cannot extend a sealed dataset. A privileged database owner can still disable
or drop triggers: these controls are application/data-integrity safeguards, not
a security boundary against the database owner. Read-time hashes independently
detect corrupted or incomplete content. Existing original tables are not
deleted or made immutable by these guards.

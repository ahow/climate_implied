# Privileged operation boundary — 2026-11-10

This is an execution/update record for S00-004/005/010, not a claim that static
discovery establishes every reachable mutation.

## Executed read-only host checks

`python script/capture-scheduler-host-evidence.py` retained the original startup
lines and source-file hashes in
`generated-artifacts/scheduler-host-evidence/combined.json`.

- Replit production: `[scheduler] Started (monthly cadence, 6h checks)`,
  including2026-11-10T11:10:54.594Z.
- Railway production: deployment e0278526-15fb-476f-a1a5-045e861b6d2e,
  `[scheduler] Disabled for this instance`,2026-11-10T11:25:11.181744758Z.
- Replit development: existing workflow startup logs show disabled.

Exactly one of these known environments is enabled. This does not mean one
autoscale replica; advisory locking serializes collection across replicas.
No restart, token/variable read, cadence or flag modification was performed.
Unknown external hosts and uninterrupted configuration between receipts are not
proven by these observations.

## Concrete discovery and remediation

`script/privileged-operation-inventory.ts` traverses actual server/script ASTs:
database/query/SQL, network/provider, cache mutation, timer and CLI candidates.
The generated `docs/privileged_operation_census.json` pins source hashes and call
sites without copying URL strings, credentials or source bodies. Initial census:
220files/320candidate call sites. Counts can change with integrated code.
It is deliberately a candidate census: Python/shell/dynamic indirection and
complete caller authorization remain separate review work.

Actual newly found public-cost gap:
`GET /api/news/climate` previously called NewsAPI and wrote the cache on misses.
It now reads cached results only; a missing/expired selected window returns503
`operator-news-refresh-required`. UI distinguishes this from a missing API key.
An authorized workspace operator can explicitly run
`npx tsx script/operator-news.ts refresh <months1-24>`.
No refresh/provider call was executed during this change.
Memory cache identity now includes the selected month window; future-dated and
expired cache entries do not qualify. Existing six-hour TTL is unchanged.

Other inspected boundaries:
- Financial FMP/OpenFIGI requests remain in their fixed-host/endpoint adapter.
  Public financial-status GET returns state without triggering calls. Existing
  trusted startup connectivity check makes three bounded FMP requests/process;
  a cross-instance provider budget is not established. No startup change made.
- Existing indicator/financial/overlay decision and workbook capture CLIs retain
  workspace/database authorization; no browser secret, HTTP identity or localhost
  bypass was introduced.
- Public mutating routes remain403 except bounded diagnostic POSTs. Static
  candidates for GET-side derived cache persistence are not silently labelled
  owner-approved source mutations.

## Actual tests and residual scope

2026-11-10T11:59:01.231079Z:
`npx tsx --test script/news-provider-boundary.test.ts script/privileged-operation-census.test.ts`
passed4/4,0fail/0skip. Log:
`generated-artifacts/workplan-completion/20261110T115901231079Z.log`.
Tests cover new-call discovery, no URL/value export, selected-key/TTL/future-time
cache refusal, and provider access placement before network calls.

S00-004 remains partial pending exhaustive authorization/caller review and
supported actual privileged lifecycle executions. No inaccessible operation is
reclassified as safe merely because public denial tests pass.

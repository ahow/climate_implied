# Additional company-history acquisition and outcome audit

Executed 2026-11-09 under `Company_Coverage_Expansion_Protocol.md`, committed
before provider acquisition. This is source acquisition and outcome availability,
not a D8 valuation comparison or evidence of predictive usefulness.

## Delivered

The operator collector now accepts a bounded private selection manifest (maximum
eight unique issuers), validates identifiers, and requires explicit active,
non-ADR USD provider profiles matching the expected workbook ISIN and symbol.
Missing listing/ADR status now fails rather than being treated as valid.
No identity was approved and no application company data was overwritten.

All eight additional cases passed provider/workbook candidate checks and were
retained privately with ten annual income, cash-flow and balance-sheet histories
and 193 workbook observations each. Including the three earlier cases, the
audit covers eleven candidates and 110 annual cash-flow observations.

| Candidate | Completed three-year outcomes | Unavailable |
|---|---:|---:|
| AAPL | 0 | 10 |
| CAT | 7 | 3 |
| CVX | 6 | 4 |
| HD | 2 | 8 |
| JNJ | 1 | 9 |
| MCD | 7 | 3 |
| MSFT | 7 | 3 |
| NEE | 7 | 3 |
| PEP | 5 | 5 |
| PG | 7 | 3 |
| UNP | 7 | 3 |
| **Total** | **56** | **54** |

The exact-fiscal-date endpoint rule and positive-FCFE requirement were not
relaxed. Calendar drift in fiscal endpoints can exclude observations; this is
reported rather than silently changing the frozen protocol. Missing future
endpoints and nonpositive FCFE remain unavailable.

## Code correction

The audit previously hard-coded “only three” companies even when more files were
supplied. It now derives coverage from actual inputs and rejects multiple
retained versions of an issuer instead of allowing them to inflate coverage.
Fiscal-end-year counts are explicitly NOT common valuation origins.

There are 7 candidate issuers with completed outcomes in 2016, 8 in each of
2017–2021, 7 in 2022, and 2 in 2023. This does not establish the required ten
common eligible issuers over six consecutive valuation origins. Actual paired
predictions, projection signals, currency/classification review and independent
identity approvals remain incomplete. No model winner or D8 acceptance declared.

## Evidence

Commands, timestamps and logs are in `workplan_completion_ledger.json`:

- `npx tsx script/collect-company-worked-inputs.ts --manifest generated-artifacts/company-expansion-plan.json`
- `npx tsx script/audit-completed-cash-flow.ts generated-artifacts/company-worked-inputs/*.json`

Source files remain under ignored `generated-artifacts/company-worked-inputs/`.
Outcome artifacts remain under `generated-artifacts/valuation-comparison/`.
The prior three-company evidence and rejected Exxon match remain unchanged.

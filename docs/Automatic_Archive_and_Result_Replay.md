# Automatic approval archives and completed-result replay

## Scope and results

This increment implements parts of workplan stages 1, 2 and 16. It does **not**
complete the full workplan or promote a climate/valuation model.

| Change | Verification | Result |
|---|---|---|
| Archive the complete approved indicator set inside proposal/manual approval transactions | Actual development database: concurrent transactions, exact archived content, double-approval rejection | Passed |
| Roll back approvals if provisioned archive validation fails | Invalid source metadata deliberately fails inside a transaction; no input/archive fixture survives | Passed |
| Store completed company-analysis JSON responses with their manifests | Actual HTTP summary of 2,442 companies, followed by stored-result retrieval and deep comparison | Passed; exact match |
| Reject altered result or manifest content | Hash/contract regression tests, including NaN and changed result fields | Passed |
| Correct legacy positive-threshold labels | Regression test against gauge, chart and toggle | Passed |
| Existing application regressions | 132 TypeScript tests; 22 Python tests; TypeScript check; production build | Passed |

## Approval archival

Both proposal approval and manual approved-entry creation acquire a common
transaction-scoped advisory lock **before** touching approval rows. This is
deliberately wider than a cell lock: changes to different indicators must still
produce successive, coherent complete approved sets.

Under PostgreSQL READ COMMITTED, the next lock holder reads the previous
holder's committed set. The approval, superseding of the previous value, archive
header and payload share one transaction. Duplicate content is idempotent.
Archive errors are not swallowed when immutable storage is provisioned.

An installation lacking the snapshot tables/guards keeps the existing approval
process and emits an explicit archive-unavailable warning. This preserves the
approved data-update process without claiming historical reproducibility.
It is not a substitute for production provisioning.

The development verification script rolls back **all** fixtures, including
their append-only archives. It must never be run against production.

## Completed outputs

For provisioned workbook-snapshot analyses, the following successful JSON
responses are now archived before they are returned:

- `/api/cv/summary`
- `/api/cv/carbon-price`
- `/api/cv/pe-comparison`
- `/api/cv/sdg-growth`
- `/api/cv/decarb-bands`
- `/api/cv/decarb-terciles`
- `/api/cv/decarb-gap/summary`
- `/api/cv/decarb-gap/timeseries`
- `/api/cv/backtest`

`X-Analysis-Result` contains the content-addressed result ID.
`X-Analysis-Result-State: archived-completed-response` confirms persistence.
`GET /api/analysis/results/:id` returns the stored JSON, manifest and recording
timestamp. Repeated identical output/analytical input combinations share one
archive identity; request timestamps do not create duplicates.

The payload includes the exact JSON representation returned by Express:
dates are strings, omitted optional properties stay omitted. Its identity covers
the analytical manifest and response. Retrieval verifies content hashes and
chunk/header integrity. Failed analyses are not represented as completed results.
If recording a successful analysis fails, the API returns 503 rather than
claiming a retrievable archive.

This is **stored-output retrieval**, not independent recalculation, an original
publication-vintage reconstruction, or a guarantee that every historical
financial/carbon/SDG overlay has been captured. The historical summary selector
still affects only that preview, not the entire application.

## Legacy milestone terminology

The legacy model's existing numerical milestone is unchanged, but the gauge,
toggle and trajectory line now call it a **legacy 5 GtCO₂e milestone**, explicitly
not net zero. Missing values say “Not reached,” not “Never.” The standalone
5% reduction-rate scale no longer claims 1.5°C alignment.

The legacy API field `netZeroYear` remains a compatibility field; its name is
not a scientifically valid definition. New member metrics separately calculate
durable zero CO₂, zero GHG and the 5%-of-own-2024 near-zero milestone. They are
not silently substituted into the legacy display.

## Remaining work

- Provision immutable snapshot tables/guards in the managed production
  database through its supported workflow; a Railway code deploy does not do this.
- Capture all financial/carbon/SDG overlays and support full historical
  recalculation, not only result retrieval.
- Complete the exhaustive output/export register and migrate remaining legacy
  consumers only when the replacement model passes its evidence gates.
- The regional ensemble, independent climate validation, empirical company
  model selection and new-gap signal/portfolio studies remain unfinished.

See [the complete stage matrix](Workplan_Status_and_Conclusions.md) rather than
treating these successful engineering checks as acceptance of all 18 stages.

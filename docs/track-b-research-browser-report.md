# Track B Research bounded browser report

## Scope and safety boundary

Tested `/methodology` in the running application. The real application catalog was
read-only and remained empty. Positive UI interaction checks used page-local
browser request interception with explicitly synthetic test data; no source
catalog, database, report files, workflow settings, auth, or public endpoint was
modified. The intercepted UI branch is engineering coverage only, not evidence
of an actual public disclosure, operator approval, historical efficacy, or a
valid production XLSX.

No unchanged component/route census or full suite was rerun. No application code
was edited by this test.

## Observed branches

| Branch | Result |
| --- | --- |
| Genuine empty catalog on `/methodology` | **PASS** — Track B stated “No authorized public Track B reports have been published,” displayed the operator prerequisite, and had 0 report links and 0 selectors. |
| Live catalog HTTP request | **PASS** — `GET /api/research/track-b-admission/catalog` returned 200 with `reports: []`. |
| Unknown exact protocol | **PASS** — unknown 64-character protocol returned 404: `No source-authorized public disclosure for this exact protocol`. |
| Synthetic exact-protocol selection | **PASS (isolated UI engineering only)** — selected protocol/report/disclosure pin loaded with matching canonical report and period-domain SHA-256 values; the UI rendered the pinned report’s values. |
| Absent frozen period | **PASS (synthetic fixture)** — period showed `unavailable`; execution, holding end, manifest, and result were null; `synthetic-frozen-period-absent` and its period-wide reason were visible. |
| JSON download identity | **PASS (synthetic fixture)** — HTTP 200; filename was `track-b-fafed466ca5e58989708b6c63f4e26f11419c6c86653df5cfeacc0c7bb56291e.json`; report and period-domain response headers matched the selected pin; downloaded report protocol matched the selection. |
| XLSX download identity | **PASS (synthetic fixture, identity only)** — HTTP 200, OpenXML MIME, filename `track-b-fafed466ca5e58989708b6c63f4e26f11419c6c86653df5cfeacc0c7bb56291e.xlsx`, and report/domain headers matched the selected pin. The intercepted body was the explicit `SYNTHETIC-XLSX-IDENTITY-TEST-ONLY` placeholder; workbook validity was **not** tested. |
| Switching while report is loading | **PASS (synthetic fixture)** — selected a second exact protocol with its report response held. The UI showed “Loading selected retained report… Previous results/downloads withheld”; there were 0 links and no old period or old report hash. |
| Switching to report error | **PASS (synthetic fixture)** — released the second response as HTTP 503. UI showed `Selected report unavailable: Synthetic intercepted report error`; there were 0 links and no stale period/report hash. |
| Public catalog after intercepted tests | **PASS** — rechecked the real HTTP catalog: 200 with 0 reports; unknown protocol remained 404. The original, non-intercepted page still had 0 links and 0 selectors. |

## Console and limitations

The only browser console error observed was the expected resource-load error for
the deliberately intercepted HTTP 503 in the synthetic error branch. No other
application console error was observed. The two setup attempts rejected by the
Playwright parser and the initial nonmatching glob did not modify application
state; the successful page-local regex interception was confirmed by its HTTP
response and rendered selector.

Existing CLI/stored/HTTP/XLSX automated backend-chain tests were documented in
`docs/s15-017-trusted-public-disclosure-evidence.json`; they were not rerun here.
This browser run does not independently verify a real public report, production
retained bytes, or a parseable XLSX.

## Source SHA-256

Hashes recorded during this run:

```text
658904696a8b8966f4d113a8115c34829af209db9420273045b216a9fab27801  client/src/components/track-b-research.tsx
e555a1c765e5ed10620675ec36b06348d66123d22452fc6fcee8d2b8aab8476c  client/src/lib/trackBPublicReports.ts
1c24d252f4f12e482d7d0ebe25bba1072ad45086bbb004afb68328a9479e76ee  server/trackBAdmissionApi.ts
61209de4c025394a5c2b585a4891e11cf1c3c624580d65810e0f7c64e5b26f3c  server/trackBPublicCatalog.ts
0f6dfd317ec5878f56afe7cb46615b139a2f23f1cef9b7f438cdff33607e53ca  shared/trackBAdmissionContract.ts
78535b22a7b593488a7a5db14509994b7d9e20abc6f57c6f19d36c94c8ca843b  shared/trackBDisclosureContract.ts
```

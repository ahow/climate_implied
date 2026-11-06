# Remaining workstreams: implementation and measured results

Run date: 6 November 2026.

This is a new five-workstream pass after the earlier ten-step implementation.
It is **not a declaration that all acceptance criteria have been satisfied**.
Engineering changes were implemented and tested in sequence; outstanding
data coverage, scientific validation and certification are listed below.
No revised scientific model was promoted into the headline calculation.

## 1. Company matching and financial updates

### Changes

- Added ISO 6166 check-digit validation to reviewed identities.
- Extended the mapping audit from a non-resumable ten-company pilot to a
  checkpointed, resumable operator process. Results are saved atomically after
  every company. Removed/changed inputs are discarded, provider errors are
  retried on a subsequent run, and three consecutive errors stop a batch.
- The eligibility denominator remains the original 2,442 structurally valid
  identifiers; checksum failures cannot shrink the denominator to improve coverage.
- Added `financial-review.ts refresh-approved`. It rechecks approved identities,
  obtains current financial snapshots and stages them for review. It does not
  approve automatically or add/change a scheduler.
- Independently reviewed Bayer's issuer/listing using its investor information,
  with FMP and OpenFIGI agreement on the security. Its approximately EUR53bn
  capitalization agrees with the issuer's quoted capitalization. Approved one
  actual snapshot, then exercised the refresh path.

### Tests and measured results

- Twelve focused identity/mapping/review/checksum tests passed.
- Expanded live audit: **200 of 2,442 companies examined**; 28 single candidates,
  50 ambiguous, 122 unmatched. These categories do not constitute approvals.
- Approved identity coverage: **1 / 2,442 = 0.04095%**, not 95%.
- Approval of the same real snapshot twice was idempotent.
- Refresh: **1 attempted, 0 errors**, new snapshot staged pending review.
- These real snapshot writes were made in the **development database**.
  A direct production request returned zero financial-review records. Source
  deployment does not copy development database rows. Production operation
  requires running the authorized review commands with production database
  access; no public write endpoint or source-embedded data migration was added.
- Bayer's negative annual net income correctly yields an unavailable earnings
  ratio rather than a misleading positive P/E.
- The provider's reported filing date is retained as provider data, not accepted
  as independent historical availability evidence.
- Existing workbook and carbon records were not overwritten.

### Outstanding

The remaining 2,242 companies were not queried in this bounded live batch.
Most identities, primary-listing choices and issuer relationships still need
review. The 95% coverage gate failed. There is no portfolio-wide FMP replacement:
current snapshots remain a separate reviewed financial calculation, not an
overwrite of historical workbook analysis. Non-ISO quote currencies such as
GBp require explicitly verified price/capitalization unit handling before use.

## 2. Native-gas pathways

### Changes

Added executable missing-gas stress tests: zero after 2024, constant 2024
emissions, and linear decline to zero in 2050. Every case preserves the 2024
anchor. Outputs retain native gas units; no CO2e sum or temperature shortcut
is manufactured. These are diagnostic assumptions, not published pathways,
statistical confidence bounds or approved infilling.

### Tests and measured results

- Eight Python pathway/sensitivity tests and three TypeScript native-contract
  tests passed.
- Re-ran both available NGFS Phase V 5.1 infilled cases: Current Policies and
  Nationally Determined Contributions.
- Each represents **23 series**, missing HFC-134, HFC-143, HFC-245fa and HFC-41.
- Constant-emissions cumulative 2025–2100 stress cases, Mt of each gas:
  HFC-134 0.00315815; HFC-143 0.0000312447; HFC-245fa 1.27847237;
  HFC-41 0.00112621. Species totals are not added as climate equivalents.
- Initial NDC command used an abbreviated label; corrected to the exact source
  scenario name and reran successfully.

### Outstanding

Neither scenario passes full gas coverage. NDCs cannot be renamed “all announced
commitments.” Source research did not establish an immediately compatible
replacement with complete species and the required commitments scope.
Stress sensitivities quantify the gap but do not resolve it.

## 3. FaIR validation

### Changes

- Added historical-window validation: full year coverage, common 1850–1900
  baseline, explicit total versus anthropogenic attribution and bounded windows.
- Average each ensemble member through the historical window before computing
  the ensemble median. Do not average annual ensemble medians.
- Added `/api/calculation/validate-history` and an operator runner that records
  historical diagnostics and previous-run reproducibility separately.
- Preserved all existing scientific promotion gates.

### Tests and measured results

- Eight historical/ensemble/holdout tests passed.
- Re-executed the pinned 841-member FaIR reference.
- Maximum annual difference from the previous local reference: **0°C**, passing
  the 0.01°C reproducibility tolerance. This is **not an independent reference**.
- Historical total warming, 2011–2020: median **1.095270°C**. IPCC AR6 WGI SPM
  A.1.2 gives observed warming of 1.09°C, range **0.95–1.20°C**, relative to
  1850–1900. **80.62%** of the reference ensemble's member-window means lie
  inside that range.
- Source: https://www.ipcc.ch/report/ar6/wg1/chapter/summary-for-policymakers/
- Malformed historical evidence returns HTTP422.

### Outstanding

The reference ensemble was calibrated using historical evidence: this range
check is not out-of-sample validation. Independent numerical reproduction,
updated forcing reconciliation, anthropogenic-only validation, eligible
holdouts, consumer migration and production execution remain unresolved.
The running headline stays on the existing model.

## 4. Empirical signal research

### Changes

- Added circular moving date-block bootstrap. Companies on the same sampled
  date remain together; consecutive date blocks preserve short temporal
  dependence. Too few independent dates fail explicitly.
- Added a revised-history mode that permits missing publication timestamps
  without inventing dates, but cannot produce a validated positive decision.
- Added a read-only research runner over existing workbook observations.
- Report the primary three-date block plus 1/6/12-date sensitivities and sector
  results; do not select a better-looking result after evaluation.

### Tests and measured results

- Four signal/block-bootstrap tests passed: deterministic results, training
  isolation, future-publication rejection and insufficient-date rejection.
- Actual data: **6,919 observations** from the first 40 workbook company IDs;
  **4,440 training**, **2,479 holdout**, **66 holdout dates**.
- Target: next-observation total return. Controls: log market capitalization
  and earnings yield. Signal: negative log(1 + Scope1+2 / market capitalization).
  Complete records only, no carry-forward, split at 2020.
- Baseline MSE **0.01045965**, candidate MSE **0.01045747**.
- Relative MSE improvement **0.0209167%**, below the specified **5%** threshold.
- Paired loss improvement interval **[-0.000001815, 0.000006116]** includes zero.
- Decision: **exploratory-no-improvement**. A negative finding is a valid
  research result, not a reason to change the specification until it passes.

### Outstanding

This is a bounded, retrospective and non-representative pilot, not a
preregistered investment claim. Publication vintages, historical universe
membership and independent currency/unit reconciliation are missing.
Full-universe, outlier and broader time-stability research remain to be done.

## 5. Backtest evidence and accounting

### Changes

- Added a vintage-evidence validator and `/api/calculation/audit-vintages`:
  missing/future publication or universe dates, duplicate observations,
  missing returns, invalid horizons and corporate-action/delisting evidence.
- Even complete declarations do not automatically become certified evidence.
- Added whole-dataset read-only auditing.
- Reject duplicate company holdings before they can corrupt weight drift.
- Added explicit cost-monotonicity and terminal-insolvency regressions.

### Tests and measured results

- Twelve vintage/accounting/walk-forward tests passed.
- Zero-cost/gross equality, independently calculated costs, drift, rising costs,
  duplicate holdings and terminal total loss all passed.
- Full database audit: **470,341 observations**, **2,437 companies with time
  series**, 22 January 2010–22 January 2026.
- **57,156** missing/non-positive return-index values; **56,772**
  missing/non-positive market-cap values; **0** inter-observation gaps over
  40 days; **2,437** terminal observations.
- Terminal observations are not proof of delistings.
- Publication dates, historical universe evidence and corporate-action/
  delisting verification are absent from the current stored source schema.
- API correctly labels incomplete supplied evidence
  `revised-history-not-point-in-time`, with `certified: false`.

### Outstanding

Point-in-time certification remains blocked by historical evidence, not by a
passing accounting test. Survivor/delisting treatment and corporate-action
handling require source reconciliation. Do not relabel revised workbook
history as investable performance.

## Combined verification and operational limits

- **87 TypeScript tests, 16 Python tests passed.**
- TypeScript checking and production build passed. After the final CLI refactor
  and bounded historical-window check, 14 affected tests and type checking
  passed again.
- Workflow restarted successfully; health and new diagnostic routes checked.
- No new recurring jobs, no changed approval cadence, no raw workbook exports.
- GitHub receives source/documentation only. Detailed provider responses,
  research rows and generated ensembles remain under ignored
  `generated-artifacts/`.
- Source export/production verification are recorded in the accompanying
  delivery message; a passing local build alone is not proof of a live release.

## Reproduction commands

```sh
npx tsx script/audit-financial-mappings.ts 50
npx tsx script/financial-coverage.ts
npx tsx script/financial-review.ts refresh-approved
uv run python script/ngfs_pathway_adapter.py --stage infilled
uv run python script/pathway_gap_sensitivity.py generated-artifacts/ngfs/native-baseline-audit-REMIND-MAgPIE-3-3-4-8-current-policies-infilled.json
uv run python script/fair-reference.py
npx tsx script/validate-fair-history.ts
npx tsx script/research-existing-data.ts
npx tsx script/audit-existing-vintages.ts
npx tsx --test script/*.test.ts
uv run python -m unittest discover -s script -p 'test_*.py'
npm run check
npm run build
```

The matching command resumes candidates, not approvals. Refresh stages proposals,
not approvals. Generated research files are not deployment inputs or live
headline replacements.

# Paired Stage 14/15 orchestration — engineering receipt

## Bounded accounting extension (supersedes remaining-engineering statements below)

Historical efficacy remains **WITHHELD**. No historical positive family result,
investability, independent review, approval, release or production mutation is
asserted. Existing report sections below describe the preceding implementation.

### Implemented clauses and boundaries

* **S14-004/010, S15-002:** `pairedResearchSleeves.ts` adds an explicitly frozen
  origin/deployment/maturity/capital schedule for overlapping exact 12-month
  cohorts. Unallocated capital is held separately; all live cohorts require
  simultaneous marks. Settlement releases cash once, including same-boundary
  redeployment. Cash, restricted cash, signed issuer values, gross/net exposure
  and aggregate NAV/return are reconciled without adding sleeve NAV twice.
  Insufficient deployment capital, missing marks and unsettled maturity fail.
  This is a marked capital ledger, **not** interpolated monthly performance
  from annual endpoints. Primary 12-month spread-factor inference still rejects
  overlapping endpoint rows: it needs a reviewed monthly sleeve-return/factor
  mapping and a frozen choice of that estimand. No inference silently changes.
* **S15-001/003/011/014/015:** a separate constrained-long-only overlay consumes
  the unchanged kernel's past-only tilt (12-row warm-up, 2% target, cap 5).
  Frozen variants support sector-neutral totals, maximum active weights,
  explicit trailing-liquidity participation limits and monthly/quarterly
  rebalancing. Eligibility/liquidity must be provided at origin. Quarterly
  off-months retain drifted positions; costs use actual weight changes. The
  overlay intersects feasible constraints along the benchmark-to-tilt line,
  rather than claiming a general optimizer; infeasible cases are unavailable.
  No arbitrary liquidity, cost or eligibility value is supplied. Constraints
  are enforced at rebalances, not asserted continuously between rebalances.
* **S15-008/013 and amendment 13:** `pairedResearchEvents.ts` implements ordered
  split, payment-date-FX dividend (including short liability), cash/stock merger,
  cash delisting, collateral transfer/release, explicit borrow fee, financing
  expense and cash-interest events. Coverage receipts and retained source hashes
  are required; missing successor marks, borrow coverage, financing for negative
  cash, and invalid collateral releases fail closed. Missing observed borrow
  requires an explicit hypothetical fee; forbidden borrow fails. Event books
  are separate from the legacy period-end aggregate convention, preventing
  automatic double application of dividend/split events.
* **S14-005/016/025 and S15-006:** original-corpus assembly selects only supplied
  retained candidates with exact original archives and origin-bound covariate
  payloads. Unknown/non-original vintage, future availability/capture, missing
  payload binding and incompatible pairs reject with origin-specific reasons.
  Supplemental historical event books and sleeve marks must bind their values
  to retained payloads. Family results now remain unavailable for **all**
  unauthenticated corpora, not only fixtures; computed diagnostics remain
  visible. Full frozen family cardinality and deterministic paired block
  uncertainty are unchanged.

### New checks and verification status

Added `script/paired-research-accounting.test.ts`: two overlapping cohorts
  hand-reconcile NAV 120 → 121 → 123 → 124 and reserve/issuer exposures;
  missing marks and overdeployment reject; concurrent/repeated requests are
  isolated; split/dividend/merger/short/collateral/expenses reconcile cash 75,
  collateral 20 and NAV 110; cash delisting gives NAV 98; missing marks,
  borrow and financing reject; unknown borrow stays hypothetical; sector/active
  constraints and quarterly holds are checked; no original candidates become
  invented evidence. Existing pipeline tests gain repeated/concurrent full
  family/uncertainty checks and missing eligibility/liquidity checks.

`npx tsc --noEmit --incremental false` passed after correcting target-level
iteration errors. After the owning agent's full-suite check identified two
failures, the bounded follow-up fixed the numerical test assertion (absolute
tolerance 1e-12, without rounding model weights) and cutoff semantics.
`npx tsx --test script/paired-research-accounting.test.ts script/paired-research-pipeline.test.ts`
then passed **23/23 tests**; TypeScript passed again. No full-suite rerun is
claimed by this bounded follow-up.
No app/UI work or screenshot was needed.

The corrected cutoff invariant applies availability/capture limits to every
artifact actually used by a **complete** date, and to supplemental sleeve/event
records. Future archives belonging only to incomplete periods do not invalidate
earlier dates; those periods remain unavailable and cannot enter estimation.
Hash/vintage checks and origin-relative future-input restrictions still apply
to all periods, including incomplete ones. New tests exercise both sides.

Every cohort's deployment mark must now equal its declared capital in cash,
restricted cash and signed assets, including cohorts launched after the first
mark. This boundary convention permits no instant unexplained profit or loss;
execution expenses must be represented after that funding boundary, not
silently deducted from a mismatching first mark. Reserve interest cannot appear
at the initial mark. A nonzero amount requires an explicit accrual interval
matching the previous/current marks, the previous unallocated reserve, a rate
known by the interval start and a source hash. It reconciles using ACT/365.25,
before any current-boundary settlements or deployments, so newly settled funds
cannot retroactively earn interest. The pipeline passes its cutoff into the
sleeve ledger. Historical nonzero reserve interest remains unavailable until
the retained cash-rate lineage is independently reviewed.

### Retained real-source examination and precise remaining blockers

Inspected the existing company-operating source bundles, without altering them:

* CAT's original publisher URL is the 2025-10-29 Q3 release; its retained
  `publishedAt` is null and retrieval is 2026-11-10T03:50:00.348Z.
* XOM's original publisher URL is the 2025-12-09 plan release; `publishedAt`
  is null and retrieval is 2026-11-10T03:50:00.323Z.
* NEE's retained release is dated **2026-01-27**, after the workplan's
  **2026-01-22** cutoff; `publishedAt` is null and retrieval is
  2026-11-10T03:49:59.988Z.

These authentic publisher documents are not original-at-origin archives for the
historical monthly panel. No eligible paired research periods were assembled
from them: CAT/XOM lack exact original availability/capture at the required
origins; NEE additionally fails the cutoff. A published calendar date is not
silently promoted to a publication timestamp. Their issuer operating facts
also do not provide complete historical universe manifests, matched projection
and valuation member archives, seven origin controls, return/action records,
borrow/collateral terms or geographically matched factors. No current-universe
substitution, old-intensity proxy, synthetic efficacy or assumed cost fills
these fields.

Still required: independently reviewed original monthly issuer/universe and
paired-member inputs; dated eligibility/trailing liquidity; full live-sleeve
marks plus cash-flow/rate lineage; actual event/collateral/borrow records; a
reviewed monthly sleeve-factor inference bridge; the 50-observation return-index
reconciliation with break rates; full cost/subperiod/drawdown/capacity reporting;
secondary sector research and a genuine prospective archive. The added modules
implement the stated accounting/constraint contracts, not those missing
empirical evaluations or independent approvals.

## Scope and status

**Historical efficacy: WITHHELD. Scientific acceptance: false.**

New offline files implement a retained-corpus adapter, an orchestration function,
an immutable-output CLI and explicit engineering fixtures. No existing paired-gap,
family-adjudication or long-only kernel was changed. No routes, UI, company case
files, shared semantics, package scripts, approvals or production state are owned
by this change.

Requirements read: original S14-001–026 and S15-001–015 clauses retained in
`WORKPLAN_COMPLETION_LEDGER.md`; amendments 12–13 in
`Developer_Workplan_Amendments.md`; existing family contract in
`Valuation_and_Research_Completion_Status.md`, `researchFamily.ts` and
`script/adjudicate-research-family.ts`; existing `walkForward.ts`.
The existing revised-history evidence mode and ordered three endpoints are
preserved. No authentic, precommitted expanded Stage 14 corpus/protocol was
created or asserted by this work. The new runner requires an independently
retained protocol hash; supplying a hash is not proof of prior commitment.

## Executable path

`pairedResearchCorpus.ts` resolves retained payload hashes and binds each paired
growth definition/member value, issuer, model and origin to its archive payload.
It verifies explicit universe membership, future-input restrictions, original
versus revised vintage claims and strictly later execution. Missing members are
retained as coverage failures, never survivor-selected scores.

`pairedResearchPipeline.ts` iterates the frozen specifications and expected
origin calendar. It calls the original paired-median and peer-rank kernel, forms
sector-balanced equal-weight quantile long/short legs (gross 2, net 0), and
records execution units, weights, split-adjusted end units, cash, settlements,
drift, financing, borrow expenses, dividend liabilities and net returns.
Boundary price/FX discontinuities and unexplained disappearing holdings fail
closed. Flagged lifecycle positions settle into cash; only flagged terminals
receive 0%, −30%, −100% return stresses. Insolvency stops the trajectory.

Primary trading expenses are exactly **25 bp × sum(abs(weight changes))**,
including initial trades and both legs. Zero cost is only an explicit
sensitivity. Borrow-rate and lifecycle sensitivities are separate, not added to
the primary hypothesis family. Missing borrow history produces hypothetical
accounting and withholds the after-cost hypothesis; explicitly unavailable
borrow fails the portfolio rather than silently dropping issuers.

Controls-only versus controls-plus-gap predictions are fitted on purged
training rows only. Ablations add baseline growth, transition demand, carbon
drag and intensity in order. Evaluation-date IC, paired R² improvement and
regional-factor alpha are computed with deterministic circular date-block
resampling. All issuer losses on a date remain together. Workbook-universe
factor alpha is separately reported. Factor regressions use portfolio returns
less the declared period cash-rate return. Singular designs are unavailable,
not regularized into purported evidence.

All model × peer × target × three-endpoint cells remain in the existing Holm
adjudicator, including missing specifications, origins and outcomes. Fixture
statistics are never submitted as empirical hypotheses. Every run has
`efficacy: WITHHELD`, `scientificAcceptance: false`, and the prior-exposure
disclosure.

The existing long-only engine is invoked separately, retaining its 12-row
warm-up, 2% tracking-error target, tilt cap 5, drift, terminal handling and
explicit 25 bp input. It is not used as evidence for the long/short hypothesis.

CLI:

```
npx tsx script/run-paired-research-pipeline.ts frozen-protocol.json PRECOMMITTED_SHA256 retained-corpus.json
```

Only a new content-addressed JSON receipt is written under
`generated-artifacts/paired-research-pipeline/`; conflicting existing output is
rejected. No historical CLI run is claimed here.

## Actual checks

Executed successfully:

```
npx tsx --test script/paired-research-pipeline.test.ts script/paired-company-gap.test.ts script/backtest-costs.test.ts script/research-family.test.ts
npx tsc --noEmit --incremental false
```

**21 tests passed, including 11 new orchestration tests; TypeScript passed.**
The fixture uses 36 explicitly synthetic monthly origins, 16 engineering-only
identifiers and two declared models, one intentionally absent. It produces 24
evaluation accounting periods, all three computed fixture endpoints, four
ablations and two factor-attribution estimates, while all six family cells
remain non-rejections. Tests also cover costs, FX/splits, terminal settlement,
financing, short dividends, unknown/forbidden borrow, missing dates/members,
hash/model substitution, same-close execution, future inputs, factor currency,
mark discontinuities, purging, insolvency and unchanged warm-up.
Future outcome perturbations cannot change earlier holdings or the selected
units/weights at the perturbed execution.

These are engineering tests, not an issuer-history study, investment finding,
archive-authenticity check or independent owner review. No application/UI
changes were made or visual verification requested.

## Precise remaining historical inputs and origins

The runner's schemas are the complete machine-readable field contract:

* **Frozen protocol:** original precommitment receipt/hash and timestamp;
  model/peer/target specifications and expected origins; evaluation boundaries,
  embargo, block length, repetitions/seed, currency/geography, quantiles,
  weighting and explicit cost/borrow/terminal sensitivity settings.
* **Universe per origin:** immutable sorted issuer membership payload and
  original universe URI, availability and capture timestamps. Membership must
  include later delisted/terminal issuers, not today's surviving constituents.
* **Paired Stage 12 / Stage 11–13 payloads per issuer/model/origin:** compatible
  currency, FCFE/FCFF basis, horizon, nominal convention and growth definition;
  matched member IDs and projected/implied growth; issuer/model/origin binding;
  retained payload hashes, original source URI, exact availability and capture
  times and original/revised designation. A newly downloaded current statement
  cannot supply an original filing vintage.
* **Origin covariates:** market capitalization, stable numeric ID, sector/peer,
  seven controls in fixed order (value, size, momentum, quality, sector, region,
  carbon intensity), baseline growth, transition demand, carbon drag and
  intensity; origin availability and retained source hashes. Sector/region
  encoding must be fixed externally and not fitted to evaluation outcomes.
* **Execution/outcome records:** exact execution, end and outcome-availability
  times; unadjusted prices, base-currency FX conversion, split ratio,
  distributions per original share, terminal proceeds and explicit lifecycle
  flag. Origins should be retained exchange/provider records and corporate
  action/delisting notices, not guessed final-row losses.
* **Financing/borrow:** cash and financing annual rates, issuer borrow
  availability/fees and their dated desk/provider records. If unavailable, an
  explicitly supplied hypothetical borrow rate is required; it does not
  become observed borrow evidence.
* **Factors:** dated Kenneth French regional developed-market factors and
  separately constructed workbook-universe factors with source hashes,
  matching geography, currency, factor ordering and holding horizon.

Origin claims for these inputs still require independent authentication.
Hash equality establishes payload consistency, not authenticity, licensing,
original publication or owner approval.

## Remaining engineering scope, not a blanket data blocker

This runner supports contiguous nonoverlapping holding windows. Monthly
12-month target cohorts can be scored for IC/R², but overlapping portfolios
are explicitly unavailable until a separately frozen overlapping-sleeve
capital-allocation/rebalance schedule is implemented. The existing long-only
kernel is only run on next-month rows; sector-neutral/active-weight/liquidity
constraint variants and rebalance-frequency variants are not newly implemented.

Cash flows use an explicit period-end settlement convention: dividends and
terminal proceeds are per original share and converted with end FX; no
intra-period dividend reinvestment is assumed. More detailed payment-date FX,
merger/spinoff successor holdings and short-collateral/rebate schedules need a
dated event ledger rather than silent approximations. Splits and cash terminal
settlements are implemented. Price discontinuities require explicit
reconciliation instead of being accepted as returns.

Remaining corpus work is to bind non-pair market/control/factor transformations
to independently reviewed raw-source lineage, reconcile the required 50
return-index samples against prices plus dividends and report break rates.
Secondary sector-level research and a genuine prospective live-signal archive
are not created by these tests. No model reselection or independent owner
review is performed. These are specific further tasks; unavailable historical
inputs did not prevent implementing and testing the executable path above.

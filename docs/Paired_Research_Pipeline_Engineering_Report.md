# Paired Stage 14/15 orchestration — engineering receipt

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

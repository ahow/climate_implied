# Next company evidence proposal — not acceptance

Scope: continue the retained First Solar, NextEra and ExxonMobil source work. No hypothetical study, unchanged FSLR forecast, beta study or D8 comparison was rerun. No production write, approval, commit, deployment, callback or central-ledger update was made.

## New primary-source progress

Three bounded public SEC submissions requests succeeded on 10 November 2026. These are **not** the previously blocked SEC archive-document requests. Retained metadata now identifies the selected FY2024 annual filings:

| Selected company/basis | Accession | SEC acceptance, UTC |
| --- | --- | --- |
| FSLR / 0001274494 | 0001274494-25-000010 | 2025-02-25 21:11:24 |
| NEE / 0000753308 | 0000753308-25-000011 | 2025-02-14 19:23:43 |
| XOM predecessor / 0000034088 | 0000034088-25-000010 | 2025-02-19 21:39:37 |

The assembler verifies retained response hashes, issuer CIK, form, fiscal period, accession and acceptance timestamp. This establishes a primary metadata publication link, **not authentication of every byte of the separately retained AnnualReports mirror**. The selected FY2024 statements, historical bridge values and retrieval timestamps remain unchanged.

Eight additional historical rows were located in the retained primary reports, without changing the frozen bridge:

- FSLR: $185.618m PP&E acquisitions funded by liabilities. This is **noncash** investing, not another current cash-capex deduction.
- NEE: $2.257bn differential-membership proceeds, $740m payments, $760m **net cash tax receipts**, and $2.737bn cash interest net of capitalization. Tax-equity financing is not automatically common FCFE. Historical tax receipts do not justify recurring forecast refunds; the existing annual cash-tax input is nonnegative.
- XOM: $3.299bn additional investments/advances, $658m NCI cash dividends and $791m changes in NCI. These identify omitted claim/investing reconciliation work, not permission to treat all three rows as ordinary maintenance capex.

Exact private locators, units, hashes, request times, status codes and missing-field diagnoses are retained under `generated-artifacts/company-operating-corpus/next-company-evidence/`. Raw documents and provider records remain ignored/private; no redistribution licence is asserted.

## Dependency-ready contract

`companyCaseEvidence.ts` adds a strict, private evidence adapter around the existing filing, common-share and full-cash-ledger models:

- Every annual numerical financial input and historical FCFE anchor requires value-hashed evidence bindings. Issuer/CIK/security, actual source capture, public availability, dependencies, freeze and market cutoff are checked separately.
- A stub explicitly covers the period after reference through the day before the first full annual forecast. Individual dated cash flows and coverage/completeness need evidence. Absence is not zero; even an explicit zero needs justification.
- The nominal FCFE continuation contract separately requires discount/growth support and explanations for maintenance/growth reinvestment, working capital, taxes, financing, non-common claims and policy expiry/eligibility. Its positive year-five anchor must reconcile to the cash schedule. It is a conditional evidence contract, not an independently established sustainable terminal.
- Exact primary common shares and an authorized same-date quote are separate inputs. Class and CIK mismatches block; rounded shares, float, diluted EPS denominators and market-cap/price shares cannot substitute.
- The optional original-nominal adapter delegates to the existing `originalNominalEquityAssessment` without modifying `reverseValuation.ts`. Original earnings must be separately primary-bound; FCFE is not relabelled earnings, and FPL allowed ROE is not issuer sustainable ROE. The original 2.5–4% assessment remains distinct from the retained 1–3% cash-flow diagnostic.

The existing `companyFullCashflowCase.ts` now values an explicitly evidenced, complete dated FCFE stub in **both** forward and reverse directions. Stub and annual/terminal cash use actual calendar days /365.25 from model reference; the stub remains fixed while the solved annual adjustment starts with the first full forecast year. Negative stub cash is retained. FCFE is already net cash to common equity, so neither working capital nor financing is deducted again. Legacy schedules still parse and calculate unchanged, but an absent stub receives `missing-stub-not-assumed-zero-legacy-schedule-only` and whole-equity pairing is withheld. An explicit zero stub requires completeness evidence and rationale.

`pairSourcedCompanyCase` now passes a fully ready evidence contract through the existing FCFE forward/reverse engine. The separate original earnings model still uses annual t=1 timing and withholds non-year-end original-model execution; its semantics were not replaced by FCFE stub mechanics. No endpoint or public output was added.

Information cutoff/model-as-of and quote observation/retrieval timestamps are separate. A **prospective conditional** calculation may use a prior close available by the freeze, provided its actual quote date is explicit, exact primary shares refer to that quote date, and the source information is available by the model cutoff. Freeze-after-price alone is not a blocker and does not require a post-freeze quote. Historical point-in-time mode retains strict cutoff/dated-reference guards. Metadata explicitly labels a prior-close comparison as conditional, not a historical-attribution claim.

## Retained evidence and remaining dependencies

The ten FSLR FY2025-release/2026-guidance conditional scenarios and their **50 annual rows** were read and hash-checked, not recalculated. The release remains unaudited and separate from selected FY2024 filings. It was published 24 February 2026 and actually retrieved 10 November 2026. Its five full years begin in 2027; reference-to-31-December-2026 stub cash is absent. Repeated total capex/D&A and expiring 45X benefits do not establish perpetual sustainable FCFE.

The nine existing FMP requests succeeded. Their actual diagnosis remains: quote timestamps exist; explicit dated `sharesOutstanding`/`sharesDate` do not. Their FY2025 balance-sheet rows do not replace the selected FY2024 basis. No new FMP request or allowlist expansion was made.

Current references remain blocked:

1. Exact FY2024 cover counts are effective **before** their annual reports were published. Neither those counts nor the later 2026 XOM cover count matches the retained 9-November-2026 quote dates. No share interpolation or carry-forward was applied.
2. The retained prior-close quotes are eligible timing candidates for a labelled prospective comparison, not disqualified solely because the freeze is later. They still lack same-date primary shares; neither quote timestamps nor source retrieval times may be backdated, and future quotes/disclosures cannot cross the declared information cutoff.
3. NEE still needs consolidated issuer-wide operating/financing/NCI allocation, not an FPL-only forecast.
4. XOM's primary-supported July-2026 succession changes CIK/security class. The historical predecessor and current successor remain separate pending identity/class/ISIN review; there is no automatic ticker join.
5. All selected FY2024 cases still need independently justified prospective schedules, complete stub coverage and sustainable terminal support. No tariff, CAT coefficient, arbitrary recovery, terminal return or new cash-tax parameter was invented.

The request remains **0/3 complete sourced end-to-end cases**. FSLR remains a solar-manufacturing alternative, not automatic satisfaction of the original industrial case requirement. Scientific/owner acceptance and model selection remain unchanged.

## Verification

Sixteen focused checks cover the evidence contract, legacy full-cash-flow/share regressions and explicit stub valuation. Independent arithmetic verifies dated negative/positive stub PV, complete annual/fade/terminal forward value and a known nonzero reverse adjustment with the same stub/timing. Additional checks cover absent/explicit-zero stubs, wrong cash basis/currency, dates/evidence, prospective prior-close eligibility, historical/future-information refusal, shares and original-model separation. Strict source checking uses the project's default downlevel target without compiler weakening; owned script checking additionally uses its required top-level-await-compatible ES2022 target. These are engineering contract tests, not empirical issuer studies or public-route/browser verification.

`validate-next-company-evidence-private.ts` separately passed actual retained-byte checks: three SEC issuer/acceptance links, eight exact filing-row locators/amounts, unchanged selected FY2024 bridges, hash-preserved distinct FSLR50 rows, and its recorded prospective dependency-contract statuses. It does not recalculate those 50 cash-flow rows. That source assembly preceded the later bounded FMP attempt, which successfully retained three exact-date quote/primary-share candidates. Those later responses omit currency/units/CIK/class, retained primary identities remain separate, and complete prospective schedules/stubs and sustainable terminal inputs are still not ready. Actual whole-equity pairs remain zero—not because the prior closes predate the freeze.

## Historical frozen-code verification repair

The mandatory `validate-company-filing-private.ts` no longer incorrectly requires the current stub-enhanced engine to have the old frozen digest. The original FY2025 FSLR assumption bytes, freeze receipt and retained result remain unmodified.

`pinned-company-source.ts` recovers the three original direct TS sources only from known pre-increment revision `c3bc94940099aa22feddd56f382c5a6d2a25d1bf`, **only after every byte digest matches the original freeze receipt**. The historical `companyFullCashflowCase.ts` digest remains `6cf7a9e40ca7216c5916768f48ef4a04802d79b9e7890b39b2fd7c29c0ff936b`; it is not rewritten to the current engine digest.

Recovered code is retained in the ignored/private `fslr-full-cashflow/pinned-code/` archive. Hash mismatches, corrupt archived bytes, an unavailable recovery revision, dependency-lock changes or imports outside the verified archive fail closed. There is no fallback to current model code. The transitive `analysisManifest.ts` is isolated from the same revision and explicitly labelled a supplemental dependency, not falsely represented as separately pinned by the original freeze. The current package lock matches that revision. Compiler/runtime bytes were not captured by the original freeze; this limitation is recorded.

The mandatory check executes the pinned historical entry point solely as deterministic verification of the existing frozen results: all ten cases/50 annual rows and **every computed top-level output field** must exactly equal the retained report. It also verifies the separately retained pre-calculation receipt equals the report receipt. This is not a new study run, result replacement, refit, new scenario freeze or source acquisition.

A separate current-code compatibility assertion preserves every historical case/ledger field exactly, while explicitly checking the new missing-stub status as additive current metadata. Current-versus-frozen source digests are reported separately, so compatibility is never represented as historical code identity. Five focused failure/retention tests and strict TypeScript checks pass; mandatory private validation passes without skips or weakened original numerical assertions.

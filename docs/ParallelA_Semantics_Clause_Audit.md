# Parallel A — original semantics closure and targeted clause audit

## Implemented scope and accounting

This increment changes semantic definitions, read-only GET response bindings, UI annotations, an existing export, the generated census and tests. It changes no economic calculation, HTTP fixture, recovery implementation, approval policy, replay implementation, central completion ledger or release. No scientific acceptance is inferred.

**69 original slots closed:** calculation-contract 27, field-semantics dictionary response 24, financial-provider status 14, existing group earnings-yield comparison XLSX 4.

| Accounting | Before | After |
|---|---:|---:|
| Bound original public slots | 797/1001 | 866/1001 |
| Original unbound remaining | 204 | 135 |
| Cumulative closure from original 429/1001 checkpoint | 368/572 | 437/572 |
| Actual total slots, including withheld | 1028 | 1028 |
| Withheld physical claims | 27 | 27 |
| Reconciled cache aliases, separately retained | 4 | 4 |
| Comparable total including aliases | 1032 | 1032 |
| Semantic definitions | 782 | 852 |
| Precisely verified existing export columns in census | 54 | 58 |

The 70 added definitions are not 70 closures: the nullable financial-provider `quote` container has its own runtime null-state definition but is not an additional original scalar slot. It contributes **zero** original closure. Public denominator delta is zero. Native candidate 187 slots, native export 35 columns and replay Ledger 22 columns are unchanged. The strict census completion gate remains false.

`shared/diagnosticMetadataSemantics.ts` gives concrete derivations, units, availability and limitations. The three GET handlers publish observed `X-Field-Semantics` IDs through `bindNestedOutput`; absent optional values need not emit every schema-leaf ID. The dictionary binds its metadata columns, not an assertion that all application fields are already covered. The provider quote is explicitly a startup connectivity sample, not approved financial data. Quote Unix seconds and diagnostic ISO completion time remain distinct. Eleven provider display elements now carry precise field IDs; this does not enlarge the original denominator.

`client/src/pages/decarb-signal.tsx` binds all four existing comparison download columns. The three signed earnings-yield differences are percentage points, not carbon prices or physical decline rates. The common 8% baseline cancels; missing group/date values remain blank. The date is the chart's browser-timezone month label, not an ISO day. No numeric formula or label was changed.

## Dynamic, conditional and custom workbook audit — not silently closed

Nine dynamic-key entries remain explicitly unresolved:

- Native-pathway validation: annual native gas map, cumulative native gas map, infilling map (three).
- Category trend selected metric/category columns; indicator-card registry-selected columns (two).
- Climate valuation selected-group P/E columns; data-management selected indicator column; peer-gap selected measure columns; selected-signal cumulative-return column (four).

The existing binding expressions are retained, but presence of an expression does not prove exhaustive conditional schema reconciliation. The category and indicator exports use `Object.fromEntries`; the comparison cumulative export includes conditional spreads. No wildcard was replaced by a convenient smaller set or counted as a scalar closure. Dynamic branch/column union validation remains ready work.

The custom replay sheets were audited directly in `server/calculation/companyProjectionReplay.ts:140–155`:

| Sheet | Actual structure and existing evidence | Remaining semantic boundary |
|---|---|---|
| Semantics | 12 columns: fieldId, meaning, unit, formula, source, period, geography, status, missingness, uncertainty, scope, asOfRule; rows from companyReplaySemantics | Describes Ledger; not an exhaustive field binding for every full-result leaf |
| Identity | Six key/value rows: contract, manifestId, resultHash, status, scientificAcceptance, productionEligible | Last two are literal string `false`; identity is not scientific acceptance; no new original slot credit |
| Ledger | 22 shared header-bound columns | Already covered before this increment; zero additional closure |
| FullResult | chunk index plus canonicalResultJson, chunk length 16000 characters | Serialized result preservation is not per-leaf semantics; zero additional closure |

The replay writer already reads all sheets back and compares cell hashes, then rejoins/parses FullResult and checks resultHash. That existing behavior was inspected, not modified or rerun as fresh replay acceptance in this increment. The supplemental census inventory remains truthful inventory, not a claim of full custom-sheet semantic closure.

## Targeted audit of the 224 unreconciled original clauses

Twelve exact original clause IDs were audited against existing implementation and named tests. **One fully met at its stated calculator-contract scope; eleven partial.** The other **212** were not audited here. These are proposed reconciliations for the main agent, not edits to central ledgers or owner/scientific acceptance. All twelve were `not-yet-reconciled` in the source ledger.

| Clause | Result | Direct evidence and remaining boundary |
|---|---|---|
| S01-011 | Partial | Provider display IDs plus existing backtest/target/native disclosure components attach field metadata. `script/field-semantics-census.ts` explicitly limits display coverage to annotated JSX; all rendered values have not been enumerated, and general warnings still exist. |
| S01-012 | Partial | `output-field-semantics.test.ts` checks required formula/unit metadata and precise binding rejection. Generated census is now 866/1001; 135 original public slots and custom/dynamic coverage remain. Zero missing fields is false. |
| S01-014 | Partial | The existing comparison export has exact label-to-ID bindings and a real XLSX readback test in `diagnostic-metadata-semantics.test.ts`. Native/historical tests check particular renamed milestones. There is no complete all-renamed-label UI/API/export equality census. |
| S05-008 | Partial | `regionalSampling.ts:sampleRegionalDrivers` sorts row IDs and regional scenarios, hashes canonical parameters and seeds bootstrap member selection. `regional-sampling.test.ts` checks 10000 members, reversed parameter rows, and 5000-member prefix invariance. `member-metrics.test.ts` checks reversed member ordering and hashes. A combined manifest-to-full-regional-output member-hash test across every input-order permutation is not supplied by those tests; do not extrapolate the component assertions. |
| S06-010 | Partial | `research-field-semantics.test.ts` binds actual retained CAT JSON; `published-scenario-references.tsx` reads its response. Retained source lineage is described, but these tests do not independently authenticate source documents or compare every browser-rendered number to their hashes. |
| S07-001 | Partial | `script/fair_native_bridge.py:apply_native_pathway` enforces complete native gas coverage, contiguous years, finite values, inventory anchor and nonnegative non-CO2 values; `test_fair_native_bridge.py` contains rejection tests. Separate pinned FaIR research scripts exist, but the accepted coupled calibrated production ensemble is not established. Python tests were inspected, not rerun here. |
| S07-022 | Partial | Native semantics tests and shared native export schema cover the current candidate. That does not establish all FaIR headline values and claim labels across UI/API/exports; no production FaIR promotion is made. |
| S10-013 | Partial | `cash-flow-valuation.test.ts` rejects valuation/cash-flow currency mismatch; `financial-mapping.test.ts` rejects missing currency and ambiguous listings. Those tests do not demonstrate conversion and currency consistency for every workbook aggregate. |
| S11-005 | **Fully met — calculator contract** | `server/calculation/cashFlowValuation.ts:model` returns `not-modelled` for `businessType === "financial"` before industrial valuation. `cash-flow-valuation.test.ts`, “loss-making, financial and unbracketed companies are not forced into a solution”, directly tests this permitted alternative. This verifies declared-financial handling, not the independent correctness of every issuer classification. |
| S11-039 | Partial | `valuation-solver.test.ts` checks the closed-form fixture and known growth recovery; `cash-flow-valuation.test.ts` checks a perpetuity, known growth, financial/loss/unbracketed refusals. These establish engineering fixtures, not reliable convergence and complete failure counting across the full intended population. |
| S13-022 | Partial | `publicValuationContract.ts` removes unsupported physical claims; `public-valuation-contract.test.ts` covers nested removal. New comparison semantics specify signed percentage-point diagnostics and explicitly prohibit carbon-price interpretation. A sourced valuation–emissions association with its interval and translation model is still not delivered. |
| S16-009 | Partial | Shared native/export bindings, preserved replay readback checks and the new comparison XLSX test cover named slices. Exhaustive every-headline UI/API/export numeric and claim-label parity, including conditional/custom exports, is not established. |

If the main agent accepts all twelve proposed statuses, the unreconciled count decreases by twelve, not 69 or 70. Semantic slot closure and clause acceptance are separate denominators.

## Executed checks and limitations

- `npx tsx script/field-semantics-census.ts` and subsequent `--check`: pass, 852 definitions / 1028 actual slots / 866 bound.
- `npm run check`: pass after final implementation/test changes.
- `npx tsx --test script/*semantics*.test.ts script/regional-sampling.test.ts script/member-metrics.test.ts script/cash-flow-valuation.test.ts script/financial-mapping.test.ts script/valuation-solver.test.ts script/output-register.test.ts`: **62 pass, 0 fail, 0 skip**.
- `npx tsx script/output-register.ts`: executed; register consistency test passes.
- Existing running `/data-management` preview screenshots successfully. The first viewport shows the read-only/operator-403 explanation and target disclosure; the changed provider section is below the captured viewport, so its rendered appearance and interactive downloads were **not** visually verified.
- No server/workflow restart, full application build, full test suite, live POST mutation, replay rerun, commit, deployment, callback or production write was performed by this subagent. Authorization middleware is untouched; public POST403 behavior remains delegated to the main agent's HTTP checks.

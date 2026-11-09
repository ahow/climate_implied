# Sourced company accounting controls — 9 November 2026

## Scope and conclusion

Stages 10–12 now include a source-backed accounting bridge and worked financial
controls for an industrial company (Caterpillar), an oil-and-gas company
(Chevron), and a utility (NextEra). These are **not completed worked climate
projections**. Physical quantities, activity growth and policy costs are explicitly
disabled to isolate accounting. Zero physical quantities in these control files
are not assertions that the companies have zero emissions.

No scientific promotion, identity approval, data approval or investment ranking
changed. Inputs are current-provider revised history, not publication vintages.
The fiscal year is fixed at 2024 for all three controls. This is an accounting
check, not a fitted or out-of-sample forecasting experiment.

## Correction to the company engine

The previous net-income reconstruction omitted non-operating income, income
attribution adjustments and other cash adjustments. These are now required
explicit inputs, not zero defaults:

```
pretax income = revenue × margin − carbon drag − interest + nonoperating income
net income = pretax income − cash tax + income attribution adjustment
FCFE = net income + depreciation + other cash adjustments
       − capex − increase in working capital + net borrowing
```

The source bridge reconciles this with `OCF − capex + net borrowing`. It does
not subtract working capital twice. Provider working-capital cash contribution
has the opposite sign to an increase in working capital in the operating model.
Residual cash adjustments are exposed for review, not deemed recurring earnings.

**Input compatibility:** callers of the company member engine must now supply
`nonOperatingIncome`, `incomeAttributionAdjustment` and `otherCashAdjustments`
for each projected year. Omitting them fails validation. Zero is valid only when
explicitly specified. Existing fixtures specify zero; sourced controls use the
reconciled bridge.

## Actual results

USD billions, current-provider 2024 statements:

| Company | OCF | Capex | Net borrowing | Starting FCFE | Constant-control FCFE | No-new-borrowing FCFE | Five-year CAGR for no-new-borrowing control |
|---|---:|---:|---:|---:|---:|---:|---:|
| Caterpillar | 12.035 | 3.215 | 0.799 | 9.619 | 9.619 | 8.820 | −1.7194% |
| Chevron | 31.492 | 16.448 | 3.568 | 18.612 | 18.612 | 15.044 | −4.1672% |
| NextEra | 13.260 | 8.514 | 11.638 | 16.384 | 16.384 | 4.746 | −21.9484% |

Both controls hold operating inputs constant for five years. The second sets
net borrowing to zero. Its CAGR compares the financing-inclusive starting FCFE
with the year-five no-new-borrowing FCFE; it is **not** an annual forecast of
operating decline. No probability is assigned to either control.

Income-statement net income minus cash-flow net income is respectively
$4 million, −$88 million and $1.248 billion. Other cash adjustments are
−$47 million, −$3.639 billion and $1.641 billion. These differences require
issuer-statement review; an arithmetic reconciliation is not accounting approval.

## Identity refusal retained

Exxon was initially included but rejected: the workbook ISIN is
`US30231G1022`, while FMP returned `US30233Q1085` for XOM. The collector did
not join on ticker or silently rewrite identity. Chevron was collected as a
separate oil-and-gas control, not as a replacement identity for Exxon.
Corporate-action continuity and primary-listing review remain unresolved.

## Lineage and reproduction

Sources: FMP stable profile, annual income statement, cash-flow statement and
balance sheet; existing company records from the uploaded workbook.
Exact-ISIN agreement creates only a provider candidate, not independent approval.

| Symbol | Retained payload SHA-256 |
|---|---|
| CAT | `292027dcb86496d50b3bac1ee99059a760069766660187a91dc95a2a3dda5a2b` |
| CVX | `fce911df1423074177f5373c34f85cd82e46e1954b6c23b56ffadbdc2f5a49b4` |
| NEE | `3f492a5be689a8feb1e97a3c9fa003b3c2929b5fc65ca22a183aa8b3fd1e4efc` |

Raw provider responses and workbook records remain private under
`generated-artifacts/company-worked-inputs/`; results under
`generated-artifacts/company-worked-results/`. Content hashes are verified on
replay, and output files are content-addressed and not overwritten.

```
npx tsx script/collect-company-worked-inputs.ts NEE CAT CVX
npx tsx script/run-company-worked-controls.ts generated-artifacts/company-worked-inputs/*.json
npx tsx --test script/company-baseline.test.ts script/company-projection.test.ts
```

Recollection can differ as the provider revises history. Exact reproduction
uses retained files, not a fresh request.

## Remaining acceptance

Verification: **158 TypeScript tests and 26 Python tests passed**, along with
type checking and the production build. All three actual-source constant
controls reproduced starting FCFE within the declared numerical tolerance.
The retained Exxon identity refusal is an expected failed eligibility check,
not an approved match.

Independent issuer/cash-flow ownership review, decomposition and recurrence of
cash adjustments, operating geography, sourced carbon boundaries, calibrated
sector activity and policy paths, defensible margin evolution, and valuation
pairing remain incomplete. The three controls do not satisfy those requirements.

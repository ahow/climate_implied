# Bounded unit B — original semantic-gap closure

## Accounting

The supplied original census had **429 bound / 1,001 public API/XLSX slots**, plus four reconciled cache aliases, and **572 unbound original slots**.

This change closes **85 original slots**, leaving **487 original slots unbound**:

| Existing response family | Original slots closed | Runtime binding |
| --- | ---: | --- |
| GET /api/research/driver-registry | 34 | driverRegistry, nested response leaves |
| GET /api/reference-scenarios | 28 | publishedReference, nested response leaves |
| GET /api/cv/summary | 21 | companySummary, nested response leaves |
| GET /api/cv/dimensions | 2 | companyDimensions, array leaves |

All four routes emit X-Field-Semantics from strict runtime binding of the actual response. No economic calculations, output values, field withholding, or authorization gates were changed.

Current coverage is **514 / 1,001 public slots**. The original public denominator delta is **zero**; actual unique API/XLSX slots remain **1,028**, including 27 previously withheld slots. Four cache aliases remain reconciled separately (1,032 including aliases). Definitions increased from 442 to 528; the additional nullable latestUpload container definition supports actual runtime nulls but is **not** counted as an original leaf closure.

Native candidate coverage remains **187/187**, native export retains its **35 columns**, and company replay retains **22 ledger columns**.

## Trace and consumer scope

- Research derivations trace driverEvidenceRegistry, retained history hashes, role classification, explicit unavailable publication dates and calibration decisions. No central-model eligibility is inferred.
- Published CAT references trace the pinned November 2025 JSON/workbook provenance. Policy low/high pathways are explicitly not probability intervals; 2100 temperature medians are external references, not dashboard output.
- Company summary counts trace the actual selected rows, raw date range, upload metadata and per-company/per-scope carry-forward statistics. Fraction units remain fractions; empty imputation populations retain the implemented zero fraction. Upload timestamps do not become source vintages.
- Added 16 exact display element IDs: nine research metadata elements, four published scenario elements and three imputation disclosure elements. The census inventories 33 explicit display elements in total, including pre-existing annotations, separately from API/XLSX slots.
- The census now records all 21 DownloadDataButton row/binding expressions explicitly. Conditional/dynamic binding expressions are metadata, **not** claims that every column is bound. Existing dynamic export gaps remain open; this unit does not introduce a browser writer or a new export denominator.
- The output register was regenerated after edits. No new route or download control was introduced, so its contents remain unchanged.

## Checks performed

- TypeScript no-emit check produced no diagnostics.
- Research/company semantics, output semantics, native semantics and register checks: **19 tests passed**.
- Company replay and public valuation contract checks: **9 tests passed**, including two fresh subprocess recalculations with byte-identical XLSX and 20 concurrent replay controls. These are synthetic engineering fixtures, not scientific acceptance.
- Fresh census regeneration and subsequent `--check` succeeded.
- Strict completion gate still rejects: **514/1001**, not complete.

The remaining 487 original slots, unenumerated display expressions, unresolved dynamic exports and broader company valuation/system families are **not claimed closed**. No approvals, production writes, DDL, collector changes, credentials, release/callback changes or calculation-engine edits were performed by this unit.

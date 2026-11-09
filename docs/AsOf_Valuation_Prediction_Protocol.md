# As-of Gordon / reverse-DCF prediction protocol (D8 inputs)

Frozen 2026-11-09, before any as-of prediction, signal or validation return was
computed and before additional companies were ranked or fetched. It implements
inputs for `Valuation_Comparison_Protocol.md`; it does not alter that protocol's
eligibility floors, loss, IC, bootstrap or decision rule.

## Annual origins and information set

- Origin for calendar year Y = the first workbook monthly observation dated in
  July of Y. Origins 2017–2023 are candidates (FY t+3 statements end in 2025/26).
- Statement used: the latest fiscal-year (FY) cash-flow and income statement
  whose provider `filingDate` is strictly before the origin date. Statements
  filed on or after the origin are never used (publication-lag rule). Provider
  values are revised history, not as-first-reported; results are labelled
  `revised-history`.
- Market capitalisation: workbook `marketCap` at the origin observation
  (USD millions for US issuers; multiplied by 1e6). Provider profile market caps
  are undated and are not used.
- Currency: provider `reportedCurrency` must be USD and equal the profile
  currency; no FX conversion.
- Accounting/unit boundary check: workbook `netProfit` × 1e6 at the origin must
  lie within ×[0.5, 2.0] of the used FY provider net income when both are
  positive; otherwise the company-origin is excluded as "unit/boundary mismatch".
  This is a gross-error screen, not a reconciliation.

## Model predictions (common-8% variant)

- Common cost of equity r = 8%. The company-specific beta variant (S11-004)
  requires a market return series and is not run here; recorded as a gap.
- FCFE = operating cash flow + capital expenditure (negative) + net debt
  issuance (OCF already includes working-capital change; no double deduction).
- Gordon (S11-007): g = r − E/P, E = used FY net income, P = origin market cap.
  Non-positive E → unavailable. Predicted 3-year cash-flow CAGR = g.
- Reverse DCF (S11-008–S11-012): existing `reverseCashFlowGrowth`, FCFE basis,
  stage-1 years 1–5, linear fade years 6–15, terminal growth 3% (within 2.5–4%),
  search bounds −50% to +50%, price-only (no analyst anchor). Predicted 3-year
  CAGR = stage-1 growth. Non-positive base FCFE or market value outside bounds →
  unavailable; no extrapolation.

## Outcomes, signals, validation return

- Actual: existing `completedCashFlowOutcomes` (exact fiscal endpoint FY t to
  FY t+3, positive FCFE both ends). `outcomeAvailableAt` = filing date of FY t+3.
  The exact-endpoint rule is unchanged even though it excludes 52/53-week years;
  any tolerance change needs separate owner review.
- Signals: each model's implied growth (cross-sectional rank). This is NOT the
  Stage 14 new-gap signal; a D8 "signal value" pass on this proxy cannot satisfy
  S11-034. Validation return: workbook total-return-index change from origin to
  the observation 12 months later (strictly after origin; never used as input).
- evaluationAsOf = run date. Rows with outcomes not available by then are
  dropped as premature.

## Coverage expansion (ex-ante, outcome-blind)

Rank workbook companies with geography UNITED STATES, excluding sectors
Financials and Real Estate, by workbook marketCap at their first observation
dated in 2016 (descending). Remove the 12 issuers already selected (including
the rejected XOM). Take the first 16 in rank order. Collect with the existing
identity-checked collector (two manifests of 8). Identity failures are excluded,
never replaced. No fiscal-year, cash-flow or return information is used for
selection, and no issuer is added or removed after outcomes are seen.

## Gates

Run `compareValuationModels` only if the existing gate is met (≥10 common
complete companies at every origin, ≥6 consecutive origins). Otherwise report
eligibility failure with counts. A numerical pass is a candidate for review
only; identities remain unapproved and nothing enters the application.

## Amendment A1 (2026-11-09, before any prediction was computed)

Reason: reading `valuationComparison.ts` showed two incompatibilities with the
unchanged D8 gate, discovered from code, not from predictions or scores:
(1) the gate requires `outcomeAvailableAt` ≥ origin + 3 years, but an FY t → FY
t+3 outcome is filed ~2.5 years after a July origin; (2) the gate requires an
identical month-day for every origin, but workbook observation days vary.

Amended definitions (supersede the corresponding lines above):

- Origin label = `Y-07-31`. Information observation = the last workbook
  observation on or before that label and dated in July Y. Statements used must
  have `filingDate` strictly before the observation date.
- Actual outcome = three-year FCFE CAGR from FY t+1 to FY t+4, where FY t is the
  used base statement. Endpoints use the same exact-fiscal-date rule (same
  month-day, years +1 and +4) and positive FCFE at both ends.
  `outcomeAvailableAt` = filing date of FY t+4. Neither endpoint is an input.
  Both models predict constant growth throughout years 1–5, so FY t+1→t+4 lies
  inside each model's constant-growth stage.
- With ten provider years, the feasible origins are 2017–2022 for December
  year-ends; issuers lacking an endpoint at an origin are missing, not imputed.

The D8 eligibility floors, loss, IC, bootstrap and decision rule are unchanged.

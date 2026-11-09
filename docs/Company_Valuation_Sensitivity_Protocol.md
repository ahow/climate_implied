# Conditional company valuation sensitivity protocol

Use only retained, hash-verified company-worked-input files. Require exact
company/profile ISIN and selection/profile symbol equality, one FY 2024 cash
flow statement, matching USD statement/profile currency and positive finite
market capitalisation. This checks provider consistency, not independent
issuer approval. Refuse duplicate symbols in a run.

Evaluate the Cartesian grid of cost of equity 6%, 8%, 10% and terminal growth
1%, 2%, 3%, separately for:

- Reported FCFE: operating cash flow + negative capital expenditure + net debt issuance.
- No-net-borrowing sensitivity: operating cash flow + negative capital expenditure.

No working-capital double deduction. Negative net debt issuance is retained;
no-net-borrowing removes both debt issuance and repayment.
Use the existing five-year growth / ten-year fade solver with growth bounds
−50% to +50%. Do not extrapolate a missing solution. Reprice every solution
with the forward model and require relative equity-value error below 1e-8.

These rates and bounds are fixed diagnostic assumptions, not empirically
estimated costs of capital or recommended forecasts. The source schema and
market-cap/statement dates were inspected before writing the protocol.
This is not an externally preregistered study.

The retained profile market caps have no valuation timestamp; FY2024 flows
and those undated caps are a mixed-date control. Do not call this point-in-time
analysis, D8 model validation, financial-sector modelling or climate inference.
Do not join workbook market caps with provider statements without establishing
units, currency and dates. Keep raw inputs and detailed outputs out of GitHub.

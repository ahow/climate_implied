# Frozen company-specific discount-rate sensitivity — 10 November 2026

Distinct from the failed D8 common-8% study. Commit before fitting. No change to
the original model-selection gate; Gordon remains primary regardless of this
exploratory sensitivity. No current provider beta is backfilled.

Universe: exactly the existing 27 ex-ante US issuer candidates; identity approval
still outstanding. Inputs: retained workbook total-return indices in their
existing revised-history basis. No additional issuers selected on outcomes.

For each July 2017–2022 origin, use exactly 60 consecutive monthly returns ending
in June, calculated from 61 observations. Monthly labels match calendar months;
no current July or later return enters fitting. Missing, nonpositive indices,
duplicate months, absent months or zero benchmark variance yield unavailable.
Benchmark: equal-weight monthly return of the other retained candidates, at
least ten contributors per month. This is a narrow leave-one-out US peer proxy,
not a broad market index; contributor counts are reported. No FX inference.

OLS beta = covariance(company, benchmark) / variance(benchmark).
Shrinkage: beta_shrunk = 0.5 * beta + 0.5, fixed before fitting.
Assumed nominal USD risk-free rate 3%, equity risk premium 5%.
Cost of equity = 3% + beta_shrunk * 5%.
These are sensitivity assumptions, not contemporaneously observed rates.
Do not clip a rate; rates <= terminal growth (3%) or >= 100% are unavailable.

Evaluate implied-growth differences against the original common-8% calculation
on matching company/origin rows. Report coverage and mean absolute differences
for Gordon and reverse DCF. Do not score returns or repeat D8 selection here.
Rate/terminal-growth grid and actual Stage 14 comparison remain separate work.
Label every output revised-history sensitivity; no scientific promotion,
identity approval, publication-vintage or investable-market-beta claim.

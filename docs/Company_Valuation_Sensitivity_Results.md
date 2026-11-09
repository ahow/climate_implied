# Company reverse-DCF sensitivity results

## Completed work

Executed 54 conditional valuation cases using retained, hash-checked Caterpillar,
Chevron and NextEra inputs: three discount rates × three terminal-growth rates
× two financing assumptions × three companies. See the
[fixed diagnostic protocol](Company_Valuation_Sensitivity_Protocol.md).

All 54 solved within the stated −50%/+50% bounds and repriced within 1e-8
relative error. Maximum observed error was 1.23e-15. Forward repricing uses
the existing forward function and is a numerical consistency check, **not an
independent valuation model or empirical validation**.

Five-year annual cash-flow growth solution ranges across the rate grid:

| Company | Reported FCFE | No-net-borrowing sensitivity |
|---|---:|---:|
| Caterpillar | −0.098% to 13.920% | 0.968% to 15.197% |
| Chevron | −2.314% to 11.259% | 0.299% to 14.396% |
| NextEra | −10.873% to 0.875% | 4.392% to 19.283% |

These are conditional ranges, **not probability intervals or forecasts**.
The substantial NextEra difference illustrates sensitivity to financing in the
reported cash-flow base. It does not establish that financing can be removed
without affecting future operations or investment.

## Evidence and limitations

- FY2024 statements are paired with undated retained profile market caps.
  This mixed-date control cannot support historical forecast or return claims.
- Provider ISIN/symbol agreement is required, not treated as independent approval.
- Costs of equity and terminal growth are explicit diagnostic assumptions.
- Working capital is not subtracted again from operating cash flow.
- No new provider requests, approvals, collection changes or dashboard promotion.
- Raw data and detailed results remain outside the GitHub source export.

Private report:
`generated-artifacts/valuation-sensitivity/0f24be7551772e0f6d8e6eeaa8276db27e1df73524609d640778167a4c8d85d5.json`.

Reproduce with `npx tsx script/company-valuation-sensitivity.ts` followed by the
three retained CAT/CVX/NEE input filenames. Missing/mismatched identity, duplicate
symbols, missing or multiple FY2024 statements, currency mismatches, invalid
numbers, wrong capex sign and changed source hashes fail rather than use defaults.

## Not completed

This is Stage 11 diagnostic progress, not the required empirical D8 comparison.
Ten eligible common companies per origin, model-specific historical predictions,
dated market values, validation signals/returns and source/identity review remain
missing. Financial-sector models, calibrated company climate cases and the
downstream valuation-gap/portfolio studies remain unfinished.

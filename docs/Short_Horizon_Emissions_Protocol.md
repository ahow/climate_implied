# Short-horizon fossil CO2 diagnostic protocol

Fixed before scoring the new study. This is **not** a test of the dashboard's
aggregate-GHG model, publication-vintage skill or 2100 temperature.

Use the existing curated annual fossil CO2 series, 2010–2025, exactly as stored.
Do not substitute nowcasts or silently revise discontinuities. Record a content
hash and retain the supplied series in the private result. The series combines
curated estimates whose original release vintages and scope consistency are not
independently certified. Any result is conditional on that limitation.

At each annual origin 2015 through 2022, fit the preceding six observations
(including the origin) and predict the next one, two and three years.
All three horizons use the same eight origins. No future observation enters a
fit. Never label this as quarterly reconstruction.

- Candidate: log-linear least-squares trend, exponentiated to Gt fossil CO2/year.
- Baselines: persistence and linear least-squares trend on the identical window.
- No parameter tuning, special pandemic adjustment or retrospective exclusion.
- Report bias, MAE and RMSE separately by horizon, and paired absolute-error
  improvements over each baseline.
- For each horizon and baseline, 2,000 circular three-origin block resamples,
  seed 20261111, percentile 95% interval for mean paired absolute-error
  improvement. Shared resampling indices preserve pairing across comparisons.
- A candidate passes a horizon's diagnostic gate only if its MAE is below
  both baselines and both improvement intervals have lower bounds above zero.
  No pooled-horizon success claim and no automatic promotion.
- Reject duplicate/missing years, non-positive/nonfinite observations or
  incomplete training/target windows. Never fill missing emissions with zero.

Eight overlapping origins are a small sample; this bootstrap is a diagnostic,
not a certification of coverage or forecast reliability. The fixed candidate
was not selected by this study from a larger search.

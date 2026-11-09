# Electricity demand: predictive uncertainty and break diagnostic

This supplemental protocol is fixed before scoring. It does not replace the
original 2010–2018 training / 2019–2024 holdout split or promote any input.
Use the already frozen, revised-history OWID source and its recorded hash.

For each of the same five regions:

1. Fit log demand on year using training observations only.
2. Resample centred training residuals in circular blocks of three, with
   1,000 repetitions and seed 20261110. Refit intercept and slope jointly.
3. Independently sample two three-year residual blocks per repetition for the
   six-year future path. Add those future shocks to the refitted log trend.
   Report marginal 95% predictive intervals, coverage, mean width and the
   proper 95% interval score (width plus 40 times each missed-tail distance).
4. Test a fixed break at 2015: compare one line to separate 2010–2014 and
   2015–2018 lines. Statistic is the reduction in residual sum of squares.
   Generate its null distribution by the same circular residual bootstrap
   under the single-line model, refitting both models every repetition.
   Use the plus-one upper-tail bootstrap p-value and Holm correction across
   the five regions, familywise alpha 0.05.

These are residual-bootstrap diagnostics, not proof of stationarity or a
calibrated 2100 uncertainty distribution. Nine training years and six holdout
years are small samples. Future residual blocks assume training errors remain
representative; trend misspecification and unseen shocks are not resolved.
No interval coverage or break result changes the original baseline gate.
No missing observations, zero demand, duplicate years or nonfinite values
are imputed. Incomplete windows are unavailable; invalid values fail.
Central-model eligibility remains false.

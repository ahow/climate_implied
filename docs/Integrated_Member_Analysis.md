# Integrated member metrics and convergence

`script/analyze-member-ensemble.ts` accepts one manifest-labelled annual
ensemble and a predeclared emissions tolerance. It validates the matrices,
computes durable CO2/GHG zero crossings and reduction metrics, and passes
the same identified members into the 5,000/10,000 convergence check.

Member identity, rather than column position after sorting, links temperature,
emissions and milestones. Incomplete temperature matrices fail. Fewer than
10,000 members produce an explicit unavailable convergence result; they are
never padded or resampled. Unavailable or failed convergence exits with code 2.
Output is written exclusively to a new file under ignored generated-artifacts.
Numerical convergence never sets production eligibility or scientific validation.

## Tests and actual retained-control run

Tests exercise 10,000-member numerical agreement, an intentionally shifted
second half that fails convergence, reversed column ordering, invalid tolerances,
missing climate years and a two-member population that cannot establish convergence.
These are software fixtures, not calibrated scientific evidence.

The existing 841-member FaIR zero-missing-history control was also processed.
Its 2024–2100 temperatures were paired with the same retained constant regional
emissions control used to generate them. Every climate configuration receives
the same emissions trajectory: this is **climate-response variation only**,
not 841 independent emissions scenarios.

Results: 841 accepted aligned members; all CO2/GHG net-zero quantiles remain
null, with 100% not reaching zero by 2100. Convergence is unavailable because
the control has 841, not 10,000, members. Exit code 2 is the intended outcome.
The 0.1 Gt tolerance supplied for this plumbing exercise was not evaluated and
is not claimed as a preregistered scientific-study threshold.

Private input/result files: `generated-artifacts/member-analysis-control/`.
The manifest label includes the SHA-256 of the retained FaIR ensemble file.
The original minor-gas history assumptions and scientific limitations remain
binding; see `Minor_Gas_History_Sensitivity.md`.

## Remaining implementation

This connects previously separate metrics and convergence utilities. It does
not build the missing calibrated 10,000-member regional/FaIR study, select its
parameters, establish independent validation or integrate a production forecast.
The full workplan remains incomplete.

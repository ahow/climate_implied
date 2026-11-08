# Sequential workplan execution

Run `uv run python script/run-workplan.py --data-checks --resume`.

This finite runner visits stages 0–17 in order, runs the available regression
checks for each, records failures, and continues independent checks. Optional
data checks run the frozen regional driver calibration and read-only workbook
vintage/financial-approval coverage audits. It does not duplicate the running
company-matching collection, approve candidates or change the collection cadence.

Live private results are saved atomically under `generated-artifacts/workplan/`:

- `status.json`: per-stage and per-command results, outstanding acceptance,
  timestamps, source fingerprint and log paths.
- `report.md`: readable stage summary and remaining work.
- `stage-*.log`: detailed command output, excluded from GitHub and deployment.

Only one runner may execute at a time. Each command has a 15-minute timeout;
timed-out process groups are terminated before proceeding. Resume skips passed
stages only when source contents and data-check options match. Failed or interrupted
stages are retried. An interrupted process cannot leave a permanent stale lock.

Exit codes: 0 is reserved for future fully accepted execution; 1 means one or
more checks failed; 2 means checks finished but implementation acceptance is
still incomplete. **A successful regression check is not a completed stage.**

## Important boundary

This is automation of executable work already implemented, not a background
software engineer. It cannot write missing regional models, obtain unavailable
scientific evidence, grant independent approvals or complete the remaining
implementation by itself. Those requirements remain explicitly open in every
stage report. The full workplan has therefore not been automated end-to-end.

Source release remains a separate tested step using `script/release-source.sh`,
followed by verifying Railway's source revision. The runner cannot automatically
publish unreviewed changes or turn failed scientific gates into successful results.
See [the continuation report](Workplan_Continuation_Results.md) for current
implementation evidence and [the binding amendments](Developer_Workplan_Amendments.md)
for acceptance requirements.

# Deployment-gate negative control

The existing Source validation workflow now supports an explicitly requested
manual negative control. Its first validation step deliberately exits with
failure. The same production-promotion job depends on validation success.
For this control, its event/ref condition allows the job, so a skipped job
tests the failed dependency rather than an unrelated event exclusion.

Normal pushes still run the full TypeScript/Python/type/build checks before
promotion. No `always()`, continue-on-error or force push is used.
Dispatch with the option false cannot promote. Non-main branches cannot promote.

The operator command is:

```
python script/verify-ci-negative-control.py --dispatch
```

It requires main to equal production-validated before dispatch, records prior
manual run IDs, waits for the new run, and verifies:

1. validation concluded failure;
2. promotion concluded skipped;
3. production-validated did not move;
4. main did not change during the experiment.

Multiple concurrent dispatches make the result inconclusive. Credentials stay
in process memory and are not printed or saved. The evidence file contains only
source identities, job conclusions and the GitHub run URL, under
generated-artifacts/ci-controls.

This is a failure-injection rehearsal of the actual dependency gate, not a
deliberately broken source commit, recovery rehearsal, branch-protection audit
or proof that every possible administrator bypass is disabled.
Recovery and single collection-host verification remain separate work.

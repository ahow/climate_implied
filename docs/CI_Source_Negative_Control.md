# Deliberately broken source-commit control

Prepared before execution, 2026-11-10.

The existing workflow-dispatch failure injection is not the original requested
broken-source-commit control. A temporary, explicitly failing TypeScript test
will therefore be committed on the normal code-only source branch. No workflow,
approval rule, production data or collector setting changes.

Acceptance requires all of:
1. The source-validation job fails on that source revision.
2. Its promotion job is skipped.
3. `production-validated` remains at the pre-control revision.
4. The running build remains at that same pre-control revision.

The temporary test is then removed in a new commit (no history rewriting), and
the normal complete validation/promotion workflow must pass. This is a deployment
safety test, not climate or investment efficacy. Receipts are recorded after
execution; this document alone does not claim the control passed.

## Executed result

Source801120ba2f9822745d0c969f2b279f7b853dc52f, CI42804603247:
345tests,344passed, exactly1expected failure at the named source test.
Validation failed, promotion skipped. The validated branch and live runtime
both remained da140f272a058d093662530e48c66dbc2266c9dc.
See CI_Source_Negative_Control.json and its retained private logs.

The first attempt also exposed two source-only CI tests reading private receipts.
Those assertions remain mandatory in validate-clause-private-evidence.ts
(355assertions, no missing-file skips); CI verifies the public metadata contract.
The second control had only the intended failure. No gate was weakened.

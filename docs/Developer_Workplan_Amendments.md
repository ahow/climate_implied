# Developer workplan — binding amendments

Approved scope: user's 8 November 2026 request to implement the revised
18-stage workplan autonomously, with the corrections below. This document
amends the submitted “Climate Dashboard — Developer Work Plan”, revised
8 November 2026. It does not declare any stage complete.

## Execution

One evidence report per stage; deploy only coherent, tested increments.
Continue independent stages after a blocker. No routine approval pauses.
Never invent empirical results, original vintages, licences, independent
review, or financial identity approval. Existing scientific promotion gates
remain binding. A failed research hypothesis is a legitimate result.
An owner reproduction check is not independent scientific validation.

## Corrections incorporated before implementation

1. **Stage 0:** inventory actual privileged operations, not a fixed seven.
   Restrict public writes; keep provider-paid operations private. CI must
   prevent failed commits deploying, not merely report after deployment.
2. **Stage 2:** unknown lifecycle, not queried, provider error and awaiting
   review are explicit states. Analytical hashes exclude run timestamps and
   administrative identifiers. Numerical portability uses declared tolerances.
3. **Stage 7:** never-reaching members are right-censored, not replaced with
   an event in 2100. Unconditional quantiles beyond the observed horizon are
   null. Report conditional-on-reaching quantiles separately.
4. **Stage 8:** regional reports contain emissions, reduction rates, net-zero
   milestones and contributions to global warming; no standalone regional
   temperature.
5. **Stage 9:** forecast claims are restricted to validated variables/horizons.
   One-to-three-year emissions skill does not validate 2100 warming. Long-run
   temperatures remain conditional scenario projections.
6. **Stage 10:** report full-baseline identity and lifecycle resolution alongside
   coverage within verified-listed companies. Unknown status cannot inflate
   overall completion.
7. **Stage 11:** starting from reported operating cash flow, FCFE = OCF −
   capital expenditure + net borrowing. OCF already includes working capital;
   do not subtract its movement again. Starting from net income, FCFE = net
   income + non-cash charges − capex − increase in operating working capital
   + net borrowing. Cash-flow and interest classifications must be reconciled.
8. **Stages 11–12:** Gordon steady-state growth and five-year reverse-DCF
   growth are separate quantities. Compare projected and implied growth only
   on a shared definition, horizon, nominal currency basis and cash-flow model.
9. **D-8:** primary forecast-validity comparison uses completed three-year
   cash-flow growth on the common eligible sample; earnings/revenue are
   secondary. Report coverage separately. Reverse DCF replaces Gordon only
   when both primary forecast validity and validation signal IC improve with
   paired 95% intervals excluding zero. No retrospective rule changes.
10. **Stage 13 Tier 1:** produce scenarios only where a defensible
    valuation-to-activity mapping exists; otherwise unavailable is valid.
    Global expansion is optional and requires a justified coverage model.
11. **Stage 13 Tier 2:** robustness, event checks and narrow assumption ranges
    do not establish identification by themselves. Default label is
    “model-implied pathway consistent with valuations”. Stronger market-
    expectation claims require a separately evidenced identification argument.
    Show both threshold-set results in methodology, not just private reports.
    No coefficients or thresholds are invented to earn a label.
12. **Stage 14:** the paired improvement in evaluation R² must have a 95%
    interval excluding zero, as must IC and after-cost long–short performance.
    The primary family includes model × peer × target × all three success
    hypotheses; apply Holm across the full family. Freeze before scoring.
    “Supported” remains qualified as locked retrospective, revised-history
    research, not validated investment evidence.
13. **Stage 15:** specify gross/net exposure, borrow availability, borrow fees,
    financing and dividend liabilities. Missing borrow history permits only a
    hypothetical long–short research result with explicit sensitivities.
14. **Stages 16–17:** unavailable results must render normally. Remove warnings
    only after resolving the underlying limitation. Independent checks and
    production deployment must have their own evidence.

## Execution ledger

The implementation/test/release status of each stage is maintained in
[Developer_Workplan_Execution.md](Developer_Workplan_Execution.md). An existing
helper or passing synthetic test does not complete its real-data/UI stage.

| Stage | Scope | Essential completion evidence |
|---|---|---|
| 0 | Baseline and safety | regression baseline, privileged-route tests, single scheduler, CI deployment gate |
| 1 | Output register | all consumers and exports inventoried; unsupported defaults removed |
| 2 | Immutable inputs | migration/rollback rehearsal, old-run replay, concurrent version isolation |
| 3 | Driver registry | complete source/role/units/missingness census |
| 4 | Calibration | frozen fit protocol, actual holdout comparisons, fallback rules |
| 5 | Emissions ensemble | region/sector/gas reconciliation, overlap tests, convergence |
| 6 | Reference pathways | verified sources/licences, gas coverage, infill sensitivity |
| 7 | Climate response | independent reference, physical checks, coherent censored metrics |
| 8 | Attribution | additive accounts and within-model attribution error bounds |
| 9 | History/skill | audited vintages, frozen evaluation, horizon-specific claims |
| 10 | Company inputs | full denominator, evidence-reviewed identities, currency reconciliation |
| 11 | Valuation | cash-flow fixtures, reliable solvers, frozen paired model comparison |
| 12 | Company projections | matched financial definitions, worked companies, scope accounting |
| 13 | Identification | evidenced mappings, complete assumption registry, valid unavailable states |
| 14 | Signal research | paired distributions, frozen testing family, actual complete outcomes |
| 15 | Portfolio research | accounting, shorting assumptions, evidence tracks, real sensitivities |
| 16 | Integration | UI/API/export consistency, approval propagation, unavailable-state journeys |
| 17 | Acceptance | clean reproduction, owner checks, exact source/deployment reconciliation |

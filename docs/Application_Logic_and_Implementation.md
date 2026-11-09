# Current output controls

The [company accounting controls](Company_Accounting_Controls.md) document
required non-operating, attribution and other cash adjustments, actual sourced
financial controls and remaining climate-projection dependencies.

See [Output controls and full-stage regression](Output_Controls_Execution.md)
and the generated [system output register](System_Output_Register.md).
All spreadsheet downloads include evidence/interpretation notes; this does
not turn view exports into immutable archived analyses.

# Current amended workplan implementation

Latest numerical and operational evidence:
[Remaining workplan execution](Remaining_Workplan_Execution.md).

For automatic approval snapshots, completed-response storage/retrieval, corrected
legacy milestone terminology and their actual test results, see
[Automatic archival and result replay](Automatic_Archive_and_Result_Replay.md).

For the current all-stage implementation/test/conclusion matrix, see
[Workplan status and conclusions](Workplan_Status_and_Conclusions.md).

The latest implemented changes, empirical results and explicit remaining scope
are in [Workplan continuation results](Workplan_Continuation_Results.md).

The [sequential execution runner](Automated_Workplan_Execution.md) runs available
stage checks and data audits with saved progress. It does not implement missing
models or declare the full workplan complete.

See [workplan amendments](Developer_Workplan_Amendments.md) and the
[stage execution record](Developer_Workplan_Execution.md) for the 8 November
2026 increment. The 18-stage programme is **not complete**. Public HTTP writes
are restricted to authorized shell operations, legacy climate views are
opt-in, and new research utilities are diagnostics, not promoted models.

# Application logic, implementation and delivery sequence

Last reviewed: 6 November 2026.

## Five-workstream evidence pass

See [Remaining workstreams: results](Remaining_Workstreams_Results.md) for the
subsequent implementation, actual-data research and acceptance results.
Identity reviews now validate ISIN checksums; mapping collection is resumable;
`financial-review.ts refresh-approved` stages new proposals without automatic
approval or scheduler changes. Native-gas gaps have quantified diagnostic
sensitivities, not approved infills. Historical ensemble-window validation and
vintage-evidence auditing are exposed as stateless diagnostic endpoints.
Signal research supports date-block uncertainty and an explicitly non-certified
revised-history mode. Passing these diagnostics never changes the model's
promotion gates. Full mapping coverage and scientific/point-in-time certification
remain incomplete.

## Resumed implementation: current operational contracts

The implementation/test record is
[Implementation run results](Implementation_Run_Results.md). This section
supersedes earlier descriptions of these features as planned or blocked.
Scientific promotion remains separate from software implementation.

### Financial identities, review and calculation

- `server/financialData/identity.ts` validates evidence-backed security reviews,
  matches them to provider candidates and prevents duplicate issuer acceptance.
  `script/financial-coverage.ts` reconciles the entire input universe against
  currently approved review identities; unresolved securities remain eligible.
- `script/financial-review.ts stage <review.json>` checks the selected ISIN,
  exchange/share-class/currency with FMP/OpenFIGI, fetches a quote and last annual
  statement, then stages a proposal. It requires the actual workbook company ID
  and source-backed issuer/listing review. Keep review files outside Git.
- `server/financialData/reviewStore.ts` persists the additive financial_reviews
  journal. Approval/rejection runs through the authorized workspace CLI, not
  a public mutation API. PostgreSQL transactions, a transaction-scoped advisory
  lock, immutable IDs and terminal states make repeated decisions safe and
  prevent conflicting issuer approvals. New approvals supersede older ones.
- `server/financialData/review.ts` validates currencies/dates/finite values and
  derives a SHA-256 input identity independent of repeated fetch time.
  Price-to-last-annual-earnings = current issuer market capitalization divided
  by last reported annual net income. Non-positive income gives unavailable,
  not a zero-growth observation. This is not TTM P/E.
- `GET /api/financial-data/reviews` supplies the read-only Data Management UI.
  Quote observation time is separate from fetch time; no streaming/live label is
  used. The latest 200 reviews are returned. Original workbook financial/carbon
  histories are never overwritten. No new scheduler owner was introduced.

### Native emissions, FaIR and promotion

- `POST /api/emissions/validate-native-pathways` accepts the two-case schema in
  `nativePathwayContract.ts`. Units are native Mt gas/year, years are 2024–2100,
  and every stored inventory gas must be represented. CO2 energy/industry and
  land-use are separate. Both scenarios must match the same inventory within
  1e-6 relative numerical tolerance (absolute floor 1e-9 Mt). NDC-only cannot
  represent all announced commitments. Cumulative comparisons cover 2025–2100.
- `uv run python script/fair-reference.py --pathway <single-case.json>` replaces
  the reference template's future emissions using `fair_native_bridge.py`.
  Native mass units are explicitly converted to template units. Unsupported
  species or incomplete inputs raise errors; there is no aggregate CO2e shortcut.
  Pre-2024 template history is preserved, not claimed to be newly validated.
- The runner exports member-level annual temperature anomalies relative to
  1850–1900. `ensemble.ts` supplies the same median, quantiles, density and
  exceedance probabilities to all diagnostic consumers. No 1–5°C clipping or
  historical offset is added. `summarize-fair.ts` supports an aligned independent
  numerical comparison at <=0.01°C; source independence is a separate check.
- `POST /api/calculation/evaluate-holdout` uses a declared protocol, cutoff,
  baseline and tolerances to measure bias, MAE and interval coverage.
  Future inputs or contaminated training fail; revised history cannot certify
  a point-in-time forecast. `GET /api/calculation/readiness` exposes seven
  unpassed scientific/runtime gates. Explicit `engine=fair` requests fail with
  HTTP 409 rather than silently returning legacy output.

### Valuation, research and portfolios

- Missing required carbon scopes produce unavailable intensity; observed zeros
  remain zeros. Invalid P/E is not zero growth. Target annualisation requires
  an explicit base year and uses signed cumulative change; absent workbook
  base-year/boundary metadata leaves annualised comparisons unavailable.
  Legacy physical/carbon-price inference is labelled illustrative on finance
  pages; workbook currency compatibility is not presumed verified.
- `POST /api/calculation/evaluate-signal` runs one preregistered specification:
  controls-only versus controls-plus-candidate least squares on training data,
  incremental holdout MSE and 500 deterministic paired bootstrap resamples.
  It verifies supplied publication/outcome dates, not their external provenance.
  Independent-row bootstrap is not a substitute for time/sector robustness.
- `walkForward.ts` retains past-only risk scaling and now tracks post-return
  holdings drift, cash investment, traded notional and turnover.
  Cost fraction = traded notional × costBps / 10,000; net monthly return =
  (1 − cost fraction) × (1 + gross return) − 1. Net wealth compounds these returns.
  Initial investment is charged; a complete loss terminates the portfolio.
  `costBps=0..100` is supported by the API (default 10, an assumption).
  The UI reports net/gross cumulative returns, maximum net drawdown and turnover.
  Existing charts and tracking error remain gross. Missing-return liquidation,
  historical classification, corporate actions and survivor bias remain caveats.

Validation: `npx tsx --test script/*.test.ts`, `npm run check`, `npm run build`,
and `uv run python -m unittest discover -s script -p 'test_*.py'`.
The rollback-only database fixture is `npx tsx script/check-financial-review-db.ts`;
run it only against development. Source-only releases use
`bash script/release-source.sh` after an explicit reviewed commit.

This is the primary developer handover for the climate dashboard. Update it in
the same change as material changes to calculations, data flows, integrations,
assumptions or deployment. It describes **implemented behavior separately from
planned behavior**; a working deployment is not proof of scientific validity.

## 1. Purpose and interpretation

The application combines:

1. A global indicator-based emissions and warming projection.
2. Company valuation, climate-exposure and decarbonization comparisons.
3. Historical signal/portfolio comparisons.
4. Published climate references and news context.

The climate and finance models are exploratory. A market valuation difference
does not by itself measure an emissions reduction, and a common temperature
axis does not make finance and physical-model outputs scientifically comparable.
Do not describe the investment results as validated alpha.

## 2. Repository, hosting and current delivery status

- Current source: https://github.com/ahow/climate_implied (underscore).
- The hyphenated `ahow/climate-implied` is an older related implementation,
  not the current release target.
- Railway project: `climate-implied`; service: `dashboard`;
  environment: `production`; source branch: `main`.
- Working Railway URL: https://dashboard-production-4d39.up.railway.app/
- `climatetracking.live` was purchased through Replit. Custom-domain migration
  is deferred at the user's request and must not block analysis development.
  Adding a domain to Railway is not proof that its DNS/TLS cutover has completed.
- Railway initially uses the existing production PostgreSQL database; this is
  not a database migration. Do not replace it with an empty database.
- Railway's scheduler remains disabled during the hosting transition. Preserve
  the existing scheduler owner and never enable duplicate collection.

GitHub synchronization uses `script/sync-github.py`, not a push of workspace
history. It exports allowlisted source files and verifies the GitHub commit.
Workspace and GitHub commit hashes differ because this is a source export.
Uploads, raw research datasets, generated outputs and credentials are excluded.
GitHub `main` pushes trigger Railway deployment, so each push is a release event.
There is no continuous workspace-to-GitHub background synchronization job.

## 3. Implemented versus planned

| Area | Implemented now | Not yet implemented/validated |
| --- | --- | --- |
| Numerical foundations | Versioned contracts, Mulberry32 RNG, stable ordering, input-based cache identities, regression tests | Scientific validation of legacy mechanisms |
| Main climate dashboard | Legacy aggregate-emissions projection and temperature conversion | Validated native-gas/FaIR replacement |
| Candidate emissions workbench | Reconciled inventory, bounded diagnostic mechanisms, dated-input diagnostic, readiness warnings | Calibrated implemented-policies and all-commitments cases |
| Published references | CAT November 2025 current-policy and optimistic comparisons | References are not native-gas model inputs |
| NGFS research | Source assessment and raw/harmonized/infilled baseline adapter | Empirically selected harmonization, complete species/sector mappings and all-commitments coverage |
| FaIR | Pinned standalone reference runner | Application coupling, updated historical validation and production runtime |
| Company analysis | Workbook ingestion and legacy valuation/backtest calculations | Packages 5–7 corrections and validation |
| FMP | Bounded provider client, startup sample check, read-only Data Management status, OpenFIGI candidate audit | Accepted universe-wide matching, persisted refresh proposals and approval/apply UI |

The headline near 2.40°C is a legacy result, not an output of the candidate
inventory, CAT or the FaIR reference runner. It is not an immutable constant:
inputs, versions, seed and calculation path affect it.

## 4. Runtime architecture

| Layer | Main locations | Responsibility |
| --- | --- | --- |
| Frontend | `client/src/pages/`, `client/src/components/` | React/TypeScript pages, queries and charts |
| API | `server/routes.ts` | Express endpoints, validation and orchestration |
| Climate calculation | `server/calculation/` | Historical inputs, projections, scenarios and candidate model |
| Company analysis | `server/climateValuation/` | Workbook processing, valuation, signals and backtests |
| Collection/approval | `server/dataIngestion/` | Adapters, scheduled collection, proposals and approved overrides |
| News | `server/newsApi/` | NewsAPI.ai requests, analysis and caching |
| Contracts/database | `shared/`, `server/db.ts`, `server/storage.ts` | Drizzle/PostgreSQL definitions, types and caches |
| Offline research | `script/` | Inventory preparation, NGFS audits, FaIR reference runs and verification |

The frontend calls same-origin `/api/...` paths. Keep credentials on the server,
never in browser bundles. Application startup performs database readiness/setup
work; do not run a development process against production merely to test it.

### Principal routes

- `/api/health`: database-backed readiness, not scientific acceptance.
- `/api/calculation-contract`: current assumptions, identities and limitations.
- `/api/projection`: headline climate calculation; uses effective nowcast inputs.
- `/api/projection/categories`, `/regions`, `/sensitivity`,
  `/historical-trend`, `/categories/historical-trend`: related climate analyses.
- `/api/emissions/candidate?scenario=constant|transition|dashboard`:
  diagnostic gas-resolved workbench, not a production forecast.
- `/api/reference-scenarios`: pinned CAT references.
- `/api/data/indicators`, `/api/data/runs`, `/api/data/proposals/...`:
  collection visibility and approval.
- `/api/cv/...`: company upload, summaries, carbon-price comparisons,
  Decarb Gap and backtest endpoints.
- `/api/news/climate`: news analysis; absent month window defaults to 12.

See [API contract](API_Contract.md) and route code for exact request schemas.

## 5. Climate indicator flow

```text
Curated history + collected proposals
                       |
                  manual approval
                       |
              effective dated overrides
                       |
            history / estimated nowcast
                       |
             versioned calculation inputs
                       |
          legacy projections and API responses
                       |
                     charts
```

Collection remains on the existing monthly cadence with manual approval before
proposed values affect the model. Refreshing analysis is not approval and does
not download a new CAT release.

Nowcast estimates extend incomplete recent history using decaying momentum;
they are not measured observations. The main projection and category routes
currently have different baseline selection paths. The candidate diagnostic
uses effective 2024 values and 2023–2024 renewable additions, not the nowcast.
Baseline alignment is a planned correction, not a solved property.

An approved-input change must invalidate every applicable route, module/memory
and persisted cache. An outer indefinite cache can bypass an inner source TTL.
Never fix an apparent stale headline solely by changing display rounding.

## 6. Current climate calculation and its limitations

`forwardProjection.ts` samples uncertain inputs and produces sector-emissions
trajectories. The main run uses 10,000 iterations; related views may use smaller
ensembles. The RNG is **Mulberry32**, not the earlier LCG. Equal effective
inputs, model settings and seeds should reproduce results.

Legacy sector shares are power 0.269, industry 0.241, agriculture 0.171,
transport 0.144, buildings 0.096 and other 0.080. They are rounded assumptions,
not the candidate reconciled inventory.

Legacy mechanisms include renewable fossil-power displacement with diminishing
returns, EV fleet turnover, policy/corporate effects, economic intensity trends
and finance-related heuristics. These mechanisms are not all empirically
calibrated, and correlated effects can overlap.

The legacy temperature relationship has the form:

```text
warming = fixed warming offset + cumulative emissions × TCRE
```

The legacy offset is 1.1°C and central TCRE is 0.00045°C/GtCO2. Crucially, the
implementation accumulates an aggregate-emissions quantity labelled CO2e and
passes it through a CO2 response approximation. This is a known scientific
mismatch, not a valid conversion of all greenhouse gases to temperature.
Temperature summaries and density also use separate sampling paths rather than
a single coherent emissions-to-temperature ensemble.

Historical charts reconstruct past calculations using current methodology and
revised inputs; they are not archived forecasts. Regional intensity substitution
is not a territorial regional climate model. Category scenarios are input
shocks, not an attribution of independent category contributions.

## 7. Approved replacement approach

### Inventory and emissions

Use the approved IGCC 2025 update's 2024 inventory basis, approximately
56.8 ± 5.5 GtCO2e. Keep UNEP's 57.7 Gt estimate separately labelled.
Preserve native gas masses for physics and use AR6 GWP100 only for reporting.
The inventory includes gas and sector cells with explicit land-use treatment.

The candidate engine separates activity from residual efficiency, bounds EV
sales/fleet effects, models electricity demand and fossil displacement, and
requires explicit eligibility, timing and overlap for abatement measures.
EV electricity demand is charged to the power balance rather than counted again
through an additional well-to-wheel reduction.

The approved main case is **implemented policies**. The comparison is delivery
of **all announced commitments**, not an extra reduction added to the main case.
Legal target coverage and company counts alone do not identify delivered,
emissions-weighted abatement.

Classify indicators as mechanism inputs, validation measures or context. Do not
invent a causal coefficient simply to make every displayed indicator move the
temperature headline.

### Published references and pathway research

CAT November 2025 supplies separately labelled 2100 medians of 2.6°C
(current policies) and 1.9°C (optimistic commitments). These are CAT MAGICC7
results with their own assumptions; they neither tune nor replace the dashboard
temperature calculation. CAT data is restricted to attributed non-commercial
use; the user's analysis is non-commercial.

NGFS 5.1 has a March 2024 policy cutoff. Its NDC case must not be renamed
all-announced-commitments. Raw, harmonized and infilled series are separate
processing stages and must not be silently mixed.

`script/ngfs_pathway_adapter.py` checks gas units, interpolates without
extrapolation and preserves original/adjusted paths. Ratio scaling and a
converging land-use offset are diagnostic sensitivities, not approved central
calibration. Missing species are reported explicitly. In particular,
HFC-245ca is not HFC-245fa. Source extracts stay outside Git.

### Temperature and validation

The planned physical model is historically initialized FaIR with compatible
gas emissions, aerosol/other forcing and constrained parameter ensembles.
The existing pinned FaIR 2.2.4 runner is only a reference exercise.

Use the 2025 annual human-induced warming estimate of 1.37°C as a validation
target, not an extra warming offset. Distinguish it from decadal warming.
Carry coherent draws through emissions and climate response, then calculate
medians, intervals, density and probabilities from the same ensemble.

Validate reference cases, historical fits and hindcasts before default promotion.
Publish failed checks rather than tuning to a desired CAT headline. Report
near-zero as 5% of starting emissions, not literal net zero, and avoid presenting
an extrapolation beyond 2100 as a modelled result.

## 8. Company data and financial logic

The user identifies the uploaded workbook as MSCI/Refinitiv data. The importer
handles workbook sheets/fields including return indices, valuation time series,
`ISSUER_ISIN`, `SDG_07_NET_ALIGNMENT_SCORE` and
`TARGET_SUMMARY_CUM_CHANGE_2050`. Inspect actual sheets before changing mapping.
Do not require the user to reconstruct a large metadata dictionary.

`cv_companies` stores identifiers, classifications, an SDG score and a target
field. `cv_time_series` stores dated return indices, market cap, P/E, net profit
and Scope 1–3 emissions. Current company classifications and target fields are
not a historical-vintage database.

The legacy valuation transformation is:

```text
g = r - 1 / PE
```

Here `r` is a common cost of equity, default 8%. This is a Gordon-style heuristic
with strong payout/growth assumptions, not a measured expected growth rate.
Clean/dirty or peer comparisons transform differences into “implied
decarbonization” and related prices/temperatures. Those physical interpretations
are not validated.

For company Decarb Gap, the implementation compares transformed growth to a
peer median and subtracts it from a common physical projection. A common
projection shifts gaps but does not create a new within-peer ranking: the
ranking is driven by relative earnings yields.

The November 2026 statistics repair calculates the summary mean and median
from these company-level values, not the separate SDG clean/dirty aggregate.
Historical quartiles now describe the cross section at each date, not the
distribution of aggregate values over the entire time series. These are
descriptive statistics, not uncertainty intervals or validated physical rates.
Valid high P/E values are retained; nonfinite and invalid positive-profit
fallback ratios are excluded. Other legacy finance limitations remain.

The legacy finance temperature conversion assumes exponential emissions decline
and applies a separate aggregate-to-TCRE approximation. The reduction-to-price
lookup is illustrative, not an empirically identified carbon-price curve.

Planned corrections retain useful value comparisons while qualifying unsupported
climate claims; preserve signed profits; handle unavailable P/E, zero
denominators and outliers explicitly; reconcile units/currencies; and calculate
target progress only where target definitions permit it.

### Historical portfolios

The API now uses `walkForwardBacktest.ts` and the pure `walkForward.ts` risk/
portfolio component. Risk scaling uses past realized unit-tilt returns only,
with a 12-observation benchmark warm-up and a tilt cap of 5. Series points expose
their actual tilt; the UI reports the latest tilt and initial training window.
The old full-sample optimizer remains explicitly named as a legacy comparison,
not the API implementation. Returns are still gross of costs.

Monthly returns require adjacent months and preserve genuine extremes/total
losses. Value/carbon signals use prior-quarter observations. SDG/target backtests
are unavailable where historical classifications are absent, instead of
backfilling today's classifications. These repairs do not supply missing
publication dates, security histories or corporate-action evidence.

The backtest needs explicit information-availability dates, historical
classifications/universe membership, correctly aligned returns and training-only
risk fitting. A date attached to an accounting period is not a publication date.
Today's emissions/SDG classifications cannot silently be backfilled as if known
at every past rebalance.

Missing histories do not block arithmetic repairs. They do block claims that
a backtest is point-in-time or survivorship-free. Keep those limitations visible.

## 9. FMP integration boundary

The Replit secret is named `FMP_API_KEY`; never commit its value or expose it to
the client. Sample AAPL requests succeeded for `quote`, `income-statement`,
`esg-ratings` and `esg-disclosures`. This checks sample access, not all exchanges,
all company coverage, latency guarantees, licensing or unlimited quota.

Income statements provide currency, accounting period and filing/acceptance
dates. The sampled ESG endpoints provide scores/ratings, not Scope 1–3 emissions.
FMP ESG scores must not silently replace MSCI SDG alignment or carbon quantities.

**Not active:** there is no approved-company FMP refresh integration yet. A stored key
does not make prices live. On 6 November 2026, Railway's `FMP_API_KEY` variable
presence and successful deployment were verified after the user added it.
Subsequently, the deployed diagnostic endpoint returned `state: verified`,
confirming the bounded FMP sample requests also succeeded from production.

The diagnostic implementation now exposes `/api/financial-data/status`. Startup
performs three fixed-symbol sample requests once per process; public GETs only
read the status. Data Management displays quote observation time separately
from check time and explicitly states that approved company records are unchanged.
`script/audit-financial-mappings.ts` is an operator-only bounded mapping pilot,
not a public paid-data proxy or an approved issuer merge. See
[autonomous results](Autonomous_Implementation_Results.md) for measured coverage.

Set the same key through Railway's secure Variables UI:
project `climate-implied` → service `dashboard` → environment `production` →
Variables → `FMP_API_KEY`. Do not paste it into chat, documentation or GitHub.
The available MCP variable tool accepts literal values but has no secure
Replit-secret reference/transfer operation. Do not retrieve the secret into a
tool result merely to copy it. A Replit secret reference is not a Railway
shared-variable reference.

Planned ingestion:

1. Resolve company/security identifiers with OpenFIGI as a supporting mapping
   source, preserving issuer, share-class and listing distinctions. Cross-check
   the selected FMP symbol, exchange and quote currency; quarantine ambiguous
   matches instead of joining on company name. See the detailed
   [matching acceptance criteria](Implementation_Success_Criteria.md).
2. Fetch financial/pricing fields server-side with timeouts, bounded requests,
   cache/freshness rules and quota-aware error handling.
3. Retain field source, fetched time, financial period, publication date, units
   and currency. Keep raw versus adjusted prices distinct from total returns.
4. Stage compatible updates for review without overwriting workbook history or
   carbon fields. Preserve existing approved values on failed/partial refreshes.
5. Add review/apply behavior and visible last-updated/source/error states.
6. Enable refresh under the existing approval model and a single scheduler owner.

Current prices must not be substituted for historical prices in a backtest.
Unknown profit currency must not be combined with market cap in another currency.

## 10. Ordered implementation and production release sequence

The [step-by-step success criteria](Implementation_Success_Criteria.md) define
measurable acceptance checks, required evidence and failure outcomes for all
ten steps. They are requirements, not statements that the steps already passed.

No routine approval pauses are required. Each numbered step is a separately
verified release; it may expose diagnostics before a replacement is ready.
Missing DNS access is not a dependency for any step.

| Step | Deliverable | Completion gate |
| --- | --- | --- |
| 1 | This handover, roadmap and release discipline | Files present on GitHub; matching Railway commit succeeds |
| 2 | FMP secure configuration, identifiers and server-side adapter | Production credential present; representative identity/currency mappings and failure cases checked |
| 3 | FMP staged refresh and review/apply UI | Preserve workbook/carbon data; explicit stale/error states; approval/cache behavior verified |
| 4 | Finish Package 2 inventory/pathway calibration | Complete compatible gas/sector coverage, delivery/overlap assumptions, agreed two scenarios and before/after acceptance report |
| 5 | Package 3 FaIR coupling and uncertainty | Historical/reference benchmarks; coherent ensemble; explicit failures; production runtime provisioned |
| 6 | Package 4 historical evaluation and dashboard promotion | Hindcasts/holdouts, aligned baselines and metrics, API/UI/export agreement |
| 7 | Package 5 valuation correctness | Invalid/missing/negative/currency/target fixtures; honest units and labels |
| 8 | Package 6 climate-signal research | Independent incremental evidence or explicit no-go; no guaranteed alpha |
| 9 | Package 7 backtest repairs | Point-in-time controls where data permits, portfolio/cost fixtures, walk-forward evaluation and disclosed limitations |
| 10 | Final production reconciliation and handover | Deployed/source identity, critical flows, documentation and open limitations agree |

FMP preparation is a new supporting workstream ahead of the remaining packages;
it does not itself complete Package 5. A secret-access issue must not stop
repairs using existing data. Scientific gates must not be bypassed merely to
finish a numbered step.

## 11. Verification and release protocol

For every completed implementation step:

1. Update this file and the relevant detailed methodology/status document.
2. Run changed-area tests plus applicable regression tests and production build.
   Use browser testing for materially changed data-writing/approval journeys.
3. Record before/after results for changed calculations; keep private captures
   and source extracts outside the public repository.
4. Commit reviewed changes and run `python script/sync-github.py`.
5. Confirm the exported GitHub `main` SHA; inspect Railway's deployment for that
   exact SHA. `BUILDING` is not success.
6. Confirm Railway `SUCCESS`, health and changed production read-only behavior.
   Never test destructive writes against the shared production dataset.
7. Report what changed, what was deployed and what remains unvalidated.

Railway uses explicit Node 22 via `railpack.json`, then tests and `npm run build`,
and starts with `npm run start`. Root Python research manifests previously
caused incorrect runtime detection. Future runtime FaIR integration must
explicitly provision Python or use an appropriately designed execution boundary.

Useful current checks:

```sh
npx tsx --test script/news-request-options.test.ts script/reference-scenarios.test.ts script/emissions-candidate.test.ts script/calculation-foundations.test.ts script/priority1.test.ts
python -m unittest discover -s script -p 'test_ngfs*.py' -v
npm run build
npm run check
```

Previous verification recorded existing upload/schema TypeScript failures;
do not equate a successful build to a clean type check. Reassess the current
diagnostics when changing those paths. Node-only Railway checks do not execute
the offline Python audit tests.

Do not run `db:push` against production as a convenience. Review schema changes
for preservation of existing data. No database/secret copies belong in Git.
Broad authentication/provenance work remains outside the agreed calculation
scope; this does not certify the existing public write endpoints as secure.
Do not expose an unrestricted public FMP proxy or paid refresh endpoint.

## 12. Supporting documents and maintenance

- [Calculation foundations](Calculation_Foundations.md)
- [Approved scientific basis](Climate_Model_Remediation_Basis.md)
- [Package 2 workbench](Package_2_Emissions_Review.md)
- [NGFS compatibility assessment](NGFS_Pathway_Compatibility_Assessment.md)
- [CAT references and licence](CAT_Reference_Scenarios.md)
- [Continuation findings](Remediation_Continuation_Status.md)
- [Railway operations](Railway_Hosting.md)
- [Legacy detailed methodology](Climate_Tracking_Dashboard_Documentation.md)
- [Member analysis and currency handling](Member_Analysis_and_Currency_Execution.md)
- [Regional and company operating engines](Regional_and_Company_Engine_Execution.md)
- [Electricity demand calibration and source transition](Electricity_Demand_Calibration_Results.md)

When behavior changes, update the status table, affected equations/data flow,
source/assumption version, tests and roadmap gate. Do not silently rewrite
historical comparisons. Distinguish planned, diagnostic, deployed and validated
states. A future developer should be able to tell which engine produces every
headline without relying on chat history.

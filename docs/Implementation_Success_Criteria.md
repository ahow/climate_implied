# Implementation success criteria

Defined 6 November 2026. These are acceptance gates, not claims that the
remaining steps have passed. Read with
[Application logic and implementation](Application_Logic_and_Implementation.md).

## Common definition of completion

Each step needs:

1. The implemented behavior and its limitations documented.
2. Relevant automated tests and build passing; any existing unrelated failures
   listed explicitly rather than represented as a clean check.
3. Source exported to GitHub, with the exact remote SHA recorded.
4. Railway `SUCCESS` for that SHA and a passing production health check.
5. Evidence for the step-specific gate below. For data-writing workflows,
   exercise a development/staging fixture, never destructive production tests.

Use **not started**, **in progress**, **deployed diagnostic**, **passed** or
**blocked**. A deployed diagnostic has not passed scientific acceptance.
A step with documented missing data is not automatically a pass.
Step 8 can pass by reaching a well-supported no-go research conclusion.

Maintain a release acceptance record containing: step, date, input/model
versions, fixtures/evaluation periods, results, unresolved limitations,
exported GitHub SHA, matching Railway deployment ID and health result.
Keep source datasets and sensitive evidence outside Git; publish aggregate
findings and reproducible test instructions where redistribution is permitted.

## 1. Documentation and release discipline

**Success factor:** another developer can trace a displayed result to its
inputs, equation, source code, assumptions and deployed version.

- Every major module is documented: climate, candidate pathways, finance,
  backtesting, collection/approval, news and external financial data.
- Current versus planned behavior is explicit, with no claims that the candidate
  model or FMP refresh is already driving the headline.
- README links resolve; named code entry points exist.
- The release record ties the GitHub commit to a successful Railway deployment.
- Documentation changes accompany subsequent changes to logic and data flows.

**Evidence:** reviewed handover, link checks and deployment identity.

## 2. FMP/OpenFIGI configuration and security matching

**Success factor:** accepted FMP records refer to the intended securities and
issuer, rather than merely a similarly named company or ticker.

- Railway has the FMP credential and a server-side production smoke request
  succeeds without logging credentials. Variable existence alone is insufficient.
- Account for 100% of the existing input identifiers as accepted, ambiguous,
  unmatched or explicitly out of scope; counts reconcile.
- Operational coverage target: accept at least 95% of eligible input security
  records by count. Freeze eligibility rules and publish the denominator before
  measuring coverage; do not remove difficult records to inflate it.
- If coverage is below 95%, retain the working legacy values and report a
  restricted pilot, not completion of universe-wide refresh.
- Zero unresolved ambiguous matches are automatically accepted.
- All accepted matches retain the original identifier, issuer linkage,
  security/share-class/listing identifiers where supplied, FMP symbol, exchange,
  currency, matching evidence, source and resolution date.
- Tests cover identical tickers on different exchanges, dual listings, multiple
  share classes, ADRs, missing matches and delisted securities. All pass.
- Audit at least 50 accepted mappings (or all if fewer), stratified across
  exchanges and available edge cases, with zero unexplained errors. Fix and
  rerun affected matching rules if errors occur. This sample is not proof that
  every record is correct.
- Repeating the mapping job creates no duplicate accepted identities.

### OpenFIGI design

Use original ISINs with OpenFIGI `/v3/mapping`, rather than fuzzy company-name
matching as the primary join. Apply exchange/MIC, currency and security-type
constraints where reliable source information exists. OpenFIGI output supplies
candidates; cross-check the selected listing against the FMP record.

Keep these levels distinct:

- **Issuer/company:** operating entity to which consolidated profits/emissions
  belong; use evidenced issuer relationships, not a ticker or FIGI as a universal
  company ID.
- **Share class/security:** legally/economically distinct instruments. A
  `shareClassFIGI` does not merge different classes into an issuer.
- **Composite/listing:** `compositeFIGI`, instrument `figi`, exchange and
  provider-specific trading symbol identify different levels of market data.
  Do not treat a composite identifier as a global issuer identifier.

Multiple listings must not duplicate consolidated issuer emissions, profit,
revenue or issuer-level market capitalization in aggregates. Distinguish an
issuer-level market-cap field from class-level capitalization before summing.
ADRs require evidenced underlying relationships and ratios; do not assume
ordinary-share prices or shares outstanding are interchangeable.

Preserve existing workbook links during any additive mapping/schema change.
Identifier effective dates matter for historical joins: today's mapping does
not establish past identifier validity.

OpenFIGI's API is public and supports unauthenticated requests at lower limits.
An account-specific API key raises limits; there is no universal public key
needed to start. Respect rate-limit headers and `Retry-After`, cache results,
and keep any supplied key server-side.

For historical coverage, explicitly consider `includeUnlistedEquities: true`;
listed-only defaults can hide delisted instruments and worsen survivor bias.
This option does not by itself supply a complete historical security master.

Source: https://www.openfigi.com/api/documentation (checked 6 November 2026).
Provider endpoint schemas/rate limits must be rechecked when implementing.

## 3. FMP staged updates and approval

**Success factor:** current financial data can be refreshed and approved without
silently changing carbon data, historical observations or company identity.

- One complete fixture journey passes: fetch → proposal → review → approve →
  changed approved value in API/UI → recalculation with a new input identity.
- Rejecting a proposal leaves approved values unchanged.
- Repeated imports/approvals are idempotent; a failed batch cannot partially
  overwrite the approved dataset.
- Existing MSCI/Refinitiv carbon, SDG and target fields are unchanged by a
  financial-only refresh, verified by before/after field comparisons.
- Accepted fields carry source, currency/unit, financial period, observation
  time, publication/acceptance date where available, and fetch time.
- Quote age is displayed separately from fetch time. A stale response is never
  labelled live; freshness follows a documented market/session-aware policy.
- Invalid keys, 429s, timeouts, missing symbols and partial responses produce
  explicit status and preserve the last approved values.
- At most one scheduled job owns each refresh; concurrent retries cannot apply
  the same batch twice. Respect the established approval process.
- No public unrestricted paid-API proxy is introduced.

**Evidence:** integration tests, one approval-flow browser check against safe
fixtures, aggregate preservation checks and read-only production verification.

## 4. Package 2: inventory and emissions pathways

**Success factor:** both agreed scenarios use a reconciled starting inventory
and defensible gas/sector mechanisms, without double-counted reductions.

- Native gas/sector sums reconcile to the source within its declared rounding
  precision; numerical accounting fixtures use a predeclared tolerance.
- Both scenarios have the same 2024 starting inventory: implemented policies
  versus delivery of announced commitments, correctly labelled.
- Every required gas has a sourced pathway or an explicit, justified infilling
  method with sensitivity analysis. No unexplained omission or zero filling.
- Activity, efficiency, technology, policy and corporate-delivery assumptions
  have documented scope, units, dates, bounds and overlap rules.
- All mechanism fixtures pass: no mechanical EV reversal, no horizon-dependent
  earlier path, no impossible fossil-power displacement, no duplicate abatement.
- Signed land-use/removal CO2 is preserved where physically meaningful;
  inappropriate negative non-CO2 emissions are rejected.
- Publish matched 2030/2050/2100 emissions and cumulative comparisons, explaining
  inventory, pathway and assumption effects separately.
- NDCs are not relabelled all commitments; CAT totals are not uniquely
  decomposed into gases without a defensible method.

**Evidence:** reconciled inventory report, scenario manifests, mechanism tests,
source/infilling assessment and before/after table. Plausibility alone is not
validation, and matching CAT's headline is not an acceptance test.

## 5. Package 3: FaIR and uncertainty

**Success factor:** temperature outputs come from coherent, historically
initialized gas/forcing pathways rather than aggregate CO2e and an added offset.

- Match an independently specified reference run with the same inputs and
  parameter ensemble. Engineering target: maximum annual temperature difference
  ≤0.01°C; document any source-specified stricter tolerance before execution.
- Verify units, historical spin-up, reference period and gas/aerosol coverage.
- Compare recent human-induced warming against the published estimate and its
  uncertainty, not an exact point target to which the model is tuned.
- The same output ensemble produces the headline, quantiles, density and
  probabilities; quantile and probability fixtures reconcile numerically.
- No added historical warming offset, hidden 1–5°C clipping, or silent legacy
  fallback remains in the new calculation.
- Perturbing emissions has the expected response in controlled experiments.
- Railway can execute the new runtime within a declared timeout/resource
  budget; dependency or model failures return explicit errors.

**Evidence:** versioned independent benchmark, numerical comparison, ensemble
consistency tests and production runtime smoke check.

## 6. Package 4: evaluation and default promotion

**Success factor:** corrected results are consistent throughout the application
and historical evidence supports their promotion over the legacy model.

- Freeze historical evaluation origins, permitted information, holdouts,
  metrics and acceptance tolerances before fitting or selecting a model.
- Include 2015 and later origins wherever appropriate source vintages exist.
  Revised-history reconstructions are evaluated/labeled separately.
- Compare gas/total emissions bias and absolute errors against persistence and
  a simple trend baseline, with interval coverage where meaningful.
- Require no deterioration beyond the predeclared practical tolerance against
  the chosen baseline on primary holdout metrics. Report failures and retain
  diagnostic status rather than changing the evaluation after seeing results.
- Main/category/scenario routes use identical baseline rules for matched runs.
- Headline, charts, exports and historical/scenario pages agree on units,
  forecast horizon, scenario identity and near-zero definition.
- Adding a later observation cannot rewrite an earlier point-in-time forecast.
- Preserve a before/after comparison and an identifiable legacy rollback path.

**Evidence:** predeclared evaluation protocol, holdout report, consumer
consistency tests and checked production views. Insufficient historical vintages
limit validation; they cannot be disguised as successful real-time hindcasts.

## 7. Package 5: valuation integrity

**Success factor:** each displayed financial metric has one defensible equation,
unit and meaning, with invalid data producing an explicit unavailable result.

- Hand-calculated fixtures pass for positive/negative profits, zero/missing
  P/E, zero denominators, outliers, currency mismatch and target base years.
- Missing observations never become false zero-growth companies.
- Company counts, exclusions and raw/adjusted aggregation totals reconcile.
- Common climate-projection changes leave within-peer value rankings unchanged
  where algebra requires that result.
- Target progress uses comparable boundaries and actual base/target years or
  is unavailable with a reason.
- Means, medians and percentiles match the promised population.
- Unsupported physical-temperature/carbon-price interpretations are removed or
  explicitly identified as illustrative heuristics throughout API/UI/export.

**Evidence:** synthetic accounting fixtures, regression comparisons and
consistent labels; currency compatibility is checked, not presumed.

## 8. Package 6: distinct climate-signal research

**Success factor:** reach a reproducible evidence-based go/no-go decision, not
necessarily produce a new investment signal.

- Define the intended quantity and candidate specifications before evaluation.
- Use transparent value, sector and emissions-intensity comparators and relevant
  conventional controls.
- Separate training/model selection from holdout evaluation and record the
  number of specifications tested.
- Measure incremental performance/association, uncertainty and stability across
  time/sectors using predeclared practical and statistical criteria.
- **Go:** criteria pass and economic interpretation is defensible.
- **No-go:** evidence does not support a distinct signal; retain transparent
  value comparisons and descriptive climate data without relabelling them.
- **Blocked:** suitable historical evidence is unavailable; this is not a go
  or a scientifically established no-go.

**Evidence:** reproducible research protocol, holdout results and explicit
decision with limitations. Guaranteed alpha is not a success requirement.

## 9. Package 7: historical portfolio accounting

**Success factor:** results can be independently reproduced without known
look-ahead or accounting errors, with data limitations visible.

- Hand-calculated fixtures reconcile weights, cash, trades, returns and costs.
- Zero-cost settings recover gross returns; costs reconcile to turnover.
- Perturbing future publications/returns cannot change earlier holdings.
- Risk/tilt estimation uses training history only.
- Missing months, dividends/corporate actions and delisting cases are explicitly
  handled; genuine extreme returns are not arbitrarily clipped.
- Historical classifications and universe membership use dated evidence where
  available. Missing history is reported, not invented.
- Report gross/net returns, drawdown, turnover, tracking error and uncertainty.
- Repair and regression-test the previously failing endpoint settings.

**Evidence:** portfolio fixtures and walk-forward report. A restricted
survivor-only/reconstructed-history analysis may be released with limitations,
but does not pass the stronger point-in-time, investable-backtest claim.

## 10. Final production reconciliation

**Success factor:** the deployed application, source and developer documentation
tell the same story, with no unresolved critical correctness issue hidden.

- All prior steps have acceptance records; any no-go or limited-data outcome is
  visible and reflected in enabled features and claims.
- Verify the production SHA, health, changed read-only APIs and critical UI
  journeys; use safe fixtures for write-flow validation.
- Effective input/model versions, data freshness and error states are visible.
- Confirm one scheduler owner and no unintended source-data loss or duplicated
  issuer aggregates.
- The handover describes the actual default engines and FMP integration state.
- A new developer can follow the documented setup/tests and locate calculations,
  configuration and known limitations without relying on chat history.

**Evidence:** final acceptance matrix, release record and maintained handover.

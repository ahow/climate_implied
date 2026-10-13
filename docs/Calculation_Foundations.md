# Calculation foundations — Package 1

## Scope

Package 1 establishes numerical/reproducibility foundations only. The emissions,
temperature, valuation and backtest models are still legacy research models.
No gas-resolved inventory, FaIR integration, revised sector mechanism, calibrated
valuation inference or point-in-time backtest is claimed complete here.

Collection cadence, manual approval behavior and uploaded data are unchanged.

## Contracts

`shared/calculationContract.ts` defines versioned legacy physical and finance
assumptions separately, explicit unavailable quantities, observation/forecast/
information-availability dates, native gas versus CO₂e types, GDP/currency
conventions and finance target metadata.

Unknown conventions are reported as unknown—not asserted to be AR6-GWP100,
PPP or a single currency without reconciliation. Future native-gas contracts
are definitions, not a claim that the current engine consumes native gases.

`GET /api/calculation-contract` publishes the currently implemented definitions
and deferred scientific work. `GET /api/projection` includes a `calculation`
object with input identity, seeds, run count and warnings. Existing response
fields remain compatible with the dashboard. Projection and finance reads
carry calculation-version and effective-climate-input revision headers.

## Reproducibility

The RNG is Mulberry32 with integer multiplication and an open-interval midpoint
mapping. Normal sampling guards against log(0). Emissions accept an explicit
seed; existing default seed formulas remain documented in response metadata.
The known repeated parameter-draw cycle is tested.

All finite required indicator inputs and valid horizons/run counts are checked
at the emissions calculation boundary. This does not remove every legacy
financial missing-data fallback; those semantics are Package 5 work.

Company/time-series inputs are stably ordered before carry-forward and
aggregation. Latest-row selection explicitly sorts. Equal signal ranks use
company ID as the deterministic tie-breaker; this characterizes existing rank
semantics rather than introducing a new tie-averaging model.

## Caches

Calculation identities hash canonicalized effective inputs, settings, contract,
RNG and assumption versions. Row inputs are sorted before hashing.

- Projection route and memory caches include the effective historical/nowcast
  revision; content changes clear route/memory/persisted projection caches.
- Each route tracks its own revision, including asynchronous regional output,
  while retaining the regional freshness TTL.
- Finance-derived carbon-price caches fingerprint loaded company/time-series
  inputs and all calculation settings. Full responses use the existing JSONB
  calculation cache without a schema migration. The old REAL-column finance
  cache is no longer read/written by this calculator because it rounds computed
  values to float32 and changes warm-cache results.
- A reduced finance projection cannot populate the full headline cache.
- Memory cache size is bounded.

Future mechanism changes must increment the appropriate assumption/engine
version, not merely change code while leaving its declared version unchanged.
Input-content changes automatically change identities.

## Fixtures and checks

Run:

```sh
npx tsx --test script/calculation-foundations.test.ts script/priority1.test.ts
npm run build
```

Synthetic/public-number fixtures and golden legacy outputs are in
`script/fixtures/`. They include 2024/2030/2050/2100 emissions, temperature
statistics, gap scores, monthly returns, representative backtest settings and
zero/2% financial conversion checks. They contain no uploaded company rows.

Tests cover seed repeatability/diversity, normal-sampling safety, input errors,
stable ordering and tied ranks, finite full-horizon results, hand-computed
synthetic returns, explicit unavailable values and input/settings/version cache
invalidation. They are characterization/regression tests, not hindcasts or
evidence of investment performance.

The development before/after snapshots are kept outside Git under
`generated-artifacts/calculation-baselines/`. To capture:

```sh
npx tsx script/capture-calculation-baseline.ts generated-artifacts/calculation-baselines/capture.json
```

Snapshots capture effective development inputs and response hashes, not a
production database snapshot or a claim about the deployed version.

## Release limits

The corrected random sequence can move numerical summaries. Do not retune
scientific constants to preserve the old headline. Report matched before/after
results and carry the same effective inputs into subsequent package comparisons.

Temperature still resamples median cumulative emissions using separate summary
and PDF draws. Aggregate CO₂e still enters legacy TCRE. Known mechanism,
threshold, currency, classification and backtest limitations remain until their
respective packages. New metadata explicitly says characterization-only.

## Verification and matched development comparison

Package 1 verification:

- 19 numerical/API-contract regression tests passed.
- Production build succeeded (existing large-bundle warnings remain).
- Development workflow restarted successfully; dashboard screenshot confirmed
  rendering and no browser error was reported.
- Repeated projection responses matched exactly.
- Finance cold/warm cache responses matched exactly across 187 calculation dates
  after switching the cache representation to JSONB.
- Type checking still reports eight pre-existing errors in upload/schema typing.
  The baseline had eleven errors; no new type errors were introduced. Build
  success is not being represented as a clean type check.

With exactly matching effective indicator inputs and 10,000 emissions runs:

| Development metric | Before | After |
|---|---:|---:|
| Median 2100 warming, °C | 2.4077093025 | 2.4011521377 |
| First-decade compound decline, %/year | 2.4933804891 | 2.4884828019 |
| Starting legacy emissions, GtCO₂e | 65.8420627434 | 65.8383528165 |
| 2100 legacy emissions, GtCO₂e | 27.6139543840 | 27.6126029051 |

This is a numerical before/after comparison, not inventory reconciliation or
scientific validation. The changed RNG explains the climate-output differences;
the emissions/temperature assumptions were not recalibrated.

To exercise live development cache equality without exposing company rows:

```sh
npx tsx script/check-calculation-api.ts
```

The finance part requires a completed development workbook and may populate
derived GET-response caches. No source data are modified.

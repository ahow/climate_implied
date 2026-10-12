# Finance API contract

## Backtests

`GET /api/cv/backtest`

| Parameter | Contract |
|---|---|
| `signal` | `carbon_intensity` (default), `sdg_exposure`, `decarb_ambition`, `decarb_gap` |
| `trackingError` | Finite number greater than 0 and at most 20, **percentage points**, default `2` |
| `trackingErrorUnit` | Optional; only `percent` is accepted |
| `method` | For Decarb Gap: `absolute`, `sector_relative` (default), `sub_sector_relative`, `industry_relative`. For other signals: only `absolute` (default) |
| `geography` | Optional company geography filter; omit or use `all` for all available companies |
| `format` | `summary` (default): `{series, summary}`. `series`: legacy array only |

Blank, duplicated, non-finite, partially numeric and out-of-range inputs are rejected with HTTP 400. A requested unsupported method is rejected, not silently ignored. `strategy` and `costOfEquity` are not supported on this route.

### Complete examples

```text
/api/cv/backtest?signal=carbon_intensity&method=absolute&trackingError=2&trackingErrorUnit=percent
/api/cv/backtest?signal=sdg_exposure&method=absolute&trackingError=2
/api/cv/backtest?signal=decarb_ambition&method=absolute&trackingError=2
/api/cv/backtest?signal=decarb_gap&method=sector_relative&trackingError=2
/api/cv/backtest?signal=decarb_gap&method=absolute&trackingError=0.02&trackingErrorUnit=percent
```

The last example intentionally targets **0.02%**, not 2%. There is no automatic unit detection.

### Response

- `series`: monthly observations. Return fields and `trackingError` use decimal units; cumulative fields are wealth multiples. Series TE is annualised population standard deviation across all included months to date, not a trailing fixed window. It is zero for the initial periods with fewer than three observations.
- `summary.signal`, `summary.method`: effective signal and grouping.
- `summary.targetTrackingErrorPct`: requested annualised TE, percentage points.
- `summary.realizedTrackingErrorPct`: unrounded, full-period annualised TE, percentage points; `null` if fewer than three periods.
- `summary.tiltScale`: actual tilt used by the engine, or `null` when no portfolio was calculated.
- `summary.calibrationPeriod`: start/end month and number of observations, or `null` for no data.
- `summary.calibrationStatus`: `within_tolerance`, `outside_tolerance`, or `insufficient_data`.
- `summary.calibrationBasis`: `full_sample_ex_post`.
- Unit/window fields and `warnings` describe the interpretation and limitations.

The engine's existing binary-search calibration and return calculations are unchanged. It may not reach the target; inspect realised TE and status. A zero-risk probe uses its existing unit tilt and reports the resulting mismatch rather than claiming success.

**Migration:** clients previously consuming a bare array must read `response.series`, or explicitly request `format=series`. Use the default response for calibration metadata. Dashboard consumers have been updated.

The former UI label “Valuation-Aware” maps to `signal=decarb_gap`. No independent valuation-aware strategy exists. Other signals use pooled ranking regardless of valuation grouping elsewhere on a dashboard page.

## Carbon prices and datasets

1. Request `GET /api/cv/uploads`.
2. Select and retain the numeric `id` of an upload whose `status` is `completed`.
3. Supply that ID and an explicit method:

```bash
# BASE_URL is the application origin; UPLOAD_ID is selected from the completed uploads.
curl --fail "$BASE_URL/api/cv/uploads"
curl --fail "$BASE_URL/api/cv/carbon-price?uploadId=$UPLOAD_ID&method=sector_relative&inferenceMethod=carbon_intensity&includeScope3=false&winsorize=true&winsorizePercentile=5"
```

`uploadId` must be a positive 32-bit integer (at most 2,147,483,647). Missing/malformed parameters return 400, unknown uploads 404, and unfinished/failed uploads 409. `method` is required: `absolute` or `sector_relative`.

Optional parameters: `inferenceMethod` (`carbon_intensity`, `climate_revenue`, `decarbonization_ambition`; default `carbon_intensity`), `includeScope3` (default `false`), `winsorize` (default `true`), integer `winsorizePercentile` (1–49, default 5), and `geography`. Boolean values must be `true` or `false`. The cost of equity is fixed at 0.08; passing `costOfEquity` is rejected.

**Reproducibility limitation:** the upload ID is a cache namespace, not an immutable dataset snapshot. Cache misses use current shared company/time-series tables. Other finance endpoints also use those shared tables. Explicit IDs make requests identifiable but do not by themselves preserve older figures. Retain responses, inputs and code versions for citations; immutable snapshots are separate planned work.

## Cost of equity

These routes accept `costOfEquity`, default `0.08`, strictly greater than 0 and at most 1:

```text
/api/cv/sdg-growth?costOfEquity=0.07
/api/cv/sdg-growth?costOfEquity=0.09
/api/cv/decarb-terciles?method=sector_relative&costOfEquity=0.08
/api/cv/decarb-gap/summary?method=sector_relative&costOfEquity=0.08
/api/cv/decarb-gap/timeseries?method=sector_relative&costOfEquity=0.08
```

Decarb terciles and gap routes support the four peer-group methods listed above, defaulting to `sector_relative`; invalid methods return 400.

Uniform cost of equity cancels in `g_clean − g_dirty` and company-minus-peer-median growth. Absolute growth changes at 7%, 8%, 9%; differential-derived rates and temperatures do not, with the same inputs and eligibility. This is an algebraic property, not a validation of the assumed discount rate.

`/api/cv/decarb-bands` does **not** use cost of equity: it selects the target-rate band with the highest aggregate P/E and converts its midpoint. Supplying `costOfEquity` returns 400 rather than suggesting a sensitivity that is not implemented.

## Publication caveats

Non-gap backtests use fixed scores retrospectively. Decarb Gap uses quarter-lagged records but not verified release-date vintages. All tilt calibration is full-sample/ex-post and returns exclude transaction costs. These are not validated investable-performance claims.

Historical climate projections are retrospective reconstructions using current methodology. Category temperatures are illustrative input-shock scenarios, not category contributions. See the main methodology document for exact shocks and unresolved baseline differences.

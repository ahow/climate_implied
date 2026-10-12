# Global Decarbonization Dashboard — Technical Documentation

**Live application:** https://climatetracking.live/
**Purpose:** A probabilistic climate-and-finance analytics platform that projects global decarbonization pathways and translates equity-market valuations into implied decarbonization rates, carbon prices, and temperature outcomes.

This document explains what each part of the dashboard does and how the underlying analysis works. It is written for a technically literate reader who wants to examine the logic and reasoning behind the application.

---

## 1. Executive Summary

The dashboard answers two connected questions:

1. **Where is the world actually heading on emissions?** — using a Monte Carlo simulation built on 22 real-world indicators from authoritative sources (IEA, IRENA, Climate Action Tracker, SBTi, Global Carbon Project, NOAA, etc.).
2. **What decarbonization rate is the stock market implicitly pricing in?** — using a Gordon Growth Model that infers expected long-term growth from company P/E ratios, then comparing that market-implied pathway against the physically projected one to surface mispriced transition opportunities.

The first is a *bottom-up climate model*. The second is a *finance signal* derived from valuations. Both are exploratory. The emissions accounting, temperature conversion and valuation-to-physical-decarbonization mapping remain subject to validation; shared axes do not establish scientific comparability or investment predictiveness.

---

## 2. Core Methodology

### 2.1 Monte Carlo Emissions Projection

- **10,000 iterations** for the main projection (2,000 for sensitivity analysis, 1,000 for category/regional breakdowns — a deliberate performance/accuracy balance).
- A **seeded Linear Congruential Generator (LCG)** is used for the random draws so that results are fully **reproducible** — the same inputs always produce the same distribution.
- Each iteration samples plausible trajectories for the indicators and propagates them through a **sector-specific emissions model**.
- Output is a distribution (p10 / p25 / p50 / p75 / p90) of emissions trajectories and resulting temperature outcomes, rather than a single deterministic number.

### 2.2 Sector Decomposition

Global emissions are split into six sectors, each modeled with its own dynamics:

| Sector | Share of emissions |
|---|---|
| Power | 26.9% |
| Industry | 24.1% |
| Agriculture | 17.1% |
| Transport | 14.4% |
| Buildings | 9.6% |
| Other | 8.0% |

### 2.3 Temperature Conversion (TCRE)

Cumulative emissions are converted to warming using the **IPCC AR6 TCRE framework** (Transient Climate Response to Cumulative Emissions):

```
temperature = baseline_warming + cumulative_emissions_GtCO2 × TCRE
            = 1.1°C + cumulative_GtCO2 × 0.00045°C/GtCO2
```

- Baseline warming: **1.1°C** (already-observed warming).
- TCRE: **0.45°C per 1,000 GtCO2**.
- Cumulative emissions are integrated from the 2024 base year out to 2100.

### 2.4 Nowcast Extrapolation (Momentum-Decay)

For recent years where final data is not yet published, the model extrapolates using a **momentum-decay method**: the recent slope of a trend is carried forward but decayed at **50% per year**. This prevents over-extrapolating trends that may be stalling. Nowcast/estimated values are visually distinguished with **dashed lines** in the charts.

---

## 3. Indicator Framework (22 indicators, 6 categories)

Historical data spans **2010–2025**. Indicators are grouped into six categories, each representing a different lever or signal on the energy transition:

1. **Technology** — renewable capacity (GW), renewable growth rate, EV sales share, EV growth rate.
2. **Policy** — policy coverage (%), policy implementation rate.
3. **Corporate** — SBTi/corporate target coverage (%), corporate implementation rate.
4. **Socioeconomic** — GDP, carbon intensity of GDP, climate concern, policy support, sacrifice willingness, human-causation belief.
5. **Financial Flows** — clean energy investment, fossil fuel investment, green bond issuance, fossil divestment. Acts as a **leading indicator** for capital reallocation (the clean-to-fossil investment ratio and green bond momentum).
6. **Emissions Outcomes** — observed fossil CO2 (GtCO2/yr), atmospheric CO2 concentration (ppm), CO2 growth rate, remaining 1.5°C carbon budget. Provides **ground-truth validation** against the projection.

**Design note on Emissions Outcomes:** observed fossil CO2 acts as a *decaying anchor* on near-term projections (recent reality pulls the projection toward itself, with the anchor weight decaying over time). The remaining carbon budget is tracked for context but does **not** drive projections — it is a physical constraint, not a behavioral driver.

---

## 4. Dashboard Pages and What They Do

### 4.1 Main Dashboard (`/`)
The central view. Shows:
- **Temperature gauge** — the median projected end-of-century warming with uncertainty band.
- **Emissions trajectory chart** — fan chart (p10–p90) of projected global emissions.
- **Temperature histogram** — distribution of outcomes across the 10,000 Monte Carlo runs.
- **Indicator cards** — current values and trends for each of the 22 indicators, filterable by category.
- **Category comparison** — illustrative input-shock scenarios, not category contributions or forecasts in which only one category evolves. See Section 4.7.
- **Regional comparison** — scales projections by regional carbon intensity (EU, US, China, India).
- **Sensitivity (tornado) chart** — varies each indicator between its p10 and p90 while holding the others constant, measuring the resulting temperature range. This ranks indicators by how much they actually move the outcome.

### 4.2 Methodology (`/methodology`)
Full written documentation of the model, organized in three parts: the decarbonization dashboard, the Climate Scenario Analyzer, and the Decarb Gap Signal.

### 4.3 Climate Scenario Analyzer (`/climate-valuation`)
Carbon pricing and P/E tercile analysis. Uploads a dataset of companies (emissions, market cap, net profit, targets) and computes implied carbon prices and decarbonization rates by comparing valuations across groups.

### 4.4 Decarb Signal Comparison (`/decarb-signal`)
Compares the **expected** (physically projected) decarbonization rate against the **market-implied** rate.

### 4.5 Decarb Gap Signal (`/decarb-gap`)
Per-company comparison of market-implied vs. projected decarbonization rate, with a selected-signal versus Decarb Gap backtest. The former “Valuation-Aware” label referred to `signal=decarb_gap`, not a separate strategy. An identical comparison is hidden when Decarb Gap is selected.

### 4.6 News Sentiment (`/news-sentiment`)
Climate news volume, sentiment, and topic breakdown via the NewsAPI.ai integration (cached 6 hours).

### 4.7 Illustrative Category Scenarios

Each scenario changes starting inputs, then runs the full model with its usual evolution rules. Other inputs retain their baseline values; their future effects are **not frozen**.

| Scenario | Exact input changes |
|---|---|
| Technology | Renewable capacity = 5,000 GW; EV sales share = 50% |
| Policy | Coverage = 100%; implementation = 1.0 |
| Corporate | Target coverage = 80%; implementation = 1.0 |
| Socioeconomic | Carbon intensity ×0.85; policy coverage ×1.3; policy implementation ×1.3; corporate implementation ×1.2 |
| Financial flows | Clean investment ×2.5; fossil investment ×0.3; green bond issuance ×3 |
| Emissions outcomes | Fossil CO₂ ×0.85; atmospheric CO₂ growth = 1.5 ppm/year |

These shocks are not calibrated to comparable effort or likelihood. The socioeconomic case deliberately changes policy and corporate inputs too; those multipliers are not capped in the current scenario function. A fixed target such as 5,000 GW is not necessarily an improvement over every baseline.

The standalone `/api/projection/categories` path starts from the 2024 indicator resolver, whereas `/api/projection?category=…` starts from the latest nowcast. They are **not interchangeable**; baseline alignment is pending model remediation.

### 4.8 Historical Projections

`/api/projection/historical-trend` is a **retrospective reconstruction using current methodology and revised historical inputs**, not a record of forecasts issued at each historical date. The intensity-decline estimate can use later observations. Nowcast rows are estimates, not observations. Historical-vintage forecast evaluation is not currently supported.

---

## 5. The Finance Engine — Valuation to Decarbonization

This is the part most worth a colleague's scrutiny, because it connects equity valuations to climate outcomes.

### 5.1 Gordon Growth Model (GGM): P/E → Implied Growth

The foundational relationship. The Gordon Growth Model relates a company's P/E ratio to its implied long-term earnings growth rate:

```
g = r − (1 / PE)

where:
  g  = implied long-term growth rate
  r  = cost of equity (default 8%)
  PE = price-to-earnings ratio (market cap / net profit)
```

A high P/E implies the market expects high growth; a low P/E implies low expected growth.

**Important — the same GGM and cost-of-equity assumption (8%) is applied consistently across all four inference methods:**

| Signal / inference method | How companies are grouped | GGM applied to |
|---|---|---|
| **Decarbonization ambition** | Terciles by announced emission-reduction targets | Aggregate P/E of best vs. worst tercile |
| **SDG exposure** | SDG alignment score > 0 ("clean") vs. < 0 ("dirty") | Aggregate P/E of clean vs. dirty group |
| **Carbon intensity** | Terciles by emissions / market cap | Aggregate P/E of low- vs. high-carbon tercile |
| **Decarb Gap (per-company)** | Peer groups (sector / sub-sector / industry) | Each company's P/E vs. its peer-group median |

The simplified formula is `g = r − 1/PE`. `costOfEquity` is configurable on SDG growth, decarb terciles and the decarb-gap summary/timeseries routes; default 0.08, accepted range greater than 0 and at most 1. Carbon-price and decarb-gap backtests use a fixed 0.08. Decarb bands select the target-rate band with the highest aggregate P/E and do not use cost of equity.

A uniform `r` cancels in a growth difference, including company-minus-peer-median growth. Thus 7%, 8% and 9% change absolute implied growth but not the derived differential, gap or differential-based temperature, holding inputs and eligibility fixed. This invariance is not evidence that company-specific discount-rate risk is immaterial.

### 5.2 Growth Differential → Implied Decarbonization Rate

For the pooled methods (ambition, SDG, carbon intensity), the implied decarbonization rate is the growth *premium* the market assigns to the "cleaner" pool:

```
growth_premium      = g_clean − g_dirty
implied_decarb_rate = growth_premium × 100   (%/yr)
```

A **positive** premium means the market values cleaner companies more highly (interpreting decarbonization ambition as value-creating). A **negative** premium means the market is currently pricing ambition as value-destructive — this is meaningful, and flows through to negative implied carbon prices and higher implied temperatures.

### 5.3 Decarbonization Rate → Carbon Price and Temperature

The implied decarbonization rate is converted onto the same physical axes as the climate model:

- **Carbon price** — the annual rate is compounded over a 6-year horizon into a cumulative reduction, then mapped through an abatement-cost lookup table (interpolated) to a $/tonne carbon price.
- **Temperature** — the annual rate is projected forward (emissions declining at that compound rate), integrated to cumulative emissions, and converted via the same TCRE relationship used by the main climate model.
- **Net-zero year** — the year at which emissions fall below 5% of the base level at that compound rate.

This shared conversion is what lets the dashboard say "the market is currently pricing in roughly X°C of warming," directly comparable to the bottom-up projection.

### 5.4 Per-Company Decarb Gap

The Decarb Gap page works at the individual-company level rather than on pooled aggregates:

```
Step 1:  g_company       = r − (1 / PE_company)
Step 2:  g_peer_median   = median(g) across companies in the same peer group
Step 3:  implied_rate    = (g_company − g_peer_median) × 100   (%/yr)
Step 4:  gap             = projected_global_rate − implied_rate
```

- A **positive gap** (the world is projected to decarbonize faster than the market is pricing for this company) is a potential *buy* signal — the market may be underestimating the transition.
- A **negative gap** suggests the market may be over-pricing transition expectations.

The summary uses the current projected global rate; the backtest uses historical rates reconstructed using today's methodology. Subtracting a common global rate does not change within-peer company rankings. The interpretation of a peer-relative growth spread as an absolute physical reduction rate remains an unvalidated assumption.

---

## 6. Signal Backtest

The Decarb Gap signal is evaluated with a portfolio backtest:

- **Returns** are computed from monthly Total Return Index (RI) data. Monthly returns above ±50% are dropped as data-quality outliers.
- **Benchmark** is market-cap weighted: `r_bench = Σ (wᵢ × rᵢ)`, with `wᵢ = MVᵢ / ΣMV`.
- **Signal scoring** is continuous and rank-based within each peer group: companies are ranked by gap, converted to a percentile, then to a score in **[−1, +1]** (0 = median). This avoids cliff effects at tercile boundaries.
- **Portfolio construction** tilts benchmark weights by the score: `w_portfolioᵢ = w_benchᵢ + (scoreᵢ × tiltScale × w_benchᵢ)`, floored at zero. Positive scores overweight, negative scores underweight.
- **Tracking-error calibration:** the `tiltScale` is calibrated by **binary search (up to 20 iterations)** against the entire backtest sample, targeting annualized tracking error `σ(active returns) × √12` (population standard deviation). Default target: 2%; stopping tolerance: 2% relative to that target. Convergence is not guaranteed; the response reports its status. This is ex-post calibration, not an ex-ante risk constraint.

**Data availability:** decarb-gap scores are recomputed quarterly using records dated through the prior quarter-end. This does not verify publication-date availability, historical universe membership or historical data vintages. Carbon-intensity, SDG and ambition backtests apply fixed company scores retrospectively and are not point-in-time investable backtests. All results are gross of trading costs.

**Signals and grouping:**
- Carbon intensity, SDG and ambition support pooled (`absolute`) ranking only. Unsupported peer-relative requests return HTTP 400.
- Decarb Gap supports `absolute`, `sector_relative` (default), `sub_sector_relative` and `industry_relative`.
- The former “Valuation-Aware” UI line is `signal=decarb_gap`. There is no separate `strategy` parameter. Lower P/E implies **lower** growth under the stated formula; a larger gap can therefore reflect lower relative implied growth.

**API units and response:** `trackingError=2` means 2%, while `trackingError=0.02` means 0.02%. Values are never guessed or rescaled. Optional `trackingErrorUnit=percent` makes the convention explicit. Default JSON is `{ series, summary }`; `format=series` requests the legacy array. Summary TE fields are percentage points; the series `trackingError` is a decimal, annualised over the expanding history (not a rolling fixed-length window). See [API contract and reproducible requests](API_Contract.md).

---

## 7. Architecture

### Tech Stack
- **Frontend:** React + Vite + TypeScript, TanStack Query, Recharts, Tailwind CSS, shadcn/ui, wouter routing.
- **Backend:** Express.js REST API with in-memory caching.
- **Database:** PostgreSQL via Drizzle ORM (projection caching, indicator snapshots, company/time-series data, carbon-price cache).
- **Integrations:** NewsAPI.ai for climate news sentiment.

### Code Layout
- `client/src/pages/` — dashboard, methodology, climate-valuation, decarb-signal, decarb-gap-signal, news-sentiment.
- `client/src/components/` — charts and UI (TemperatureGauge, EmissionsChart, TemperatureHistogram, SensitivityChart, etc.).
- `server/calculation/` — the climate model:
  - `forwardProjection.ts` — Monte Carlo simulation + sensitivity analysis.
  - `categoryProjections.ts` — per-category isolated impact.
  - `regionalProjections.ts` — regional carbon-intensity scaling.
  - `historicalRecalculation.ts` / `historicalIndicators.ts` — backtesting and source data.
- `server/climateValuation/` — the finance engine:
  - `decarbConversion.ts` — GGM and decarb→carbon-price→temperature conversions (the shared math).
  - `sharedUtils.ts` — carbon intensity, tercile assignment, peer grouping, data loading.
  - `tercileCalculator.ts`, `carbonPriceCalculator.ts`, `sdgGrowthCalculator.ts`, `decarbTercileCalculator.ts` — the four inference methods.
  - `decarbGapCalculator.ts` — per-company gap signal.
  - `backtestCalculator.ts` — the portfolio backtest engine.
- `server/newsApi/newsService.ts` — news sentiment.
- `server/routes.ts` — REST endpoints.
- `shared/schema.ts` — Drizzle database schema shared by frontend and backend.

### Key API Endpoints
- `GET /api/projection?category=…` — main Monte Carlo projection.
- `GET /api/projection/sensitivity` — tornado-chart sensitivity.
- `GET /api/projection/categories` / `…/regions` / `…/historical-trend` — illustrative scenarios, regional comparisons and retrospective reconstruction.
- `GET /api/cv/uploads` — select an explicit completed upload before requesting carbon prices.
- `GET /api/cv/carbon-price?uploadId=<completed-id>&method=sector_relative&inferenceMethod=carbon_intensity` — implied carbon prices; both `uploadId` and `method` are required.
- `GET /api/cv/sdg-growth` / `…/decarb-terciles` / `…/decarb-bands` — valuation-implied decarb rates.
- `GET /api/cv/decarb-gap/summary` / `…/timeseries` — per-company gap signal.
- `GET /api/cv/backtest?signal=carbon_intensity&method=absolute&trackingError=2&trackingErrorUnit=percent` — retrospective signal backtest with calibration summary.
- `GET /api/news/climate?months=…` — news sentiment.

### Reproducibility & Caching
- Monte Carlo randomness is seeded. Reproduction additionally requires the same model code, inputs, overrides and projection start year. Seeds do not preserve historical data vintages.
- An upload identifier currently identifies an upload/cache namespace, not an immutable full-data snapshot. On a carbon-price cache miss, the calculator uses the current shared company/time-series tables. Archive the response and input extract used for a citation; fully versioned snapshots remain pending.
- Computed projections and carbon-price results are cached (in-memory and in the database) to avoid redundant heavy computation; `POST /api/refresh` clears the caches.

---

## 8. Data Sources

| Source | Data |
|---|---|
| IRENA | Renewable capacity statistics |
| IEA | Global EV Outlook, World Energy Investment |
| Climate Action Tracker | Policy coverage and implementation |
| SBTi | Corporate science-based-target commitments |
| Global Carbon Project | Annual fossil CO2 emissions |
| NOAA (Mauna Loa) | Atmospheric CO2 concentration |
| IPCC AR6 | Remaining 1.5°C carbon budget, TCRE framework |
| Climate Bonds Initiative | Green bond issuance |
| Gallup / Pew Research | Climate concern and policy support polling |
| World Bank / IMF | GDP and carbon intensity of GDP |

---

*This document describes the current implementation and its limitations. Consult the accompanying API contract and retain the code/data version used for any external citation.*

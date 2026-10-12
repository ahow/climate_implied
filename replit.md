# Global Decarbonization Dashboard

## GitHub synchronization instruction

The user requests that current application code be pushed to
https://github.com/ahow/climate_implied and kept updated as changes are made.
After reviewing, checking and committing changes, run `python script/sync-github.py`
and verify its remote-commit result. The public repo uses a code-only export:
do not push workspace `main` or its full history, which includes uploaded data.
Never force-push or upload secrets, private attachments, or generated outputs.
This is not authorization to publish/deploy the application.

## Overview
A probabilistic climate projections dashboard using Monte Carlo simulation (10,000 iterations) with sector-specific emissions modeling. Tracks 22 real-world indicators from authoritative sources (IEA, IRENA, Climate Action Tracker, SBTi, Global Carbon Project, NOAA, Gallup, Pew Research, World Bank/IMF, Climate Bonds Initiative, Stand.earth) across six categories: Technology, Policy, Corporate, Socioeconomic, Financial Flows, and Emissions Outcomes. Historical data covers 2010-2025. Financial Flows module (clean energy investment, green bonds, fossil divestment) serves as leading indicator for capital reallocation. Emissions Outcomes module (observed CO2 emissions, atmospheric concentration, remaining 1.5°C carbon budget) provides ground truth validation against projections. Includes indicator sensitivity analysis (tornado chart) showing temperature impact of each indicator. Nowcast extrapolation uses momentum-decay method (50% annual slope decay) to avoid over-extrapolation of stalling trends, with dashed-line visual distinction for estimated values. Includes climate news sentiment analysis via NewsAPI.ai integration.

## Tech Stack
- **Frontend**: React + Vite + TypeScript, TanStack Query, Recharts, Tailwind CSS, shadcn/ui components, wouter routing
- **Backend**: Express.js REST API with in-memory caching
- **Database**: PostgreSQL (Drizzle ORM) for projection caching and indicator snapshots
- **Theme**: Teal/climate color scheme (hsl 168 primary)

## Project Structure
- `client/src/pages/dashboard.tsx` - Main dashboard page with all visualizations
- `client/src/pages/methodology.tsx` - Methodology documentation page
- `client/src/pages/climate-valuation.tsx` - Climate Scenario Analyzer page (carbon pricing, P/E tercile analysis)
- `client/src/pages/decarb-signal.tsx` - Decarb Signal Comparison page (expected vs. market-implied rates)
- `client/src/pages/decarb-gap-signal.tsx` - Decarb Gap Signal page (per-company market-implied vs projected decarb rate comparison, dual-strategy backtest: signal-driven vs valuation-aware)
- `client/src/pages/news-sentiment.tsx` - Climate News Sentiment page (volume, sentiment, topic breakdown)
- `client/src/components/` - UI components (TemperatureGauge, EmissionsChart, TemperatureHistogram, IndicatorCards, CategoryFilter, HistoricalTrendChart, RegionalComparison, MetricToggle, CategoryComparison, SensitivityChart, ThemeProvider/Toggle)
- `client/src/lib/types.ts` - Shared frontend types
- `server/calculation/` - Calculation engine modules
  - `forwardProjection.ts` - Monte Carlo simulation with sector-specific modeling + sensitivity analysis
  - `categoryProjections.ts` - Category-isolated impact analysis (6 categories including Financial Flows, Emissions Outcomes)
  - `regionalProjections.ts` - Regional carbon intensity scaling
  - `historicalRecalculation.ts` - Historical backtesting (2015-2025)
  - `historicalIndicators.ts` - Historical data from authoritative sources (2010-2025, 22 indicators)
- `server/climateValuation/` - Climate Scenario Analyzer modules
  - `sharedUtils.ts` - Consolidated shared utilities (carbon intensity, tercile assignment, geography filtering, time series grouping, peer group key, annual decarb rate, DB loading with optional carry-forward)
  - `dataProcessor.ts` - Excel file parser and data transformer (ISIN-based company mapping)
  - `tercileCalculator.ts` - On-the-fly carbon intensity tercile computation (absolute and sector-relative)
  - `carbonPriceCalculator.ts` - On-the-fly implied carbon price calculation with winsorization
  - `sdgGrowthCalculator.ts` - SDG alignment growth differential (Gordon Growth Model implied decarb rate)
  - `decarbBandCalculator.ts` - Decarbonization ambition P/E band analysis (peak band = market-implied rate)
  - `decarbConversion.ts` - Shared conversion helper (decarb rate → carbon price, temperature via TCRE)
  - `decarbGapCalculator.ts` - Per-company decarb gap signal (GGM implied rate vs projected rate, peer-relative scoring)
  - `backtestCalculator.ts` - Signal backtest engine (monthly RI returns, market-cap weighted benchmark, time-varying signal scoring for decarb_gap, tracking error constraint)
- `server/newsApi/newsService.ts` - NewsAPI.ai integration for climate news volume and sentiment analysis
- `server/routes.ts` - REST API endpoints (decarbonization + climate valuation + news)
- `server/storage.ts` - Storage interface with caching
- `shared/schema.ts` - Database schema (projectionCache, indicatorSnapshots, cv_companies, cv_time_series, cv_data_uploads, cv_company_terciles, cv_carbon_price_cache)

## API Endpoints
- `GET /api/projection?category=all|technology|policy|corporate|socioeconomic|financial|emissions` - Main projection with Monte Carlo simulation
- `GET /api/indicators/historical` - Historical indicator data (2010-2025, 22 indicators)
- `GET /api/projection/categories` - All category impact projections (6 categories)
- `GET /api/projection/regions` - Regional comparison projections
- `GET /api/projection/sensitivity` - Indicator sensitivity analysis (tornado chart: temperature impact per indicator)
- `GET /api/projection/historical-trend` - Historical backtesting trend
- `POST /api/cv/upload` - Upload Excel file for climate valuation analysis (multipart/form-data)
- `GET /api/cv/uploads` - List all upload records
- `GET /api/cv/upload/:id/status` - Check upload processing status
- `GET /api/cv/dimensions` - Get available sectors and geographies
- `GET /api/cv/carbon-price?uploadId=&method=&includeScope3=&winsorize=&inferenceMethod=` - Calculate implied carbon prices (inferenceMethod: carbon_intensity|climate_revenue|decarbonization_ambition)
- `GET /api/cv/pe-comparison?method=&includeScope3=` - P/E ratio tercile comparison using aggregate P/E (total market cap / total net profit)
- `GET /api/cv/sdg-growth?costOfEquity=0.08` - SDG alignment growth differential (Gordon Growth Model: clean vs dirty implied growth rates, decarb rate, temperature)
- `GET /api/cv/decarb-bands` - Decarbonization ambition P/E by target band (peak band = market-implied pathway)
- `GET /api/cv/decarb-terciles?method=absolute|sector_relative|sub_sector_relative|industry_relative&costOfEquity=0.08` - Decarbonization ambition tercile analysis (best vs worst P/E and avg decarb rates over time, plus market-implied decarb rate, carbon price, and temperature via Gordon Growth Model)
- `GET /api/cv/summary` - Dataset summary statistics
- `GET /api/cv/decarb-gap/summary?method=sector_relative&geography=&costOfEquity=0.08` - Per-company decarb gap summary (distribution, top/bottom companies, signal split)
- `GET /api/cv/decarb-gap/timeseries?method=sector_relative&geography=&costOfEquity=0.08` - Implied vs projected rate time series with IQR band
- `GET /api/cv/backtest?signal=carbon_intensity|sdg_exposure|decarb_ambition|decarb_gap&trackingError=2&method=sector_relative&geography=` - Signal backtest (monthly RI-based returns, market-cap benchmark, continuous rank-based signal scoring, proportional weight tilting, tracking error constraint)
- `POST /api/refresh` - Clear all projection caches and re-run analysis on next request
- `GET /api/news/climate?months=12` - Climate news volume, sentiment, topic breakdown from NewsAPI.ai (cached 6h)

## Key Design Decisions
- Seeded RNG (Linear Congruential Generator) for reproducible Monte Carlo results
- 10,000 iterations for main projections, 2,000 for sensitivity analysis, 1,000 for category/regional (performance balance)
- IPCC AR6 TCRE framework (0.45°C per 1,000 GtCO2) with 1.1°C baseline warming
- 6 sectors: Power (26.9%), Transport (14.4%), Industry (24.1%), Buildings (9.6%), Agriculture (17.1%), Other (8.0%)
- 6 indicator categories: Technology, Policy, Corporate, Socioeconomic, Financial Flows, Emissions Outcomes
- Financial Flows module: Clean-to-fossil investment ratio as leading indicator, green bond momentum (normalized to 0-1). Fossil fuel capex (IEA) represents industry growth intentions
- Emissions Outcomes module: Observed fossil CO2 anchors near-term projections (decaying anchor weight), CO2 growth rate acceleration signal. Note: Remaining carbon budget is tracked as informational data but does not drive projections (it's a physical constraint, not a behavioral driver)
- Sensitivity analysis: Varies each of 15 indicators between p10/p90 while holding others constant; measures temperature range impact; sorted by impact magnitude
- In-memory caching for computed projections to avoid redundant calculations
- On-the-fly tercile computation (PE comparison, carbon pricing) instead of pre-computed tercile table to avoid generating millions of records during upload
- Carbon price results are cached in cv_carbon_price_cache table after first computation
- Upload processing inserts companies and time series only; tercile classification happens at query time
- Last-observation-carried-forward (LOCF) for emissions: when a company has no emissions on a given date, the most recent available scope 1/2/3 values are carried forward to fill gaps, enabling carbon intensity rankings to extend to the latest available market cap/profit dates
- `server/climateValuation/emissionsCarryForward.ts` - Shared LOCF utility used by tercileCalculator and carbonPriceCalculator

## Data Sources (2010-2025)
- **IRENA**: Renewable Capacity Statistics (annual, March)
- **IEA**: Global EV Outlook, World Energy Investment (annual, June)
- **Climate Action Tracker**: Policy coverage and implementation rates
- **SBTi**: Science Based Targets initiative corporate commitment tracking
- **Global Carbon Project**: Annual fossil CO2 emissions (GtCO2/yr), published November
- **NOAA**: Mauna Loa atmospheric CO2 concentration (ppm), monthly
- **IPCC AR6**: Remaining carbon budget for 1.5°C (GtCO2)
- **Climate Bonds Initiative**: Green bond issuance statistics
- **Gallup**: Global Climate Concern polling
- **Pew Research**: Climate policy support surveys
- **World Bank / IMF**: GDP, carbon intensity of GDP

# Frozen fleet-share transition diagnostic

Frozen before inspecting stock observations or running this study.
Separate from completed EV sales-growth studies; no refit or overwrite of them.

Sources: existing hashed OWID EV sales-share extract
45969bb5f9a809c45792d8986f53023754d0fa141e74c7e24ad9af6ad041059b;
OWID share-car-stocks-electric CSV/metadata, downloaded once and hash-pinned
in the study manifest before evaluation. Metadata inspection found chart
IEA2026 versus column IEA2025 attribution: unresolved, not silently reconciled.
BEV plus PHEV passenger-car shares; no tailpipe or grid-emissions claim.
Original publication availability is unknown. Revised-history evaluation only.
Raw source extracts stay ignored/private; publish aggregate study results only.

Entities: World, China, India, United States, European Union (27), Rest of World.
Require complete2010–2018 training stock and sales shares, and2019–2024 stock
observations. No invented Rest-of-World denominator, interpolation or shortened
windows. Shares must be finite and within[0,1].

Fit the stock-share transition f[t]-f[t-1]=tau*(sales[t-1]-f[t-1])
on training transitions2011–2018, through-origin least squares:
tau=clip(sum(x*y)/sum(x*x),0,1). Reject unidentified zero denominator.
This is an effective stock-share transition coefficient, NOT a measured vehicle
lifetime: fleet growth, scrappage and changing denominators can confound it.
Forecast from2018 stock, holding sales at its2018 level throughout holdout.
Do not consume realized holdout sales or reset forecasts using holdout stocks.

Baselines: persistence at2018 stock and OLS linear stock-share trend fitted
on2010–2018, bounded[0,1]. Primary metric: MAE in percentage points across all
six holdout years. Candidate must strictly beat BOTH baselines; failures remain
sensitivity-only. No result is centrally promoted.

Uncertainty:1000 circular moving-block training-residual bootstrap draws,
block length3, seed20261109, matching the existing EV uncertainty settings.
Keep training x fixed; generate y*=tau*x+resampled residual and refit bounded tau.
Report2.5/50/97.5% coefficient and annual forecast quantiles and holdout coverage.
These are parameter-uncertainty intervals, not observation/process-noise
predictive intervals; no manufactured probabilistic acceptance claim.
Report early2011–2014 and late2015–2018 transition fits as descriptive stability.

Record source/metadata/protocol/implementation hashes, full missingness and
all six entity decisions. Do not tune model/windows/seed after observing results.

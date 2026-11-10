# Frozen fleet-share transition study — 2026-11-10

Protocol committed941df06 before stock observations were inspected/evaluated.
Executable: script/fleet_transition.py; machine-readable results:
fleet_transition_results.json, including protocol/source/implementation hashes.
This does not refit the completed EV sales study or change native engine inputs.

| Entity | Transition MAE pp | Persistence | Linear | Decision |
|---|---:|---:|---:|---|
| World |0.878914|1.548333|1.486803|Point-metric candidate only|
| China |2.032793|3.600000|3.515426|Point-metric candidate only|
| India |0.151414|0.154000|0.148169|Sensitivity-only; fails linear|
| United States |0.345756|0.841667|0.727075|Point-metric candidate only|
| EU27 |1.437520|1.798333|1.728069|Point-metric candidate only|
| Rest of World | unavailable | unavailable | unavailable | Missing required years |

All fits use2010–2018 only; forecasts hold2018 sales fixed and recursively
predict2019–2024 stock shares without actual holdout sales/stocks as inputs.
Three tests pass, including changing holdout values without changing fit,
bootstrap intervals or forecasts; missing/invalid windows reject.

No central promotion. Parameter-only95% intervals cover0/6 holdout years for
World/China/India/EU27 and1/6 for US. They are not calibrated predictive
intervals. Effective transition coefficients do not identify vehicle
lifetimes or causal tailpipe displacement when fleet denominators change.

Stock missing Rest-of-World years:2017,2019,2021; training sales missing2013,2015.
No interpolation, shorter window or substitute regional denominator.
Stock source: OWID share-car-stocks-electric; metadata chart cites IEA2026,
column cites IEA2025, unresolved. Original publication dates unknown.
The retained CSV/hash is revised-history evidence, not publication proof.

Actual executions:
- python -m unittest discover -s script -p test_fleet_transition.py:
  3passed/0failed/0skipped;2026-11-10T03:17:49Z;
  generated-artifacts/workplan-completion/20261110T031749819928Z.log.
- python script/fleet_transition.py: exited0 at03:17:52Z;
  generated-artifacts/workplan-completion/20261110T031752068151Z.log.

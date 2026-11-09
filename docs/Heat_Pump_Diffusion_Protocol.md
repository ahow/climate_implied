# US heat-pump shipment diffusion diagnostic — frozen protocol

Frozen 2026-11-09 before any fit or score was computed.

## Source and access investigation

- IEA "Heat pump sales for selected regions, 2019–2024" (CC BY 4.0): chart data
  not downloadable; direct request HTTP 403. Not used.
- AHRI (primary US manufacturers' association) public page "Central Air
  Conditioners and Air-Source Heat Pumps" publishes a twenty-year table image of
  annual US air-source heat-pump shipments, 2006–2025 (file
  `2026-03/Air-Source Heat Pumps Table.jpg`, SHA-256
  e6d5b99709e1c48779f25729e043d111ee81ca49eeec33871836cd04b4a2c1ed). Values
  were transcribed from the image and cross-checked where AHRI's public December
  2020 and 2021 releases state totals (2020 3,418,478 and 2021 3,916,766 match
  the table; the 2021 release's 3,109,840 comparison column differs from the
  table's 2019 value 3,110,888, i.e. revised history).
- AHRI monthly PDFs for most years and gas-furnace histories require login
  (HTTP 403); EHPA/JRAIA data are member/paid. A heat-pump *share* of heating
  sales therefore cannot be constructed; no denominator is invented.
- Licence: AHRI publishes no open licence. Use is limited to private research
  and aggregate fit metrics; the transcribed series is not committed or shown in
  the application.

## Study

- Target: annual US air-source heat-pump shipments (units), levels.
- Primary training 2011–2018 (post-recession; the 2006–2010 decline is a housing
  shock, declared a structural break before fitting). Sensitivity training
  2006–2018. Evaluation 2019–2025 (7 complete years), never used in fitting.
- Models: (a) persistence at last training value; (b) OLS linear trend in level;
  (c) log-linear (constant exponential growth) trend.
- Logistic/Gompertz/Bass in levels require a market-size ceiling; no sourced
  prior for the US heating-equipment market ceiling is available without the
  furnace denominator, so these are declared unidentified, not fitted with an
  arbitrary ceiling.
- Metric: mean absolute percentage error (MAPE) over 2019–2025.
- Acceptance as a calibrated central driver: requires a share-based diffusion
  model (workplan Stage 4); a levels trend can at most be a sensitivity/prior.
  The comparison reports which levels model forecast best, nothing more.
- Classification: revised-history retrospective diagnostic; US only.

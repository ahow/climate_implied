# US heat-pump shipment diffusion diagnostic — results

Executed 2026-11-09 under `Heat_Pump_Diffusion_Protocol.md` (frozen in commit
7c8121d before any fit). Code: `script/heat_pump_diffusion.py:evaluate`; tests
`script/test_heat_pump_diffusion.py` (2 pass: exact exponential recovery; test
years never enter the fit). Transcribed series is private
(`generated-artifacts/heat-pump-sources/`), not committed.

| Training window | Persistence MAPE | Linear MAPE | Log-linear MAPE | Best |
|---|---:|---:|---:|---|
| 2011–2018 (primary) | 21.0% | **9.0%** | 11.3% | linear |
| 2006–2018 (sensitivity) | **21.0%** | 22.7% | 21.2% | persistence |

Evaluation 2019–2025 (7 years). Primary log-linear growth 7.8%/yr; sensitivity 3.5%/yr.

## Decision

- A post-2011 linear trend in levels forecast 2019–2025 US shipments with 9%
  MAPE, better than persistence and constant exponential growth. The result is
  **window-sensitive**: including the 2006–2010 housing decline removes any
  advantage, so it is not a robust structural estimate.
- No share-based logistic/Gompertz/Bass model was fitted: no permitted
  heating-equipment denominator (AHRI furnace history and most monthly PDFs need
  login; EHPA/JRAIA are paid/member data). The heat-pump diffusion driver is
  therefore **not calibrated**; the levels trend may be used only as a
  documented US sensitivity/prior, never as a central calibrated share.
- Limitations: revised history; US only; numbers transcribed from a published
  table image (two values cross-checked against AHRI's public 2020/2021 releases);
  no open licence, so only aggregate metrics are published.

# FaIR pulse diagnostics — frozen before execution

Use pinned FaIR 2.2.4 and the existing 841-member upstream calibration files.
Run the same historical/future reference under three scenarios: unchanged,
an additional 100 GtCO₂ fossil pulse in 2025, and an additional 100 MtCH₄
pulse in 2025. Keep all other emissions and forcing identical.

Check numerical finiteness and positive median CO₂ temperature response at
2035 and 2100. Check positive median CH₄ concentration excess after the pulse
and a smaller excess after 10 and 30 years. Report the effective e-folding
time of the median concentration excess, and median temperature response.
These are sign/decay diagnostics, not independently calibrated acceptance bounds.

Report CO₂ response per 1,000 GtCO₂, but **do not call it TCRE**: a pulse
response on a changing reference pathway is not the standard transient
cumulative-emissions experiment. Independent TCRE/reference comparison and
historical-forcing reconciliation remain separate, unmet acceptance criteria.

No diagnostic promotes the climate model. Inputs are checked against the
previously recorded reference-source hashes. Store protocol/input/output hashes.

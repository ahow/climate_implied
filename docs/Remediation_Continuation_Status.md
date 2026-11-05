# Remediation continuation — 5 November 2026

The user authorized the hosting handover and Packages 2–7 without routine
approval pauses. This does not waive scientific acceptance criteria or authorize
fabricated historical data. Package 1 remains complete; Package 2 remains open.

## Hosting

The Railway custom-domain attachment for `climatetracking.live` exists.
Its certificate is awaiting domain ownership verification. DNS must be changed
at the domain provider; no connected DNS-management integration was available.

Railway supplied:

| Type | Host | Required value |
| --- | --- | --- |
| CNAME | @ | `z1ou4jgk.up.railway.app` |
| TXT | `_railway-verify` | `railway-verify=4502fdf883a5d2abf5ae66dc1a94c9f8172c58233485302665a81ec19764d2d2` |

The TXT value is a public DNS ownership record, not an application credential.
Do not delete unrelated MX/TXT records. The domain apex needs a provider that
supports the Railway routing record via CNAME flattening or an equivalent
provider-supported apex mechanism. Do not invent an A-record address if the
provider rejects apex CNAMEs; resolve provider support first.

For a Replit-purchased domain, official documentation directs the owner to
Tools → Domains → selected domain → DNS Records:
https://docs.replit.com/build/domain-purchasing

The existing Replit scheduler has not been disabled and Railway's scheduler has
not been enabled. Transfer scheduler ownership only after DNS/TLS readiness,
ensuring the existing scheduler stops before the replacement starts. Retain the
existing database and rollback deployment.

## Package 2: native-gas adapter and stage comparison

`script/ngfs_pathway_adapter.py` now compares published NGFS World pathways with
the reconciled 2024 inventory. It:

- Enforces native gas units, including kt-to-Mt conversion.
- Preserves raw and adjusted annual paths and their cumulative annual sums.
- Interpolates within the published horizon, never extrapolates.
- Compares raw, harmonized and infilled stages without mixing them.
- Keeps land-use CO2 signed; no clipping of legitimate removals.
- Uses ratio and converging-offset adjustments as explicit sensitivities,
  **not approved central calibration**.
- Reports unrepresented inventory species rather than inventing their paths.
- Keeps all research extracts and derived pathways in ignored local storage.

REMIND current-policies baseline differences from the inventory:

| Gas component | Raw 2024 difference | Infilled 2024 difference |
| --- | ---: | ---: |
| Energy/industrial CO2 | +2.50% | +2.50% |
| Land-use CO2 | −18.47% | −18.47% |
| CH4 | +7.66% | +10.15% |
| N2O | +10.29% | +18.87% |

The infilled stage maps 23 series, versus 13 raw series. It still lacks
compatible inventory paths for HFC-134, HFC-143, HFC-245fa and HFC-41.
HFC-245ca must not be substituted for the distinct HFC-245fa molecule.

GCAM and MESSAGE infilled paths were also assessed. Their starting land-use
CO2 differences are −70.99% and +22.03%, respectively. These differences are
reasons to assess boundaries and harmonization, not grounds for selecting a
model solely because it gives the preferred temperature.

MESSAGE raw processing encounters a zero source baseline for a positive
inventory anchor; the proportional adapter rejects it instead of dividing by
zero or silently zeroing the inventory.

Reproduce:

```sh
python -m unittest discover -s script -p 'test_ngfs*.py' -v
python script/ngfs_pathway_adapter.py --stage raw
python script/ngfs_pathway_adapter.py --stage harmonized
python script/ngfs_pathway_adapter.py --stage infilled
```

These tests establish numerical behavior, not physical validation.

## Additional source assessment

The April 2026 Nature Climate Change study “Promising climate progress from
net-zero ambitions to the Paris Agreement goal” was reviewed:
https://www.nature.com/articles/s41558-026-02615-y

Its Methods section uses January 2023 current-policy/NDC cutoffs and net-zero
pledges around COP26. Its underlying data:
https://doi.org/10.5281/zenodo.10009463

It is useful as a methodological reference for harmonization and infilling,
but its 2026 publication date does not make its policy assumptions newer than
the pinned CAT November 2025 reference. It is not a justified replacement for
the agreed recent all-announced-commitments comparison.

## Acceptance gates still open

- Package 2: all-commitments gas/sector pathway, empirical sector and delivery
  assumptions, harmonization selection, and matched acceptance comparison.
- Package 3: application FaIR coupling, reference validation and coherent
  ensemble uncertainty.
- Package 4: historical evaluation and validated promotion to dashboard.
- Packages 5–7: finance corrections, distinct-signal research and point-in-time
  backtest repairs remain unimplemented.

The adapter is offline research infrastructure. It does not change the current
dashboard headline or certify completion of any of these packages.

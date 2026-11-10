# UserunitB — independent climate efficacy execution

## Status: Partial; no central promotion

Executed 10 November 2026 (UTC runtime date). Dates of information availability
remain unknown. No EV, storage, fleet941df06 or beta study was rerun. No production
writes, collectors, shared semantics, routes, UI, ledgers, packages or releases
were changed. These are offline research diagnostics, not dashboard forecasts.

Read the original Stage 4 activity/intensity, policy, holdout and efficacy clauses
in `attached_assets/Climate_Dashboard_—_Developer_Work_Plan_1794133884617.docx`,
and existing Kaya, demand, predictive-demand, driver-calibration and uncertainty
protocols. Policy implementation lacks identified effects/usable retained
implementation-weighted observations; demand already has completed diagnostics.
Selected the unmet forecast-Kaya/energy-intensity test using retained real source
observations. A new operational protocol and negative-control tests were written
before scoring (protocol hash recorded at 2026-11-10T05:21:49Z).

## Stage 4: real-series availability failure, not a fitted result

Frozen 2010–2018 training / complete 2019–2024 holdout, persistence and linear
baselines remain unchanged. Joint three-year blocks preserve factor/region
dependence; no missing observations are filled or windows shortened.

All **7/7 entities unavailable**:

| Entity | Missing required observations |
|---|---|
| World | GDP 2011–2014, 2023–2024 |
| China, India, US | GDP 2023–2024 each |
| EU27 | GDP throughout 2010–2024 |
| Rest of World, International transport | All four required fields throughout |

Thus no real-series MAE, uncertainty calibration, break p-value or winner exists;
none is manufactured from the unit-test fixtures. Central: 0. Sensitivity fits:
0. Statistical rejects: 0. Unavailable: 7. The executable reports the exact
missing cells. Factor-trend products algebraically equal a log-CO2 trend and
would not demonstrate incremental independent mechanism skill even if available.
Accounting is not causal policy evidence.

Source: OWID CO2 revision `382ee6c662b0ece26e111f263b44c029afad7787`, GCB 2025,
Maddison 2023 GDP in constant 2011 international PPP dollars, OWID population,
EI 2025/EIA 2026 energy. Publication vintages are not independently established;
this is revised history. Input SHA256:

- Kaya CSV: `7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6`
- Codebook: `33b4f5e00efd58c7b83863f736beba1af4df946b43642b0400c3ec38648e0e8e`
- Frozen new protocol: `ab7da56d04fad92c6dab27b3c0f77cfe427518eab87014019105967a12d0a31f`
- Preimplementation tests: `c102f5fa3344896e20270775e1915f5ee6ef1d3e7ee85e0932ac9692f972a836`
- Result: `generated-artifacts/driver-calibration/forecast-kaya-13ea4f867ca6b37693b8a3ab7f243c216778bb4f664a8384221493c29d9c57c0.json`

## Immediate Stage 7 fallback: independent SSP endpoint benchmark

After the narrow-series block, executed FaIR 2.2.4 against **published upstream
numerical outputs**, not a synthetic-only test or self-generated reference.
Reference revision `ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79` of
https://github.com/OMS-NetZero/FAIR, `tests/reproduction_test.py` and
`tests/test_data/`. Native RCMIP v5.1.0 inputs, all eight SSPs and all 66 upstream
CMIP6 model/run calibrations: **528 scenario/configuration cells**. This is NOT
the separate 841-member constrained ensemble and not a calibrated 10k ensemble.

| Frozen test | Observed maximum absolute difference | Threshold | Result |
|---|---:|---|---|
| 2100 timebound surface temperature | 0.000001206335 °C | ≤0.01 °C every cell | Pass |
| 2100 CO2 concentration | 0.00005880952 ppm | each cell ≤1e-8 + 1e-5 × abs(reference) | Pass |
| 2100 summed forcing | 0.0000002983487 W/m² | same relative/absolute rule | Pass |
| Coordinate identity / finite full temperature trajectory | exact / all finite | required | Pass |
| Original maximum **annual** reference difference ≤0.01°C | upstream reference stores only endpoint | every annual year | **Unavailable** |

Positive endpoint evidence advances the original Stage 7 independent-reference
clause but does not complete it. No independent annual trajectory, constrained
calibration validation, IGCC historical-forcing validation or dashboard promotion
is claimed. Central eligibility remains false. Reference dates remain unknown.
No Stage 6 gas-infill acceptance is claimed.

Source hashes (SHA256):

| Input | Hash |
|---|---|
| Upstream calibration CSV | `aff935fa3108a7c022f7f4ae1445033fd7fd117bbd709c67cc5223e4a712ce0d` |
| Upstream temperature NetCDF | `5a211aba211865388bfc2aefef74c053937df10a44d3204c28582c6c0b6176b7` |
| Upstream concentration NetCDF | `694350f6731029b5d0698472b8699e7eb47ed1bef2ad4d093cd13dced797b34b` |
| Upstream forcing NetCDF | `80444806dc454aaae1631caf7593c8dda632f95b689fab9e562b66c14f528e79` |
| RCMIP emissions | `2af9f90c42f9baa813199a902cdd83513fff157a0f96e1d1e6c48b58ffb8b0c1` |
| RCMIP concentrations | `b6749ea32cc36eb0badc5d028b5b7b7bbcc56606144155fa2c0c3f9ceeac18c9` |
| RCMIP forcing | `15ef911f0ea9854847dcd819df300cedac5fd001c6e740f2c5fdb32761ddec8b` |
| Frozen benchmark protocol | `81f84b727dd133c75c84e2f75bac35cf67e9bc191cbfb1a5b1fffeb9d9af26a6` |
| Benchmark executable | `b6c80245807916894aeb721996efa3f0de68f47564e0466339dbd76ddc02fff9` |

Result: `generated-artifacts/independent-fair-benchmark/result-120b305e686161e327b619ed1c293547ada46d7d407aa2ecdf14d8315012efa9.json`.
The matching `-temperature.nc` retains the computed full trajectory; it is never
used as an independent expected reference. Raw inputs remain private; no blanket
redistribution licence is asserted.

## Reproduction and execution evidence

```
uv run python -m unittest discover -s script -p test_forecast_kaya.py -v
uv run python script/forecast_kaya.py
uv run python -m unittest discover -s script -p test_independent_fair_benchmark.py -v
uv run --with h5netcdf --with h5py python script/independent_fair_benchmark.py
```

New focused tests: **5 passed**. They check leakage, permutation invariance,
identity, missing/invalid data, threshold failure and coordinate rejection;
they are engineering checks, not the real-study evidence.

Logs: `generated-artifacts/driver-calibration/forecast-kaya-tests.log`,
`forecast-kaya-execution.log`, and
`generated-artifacts/independent-fair-benchmark/tests.log`, `execution.log`.
The first two benchmark attempts failed for missing NetCDF backend/h5py; both
failure logs are retained in that directory. Ephemeral `uv --with` dependencies
resolved IO without changing package manifests or scientific thresholds. No
retuning followed any outcomes. No UI changed or signed-in UI verification
performed; app-level checks belong to the owning agent.

## Primary-source and annual-history investigation, 2026-11-10 UTC

The new `script/kaya_source_assembly.py` verifies frozen hashes, inventories both
retained energy alternatives, and audits explicit fixed EU27 membership for all
four fields over 2010–2024. **54 member GDP cells are missing: all 27 countries
in 2023 and 2024.** Other member/year/field cells are present. Candidate sums are
private, not substituted for the frozen published region. Any missing member
produces a missing sum, never a partial aggregate.

World still lacks GDP 2011–2014 and 2023–2024; China, India and US lack GDP
2023–2024; published EU27 lacks GDP throughout. Rest of World lacks an authorized
disjoint fixed partition reconciled to energy/CO2 bunker boundaries.
International transport has no source-defined GDP/population account. Neither
has the required published series. No subtraction from unmatched World totals,
interpolation, shortened window or incompatible splice was used. **Zero ready
entities:** original forecast gates cannot yet run, and no fitted winner or
statistical reject is claimed.

Exact gaps, fixed membership, country inventory, retained-source hashes and
dated HTTP receipts are private:
`generated-artifacts/kaya-source-investigation/f19cb32dc224480f8cf03c972386390c2c200ed411b61155af7063731cacea86.json`.

### GDP investigation beyond the retained seven-entity failure

The Groningen MPD 2023 primary release page explicitly states **169 countries
through 2022**, and CC BY 4.0. Its release index lists editions through 2023.
The linked [Dataverse dataset](https://doi.org/10.34894/INZBF2) supplied real
XLSX and Stata files; actual Stata inspection confirms 131,144 rows, years
1–2022. Neither format fills 2023–2024. Dataset metadata records release time
2024-04-26T08:43:37Z and CC-BY-4.0; that is not observation-specific vintage
evidence. World Bank NY.GDP.MKTP.PP.KD metadata explicitly uses **constant 2021
international dollars**, not constant 2011 PPP. It cannot fill frozen GDP cells.
Energy alternatives remain inadmissible under the no-splice protocol.

| Evidence | SHA256 |
|---|---|
| Groningen MPD page | `78318c9dbce08b616d205a9c1fe5d6583cb207c9b8add3b90238204b137614d2` |
| Groningen release index | `a3a254dfea1a4574d8a5c02b256ab07e99a212473aafb7048b4b3dcbf82eadc6` |
| MPD XLSX, datafile 421302 | `ecc5916ca12789b983fc4be437f8a354bbf4291323605324ac3e0aea4c57cbb6` |
| MPD Stata, datafile 421303 | `2bc62ccbd795d4d330ef9ead6dc29c39e956922b43264640eba52d2c244841cb` |
| Dataverse metadata | `85c46881789c8ad3a89dd4478ac7c7888f50580e9c4e6f290f93e6672a1e3669` |
| World Bank metadata | `8fa44ef12f5d906067ccfa55468a6c55446b483df84db42ef5788fc300e8e64c` |

### Independent annual-history fallback advanced

`script/kaya_primary_history_sources.py` follows discovered primary links and
retains independent histories from
[ClimateIndicator/forcing-timeseries](https://github.com/ClimateIndicator/forcing-timeseries)
revision `852f4f7b0733fa4d573c145cdfaf556da5589231`.
Published `output/ERF_best_1750-2024.csv` passes a strict **275 annual rows**
and finite-cell inventory. Published `data/gmst/IGCC_GMST_1850-2024.csv` passes
**175 annual rows**, preserving explicit half-year coordinates 1850.5–2024.5.
These are physical histories, **not matched annual SSP/member FaIR numerical
references**. No endpoint interpolation or self-comparison was performed.
The original annual ≤0.01°C gate remains unavailable. Baseline, forcing
definition, calibration independence and matched-trajectory validation remain
open; source acquisition alone is not historical calibration validation.

| Evidence | SHA256 |
|---|---|
| Independent annual ERF | `be4020f78361563fc215cc71d169e3d3800d0cf677c5d1174653098c82618331` |
| Independent annual GMST | `94cbfe9c7a6024412aeba8e0be934417bc9ca78cf0a73bcd12a2261a6138e7f0` |
| Repository README | `146c15d6c2e6553db07de734f4bcf018e1972115dac1332d37c0b93584b3ed3c` |
| MIT licence | `7930d540ce08efbd63edde879dbe8ff46df8bd0dcbb66678a8f6649058cb9f71` |

The README warns six ancillary datasets require registration or are not public
domain, with some offline radiative-transfer inputs. MIT code licensing is not
blanket third-party redistribution permission. No restricted inputs were
accessed; retained histories remain private. Its preliminary-2025 warning does
not establish contemporaneous vintages for the explicit 2024 files.

The pinned FAIR tree was inspected without rerunning the 528 endpoint cells:
published SSP NetCDF references are endpoint-only. OMS-NetZero/fair-calibrate
repository and main-tree requests returned retained HTTP 404 receipts, not proof
that no annual reference exists elsewhere.

Follow-up evidence:
`generated-artifacts/kaya-source-investigation/c2069b4c5534b9e08e50a85003669f85337241849203e658ce5ae373231217e8.json`.
The receipt label `maddisonDocumentation` denotes the actual Stata file; the code
now calls it `maddisonStata`. An initial integer-coordinate inventory rejected
GMST; the final inventory explicitly preserves its .5 coordinate offset.
All retrieval timestamps are retrieval dates, not information-availability dates.
These remain current-revision/revised-history sources; central eligibility false.

```
python3 script/kaya_source_assembly.py
python3 script/kaya_primary_history_sources.py
python3 -m unittest discover -s script -p test_kaya_source_assembly.py -v
```

Four focused tests pass: fixed/full membership; missing-cell/partial-sum
rejection; duplicate/nonfinite rejection; and annual gap/coordinate validation.
Completed 528 endpoint/12 infill/EV/fleet/beta results were preserved without
reruns or promotion. No production writes, central ledger changes, collector,
approval, dashboard or release changes were made.

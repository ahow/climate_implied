# NGFS pathway compatibility assessment

## Decision

**Accept NGFS 5.1 for reference-pathway development, not direct promotion to the dashboard.**
The actual archive has been downloaded and inspected. It contains useful native-gas,
sector and energy pathways through 2100. It does not by itself fulfil the approved
“all announced commitments delivered” comparison, and it is not a complete
drop-in replacement for the 2024 inventory.

This assessment completes the dataset-selection investigation. **Package 2 is
not yet complete. Package 3 has not started.** No application calculations,
headline temperature, collection/approval process or deployment were changed.

## 1. Exact data obtained

- Release: **NGFS Phase V, version 5.1**
- DOI: https://doi.org/10.5281/zenodo.17901363
- Official access: https://data.ece.iiasa.ac.at/ngfs/#/downloads
- Published archive: `1773763507243-V5.1_NGFS_Phase_5.zip`
- Size: **175,278,379 bytes**
- SHA-256: `acae7160abbd34d10b4eda5226a1fc3ebb5591205203a82c48ab9b5d5ad7c31b`
- Workbook assessed: `V5.1 NGFS Phase 5/IAM_data.xlsx`
- Selected region: `World`
- Selected cases: `Current Policies` and `Nationally Determined Contributions (NDCs)`
- Selected rows after excluding the affected physical-damage-integrated model: **4,344**

The download is a manually obtained research input, not a new automatic ingestion
job. Raw archives, workbooks, selected rows and detailed machine-readable audit
outputs are under ignored `generated-artifacts/ngfs/`, not in the public code
export or application responses. These local generated files are not a durable
application-data store.

For repeat acquisition, use the official Explorer's **Guest login → Downloads**
and choose the exact version above. The DOI contains release notes, not the data
archive. Do not save temporary guest credentials or download links.

## 2. Which models are usable?

| Model | Selected rows | Raw emissions variable/unit pairs | Core CO2 time steps |
|---|---:|---:|---|
| GCAM 6.0 NGFS | 1,290 | 112 | Five-year intervals, 2020–2100 |
| MESSAGEix-GLOBIOM 2.0-M-R12-NGFS | 1,486 | 136 | Five-year intervals to 2060; ten-year thereafter |
| REMIND-MAgPIE 3.3-4.8 | 1,568 | 117 | Five-year intervals to 2060; ten-year thereafter |

These counts describe coverage, not quality rankings. Blank cells at 2065,
2075, 2085 and 2095 in the latter two models must not become zero emissions.
Annual interpolation must use each series' actual populated years.

Exclude `REMIND-MAgPIE 3.3-4.8 IntegratedPhysicalDamages (median)`. NGFS identifies
all outputs of that variant among those affected by the retracted Kotz et al.
paper. The ordinary transition models are not rejected on that basis.

Source: [NGFS Phase V notice](https://www.ngfs.net/en/publications-and-statistics/publications/ngfs-climate-scenarios-central-banks-and-supervisors-phase-v).
The notice supersedes the older, less definitive damage-paper warning in the
Zenodo release description.

## 3. Policy compatibility

According to the [NGFS FAQ](https://www.ngfs.net/ngfs-scenarios-portal/faq):

- Current Policies uses a stylised subset of policies represented in a database
  with a **March 2024** cut-off. It is a historical policy reference, not a
  comprehensive inventory of policies implemented today.
- NDCs includes conditional national targets submitted by that cut-off, assumes
  their delivery by 2030, and continues comparable ambition afterwards.
- NDCs **does not include long-term net-zero targets**.

Consequences:

1. Current Policies is suitable as a dated reference for the implemented-policy
   case, subject to assessing policies introduced after its cut-off.
2. NDCs is suitable as an explicitly labelled **“2030 NDCs delivered, March 2024
   pledge set”** reference comparison.
3. It must not be relabelled “all announced commitments delivered.”
4. A Net Zero 2050 pathway must not be substituted for countries' actual
   heterogeneous commitments merely because its name sounds similar.
5. To preserve the approved full-commitments scope, assess a separately
   documented full-pledge pathway or construct the missing target extension
   from dated targets. NGFS alone does not settle that requirement.

## 4. Native gases and units

Verified raw variables include:

| Variable | Published unit | Conversion to application native mass |
|---|---|---|
| CO2, energy and industrial processes | Mt CO2/yr | Already Mt |
| CO2, AFOLU | Mt CO2/yr | Already Mt; retain signed land-use values |
| CH4 | Mt CH4/yr | Already Mt |
| N2O | kt N2O/yr | Divide by 1,000; this label is N2O, not N2O-N |
| Individual fluorinated species | Usually kt species/yr | Divide by 1,000, checking the species explicitly |
| F-Gases / Kyoto Gases | Mt CO2-equivalent/yr | Reporting aggregate, **not** a native species |
| HFC / PFC aggregates | HFC134a-equivalent / CF4-equivalent | **Not** masses of individual gases |

Three distinct processing stages are present: raw IAM emissions, harmonized
emissions and infilled emissions. They cannot be mixed casually.

The `AR6 climate diagnostics|Infilled|Emissions|...` series supply a broader
species set, including gases and aerosol precursors needed for a physical
climate calculation. “Infilled” means estimated in post-processing, not
independently observed or directly modelled sector emissions.

The common infilled set does not directly match inventory HFC-134, HFC-143,
HFC-41 and HFC-245fa. In particular **HFC-245ca is not HFC-245fa**.
Those four inventory species contribute approximately **0.01624 GtCO2e** in
2024. Their small reporting contribution does not justify silently omitting
them from the native-gas boundary. GCAM's raw data includes HFC-245fa, but using
it with infilled series needs an explicit, consistent treatment.

Species aliases such as `cC4F8` versus `c-C4F8` and `HFC43-10` versus
`HFC-43-10-mee` require a reviewed mapping. Ozone-depleting substances in the
climate input set remain separate from the dashboard's UNFCCC reporting total.

## 5. Baseline differences: do not directly overwrite the inventory

The table shows the percentage difference between each model's **raw Current
Policies 2024 value interpolated from 2020/2025** and our 2024 inventory.
These are model reference values, not 2024 observations.

| Model | Fossil/process CO2 | Land-use CO2 | CH4 | N2O |
|---|---:|---:|---:|---:|
| GCAM | −3.56% | −70.99% | +1.01% | +17.43% |
| MESSAGE | −5.19% | +22.03% | +1.76% | +12.23% |
| REMIND | +2.50% | −18.47% | +7.66% | +10.29% |

The particularly large GCAM land-use difference rules out a blanket claim of
baseline compatibility. It does not prove the model is wrong: land boundaries,
historical calibration and methodologies require comparison.

For both selected cases in all three models, raw total CO2 reconciles with
energy/process CO2 plus AFOLU CO2 at the global level. The largest error after
annual linear interpolation is below **1.1 × 10^-10 Mt CO2/yr**, consistent
with floating-point/source rounding.

This checks one accounting identity, not every sector hierarchy or the entire
scientific validity of a scenario.

## 6. Sector mapping findings

All three models supply electricity, industry, residential/commercial,
transportation, industrial-process and AFOLU CO2 series. Subsector coverage differs.

REMIND is a useful first **adapter-development candidate** because it explicitly
includes road/passenger/LDV CO2, aligning with the dashboard's EV mechanism.
GCAM and MESSAGE should remain independent comparisons; this recommendation
does not make REMIND the statistically “best” or validated central model.

Important mapping constraints:

- Parent totals and child series must never both be summed.
- Electricity excludes separately reported heat; EDGAR combustion boundaries
  must be checked before treating them as identical.
- EDGAR combined `1.A.4` cannot be split into buildings/agriculture by guesswork.
- Fossil fuel extraction and processing belong outside electricity demand.
- International aviation/shipping and territorial boundaries require explicit checks.
- Native CH4 and N2O sector granularity is coarser than the CO2 hierarchy.
- Net AFOLU and removals cannot be forced into a nonnegative gross-emissions
  calculation or rescaled through a zero crossing.

## 7. Licence and storage decision

The official [legal code](https://data.ene.iiasa.ac.at/ngfs/static/License/Legal.html)
is an adapted licence, **not unmodified CC BY 4.0**.

Its grant allows sharing parts that do not constitute a substantial portion,
and adapted material including figures, online visualisations, tables and
derived analysis, subject to the licence conditions and attribution. It
prohibits redistribution of a substantial portion of the source material.
The release description states that research and commercial use are permitted.

Accordingly:

- Keep the full source archive and large subsets out of GitHub and public APIs.
- Publish code, attribution, release identifiers and limited derived assessments.
- Review the size and nature of any production extract before publishing it;
  do not assume that “only World” necessarily resolves redistribution rights.
- If durable application storage is needed, use private App Storage rather than
  committing raw source files. Storage privacy alone does not grant redistribution rights.

This is an implementation assessment, not legal advice.

## 8. Concrete work needed to complete Package 2

### Follow-up check: full-commitments alternative

The [CAT November 2025 public workbook](https://climateactiontracker.org/documents/1349/CAT_2025-11_PublicData_GlobalTemperatureEstimates_COP30.xlsx)
has been downloaded and its sheets inspected. Its “Optimistic scenario
(net-zero pledges)” includes all target announcements, including proposals
not formally submitted to the UN. Its policy scope therefore fits the broader
comparison better than NGFS NDCs.

However, the workbook provides global emissions in **GtCO2eq**, plus temperature
series, not the sector/native-gas pathways needed for this application.
The workbook also expressly prohibits commercial reuse and requires attribution
to Climate Analytics and NewClimate Institute and a copyright notice.

It is therefore not a direct replacement for the missing native-gas comparison.
Do not infer a unique CO2/CH4/N2O allocation from its aggregate total, import its
temperature output as a FaIR result, or embed the downloaded data in production
without checking the intended use and applicable rights. The raw workbook
remains in ignored local research storage.

Two legitimate next steps are available: explicitly narrow this release's
comparison to NGFS's dated NDC-delivery scenario, or preserve the full-commitments
scope and obtain compatible detailed pathways and suitable usage rights.
No narrowing of the approved scope has yet been authorised.

1. Build a reviewed REMIND-to-inventory crosswalk, with explicit residual buckets
   rather than invented sector splits.
2. Compare raw, harmonized and infilled emissions before choosing a coherent
   processing stage. Document any secondary species source.
3. Implement and test baseline reconciliation against the 2024 inventory:
   evaluate proportional adjustments for positive series, and offset/convergence
   methods for signed land/removal series. Select methods from the evidence,
   not from the desired temperature.
4. Retain both original and adjusted pathways, annual and cumulative totals,
   and same-start comparisons against GCAM/MESSAGE.
5. Resolve the full-commitments scope and policy cut-off; do not silently
   substitute the narrower NDC comparison.
6. Express dashboard-driver changes as departures from the reference mechanism,
   not additional reductions on top of already-modelled policies/technology.
7. Deliver the Package 2 before/after comparison and acceptance checks.

Only then seek confirmation for Package 3. FaIR historical initialization and
temperature conversion are not part of this assessment.

## 9. Reproduction and verification

```sh
python script/test_ngfs_assessment.py
python script/assess-ngfs.py generated-artifacts/ngfs/V5.1_NGFS_Phase_5.zip
```

The audit validates the archive SHA-256, workbook headers, required scenarios
and native core units, excludes the damage-integrated variant, checks global
CO2 reconciliation, and writes local-only detailed results. Six synthetic
tests cover uneven time steps, signed paths, endpoints, extrapolation rejection
rejection of nonfinite observations and rejection of the wrong archive.

The audit does not establish full sector/gas reconciliation, full licence
clearance for a production extract, historical predictive skill, or calibration
of the dashboard's policy/corporate coefficients.

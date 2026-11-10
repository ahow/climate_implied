"""Source-pinned physical diagnostics on retained arrays; never runs or fits FaIR.

The extra diagnostic is a *change in annual ERF since annual 1750*, not a
reconstruction of the absolute forcing reference. Natural ERF is not re-zeroed.
All downloaded bytes and failed attempts have receipts. No restricted ancillary
data, purchases, observational-temperature conversion, or attribution surrogate.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import urllib.error
import urllib.request

import numpy as np
import xarray as xr

from compare_retained_igcc_physics import compare_forcing
from reconcile_igcc_history import ERF, digest


FORCING_REVISION = "6e5a0e0fe4525ad77bbdd47da8ebc01b43a06cc1"
DATA_REVISION = "d9726573dccd9381652432b58b38f670af493c1c"
ATTRIBUTION_REVISION = "9633fb45f9bf82b47492f969614568c43f3e5a6f"
FAIR_REVISION = "ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79"
FAIR_FOLLOWUP_REVISION = "95c9051eed6a3d423689a81b9db171b8064005a6"
HEADLINE = "temperature-attribution_global_igcc-assessment_synthesis_headline_IGCC-2025a"
DIRECT_GASES = ("CO2", "CH4", "N2O")
OUT = Path("generated-artifacts/physical-source-alignment")


def source_specs():
    forcing = f"https://raw.githubusercontent.com/ClimateIndicator/forcing-timeseries/{FORCING_REVISION}/"
    data = f"https://raw.githubusercontent.com/ClimateIndicator/data/{DATA_REVISION}/"
    attribution = f"https://raw.githubusercontent.com/ClimateIndicator/anthropogenic-warming-assessment/{ATTRIBUTION_REVISION}/"
    fair = f"https://raw.githubusercontent.com/OMS-NetZero/FAIR/{FAIR_REVISION}/"
    return {
        "forcingLicense": (forcing+"LICENSE", "MIT; repository code, not a blanket licence for ancillary datasets"),
        "forcing2024": (forcing+"output/ERF_best_1750-2024.csv", "Public author-produced output; retained privately, underlying ancillary rights not asserted"),
        "forcingCode2024": (forcing+"notebooks/12_make-forcing.py", "MIT"),
        "volcanicCode2024": (forcing+"notebooks/10_volcanic-forcing.py", "MIT"),
        "slcfCode2024": (forcing+"notebooks/08_slcf-emissions.py", "MIT"),
        "slcfEmissions2024": (forcing+"output/slcf_emissions_1750-2024.csv", "Public author-produced output; private retention, ancillary redistribution rights not asserted"),
        "concentrations2024": (forcing+"output/ghg_concentrations_1750-2024.csv", "Public author-produced output; private retention, ancillary redistribution rights not asserted"),
        "dataLicense": (data+"LICENSE", "CC-BY-4.0"),
        "dataReadme": (data+"README.md", "CC-BY-4.0"),
        "headlines2025": (data+"data/base/anthropogenic_warming/Assessment-Update-2025_GMST_headlines.csv", "CC-BY-4.0"),
        "headlines2025Standard": (data+f"data/CDS/csv/{HEADLINE}.csv", "CC-BY-4.0"),
        "headlines2025Metadata": (data+f"data/CDS/nc/{HEADLINE}.nc", "CC-BY-4.0; also embedded in NetCDF"),
        "gwi2025": (data+"data/base/anthropogenic_warming/Walsh_GMST_timeseries.csv", "CC-BY-4.0"),
        "kcc2025": (data+"data/base/anthropogenic_warming/Ribes_GMST_timeseries.csv", "CC-BY-4.0"),
        "rof2025": (data+"data/base/anthropogenic_warming/Gillett_GMST_timeseries.csv", "CC-BY-4.0"),
        "attributionReadme": (attribution+"README.md", "Public source documentation; private retention, no licence inferred"),
        "oldAttribution2025Extrapolation": (attribution+"results/Assessment-Extrapolation-2025_GMST_headlines.csv", "Public output; private retention, no licence inferred"),
        "published2026": ("https://essd.copernicus.org/articles/18/3889/2026/", "CC-BY-4.0, Forster et al. (2026), doi:10.5194/essd-18-3889-2026"),
        "fairLicense": (fair+"LICENSE", "Apache-2.0"),
        "fairReproduction": (fair+"tests/reproduction_test.py", "Apache-2.0"),
        "fairTree": (f"https://api.github.com/repos/OMS-NetZero/FAIR/git/trees/{FAIR_REVISION}?recursive=1", "GitHub repository file metadata"),
        "fairFollowupTree": (f"https://api.github.com/repos/OMS-NetZero/FAIR/git/trees/{FAIR_FOLLOWUP_REVISION}?recursive=1", "GitHub repository file metadata; follow-up revision, not substituted into frozen benchmark"),
    }


def fetch_source(name, url, license_text, directory):
    """Retain successful and HTTP-error bodies; network failures are explicit."""
    receipt = {"name": name, "url": url, "retrievedAtUTC": datetime.now(timezone.utc).isoformat(),
               "license": license_text, "informationAvailableAt": None,
               "historyBasis": "pinned repository revision or current published article; not original-vintage backtest"}
    try:
        response = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "physical-source-audit/1.0"}), timeout=60)
    except urllib.error.HTTPError as error:
        response = error
        receipt["error"] = str(error)
    except (urllib.error.URLError, TimeoutError) as error:
        return None, {**receipt, "status": None, "error": str(error)}
    with response:
        body = response.read()
        receipt.update(status=response.status, finalURL=response.geturl(),
                       serverDate=response.headers.get("Date"),
                       serverLastModified=response.headers.get("Last-Modified"))
    sha = hashlib.sha256(body).hexdigest()
    target = directory / (sha+".source")
    if target.exists() and target.read_bytes() != body:
        raise ValueError("Content-addressed source collision")
    if not target.exists():
        target.write_bytes(body)
    receipt.update(sha256=sha, retainedPath=str(target))
    return body if receipt["status"] == 200 else None, receipt


def parse_erf(body):
    result = {}
    for row in csv.DictReader(io.StringIO(body.decode("utf-8-sig"))):
        year = int(row.pop(""))
        if year in result:
            raise ValueError("Duplicate ERF year")
        result[year] = {k: float(v) for k, v in row.items()}
    return result


def metrics(actual, target):
    """Median computed after per-member baseline subtraction, not before it."""
    median = actual.median("config").transpose("year", "scenario").values
    delta = median - target[:, None]
    return {
        "scenarios": [
            {"scenario": str(s), "biasWm2": float(delta[:, i].mean()),
             "rmseWm2": float(np.sqrt(np.mean(delta[:, i]**2))),
             "maximumAbsoluteDifferenceWm2": float(np.abs(delta[:, i]).max()),
             "model1750Wm2": float(median[0, i]), "reference1750Wm2": float(target[0]),
             "model2014Wm2": float(median[-1, i]), "reference2014Wm2": float(target[-1])}
            for i, s in enumerate(actual.scenario.values)],
        "maximumScenarioMedianSpreadWm2": float(np.ptp(median, axis=1).max())}


def compare_gas_changes(data, reference):
    """Direct-gas ERF classes only; not emitted-species warming attribution."""
    years = np.arange(1750, 2015)
    if set(reference) != set(range(1750, 2025)):
        raise ValueError("Exact pinned annual ERF years 1750-2024 required")
    results = {}
    for gas in DIRECT_GASES:
        actual = data.forcing_species_annual.sel(year=years, specie=gas).transpose("year", "scenario", "config")
        if actual.attrs.get("units") != "W m-2":
            raise ValueError("Retained forcing must explicitly use W m-2")
        target = np.asarray([reference[int(y)][gas] for y in years])
        if not np.isfinite(actual).all() or not np.isfinite(target).all():
            raise ValueError("Finite direct-gas ERF required")
        results[gas] = {
            "unit": "W m-2", "unitMultiplier": 1, "years": [1750, 2014],
            "raw": metrics(actual, target),
            "alignedAnnual1750Change": metrics(actual-actual.sel(year=1750), target-target[0]),
            "removedModelAnnual1750ByMember": actual.sel(year=1750).values.tolist(),
            "removedReferenceAnnual1750": float(target[0]),
            "modelBaselineConcentrationUnique": np.unique(data.baseline_concentration.sel(specie=gas)).tolist(),
            "modelForcingReferenceConcentrationUnique": np.unique(data.forcing_reference_concentration.sel(specie=gas)).tolist(),
            "concentrationUnit": {"CO2": "ppm", "CH4": "ppb", "N2O": "ppb"}[gas],
        }
    return {
        "directGasERF": results,
        "alignment": "Subtract each series' annual-1750 ERF from itself; FaIR subtraction is memberwise before ensemble median",
        "justification": "2024 source notebooks/12_make-forcing.py computes Meinshausen2020 GHG ERF and subtracts ghg_forcing_offset at 1750; retained FaIR stores boundary-pair annual forcing, with distinct initialized concentration and forcing-reference concentration",
        "interpretation": "ERF changes since the same annual origin only; not an exact conversion between nonlinear concentration reference states and not a fit or accuracy acceptance",
        "timeConvention": "IGCC annual integer label versus FaIR (boundary[y]+boundary[y+1])/2; no integer/midpoint relabel as different data year",
        "naturalAlignment": {"status": "not applied",
            "solarSourceReference": "Mean TSI over complete solar cycles 6755 BCE to 1750 CE, per 2024 make-forcing source",
            "volcanicSourceReferenceComment": "2024 volcanic source declares mean background sAOD over 9500 BCE to 1749 CE",
            "volcanicSourceExecutableReference": "erf_sulf = -20 * (aod - np.mean(aod[:(11262*12)])); concatenation has 135000 HolVol months followed by CMIP7",
            "volcanicSourceUnresolvedDiscrepancy": "Executable reference slice is 135144 months, 144 months longer than the 135000-month pre-1750 block described in source comments. Retained code does not establish comment/code equivalence; no correction or offset invented.",
            "missing": "Retained FaIR/RCMIP source baseline equivalence and compatible pre-1750 source histories; annual 1750 need not be zero"},
        "otherSpecies": "CO2 FFI/AFOLU are emissions bookkeeping, not two additional CO2 forcing terms. ARI+ACI is an anthropogenic subset. Ozone/indirect CH4 effects and precursor/emitted-species attribution are not equated with direct-gas ERF.",
        "centralEligible": False, "annualReferenceGatePassed": False, "threshold": None}


def inspect_species_and_inputs(data, reference, concentration_body, emissions_body):
    columns = set(reference[1750])
    model_gases = [str(s) for s in data.specie.values
                   if str(data.species_type.sel(specie=s).item()) in
                   ("co2", "ch4", "n2o", "cfc-11", "other halogen", "f-gas")]
    inventory = {
        "referenceERFColumns": sorted(columns),
        "modelDirectGasSpecies": model_gases,
        "sameNameDirectGasERFClasses": sorted(set(model_gases) & columns),
        "modelGasNamesWithoutExactReferenceColumn": sorted(set(model_gases)-columns),
        "referenceNamesWithoutExactModelGas": sorted(columns-set(model_gases)),
        "mappingRestriction": "Only CO2/CH4/N2O numerically compared here. Same spelling is not proof of identical chemistry/efficacy; no guessed isomer/name aliases or missing-gas zero-fill.",
        "nativeModelEmissionsUnits": {str(s): str(data.native_emissions_unit.sel(specie=s).item())
                                     for s in data.specie.values if str(data.species_input_mode.sel(specie=s).item()) == "emissions"},
    }
    if concentration_body is not None:
        rows = list(csv.DictReader(io.StringIO(concentration_body.decode("utf-8-sig"))))
        years = [int(r["YYYY"]) for r in rows]
        first = next(r for r in rows if int(r["YYYY"]) == 1750)
        inventory["referenceConcentrationInput"] = {
            "rows": len(rows), "firstYear": min(years), "lastYear": max(years),
            "missing1750to1850": [y for y in range(1750, 1851) if y not in years],
            "actual1750": {s: float(first[s]) for s in DIRECT_GASES},
            "sourceTreatment": "2024 make-forcing source inserts NaN for 1751-1849, then uses pandas interpolation. These are source interpolations, not separately observed annual concentrations."}
    else:
        inventory["referenceConcentrationInput"] = {"status": "retrieval unavailable"}
    if emissions_body is not None:
        rows = list(csv.DictReader(io.StringIO(emissions_body.decode("utf-8-sig"))))
        years = [int(r[""]) for r in rows]
        inventory["referenceEmissionsInput"] = {
            "rows": len(rows), "firstYear": min(years), "lastYear": max(years),
            "species": {s: {
                "firstFiniteYear": min(int(r[""]) for r in rows if r[s] and np.isfinite(float(r[s]))),
                "blankRows": sum(not r[s] for r in rows),
                "value1750AsDelivered": float(rows[0][s]) if rows[0][s] else None}
                for s in rows[0] if s},
            "unitAndBoundaryEvidence": [
                "Source reads CEDS v20250318 and multiplies totals by 0.001; earlier comment still names v2024.07.08",
                "Source explicitly maps SO2 to RCMIP Sulfur and NMVOC to VOC",
                "Source adds RCMIP agricultural-waste, forest, grassland and peat burning before 1997; CEDS+GFED from 1997",
                "Source applies NOx 46.006/30.006 to biomass terms, declaring GFED NO to NO2 conversion",
                "Source includes aviation in CEDS; output headers do not encode units or natural/anthropogenic scope",
                "CH4 and N2O CEDS start in 1970; earlier blank output cells are not zero"],
            "comparisonStatus": "not scored: verify CEDS/GFED units and boundary equivalence to retained RCMIP native totals, especially NOx basis and CH4/N2O natural baseline, before applying conversion"}
    else:
        inventory["referenceEmissionsInput"] = {"status": "retrieval unavailable"}
    return inventory


def inspect_human_reference(base_body, standard_body, metadata_body, method_bodies):
    rows = list(csv.DictReader(io.StringIO(base_body.decode("utf-8-sig"))))
    annual = [r for r in rows if float(r["timebound_lower"]) == 2025 and float(r["timebound_upper"]) == 2026]
    decade = [r for r in rows if float(r["timebound_lower"]) == 2016 and float(r["timebound_upper"]) == 2026]
    if len(annual) != 2 or len(decade) != 1:
        raise ValueError("Expected separate annual/SR15 rows and actual 2016-2025 decade bounds")
    definitions = {}
    for row in annual:
        if row["notes"] not in ("", "SR15 definition"):
            raise ValueError("Unknown annual headline definition")
        key = "SR1.5" if row["notes"] == "SR15 definition" else "Annual"
        if key in definitions:
            raise ValueError("Duplicate headline definition")
        definitions[key] = {"year": 2025, "timeBoundsHalfOpen": [2025, 2026],
                            "p05": float(row["anthropogenic_p05"]),
                            "p50": float(row["anthropogenic_p50"]),
                            "p95": float(row["anthropogenic_p95"])}
    standard = list(csv.DictReader(io.StringIO(standard_body.decode("utf-8-sig"))))
    for definition, values in definitions.items():
        for percentile in ("p05", "p50", "p95"):
            selected = [r for r in standard if r["definition"] == definition and r["component"] == "anthropogenic"
                        and r["percentile"] == percentile and float(r["time"]) == 2025]
            if len(selected) != 1 or float(selected[0]["GMST"]) != values[percentile]:
                raise ValueError("Standardized and base source headlines disagree")
    with xr.open_dataset(io.BytesIO(metadata_body)) as meta:
        if meta.GMST.attrs["units"] != "degC" or "1850-1900" not in meta.GMST.attrs["long_name"]:
            raise ValueError("Explicit human-reference unit and baseline metadata required")
        if "human-induced" not in meta.attrs["summary"].lower() or "GMST" not in meta.attrs["summary"]:
            raise ValueError("Human-induced GMST observable metadata required")
        attrs = {k: meta.attrs[k] for k in ("title", "summary", "source", "references", "license", "date_created", "version")}
        variable_attrs = dict(meta.GMST.attrs)
    methods = {}
    for name, body in method_bodies.items():
        method_rows = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
        by_year = {}
        for row in method_rows:
            year = float(row["timebound_lower"])
            if year in by_year:
                raise ValueError("Duplicate method annual coordinate")
            if float(row["timebound_upper"]) != year+1 or float(row["time"]) != year+.5:
                raise ValueError("Method annual bounds/midpoints disagree")
            by_year[year] = row
        missing = [y for y in range(2016, 2026) if y not in by_year]
        methods[name] = {"firstAnnualYear": min(by_year), "lastAnnualYear": max(by_year),
                         "missing2016to2025": missing,
                         "anthropogenic2025P50": float(by_year[2025]["anthropogenic_p50"]) if 2025 in by_year else None,
                         "note": "Published marginal quantiles, not matched FaIR ensemble members; decade uncertainty cannot be averaged from annual quantiles"}
    return {
        "status": "actual 2025 human-induced GMST source located and cross-checked; model comparison unavailable",
        "observable": "human-induced GMST", "baseline": "1850-1900", "unit": "degC",
        "annualDefinitionsKeptSeparate": definitions,
        "mean2016to2025": {"timeBoundsHalfOpen": [2016, 2026],
            **{p: float(decade[0]["anthropogenic_"+p]) for p in ("p05", "p50", "p95")}},
        "metadata": attrs, "variableMetadata": variable_attrs, "methods": methods,
        "publicationYearIsNotDataYear": True,
        "old2025ExtrapolationNotUsed": "The old attribution repository labels its 2025 estimate Assessment-Extrapolation-2025, based on a 2024 assessment; it is not substituted for the located 2025 update",
        "requiredForComparison": [
            "Actual paired human-only/counterfactual or source-compatible attribution member trajectories, including 2016-2025",
            "Verified model-to-reference GMST observable definition; surface-layer total temperature is not human-induced GMST",
            "Explicit matching Annual versus SR1.5 method; 1.37 is the SR1.5-labelled row, whereas Annual is 1.38",
            "Memberwise 1850-1900 baseline and preserved member identities; no invented GSAT/GMST factor"],
        "shareMeanMembersInRange": None, "centralEligible": False}


def inspect_independent_history(tree_body, reproduction_body, followup_body=None):
    tree = json.loads(tree_body)
    files = [r["path"] for r in tree["tree"] if r["path"].startswith("tests/test_data/") and r["path"].endswith(".nc")]
    reproduction = reproduction_body.decode()
    followup = json.loads(followup_body) if followup_body is not None else None
    if tree.get("truncated") or (followup is not None and followup.get("truncated")):
        raise ValueError("Complete upstream trees required for file inventory")
    return {"revision": FAIR_REVISION, "netcdfTestDataPaths": files,
            "endpointSelectionSourceLines": [line.strip() for line in reproduction.splitlines()
                                             if "2100" in line or "[-1," in line],
            "followupRevision": FAIR_FOLLOWUP_REVISION,
            "followupNetcdfTestDataPaths": ([r["path"] for r in followup["tree"]
                if r["path"].startswith("tests/test_data/") and r["path"].endswith(".nc")] if followup else None),
            "status": "annual independent trajectory still unavailable",
            "missing": ["Published independent annual temperature array at matched 1750-2100 coordinates and all scenario/config identities",
                        "Matched upstream source/config/input provenance for that annual array; do not regenerate it with this execution"],
            "note": "Enumerated actual upstream revision tree and reproduction source, not a rerun of endpoint acceptance",
            "annualReferenceGatePassed": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", help="Already-retained private physical manifest; no FaIR run")
    args = parser.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    sources, receipts = {}, []
    for name, (url, license_text) in source_specs().items():
        body, receipt = fetch_source(name, url, license_text, OUT)
        sources[name] = body
        receipts.append(receipt)
    manifest = json.loads(Path(args.manifest).read_text())
    if digest(manifest["file"]) != manifest["sha256"]:
        raise ValueError("Retained physics hash mismatch")
    if sources["forcing2024"] is None or hashlib.sha256(sources["forcing2024"]).hexdigest() != ERF.stem:
        raise ValueError("Source-producing 2024 revision ERF must byte-match existing pinned ERF")
    reference = parse_erf(sources["forcing2024"])
    # Check the exact source operations before applying any change diagnostic.
    code = sources["forcingCode2024"]
    if (code is None
            or hashlib.sha256(code).hexdigest() != "b067808e644a584dd96144d26f06aeab046a39552bc33a5775d31449fe80bdbb"
            or sources["volcanicCode2024"] is None
            or hashlib.sha256(sources["volcanicCode2024"]).hexdigest() != "00e60e9cb5c8e6b5e3d5479b16dda71f8e4ac093ed6642bd6098b202f8f700ed"):
        raise ValueError("Exact inspected 2024 GHG/natural baseline source required")
    with xr.open_dataset(manifest["file"]) as data:
        raw = compare_forcing(data, reference)
        aligned = compare_gas_changes(data, reference)
        inventory = inspect_species_and_inputs(data, reference, sources["concentrations2024"], sources["slcfEmissions2024"])
        sizes = dict(data.sizes)
    human_names = ("headlines2025", "headlines2025Standard", "headlines2025Metadata", "gwi2025", "kcc2025", "rof2025")
    if all(sources[k] is not None for k in human_names):
        human = inspect_human_reference(*(sources[k] for k in human_names[:3]),
            {k: sources[k] for k in human_names[3:]})
    else:
        human = {"status": "unavailable", "missingSources": [k for k in human_names if sources[k] is None],
                 "shareMeanMembersInRange": None, "centralEligible": False}
    # The old raw helper's unverified scalar targets must not override sourced definitions.
    raw["humanWarming"] = {"status": "see separately sourced humanWarming section"}
    history = (inspect_independent_history(sources["fairTree"], sources["fairReproduction"], sources["fairFollowupTree"])
               if sources["fairTree"] is not None and sources["fairReproduction"] is not None
               else {"status": "source retrieval incomplete", "annualReferenceGatePassed": False})
    result = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "scope": "New source-justified change diagnostic on already-retained matrices; no model, fleet, beta, EV or acceptance rerun",
        "sourceReceipts": receipts, "physicalManifest": str(args.manifest),
        "physicalManifestSha256": digest(args.manifest), "physicalSha256": manifest["sha256"],
        "physicalDimensions": sizes, "codeSha256": digest(__file__),
        "rawForcing": raw, "sourceAlignedForcingChanges": aligned, "humanWarming": human,
        "speciesAndInputAudit": inventory,
        "independentAnnualReference": history,
        "emissionsComparison": {"status": "not performed",
            "missing": "Source-matched native-gas annual emissions and total/natural/anthropogenic/bunker/biomass boundary mapping; GHG CO2e inventory cannot replace native emissions"},
        "centralEligible": False, "calibrated10kEnsembleClaim": False, "fittedParameters": [],
        "sourceHistoryBasis": "current revision diagnostic, not an as-of-vintage validation"}
    text = json.dumps(result, indent=2, allow_nan=False)+"\n"
    target = OUT / (hashlib.sha256(text.encode()).hexdigest()+".json")
    target.write_text(text)
    print(target)


if __name__ == "__main__":
    main()

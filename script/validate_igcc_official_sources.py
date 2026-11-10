"""Explicit PRIVATE source validator/diagnostic; never imported by CI for data.

Uses already fetched, hashed author sources and retained FaIR arrays. No model
run or network call. Public unit tests exercise only independent fixtures.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from independent_fair_benchmark import digest


PINS = {
    "erf": "9d87e026c33b20ccc00c3a12f4a34557553490b37cc43e1eadc324b4678fc035",
    "erfMetadata": "fbf9e254e37b8e93be5ddaa5073b1576dca7be82851b28ba0bffaf20eaea3220",
    "emissionsMetadata": "49f0991d18b66957cfcab015d6fc3df402ebd26289ec8a72ac691a27f82e94a6",
    "gwiCode": "0fb7c34020f4f8ad9a03186ebcf42008f8d862baf4e4f61f7e9220045bcfb6a4",
    "gwiDefinitions": "ee0874342b8d688edebf4a71bca67b073208f8d6357cce284c007031378c56d9",
    "gwiPreset": "682fd93ac45675ec4de64e9c238ce89437a2a41058668ba07c0d9803b276db22",
    "gwiThermalParameters": "25cc0a669ca02ae44c6d862905c2de3e1d8c9d4d465b5c65b9089d02203e5391",
}


def parse_actual_erf(body):
    rows = list(csv.DictReader(io.StringIO(body.decode("utf-8-sig"))))
    result = {}
    for row in rows:
        year = int(row["timebound_lower"])
        if year in result or float(row["timebound_lower"]) != year or float(row["timebound_upper"]) != year+1 or float(row["time"]) != year+.5:
            raise ValueError("Unique exact annual midpoint/bounds required")
        values = {k: float(v) for k, v in row.items() if k not in ("time", "timebound_lower", "timebound_upper")}
        if not np.isfinite(list(values.values())).all():
            raise ValueError("Finite official forcing values required")
        result[year] = values
    if sorted(result) != list(range(1750, 2026)):
        raise ValueError("Full actual source 1750-2025 required, never shorten window")
    return result


def difference_metrics(actual, reference, years):
    selected = actual.sel(year=years).transpose("year", "scenario", "config")
    if not np.isfinite(selected).all():
        raise ValueError("Finite retained member arrays required")
    target = np.array([reference[int(y)] for y in years])
    delta = selected.median("config").values-target[:, None]
    return [{"scenario": str(s), "bias": float(delta[:, i].mean()),
             "rmse": float(np.sqrt(np.mean(delta[:, i]**2))),
             "lastModel": float(selected.median("config").values[-1, i]),
             "lastReference": float(target[-1])}
            for i, s in enumerate(selected.scenario.values)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("physical_manifest")
    parser.add_argument("--sources", default="generated-artifacts/physical-attribution")
    args = parser.parse_args()
    directory = Path(args.sources)
    sources = {name: directory/(sha+".source") for name, sha in PINS.items()}
    for name, path in sources.items():
        if digest(path) != PINS[name]:
            raise ValueError(f"Exact inspected author source hash required: {name}")
    code = sources["gwiCode"].read_text()
    definitions = sources["gwiDefinitions"].read_text()
    preset = sources["gwiPreset"].read_text()
    for text in ("coef_Obs_Results[:, c_k] +", "coef_PiC_Results[:, c_l]", "np.linalg.lstsq", "temp_Att_Results[:, output_vars.index('GHG'), i]", "temp_Att_Results[:, output_vars.index('OHF'), i]"):
        if text not in code:
            raise ValueError("Inspected operative GWI regression equation missing")
    for text in ("START_REGRESS=1850", "seq 2025 2025", "INCLUDE_REG_CONST=n", "VARS=GHG,OHF,Nat", "SCENARIO=observed-2025", "PREINDUSTRIAL_ERA=1850-1900"):
        if text not in preset:
            raise ValueError("Inspected IGCC-2025 operative preset missing")
    for text in ("df_temp.median(axis=1)", "temp_s[:(end_pi-start_pi)].mean()", "max(temp_ma_3) < 0.3", "min(temp_ma_30) > -0.1"):
        if text not in definitions:
            raise ValueError("Source-specific observation/control preprocessing missing")
    parameters = pd.read_csv(sources["gwiThermalParameters"], index_col=0, header=[0, 1])
    if parameters.index.tolist() != ["d", "q"] or parameters.shape != (2, 84) or not np.isfinite(parameters).all().all():
        raise ValueError("Exact inspected source thermal-response parameter layout required")
    reference = parse_actual_erf(sources["erf"].read_bytes())
    manifest = json.loads(Path(args.physical_manifest).read_text())
    if digest(manifest["file"]) != manifest["sha256"]:
        raise ValueError("Actual physical retention hash mismatch")
    forcing = {}
    with xr.open_dataset(sources["erfMetadata"]) as meta, xr.open_dataset(manifest["file"]) as data:
        if meta.attrs.get("version") != "IGCC-2025a" or "CC BY 4.0" not in meta.attrs.get("license", ""):
            raise ValueError("Actual 2025 author version/licence required")
        if meta.time.dt.year.values.tolist() != list(range(1750, 2026)):
            raise ValueError("Actual official history must include 2025")
        for name in ("CO2", "CH4", "N2O", "solar", "volcanic"):
            if meta[name].attrs.get("units") != "W m-2":
                raise ValueError("Explicit official native forcing units required")
            # NetCDF is float32; verify the CSV values at exactly that precision.
            expected = np.asarray([reference[y][name] for y in range(1750, 2026)], dtype=np.float32)
            if not np.array_equal(expected, meta[name].sel(percentile="p50").values):
                raise ValueError("CSV/NetCDF source values differ at publication storage precision")
        for name in ("CO2", "CH4", "N2O", "solar", "volcanic"):
            model_name = {"solar": "Solar", "volcanic": "Volcanic"}.get(name, name)
            actual = data.forcing_species_annual.sel(specie=model_name)
            if actual.attrs.get("units") != "W m-2":
                raise ValueError("Retained forcing native unit mismatch")
            target = {y: reference[y][name] for y in reference}
            forcing[name] = {
                "unit": "W m-2", "alignment": "As delivered annual series; no fitted offsets or natural re-zeroing",
                "fullSourceYears": [1750, 2025], "fullSourceYearCount": 276,
                "fullSourceDifference": difference_metrics(actual, target, np.arange(1750, 2026)),
                "new2015to2025ConditionalSSPVsActualDifference": difference_metrics(actual, target, np.arange(2015, 2026)),
                "boundaryCompatibilityAccepted": False}
    with xr.open_dataset(sources["emissionsMetadata"]) as emissions, xr.open_dataset(manifest["file"]) as data:
        if emissions.attrs.get("version") != "IGCC-2025a" or "CC BY 4.0" not in emissions.attrs.get("license", ""):
            raise ValueError("Official emissions source metadata required")
        years = emissions.time.dt.year.values
        if not np.array_equal(years, np.arange(1959, 2025)):
            raise ValueError("Keep exact full available official emissions window")
        attrs = emissions.CO2_FFI.attrs
        if attrs.get("units") != "Gt" or attrs.get("cell_methods") != "time: sum" or "carbon dioxide" not in attrs.get("long_name", "").lower():
            raise ValueError("Explicit annual native CO2 mass metadata required")
        if data.native_emissions_unit.sel(specie="CO2 FFI").item() != "Gt CO2/yr" or data.species_input_mode.sel(specie="CO2 FFI").item() != "emissions":
            raise ValueError("Actual native CO2 FFI emissions input required, not calculated aggregate CO2")
        values = emissions.CO2_FFI.sel(accounting_method="WGIII").values
        native = {
            "component": "CO2 FFI only, not calculated aggregate CO2",
            "conversion": "Retained annual rate Gt CO2/yr times exact one-year input interval = official annual Gt CO2 mass; multiplier 1, no GWP",
            "fullAvailableSourceYears": [1959, 2024], "sourceYearCount": 66,
            "fullSourceDifference": difference_metrics(data.emissions_native.sel(specie="CO2 FFI"),
                                                      dict(zip(years.tolist(), values.tolist())), years),
            "2025OfficialNativeMassAvailable": False,
            "comparisonMeaning": "Matched broad fossil/industry native-CO2 class and mass/time dimensions; raw differences, not accepted inventory-boundary equivalence or reconstructed actual inputs",
            "remainingBoundaryRequirement": "Document source versus RCMIP cement/carbonation sinks, industrial-process and bunker accounting before replacing model inputs",
            "unresolvedNativeInputSpecies": 52,
            "nonCO2Restriction": "Official CH4/N2O/F-gas values here are GWP100 CO2-equivalent; never substituted for native input rates",
            "LULUCFRestriction": "Do not assert CO2 AFOLU equals source LULUCF without inventory-boundary reconciliation"}
        source_metadata = {k: emissions.attrs[k] for k in ("source", "references", "version", "date_created", "license")}
    report = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "kind": "Private actual-source validator and new official-history raw diagnostics",
        "codeSha256": digest(__file__), "sourceHashes": PINS,
        "observationalKernelCodeSha256": digest(Path(__file__).with_name("igcc_observation_operator.py")),
        "physicalSha256": manifest["sha256"], "modelsRun": 0,
        "sourceProof": {
            "gwiTag": "IGCC-2025", "gwiRevision": "b18b5fc8731b5c966613cc6ac38c35be1ab8984a",
            "operator": "Three separate GHG/Nat/OHF fingerprints; no-intercept least squares against observed GMST and piControl; sum their coefficients; human=GHG+OHF",
            "observationBaseline": "Common 1850-1900 mean of ensemble median, preserving observational baseline uncertainty",
            "controlBaselineExecutable": "Each raw source control slice subtracts its first 50 positions (end_pi-start_pi); distinct from model/observation 51-year baseline. This source code distinction is not silently corrected.",
            "controlFilter": "Source strict 3-year smoothed extrema within +/-0.3, span >0.06; 30-year smoothed extrema within +/-0.1",
            "subsamplePreset": "Five repeated samples=60 invocations cap EACH forcing/observation/control sample at 60 without replacement, while retaining all 28 thermal configurations. With adequate source members, each repeat has 28*60*60*60 = 6048000 combinations. This is an operative-code count, not a claim that an ensemble was executed here.",
            "thermalParameters": "28 source climate configurations, each with three q/d response terms (2 rows x 84 columns); not the retained benchmark's 66 configurations",
            "versionBridgeRequired": "Operative code imports models.FaIR_V2.FaIRv2_0_0_alpha1.fair.fair_runner, absent from the inspected complete repository tree. Deliver independently published source fingerprints or validate thermal-response equivalence using supported installed FaIR 2.2.4; do not pretend these runners/configurations are interchangeable.",
            "spatialOperatorFinding": "GWI does not require arbitrary GSAT rescaling: regression onto actual HadCRUT GMST absorbs multiplicative response scale. This is an attribution-based observational constraint, not a direct spatial mixing operator and not applicable to arbitrary total/paired SSP vectors."},
        "actual2025ForcingSource": "ClimateIndicator/data@d9726573dccd9381652432b58b38f670af493c1c, IGCC-2025a; actual 1750-2025 annual ERF, CSV verified against NetCDF at float32 storage precision",
        "forcingRawDiagnostics": forcing,
        "nativeCO2RawDiagnostic": native, "nativeEmissionSourceMetadata": source_metadata,
        "readyImplementation": "script/igcc_observation_operator.py; source-only tests require no private files",
        "residualRequirements": [
            "Legally usable pinned full 1000-member historical ERF ensemble through 2025, source climate parameter set and version-compatible fresh separate GHG/Nat/OHF response runs; current paired SSP intervention is not these fingerprints",
            "Actual HadCRUT5.1 200-member observations and permitted-use source piControl overlapping slices with exact filters/baselines and joint sampling identity",
            "Underlying Git-LFS historical ERF objects and ancillary data have not been fetched merely from pointers; verify source-specific reuse terms and delivered hashes first",
            "Native emissions histories for the 53 active inputs through actual 2025 remain incomplete; published official GHG mass output ends 2024 and nonCO2 entries are CO2e",
            "Execute independent source-compatible GWI attribution ensemble or obtain published joint attributed GMST members; marginal quantiles are not joint members. Then apply fixed SR1.5 and decade operators before any member share."
        ],
        "actualQualifiedMemberComparisonPerformed": False, "shareMeanMembersInRange": None,
        "centralEligible": False, "pointTargetTuning": False, "vintageValidationClaim": False}
    text = json.dumps(report, indent=2, allow_nan=False)+"\n"
    target = directory/("official-history-validation-"+hashlib.sha256(text.encode()).hexdigest()+".json")
    target.write_text(text)
    print(target)


if __name__ == "__main__":
    main()

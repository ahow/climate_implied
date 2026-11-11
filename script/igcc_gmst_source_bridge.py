"""Pinned actual-GMST source assembly, not attribution or climate calibration.

The official HadCRUT5 coverage-uncertainty column is retained separately, not
silently added to realization members or mistaken for an independent member.
No SSP temperature, synthetic control or human-warming headline is an input.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import xarray as xr

from igcc_observation_operator import common_observation_baseline


VERSION = "HadCRUT.5.1.0.0"
FILENAME = VERSION + ".analysis.ensemble_series.global.annual.csv"
CSV_SHA256 = "8bd47a7647515ac20beb960882d503b5697829fa702e9067e795ddf7fd046155"
GIT_BLOB_SHA1 = "d79fbb5a2cb3092de508666742907c32c2e62d42"
REVISION = "b18b5fc8731b5c966613cc6ac38c35be1ab8984a"
PROTOCOL = Path("docs/igcc-gmst-source-bridge-protocol.json")
PROTOCOL_SHA256 = "d22a0c00f9e32abc6e28f3591e15be64583d802121eba035077a6341eec7292a"
DEFINITIONS_SHA256 = "ee0874342b8d688edebf4a71bca67b073208f8d6357cce284c007031378c56d9"
LANDING_SHA256 = "93247c5631b0df39a05cf75203c85eb62b02d272b1f274e7ca1edc9a401b64a7"
TERMS_SHA256 = "5d28efbdc48281339957dc14f0bf251e98d5aa152f59cd8e469decfa3e85f852"
PREFIX = ["Time", "Fraction of area represented", "Coverage uncertainty (1 sigma)"]
MEMBERS = [str(i) for i in range(1, 201)]
HEADER = PREFIX + ["Realization " + i for i in MEMBERS]
YEARS = np.arange(1850, 2026)


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def parse_native_annual(body):
    """Parse complete native source identities, rejecting summaries and gaps."""
    rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
    if not rows or rows[0] != HEADER:
        raise ValueError("Exact ordered HadCRUT 200-realization source header required")
    indexed = {}
    for row in rows[1:]:
        if len(row) != len(HEADER):
            raise ValueError("Complete source CSV row required")
        # Integer text only: no int(float()) coercion of a year coordinate.
        try:
            year = int(row[0])
        except ValueError as exc:
            raise ValueError("Exact integer annual source years required") from exc
        if row[0] != str(year) or year in indexed:
            raise ValueError("Unique exact integer annual source years required")
        try:
            values = np.asarray(row[1:], dtype=float)
        except ValueError as exc:
            raise ValueError("Numeric source data required") from exc
        if not np.isfinite(values).all():
            raise ValueError("Finite complete source values required")
        if not 0 <= values[0] <= 1 or values[1] < 0:
            raise ValueError("Physical coverage fraction/uncertainty required")
        indexed[year] = values
    if sorted(indexed) not in (YEARS.tolist(), YEARS.tolist()+[2026]):
        raise ValueError("Complete fixed 1850-2025 years, only optional excluded 2026 allowed")
    values = np.stack([indexed[int(year)] for year in YEARS])
    native = xr.DataArray(
        values[:, 2:], dims=("year", "observation_member"),
        coords={"year": YEARS, "observation_member": MEMBERS},
        attrs={"units": "degC", "reference_period": "1961-1990",
               "observable": "HadCRUT5 global blended near-surface temperature anomaly"},
    )
    centered, offset = common_observation_baseline(native, "observation_member")
    dataset = xr.Dataset({
        "native_gmst_anomaly": native,
        "gmst_anomaly": centered.assign_attrs(
            units="degC", reference_period="1850-1900",
            baseline_operator="mean of annual ensemble medians, common to all members"),
        "common_baseline_offset": offset.assign_attrs(units="degC"),
        "fraction_of_area_represented": ("year", values[:, 0], {"units": "1"}),
        "coverage_uncertainty_1sigma": ("year", values[:, 1], {
            "units": "degC", "treatment": "Retained source diagnostic, not added to GWI realizations"}),
    })
    return dataset, [y for y in indexed if y not in YEARS]


def assemble(directory):
    """Private explicit assembly; all real inputs must match inspected bytes."""
    directory = Path(directory)
    pins = {
        PROTOCOL: PROTOCOL_SHA256,
        directory/FILENAME: CSV_SHA256,
        directory/"hadcrut-landing.html": LANDING_SHA256,
        directory/"hadcrut-terms.html": TERMS_SHA256,
        Path("generated-artifacts/physical-attribution")/(DEFINITIONS_SHA256+".source"): DEFINITIONS_SHA256,
    }
    for path, expected in pins.items():
        if sha256(path) != expected:
            raise ValueError(f"Pinned source/protocol SHA-256 mismatch: {path}")
    terms = (directory/"hadcrut-terms.html").read_text()
    landing = (directory/"hadcrut-landing.html").read_text()
    definitions = (Path("generated-artifacts/physical-attribution")/
                   (DEFINITIONS_SHA256+".source")).read_text()
    if ("HadCRUT5 is subject to Crown copyright" not in terms
            or "Open Government License v3" not in terms
            or "1961-1990 reference period" not in landing
            or "df_temp.median(axis=1)" not in definitions):
        raise ValueError("Dataset-specific rights, native reference and source baseline proof required")
    body = (directory/FILENAME).read_bytes()
    blob = hashlib.sha1(b"blob "+str(len(body)).encode()+b"\0"+body).hexdigest()
    if blob != GIT_BLOB_SHA1:
        raise ValueError("Actual native git blob differs from located source identity")
    dataset, excluded = parse_native_annual(body)
    # Independent arithmetic check, not just calling the same helper twice.
    native = dataset.native_gmst_anomaly.values
    offset = float(np.median(native[:51], axis=1).sum()/51)
    np.testing.assert_allclose(dataset.gmst_anomaly.values, native-offset, rtol=0, atol=1e-15)
    before = native-native[:, :1]
    after = dataset.gmst_anomaly.values-dataset.gmst_anomaly.values[:, :1]
    np.testing.assert_allclose(after, before, rtol=0, atol=5e-16)
    member_baselines = dataset.gmst_anomaly.sel(year=slice(1850, 1900)).mean("year")
    if not float(member_baselines.max()-member_baselines.min()) > 0:
        raise ValueError("Observational member baseline uncertainty was erased")
    dataset.attrs.update({
        "version": "igcc-gmst-source-bridge-1",
        "source_version": VERSION, "source_sha256": CSV_SHA256,
        "source_git_blob_sha1": blob, "gwi_source_revision": REVISION,
        "protocol_sha256": PROTOCOL_SHA256,
        "data_license": "Open Government Licence v3; British Crown Copyright, Met Office",
        "attribution": "Morice et al., doi:10.1029/2019JD032361",
        "source_acquisition": "2026-11-11; exact GWI repository snapshot, not direct Met Office download",
        "vintage_caveat": "Original publication day and original-time availability not independently established",
        "historical_window": "1850-2025 inclusive; any partial 2026 source row excluded",
        "qualification": "Observed GMST members only; not attributed human warming or a calibrated joint ensemble",
    })
    output = directory/"actual-gmst-observation-members.nc"
    dataset.to_netcdf(output, engine="h5netcdf")
    with xr.open_dataset(output, engine="h5netcdf") as reread:
        xr.testing.assert_equal(dataset, reread.load())
    result = {
        "version": "igcc-gmst-source-bridge-1",
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "status": "actual-source-observation-dependency-assembled; attribution-withheld",
        "inputPins": {str(p): expected for p, expected in pins.items()},
        "codePins": {str(p): sha256(p) for p in (
            Path(__file__), Path("script/igcc_observation_operator.py"))},
        "sourceVersion": VERSION, "sourceRepositoryRevision": REVISION,
        "sourceGitBlobSHA1": blob, "sourceBytes": len(body),
        "units": "degrees Celsius GMST anomaly",
        "nativeReferencePeriod": "1961-1990", "assembledReferencePeriod": "1850-1900",
        "annualYearsInclusive": [1850, 2025], "annualRows": len(YEARS),
        "realObservationMembers": len(MEMBERS), "excludedSourceYears": excluded,
        "commonBaselineOffsetC": offset,
        "memberBaselineRangeC": [float(member_baselines.min()), float(member_baselines.max())],
        "baselinePairDifferenceMaxAbsChangeC": float(np.max(np.abs(after-before))),
        "coverageUncertaintyTreatment": "Preserved separately; not sampled, added or claimed included by the GWI member series",
        "coverageFraction2025": float(dataset.fraction_of_area_represented.sel(year=2025)),
        "coverageUncertainty1Sigma2025C": float(dataset.coverage_uncertainty_1sigma.sel(year=2025)),
        "rights": "Dataset-specific Met Office HadCRUT5 terms: Crown copyright, Open Government Licence v3; citation and acknowledgement required",
        "attribution": "Morice et al., doi:10.1029/2019JD032361; HadCRUT.5.1.0.0 source snapshot obtained from pinned author repository on 2026-11-11. Original first-publication year not inferred.",
        "output": str(output), "outputSHA256": sha256(output),
        "nativeEmissionInputsReplaced": 0, "newModelsRun": 0,
        "humanWarmingHeadlineScoring": False, "shareMembersInRange": None,
        "centralEligible": False,
        "remainingDependencies": [
            "Permitted-use piControl source identities and filtered slices",
            "Actual GHG/OHF/Nat forcing ensembles and validated alpha1/supported thermal-response bridge",
            "Boundary-reconciled actual native emissions through 2025 for all active species",
        ],
    }
    result_path = directory/"assembly-result.json"
    result_path.write_text(json.dumps(result, indent=2)+"\n")
    return result_path, result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", default="generated-artifacts/igcc-gmst-source-bridge")
    args = parser.parse_args()
    path, result = assemble(args.sources)
    print(json.dumps({"result": str(path), "resultSHA256": sha256(path),
                      "status": result["status"], "annualRows": result["annualRows"],
                      "realObservationMembers": result["realObservationMembers"]}, indent=2))


if __name__ == "__main__":
    main()

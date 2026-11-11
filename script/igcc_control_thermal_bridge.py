"""Fail-closed control admission and explicitly qualified modal thermal bridge.

No observation assembly or attribution is run. The AR5 sibling's midpoint
quadrature is NOT silently equated with alpha1 or an exact annual mean.
"""
import argparse
import ast
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr

from igcc_observation_operator import prepare_gwi_controls
from validate_igcc_official_sources import parse_actual_erf


ROOT = Path("generated-artifacts/igcc-control-thermal-bridge")
ORIGINAL = Path("generated-artifacts/physical-attribution")
PARAM_SHA = "25cc0a669ca02ae44c6d862905c2de3e1d8c9d4d465b5c65b9089d02203e5391"
ERF_SHA = "9d87e026c33b20ccc00c3a12f4a34557553490b37cc43e1eadc324b4678fc035"
AR5_SHA = "0af19c944dd8067c730dcb1d50fc9c7e07bb52e9ca90be607bbd393333d0f605"
FAIR_SHA = "568ace02ddb0fb72068830635512adfabaaf83b0b5ff296b73f4312ae4a7b87e"
OHF = ("aerosol-radiation_interactions", "aerosol-cloud_interactions",
       "contrails", "land_use", "BC_on_snow", "O3", "H2O_stratospheric")
NAT = ("solar", "volcanic")
COMPONENTS = ("GHG", "Nat", "OHF")


def digest(body):
    return hashlib.sha256(body).hexdigest()


def read_qualified_control(source_body, extraction_body, terms_body, metadata):
    """Admit an explicitly evidenced original MAG and annual World extraction.

    This does not guess an unavailable MAG schema or pretend an arbitrary CSV
    is native CMIP6. A future caller must supply independently extracted annual
    values, original bytes and actual original license metadata/rights evidence.
    """
    required = ("source_path", "source_sha256", "extraction_sha256",
                "terms_evidence_sha256", "institution_id", "source_id",
                "experiment_id", "variant_label", "grid_label", "version",
                "variable_id", "region", "units", "license_id", "license_text")
    if any(not isinstance(metadata.get(k), str) or not metadata[k].strip() for k in required):
        raise ValueError("Complete explicit source identity and specific license evidence required")
    for body, key in ((source_body, "source_sha256"),
                      (extraction_body, "extraction_sha256"),
                      (terms_body, "terms_evidence_sha256")):
        if digest(body) != metadata[key]:
            raise ValueError(f"Original source/extraction/terms hash mismatch: {key}")
    licenses = {
        "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
        "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
        "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
    }
    url = licenses.get(metadata["license_id"])
    if url is None or url not in metadata["license_text"]:
        raise ValueError("Explicit compatible model-specific license required; no generic CMIP template")
    # A claim in caller metadata alone is not license evidence.
    if (metadata["license_text"] not in source_body.decode("utf-8")
            or metadata["license_text"] not in terms_body.decode("utf-8")):
        raise ValueError("Exact original model license must be evidenced in source and rights bytes")
    if (metadata["experiment_id"] != "piControl" or metadata["variable_id"] != "tas"
            or metadata["region"] != "World" or metadata["units"] not in ("K", "degC")):
        raise ValueError("Native annual World piControl tas in K or degC required")
    for key in ("institution_id", "source_id", "experiment_id", "variant_label",
                "grid_label", "version", "variable_id"):
        if metadata[key] not in metadata["source_path"].split("/"):
            raise ValueError(f"Semantic source identity not present in original path: {key}")
    rows = list(csv.reader(io.StringIO(extraction_body.decode("utf-8-sig"))))
    if not rows or rows[0] != ["year", "tas"]:
        raise ValueError("Explicit annual extraction year/tas columns required")
    years, values = [], []
    for row in rows[1:]:
        if len(row) != 2:
            raise ValueError("Complete annual extraction required")
        year = int(row[0])
        if row[0] != str(year):
            raise ValueError("Exact native annual integer coordinates required")
        years.append(year)
        values.append(float(row[1]))
    years, values = np.asarray(years), np.asarray(values)
    if (len(years) < 176 or not np.all(np.diff(years) == 1)
            or not np.isfinite(values).all()):
        raise ValueError("Finite complete consecutive native annual control required; never drop gaps")
    identity = "/".join(metadata[k] for k in (
        "institution_id", "source_id", "experiment_id", "variant_label",
        "grid_label", "version", "variable_id"))
    step, length = 88, 176
    count = (len(values)-(length-step))//step
    starts = np.arange(count)*step
    names = [f"{identity}_slice-{i}:{i+length}" for i in starts]
    raw = xr.DataArray(
        np.stack([values[i:i+length] for i in starts], axis=1),
        dims=("year", "control_member"),
        coords={"year": np.arange(1850, 2026), "control_member": names})
    prepared, offsets = prepare_gwi_controls(raw)
    slices = [{
        "control_member": name, "startPosition": int(start), "endPositionExclusive": int(start+length),
        "nativeFirstYear": int(years[start]), "nativeLastYear": int(years[start+length-1]),
        "filterPassed": name in prepared.control_member.values.tolist(),
    } for name, start in zip(names, starts)]
    prepared.attrs.update({
        "units": "degC anomaly", "source_identity": identity,
        "source_sha256": metadata["source_sha256"], "license_id": metadata["license_id"],
        "control_baseline": "first 50 positions of each native 176-position slice",
        "qualification": "Admitted source only, not complete GWI controls; retraction/publication review still required"})
    return prepared, offsets, slices


def _inputs(forcing, q, d):
    forcing, q, d = np.asarray(forcing, float), np.asarray(q, float), np.asarray(d, float)
    if (forcing.ndim != 1 or q.shape != (3,) or d.shape != (3,)
            or not np.isfinite(forcing).all() or not np.isfinite(q).all()
            or not np.isfinite(d).all() or (d <= 0).any() or (q < 0).any()):
        raise ValueError("Finite annual forcing and exactly three nonnegative q/positive d terms required")
    return forcing, q, d


def modal_response(forcing, q, d):
    """Independent exact annual-constant and source midpoint recurrences."""
    forcing, q, d = _inputs(forcing, q, d)
    decay = np.exp(-1/d)
    gain = -np.expm1(-1/d)
    exact_state = np.zeros(3)
    midpoint_state = np.zeros(3)
    output = np.empty((len(forcing), 3))
    for i, value in enumerate(forcing):
        mean = q*value+(exact_state-q*value)*d*gain
        exact_state = decay*exact_state+q*gain*value
        midpoint_state = decay*midpoint_state+q/d*np.exp(-.5/d)*value
        output[i] = (exact_state.sum(), mean.sum(), midpoint_state.sum())
    return output


def supported_modal_boundary(forcing, q, d):
    """Use supported FaIR matrix update in modal, NOT physical-ocean coordinates."""
    from fair.energy_balance_model import step_temperature
    forcing, q, d = _inputs(forcing, q, d)
    matrix = np.diag(np.exp(-1/d))[None, ...]
    vector = (q*(-np.expm1(-1/d)))[None, ...]
    state, noise = np.zeros((1, 3)), np.zeros((1, 3))
    values = []
    for value in forcing:
        state = step_temperature(state, matrix, vector, noise, np.array([[value]]))[None, :]
        values.append(state.sum())
    return np.asarray(values)


def source_midpoint(forcing, q, d, source_body):
    """Exact hash-pinned sibling FTmod, all three original terms by linearity."""
    forcing, q, d = _inputs(forcing, q, d)
    if digest(source_body) != AR5_SHA:
        raise ValueError("Exact inspected operative AR5 sibling source required")
    tree = ast.parse(source_body)
    function = next(node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "FTmod")
    # Do not execute repository-level imports, gas parameters or missing alpha1.
    namespace = {"np": np}
    exec(compile(ast.Module(body=[function], type_ignores=[]), "<pinned source FTmod>", "exec"), namespace)
    result = np.zeros(len(forcing))
    for qi, di in zip(q, d):
        params = np.zeros(20)
        params[10], params[15], params[16] = qi, di, 1
        result += namespace["FTmod"](len(forcing), params) @ forcing
    return result


def residual(a, b, first=0):
    delta = np.asarray(a)[first:]-np.asarray(b)[first:]
    return {"maxAbsC": float(np.abs(delta).max()), "rmseC": float(np.sqrt(np.mean(delta**2)))}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default=str(ROOT))
    args = parser.parse_args()
    output = Path(args.output)
    from fair import __version__
    from fair import energy_balance_model
    import inspect
    fair_file = Path(inspect.getfile(energy_balance_model))
    if __version__ != "2.2.4" or digest(fair_file.read_bytes()) != FAIR_SHA:
        raise ValueError("Exact inspected supported FaIR2.2.4 matrix-step implementation required")
    files = {
        ORIGINAL/(PARAM_SHA+".source"): PARAM_SHA,
        ORIGINAL/(ERF_SHA+".source"): ERF_SHA,
        ROOT/"ar5-ir.py.source": AR5_SHA,
        ROOT/"control-readme.txt": "22d30202453758bd4b1b3ed787f8e3f7f3a3ca828cf1359ea182b06b7b4d720a",
        ROOT/"cmip6-terms.html": "69397921f4b89febd709a32588fa0f716e357f296b2ab2f51f218e55b7607876",
        Path("docs/igcc-control-thermal-bridge-protocol.json"): "9b0e8f82dd67f6b211d4af8a44a03e1a18d2f13ab039f1cff501020c42d4a44c",
        Path("docs/igcc-control-thermal-operational-freeze.json"): "68da9a373537538b0f5748c8a0779134958304abff30abde256f849372f6a61f",
    }
    # The operational freeze is saved and hashed with each result, never edited
    # after inspecting residuals to manufacture a numerical acceptance rule.
    freeze = Path("docs/igcc-control-thermal-operational-freeze.json")
    for file, expected in files.items():
        if digest(file.read_bytes()) != expected:
            raise ValueError(f"Source/protocol hash mismatch: {file}")
    parameters = pd.read_csv(ORIGINAL/(PARAM_SHA+".source"), header=[0, 1], index_col=0)
    models = list(dict.fromkeys(parameters.columns.get_level_values(0)))
    if len(models) != 28 or parameters.shape != (2, 84) or parameters.index.tolist() != ["d", "q"]:
        raise ValueError("Complete unmodified 28-configuration three-term thermal source required")
    reference = parse_actual_erf((ORIGINAL/(ERF_SHA+".source")).read_bytes())
    columns = list(reference[1750])
    ghg = [c for c in columns if c not in OHF+NAT]
    groups = (ghg, list(NAT), list(OHF))
    forcing = np.asarray([[sum(reference[y][c] for c in group) for group in groups]
                          for y in range(1750, 2026)])
    total = np.asarray([sum(reference[y].values()) for y in range(1750, 2026)])
    classification_residual = float(np.max(np.abs(forcing.sum(axis=1)-total)))
    results = np.empty((276, 28, 3, 3))
    rows = []
    source_body = (ROOT/"ar5-ir.py.source").read_bytes()
    for i, model in enumerate(models):
        p = parameters[model]
        if p.columns.tolist() != ["1", "2", "3"]:
            raise ValueError("All original response terms and their ordering required")
        q, d = p.loc["q"].to_numpy(), p.loc["d"].to_numpy()
        for j, component in enumerate(COMPONENTS):
            values = modal_response(forcing[:, j], q, d)
            supported = supported_modal_boundary(forcing[:, j], q, d)
            sibling = source_midpoint(forcing[:, j], q, d, source_body)
            results[:, i, j] = values
            rows.append({
                "configuration": model, "component": component,
                "midpointRecurrenceMinusSiblingFTmod": residual(values[:, 2], sibling),
                "supportedStepMinusExactBoundary": residual(supported, values[:, 0]),
                "siblingMidpointMinusExactAnnualMean": residual(sibling, values[:, 1]),
                "siblingMidpointMinusExactAnnualMean2015to2025": residual(sibling, values[:, 1], 265),
            })
    dataset = xr.Dataset({
        "unregressed_modal_response": (("year", "configuration", "component", "method"), results),
        "actual_p50_erf": (("year", "component"), forcing),
    }, coords={"year": np.arange(1750, 2026), "configuration": models,
               "component": list(COMPONENTS), "method": ["exact_boundary", "exact_annual_mean", "sibling_midpoint"]})
    dataset.unregressed_modal_response.attrs.update(units="degC", qualification="Unregressed source-method diagnostic, not attributed GMST")
    dataset.actual_p50_erf.attrs.update(units="W m-2", qualification="Actual source p50 aggregate only, not joint forcing ensemble")
    dataset.attrs.update(initial_state="all modal diagnostic states zero at 1750 boundary; not source alpha1 initialization proof",
                         alpha1_equivalence="unverified", observation_assembly_rerun="no",
                         protocol_sha256=files[Path("docs/igcc-control-thermal-bridge-protocol.json")],
                         operational_freeze_sha256=digest(freeze.read_bytes()))
    output.mkdir(parents=True, exist_ok=True)
    nc = output/"unregressed-thermal-method-diagnostic.nc"
    dataset.to_netcdf(nc, engine="h5netcdf")
    with xr.open_dataset(nc, engine="h5netcdf") as reread:
        xr.testing.assert_equal(dataset, reread.load())
    result = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "status": "modal-matrix-update-verified; sibling-discretization-not-equivalent; alpha1-and-controls-blocked",
        "sourcePins": {str(p): sha for p, sha in files.items()},
        "supportedFaIRSourceSHA256": FAIR_SHA,
        "operationalFreezeSHA256": digest(freeze.read_bytes()),
        "implementationSHA256": digest(Path(__file__).read_bytes()),
        "sourceClasses": dict(zip(COMPONENTS, groups)),
        "classificationTotalMaxAbsResidualWm2": classification_residual,
        "allConfigurations": 28, "allComponents": 3, "annualYears": [1750, 2025],
        "actualJointForcingEnsembleFetched": False, "actualControlsFetched": 0,
        "actualQualifiedControlSlices": 0, "newAttributionRuns": 0,
        "shareMembersInRange": None, "centralEligible": False,
        "output": str(nc), "outputSHA256": digest(nc.read_bytes()),
        "residuals": rows,
    }
    receipt = output/"thermal-method-result.json"
    receipt.write_text(json.dumps(result, indent=2)+"\n")
    print(json.dumps({"result": str(receipt), "resultSHA256": digest(receipt.read_bytes()),
                      "comparisonRows": len(rows), "status": result["status"]}, indent=2))


if __name__ == "__main__":
    main()

"""Independent upstream SSP numerical benchmark; endpoint-only acceptance."""
import hashlib
import json
from pathlib import Path
from unittest.mock import patch

import fair
from fair import FAIR
from fair.interface import fill, initialise
from fair.io import read_properties
import numpy as np
import pandas as pd
import pooch
import xarray as xr

ROOT = Path("generated-artifacts/independent-fair-benchmark")
REVISION = "ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79"
HASHES = {
    "4xCO2_cummins_ebm3.csv": "aff935fa3108a7c022f7f4ae1445033fd7fd117bbd709c67cc5223e4a712ce0d",
    "cmip6_ssp_emissions_run_temperature_2100.nc": "5a211aba211865388bfc2aefef74c053937df10a44d3204c28582c6c0b6176b7",
    "cmip6_ssp_emissions_run_co2_concentration_2100.nc": "694350f6731029b5d0698472b8699e7eb47ed1bef2ad4d093cd13dced797b34b",
    "cmip6_ssp_emissions_run_forcing_sum_2100.nc": "80444806dc454aaae1631caf7593c8dda632f95b689fab9e562b66c14f528e79"}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def compare(actual, expected, temperature=False):
    if actual.dims != expected.dims or actual.shape != expected.shape:
        raise ValueError("Reference dimension mismatch")
    if set(actual.coords) != set(expected.coords):
        raise ValueError("Reference coordinate names mismatch")
    for coord in expected.coords:
        if not actual.coords[coord].equals(expected.coords[coord]):
            raise ValueError(f"Reference coordinate mismatch: {coord}")
    a, e = actual.values, expected.values
    if not np.isfinite(a).all() or not np.isfinite(e).all():
        raise ValueError("Nonfinite benchmark")
    delta = np.abs(a - e)
    return {"maxAbsoluteDifference": float(delta.max()),
            "passed": bool(np.all(delta <= (.01 if temperature else 1e-8 + 1e-5 * np.abs(e)))),
            "cells": int(delta.size)}


def main():
    if fair.__version__ != "2.2.4":
        raise ValueError("Pinned FaIR 2.2.4 required")
    for name, sha in HASHES.items():
        if digest(ROOT / name) != sha:
            raise ValueError(f"Source hash mismatch: {name}")
    # Record inputs actually used by FaIR's hash-verifying RCMIP loader.
    receipts = []
    retrieve = pooch.retrieve

    def recorded_retrieve(*args, **kwargs):
        path = retrieve(*args, **kwargs)
        receipts.append({"url": kwargs["url"], "upstreamKnownHash": kwargs["known_hash"],
                         "sha256": digest(path), "retainedPath": str(path)})
        return path

    f = FAIR(ch4_method="thornhill2021")
    f.define_time(1750, 2100, 1)
    f.define_scenarios(["ssp119", "ssp126", "ssp245", "ssp370", "ssp434", "ssp460",
                        "ssp534-over", "ssp585"])
    df = pd.read_csv(ROOT / "4xCO2_cummins_ebm3.csv")
    configs = [f"{model}_{run}" for model in df["model"].unique()
               for run in df.loc[df["model"] == model, "run"]]
    f.define_configs(configs)
    species, properties = read_properties()
    f.define_species(species, properties)
    f.allocate()
    f.fill_species_configs()
    fill(f.species_configs["unperturbed_lifetime"], 10.8537568, specie="CH4")
    fill(f.species_configs["baseline_emissions"], 19.01978312, specie="CH4")
    fill(f.species_configs["baseline_emissions"], 0.08602230754, specie="N2O")
    with patch("pooch.retrieve", recorded_retrieve):
        f.fill_from_rcmip()
    initialise(f.concentration, f.species_configs["baseline_concentration"])
    for state in (f.forcing, f.temperature, f.cumulative_emissions, f.airborne_emissions):
        initialise(state, 0)
    for i, config in enumerate(configs):
        model, run = config.split("_")
        row = df.loc[(df["model"] == model) & (df["run"] == run)]
        for field, first, last in (("ocean_heat_capacity", "C1", "C3"),
                                   ("ocean_heat_transfer", "kappa1", "kappa3")):
            fill(f.climate_configs[field], row.loc[:, first:last].values.squeeze(), config=config)
        for field, column in (("deep_ocean_efficacy", "epsilon"),
                              ("gamma_autocorrelation", "gamma"),
                              ("sigma_eta", "sigma_eta"), ("sigma_xi", "sigma_xi")):
            fill(f.climate_configs[field], row[column].values[0], config=config)
        for field, value in (("stochastic_run", True), ("use_seed", True),
                              ("seed", 1355763 + i * 399)):
            fill(f.climate_configs[field], value, config=config)
    f.run(progress=False)
    if not np.isfinite(f.temperature.values).all():
        raise ValueError("Nonfinite full temperature trajectory")
    actuals = {"temperature": f.temperature[-1, ..., 0],
               "co2_concentration": f.concentration[-1, ..., 2],
               "forcing_sum": f.forcing_sum[-1, ...]}
    comparisons = {}
    for key, actual in actuals.items():
        with xr.open_dataarray(ROOT / f"cmip6_ssp_emissions_run_{key}_2100.nc") as reference:
            comparisons[key] = compare(actual, reference, key == "temperature")
    report = {"upstreamRevision": REVISION, "fairVersion": fair.__version__,
              "sourceHashes": HASHES, "rcmipReceipts": receipts,
              "protocolSha256": digest("docs/Independent_FaIR_Benchmark_Protocol.md"),
              "codeSha256": digest(__file__), "configurations": len(configs),
              "scenarios": f.scenarios, "comparisons": comparisons,
              "annualReferenceGate": "unavailable: published reference contains endpoint only",
              "centralEligible": False, "informationAvailableAt": None,
              "fullTemperatureFinite": True}
    text = json.dumps(report, indent=2, allow_nan=False) + "\n"
    target = ROOT / ("result-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if not target.exists():
        with target.open("x") as stream:
            stream.write(text)
    elif target.read_text() != text:
        raise ValueError("Evidence changed")
    # Retain computed trajectories without overwriting the independent reference.
    out = ROOT / (target.stem + "-temperature.nc")
    if not out.exists():
        f.temperature.to_netcdf(out)
    print(json.dumps({"evidence": str(target), **report}, indent=2))


if __name__ == "__main__":
    main()

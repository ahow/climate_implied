"""Retain actual FaIR arrays, not reconstructed CO2e or inferred attribution."""
import hashlib
import json
from pathlib import Path

import numpy as np
import xarray as xr
from fair.structure.units import desired_concentration_units, desired_emissions_units


def physical_dataset(model):
    """Annual emissions are native input rates; forcing is boundary-pair mean."""
    species = list(model.species)
    natural = [s for s in species if model.properties[s]["type"] in ("solar", "volcanic")]
    aerosol = [s for s in species if model.properties[s]["type"] in ("ari", "aci")]
    if len(natural) != 2 or len(aerosol) != 2:
        raise ValueError("Explicit solar/volcanic and ARI/ACI species required")
    bounds = np.asarray(model.timebounds)
    if not np.array_equal(np.diff(bounds), np.ones(len(bounds)-1)):
        raise ValueError("Annual boundary coordinates required")
    years = bounds[:-1].astype(int)
    forcing = model.forcing
    # FaIR leaves non-forcing bookkeeping species as all-NaN (e.g. FFI/AFOLU
    # emissions feed aggregate CO2). Preserve them as NaN, not fabricated zero.
    radiative_types = {"solar", "volcanic", "ari", "aci", "ozone", "contrails",
                       "lapsi", "h2o stratospheric", "land use"}
    bookkeeping = [s for s in species if not model.properties[s]["greenhouse_gas"]
                   and model.properties[s]["type"] not in radiative_types]
    active_forcing = forcing.drop_sel(specie=bookkeeping)
    if not np.isfinite(active_forcing.values).all() or not np.isfinite(model.forcing_sum.values).all():
        raise ValueError("Nonfinite actual forcing outside structural inactive species")
    if not np.allclose(forcing.sum("specie"), model.forcing_sum, rtol=0, atol=1e-12):
        raise ValueError("Species forcing does not close to actual forcing sum")
    annual = xr.DataArray((forcing.values[:-1] + forcing.values[1:])/2,
        dims=("year", "scenario", "config", "specie"),
        coords={"year": years, "scenario": model.scenarios,
                "config": model.configs, "specie": species})
    emissions = model.emissions.rename(timepoints="year").assign_coords(year=years)
    # Non-emissions species intentionally contain NaN; never silently zero-fill.
    active = [s for s in species if model.properties[s]["input_mode"] == "emissions"]
    if not np.isfinite(emissions.sel(specie=active).values).all():
        raise ValueError("Nonfinite active native emissions")
    units = []
    for s in species:
        if s in active and s not in desired_emissions_units:
            raise ValueError(f"Missing native unit for emissions species: {s}")
        units.append(desired_emissions_units.get(s, "not an emissions input"))
    ds = xr.Dataset({
        "emissions_native": emissions,
        "forcing_species_annual": annual,
        "forcing_species_bounds": forcing,
        "forcing_total_annual": annual.sum("specie"),
        "forcing_natural_annual": annual.sel(specie=natural).sum("specie"),
        "forcing_anthropogenic_annual": annual.drop_sel(specie=natural).sum("specie"),
        "forcing_aerosol_annual": annual.sel(specie=aerosol).sum("specie"),
        "temperature_bounds": model.temperature,
        "baseline_concentration": model.species_configs["baseline_concentration"],
        "baseline_emissions": model.species_configs["baseline_emissions"],
        "forcing_reference_concentration": model.species_configs["forcing_reference_concentration"],
        "native_emissions_unit": ("specie", units),
        "concentration_unit": ("specie", [desired_concentration_units.get(s, "not a concentration species") for s in species]),
        "species_input_mode": ("specie", [model.properties[s]["input_mode"] for s in species]),
        "species_type": ("specie", [model.properties[s]["type"] for s in species]),
    })
    for key in ds:
        if key.startswith("forcing_") and key != "forcing_reference_concentration":
            ds[key].attrs["units"] = "W m-2"
    ds["temperature_bounds"].attrs.update(units="K anomaly", observable="FaIR surface layer is not established as observational GMST")
    ds["baseline_concentration"].attrs["units"] = "See concentration_unit by species"
    ds["forcing_reference_concentration"].attrs["units"] = "See concentration_unit by species"
    ds["baseline_emissions"].attrs["units"] = "See native_emissions_unit by species"
    ds.attrs.update(
        time_alignment="Emissions at year+0.5; forcing annual=(boundary[y]+boundary[y+1])/2",
        forcing_baseline="Actual initialized model reference; no 1750 re-zeroing",
        temperature_baseline="Actual initialized model state; no 1850-1900 recentering in this file",
        decomposition="Natural=Solar+Volcanic; anthropogenic=all other species; aerosol=ARI+ACI subset, not an additional summand",
        attribution="Forcing bookkeeping only; no human-induced temperature attribution",
        emissions_missingness="NaN for non-emissions input modes is structural, not zero",
        forcing_missingness="Non-GHG precursor/bookkeeping species without a direct radiative type retained as delivered, including NaN; sums use FaIR skip-NaN convention",
        production_eligible="false")
    return ds


def retain_physical(model, directory, provenance):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    data = physical_dataset(model)
    identity = hashlib.sha256(json.dumps(provenance, sort_keys=True).encode()).hexdigest()
    target = directory / f"physical-{identity}.nc"
    if target.exists():
        with xr.open_dataset(target) as previous:
            xr.testing.assert_identical(previous.load(), data)
    else:
        data.to_netcdf(target, engine="h5netcdf", encoding={
            name: {"zlib": True, "complevel": 4}
            for name, array in data.data_vars.items() if array.dtype.kind in "fi"})
    report = {"file": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
              "provenance": provenance, "scenarios": list(model.scenarios),
              "memberIds": [str(c) for c in model.configs],
              "years": [int(data.year.values[0]), int(data.year.values[-1])],
              "species": list(model.species), "centralEligible": False}
    manifest = target.with_suffix(".json")
    text = json.dumps(report, indent=2, allow_nan=False)+"\n"
    if manifest.exists() and manifest.read_text() != text:
        raise ValueError("Physical retention manifest changed")
    if not manifest.exists():
        manifest.write_text(text)
    return report

"""Paired, freshly initialized FaIR counterfactual experiment on retained inputs.

This is a native-emissions intervention, not total warming relabelled as human
warming. The output remains GSAT-like FaIR surface temperature, not verified GMST.
Post-2014 inputs remain SSP projections. Neither limitation is hidden by a factor,
an observation fit, or by shortening the historical reconciliation window.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import fair
from fair import FAIR
from fair.interface import fill, initialise
from fair.io import read_properties
import numpy as np
import pandas as pd
import xarray as xr

from compare_retained_igcc_physics import human_warming_reference_contract
from independent_fair_benchmark import HASHES, ROOT, digest


def validate_inputs(data):
    """Reject missing identities, native units, or truncated experiment windows."""
    if not np.array_equal(data.year, np.arange(1750, 2100)):
        raise ValueError("Full retained 1750-2099 annual input window required")
    if not np.array_equal(data.timebounds, np.arange(1750, 2101)):
        raise ValueError("Full retained 1750-2100 boundary window required")
    for coordinate in ("config", "scenario", "specie"):
        values = data[coordinate].values.tolist()
        if not values or len(set(values)) != len(values):
            raise ValueError(f"Unique {coordinate} identities required")
    active = data.specie.where(data.species_input_mode == "emissions", drop=True)
    if not np.isfinite(data.emissions_native.sel(specie=active)).all():
        raise ValueError("Finite active native emissions required")
    if not np.isfinite(data.baseline_emissions.sel(specie=active)).all():
        raise ValueError("Finite source baseline emissions required")


def build_model(data, climate_table, counterfactual=False):
    """New instance and initialized state for *each* intervention, no state reuse.

    Baseline emissions are FaIR's source-defined reference-state balancing rates,
    not assumed zero or independently measured natural emission inventories.
    Solar/volcanic forcing, chemistry, feedbacks, climate parameters and seeded
    stochastic realizations are held fixed across the paired experiments.
    """
    validate_inputs(data)
    if fair.__version__ != "2.2.4":
        raise ValueError("Pinned supported FaIR 2.2.4 required")
    f = FAIR(ch4_method="thornhill2021")
    f.define_time(1750, 2100, 1)
    f.define_scenarios(data.scenario.values.tolist())
    f.define_configs(data.config.values.tolist())
    species, properties = read_properties()
    if species != data.specie.values.tolist():
        raise ValueError("Exact retained species ordering required")
    f.define_species(species, properties)
    f.allocate()
    f.fill_species_configs()
    fill(f.species_configs["unperturbed_lifetime"], 10.8537568, specie="CH4")
    fill(f.species_configs["baseline_emissions"], 19.01978312, specie="CH4")
    fill(f.species_configs["baseline_emissions"], 0.08602230754, specie="N2O")
    for key in ("baseline_concentration", "baseline_emissions", "forcing_reference_concentration"):
        xr.testing.assert_equal(f.species_configs[key], data[key])
    f.emissions.data[:] = data.emissions_native.transpose("year", "scenario", "config", "specie").values
    for s in species:
        if properties[s]["input_mode"] == "emissions":
            from fair.structure.units import desired_emissions_units
            if data.native_emissions_unit.sel(specie=s).item() != desired_emissions_units[s]:
                raise ValueError(f"Native unit mismatch: {s}")
            if counterfactual:
                fill(f.emissions, f.species_configs["baseline_emissions"].sel(specie=s).values, specie=s)
        elif properties[s]["input_mode"] == "forcing":
            if properties[s]["type"] not in ("solar", "volcanic"):
                raise ValueError(f"Unspecified forcing intervention for {s}")
            fill(f.forcing, data.forcing_species_bounds.sel(specie=s).values, specie=s)
        elif properties[s]["input_mode"] not in ("calculated",):
            raise ValueError(f"Unspecified concentration intervention for {s}")
    initialise(f.concentration, f.species_configs["baseline_concentration"])
    # Initialise only the initial forcing boundary, preserving natural inputs.
    for state in (f.forcing, f.temperature, f.cumulative_emissions, f.airborne_emissions):
        initialise(state, 0)
    for i, config in enumerate(f.configs):
        # No split on '_' (member model names themselves may contain underscores).
        rows = climate_table[
            (climate_table["model"].astype(str)+"_"+climate_table["run"].astype(str)) == config]
        if len(rows) != 1:
            raise ValueError(f"One source climate row required for {config}")
        row = rows.iloc[0]
        for field, columns in (
                ("ocean_heat_capacity", ["C1", "C2", "C3"]),
                ("ocean_heat_transfer", ["kappa1", "kappa2", "kappa3"])):
            fill(f.climate_configs[field], row[columns].to_numpy(dtype=float), config=config)
        for field, column in (("deep_ocean_efficacy", "epsilon"),
                              ("gamma_autocorrelation", "gamma"),
                              ("sigma_eta", "sigma_eta"), ("sigma_xi", "sigma_xi")):
            fill(f.climate_configs[field], float(row[column]), config=config)
        for field, value in (("stochastic_run", True), ("use_seed", True), ("seed", 1355763+i*399)):
            fill(f.climate_configs[field], value, config=config)
    return f


def attributed_members(factual, counterfactual):
    """Subtract paired responses then rebase each member, never subtract medians."""
    if factual.dims != counterfactual.dims:
        raise ValueError("Paired dimension order required")
    for name in factual.dims:
        if not factual[name].equals(counterfactual[name]):
            raise ValueError("Exact paired member/time coordinates required")
    if not np.isfinite(factual).all() or not np.isfinite(counterfactual).all():
        raise ValueError("Finite paired temperatures required")
    if not np.array_equal(factual.timebounds, np.arange(1750, 2101)):
        raise ValueError("Full retained temperature window required")
    years = factual.timebounds.values[:-1].astype(int)

    def annual(a):
        return xr.DataArray((a.values[:-1]+a.values[1:])/2, dims=("year", "scenario", "config"),
                            coords={"year": years, "scenario": a.scenario, "config": a.config})

    fa, cf = annual(factual), annual(counterfactual)
    fb = fa.sel(year=slice(1850, 1900)).mean("year")
    cb = cf.sel(year=slice(1850, 1900)).mean("year")
    result = xr.Dataset({
        "factual_surface_annual": fa, "counterfactual_surface_annual": cf,
        "factual_baseline_1850_1900": fb, "counterfactual_baseline_1850_1900": cb,
        "paired_baseline_1850_1900": fb-cb,
        "attributed_surface_annual": (fa-cf)-(fb-cb)})
    result.attrs.update(
        observable="FaIR surface temperature response; not verified GMST",
        baseline="Each paired member: annual boundary-pair means, 1850-1900 inclusive (51 years)",
        attribution="Native emissions set to source baseline rates; natural forcing retained; factual minus counterfactual",
        member_pairing="Identical configuration, climate parameters and stochastic seed; scenarios are not independent members",
        history="RCMIP historical through 2014; SSP conditional thereafter",
        centralEligible="false")
    return result


def compatibility_report(data, manifest):
    """Exact remaining source/method requirements, not caller-label certification."""
    active = [str(s) for s in data.specie.values if data.species_input_mode.sel(specie=s).item() == "emissions"]
    natural = [str(s) for s in data.specie.values if data.species_type.sel(specie=s).item() in ("solar", "volcanic")]
    return {
        "nativeEmissionIntervention": {
            "speciesCount": len(active),
            "units": {s: data.native_emissions_unit.sel(specie=s).item() for s in active},
            "sourceBaselineRatesByMemberRetained": True,
            "meaning": "Remove deviations from FaIR reference-state emissions, not a claim that those balancing rates are observed natural inventories",
            "inputReceipts": manifest["provenance"]["rcmipReceipts"]},
        "naturalForcing": {
            "species": natural, "intervention": "Identical original boundary arrays in both runs; no re-zeroing",
            "igccCompatibility": "unresolved",
            "remaining": "Resolve IGCC volcanic executable 135144-month reference slice versus described 135000 pre-1750 months, and RCMIP solar/volcanic baseline equivalence using permitted pre-1750 histories"},
        "nativeIGCCComparison": {
            "status": "withheld",
            "remaining": "IGCC CEDS/GFED outputs need native-unit and biomass/aviation boundary equivalence to RCMIP; NOx NO/NO2 mass basis; CH4/N2O reference balancing rates versus anthropogenic-only inventories. Pre-1970 missing CH4/N2O cells are not zero. No CO2e conversion can supply this evidence."},
        "observable": {
            "available": "Global FaIR surface layer",
            "required": "Source-justified spatial land-air/ocean-SST observation operator with coverage and sea-ice treatment, or published paired GMST responses for the same configurations and attribution convention",
            "whyUnavailable": "These three-layer global states do not contain separate land-air, ocean-SST, sea-ice or coverage fields. Source GMST labels do not supply those missing fields; no universal scalar or fitted operator is applied."},
        "historicalExtension": {
            "status": "required",
            "remaining": "Native historical emissions and natural forcing through actual 2025 with matched source boundaries, followed by fresh paired runs over the unchanged window. Retained SSP 2015-2025 cannot be relabelled as observations."},
        "referenceDefinition": {
            "remaining": "Reconcile source Annual and SR1.5 definitions for a genuine attributed GMST artifact; no 0.01 C target shift inferred",
            "contract": human_warming_reference_contract()},
        "actualGMSTMemberComparisonPerformed": False, "shareMeanMembersInRange": None,
        "centralEligible": False, "calibrated10kEnsembleClaim": False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--output", default="generated-artifacts/physical-attribution")
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text())
    if digest(manifest["file"]) != manifest["sha256"]:
        raise ValueError("Retained physical hash mismatch")
    climate = ROOT / "4xCO2_cummins_ebm3.csv"
    if digest(climate) != HASHES[climate.name]:
        raise ValueError("Climate parameter source hash mismatch")
    with xr.open_dataset(manifest["file"]) as source:
        data = source.load()
    table = pd.read_csv(climate)
    runs = []
    for intervention in (False, True):
        model = build_model(data, table, counterfactual=intervention)
        model.run(progress=False)
        if not np.isfinite(model.temperature).all():
            raise ValueError("Nonfinite experiment temperature")
        if not intervention:
            xr.testing.assert_equal(model.temperature, data.temperature_bounds)
        runs.append(model)
    ds = attributed_members(runs[0].temperature.sel(layer=0), runs[1].temperature.sel(layer=0))
    ds["baseline_emissions"] = data.baseline_emissions
    ds["native_emissions_unit"] = data.native_emissions_unit
    ds["seed"] = runs[0].climate_configs["seed"]
    for label, run in zip(("factual", "counterfactual"), runs):
        ds[f"{label}_native_emissions"] = run.emissions.rename(timepoints="year").assign_coords(year=data.year)
        ds[f"{label}_natural_forcing_bounds"] = run.forcing.sel(specie=["Solar", "Volcanic"]).rename(specie="natural_specie")
    xr.testing.assert_equal(ds.factual_natural_forcing_bounds, ds.counterfactual_natural_forcing_bounds)
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    report = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "experiment": "Fresh full native-emissions factual and reference-emissions counterfactual; same natural forcing and stochastic seeds",
        "modelsRun": 2, "factualTemperatureExactRetainedMatch": True,
        "timebounds": [1750, 2100], "annualYears": 350,
        "configurations": len(runs[0].configs), "scenarios": runs[0].scenarios,
        "memberIds": runs[0].configs, "seedRule": "1355763 + configuration_index * 399",
        "baselineYearsInclusive": [1850, 1900], "baselineYearCount": 51,
        "codeSha256": digest(__file__), "fairVersion": fair.__version__,
        "fairImplementationSha256": digest(Path(fair.__file__).with_name("fair.py")),
        "physicalManifestSha256": digest(args.manifest), "physicalSha256": manifest["sha256"],
        "climateParametersSha256": digest(climate),
        "compatibility": compatibility_report(data, manifest),
        "conditionalSurfaceResponseNotGMST": [
            {"scenario": str(s),
             "medianAttributedSurface2025C": float(ds.attributed_surface_annual.sel(year=2025, scenario=s).median("config")),
             "medianAttributedSurface2016to2025C": float(ds.attributed_surface_annual.sel(year=slice(2016, 2025), scenario=s).mean("year").median("config"))}
            for s in data.scenario.values],
        "fittedParameters": [], "centralEligible": False,
        "rawAndChangeERFDiagnostics": "Previously retained outputs left unchanged; not rerun"}
    identity = hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest()
    artifact = out / (identity+".nc")
    ds.to_netcdf(artifact, engine="h5netcdf")
    report.update(artifact=str(artifact), artifactSha256=digest(artifact))
    result = out / (identity+".json")
    result.write_text(json.dumps(report, indent=2, allow_nan=False)+"\n")
    print(result)


if __name__ == "__main__":
    main()

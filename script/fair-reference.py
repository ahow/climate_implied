"""Reproduce the pinned upstream example; NOT a dashboard forecast.

Run: uv run python script/fair-reference.py
Inputs and outputs are generated, excluded from Git/deployment.
The draft scenario and 2022 calibration cannot certify a 2025 historical fit.
"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

import fair
import numpy as np
import pandas as pd
from fair import FAIR
from fair.interface import fill, initialise
from fair.io import read_properties

REVISION = "ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79"
BASE = f"https://raw.githubusercontent.com/OMS-NetZero/FAIR/{REVISION}/examples/data/calibrated_constrained_ensemble/"
ROOT = Path(__file__).resolve().parents[1] / "generated-artifacts/fair-reference"
FILES = [
    "calibrated_constrained_parameters_calibration1.4.1.csv",
    "species_configs_properties_calibration1.4.1.csv",
    "extensions_1750-2500.csv",
    "volcanic_solar.csv",
]


def main(pathway_file=None, output_directory=None):
    if fair.__version__ != "2.2.4":
        raise RuntimeError("Reference runner requires FaIR 2.2.4")
    if pathway_file and not output_directory:
        raise ValueError("Candidate runs require a new --output-directory; never overwrite the reference")
    root = Path(output_directory).resolve() if output_directory else ROOT
    if not root.is_relative_to(ROOT.parent):
        raise ValueError("Outputs must remain under generated-artifacts")
    root.mkdir(parents=True, exist_ok=output_directory is None)
    inputs = []
    for name in FILES:
        # Always retrieve the immutable source; never silently trust a stale cache.
        with urlopen(BASE + name, timeout=60) as response:
            data = response.read()
        (root / name).write_bytes(data)
        inputs.append({"file": name, "url": BASE + name,
                       "sha256": hashlib.sha256(data).hexdigest()})
    params, species_file, emissions, forcing = [str(root / x) for x in FILES]
    pathway = None
    if pathway_file:
        from fair_native_bridge import apply_native_pathway, native_coverage
        pathway = json.loads(Path(pathway_file).read_text())
        inventory = json.loads((Path(__file__).resolve().parents[1] /
            "server/calculation/data/inventory2024.json").read_text())
        baseline = {}
        for cell in inventory["cells"]:
            gas = ("CO2-LULUCF" if cell["sector"] == "LULUCF" else "CO2-EIP") if cell["gas"] == "CO2" else cell["gas"]
            baseline[gas] = baseline.get(gas, 0) + cell["nativeMt"]
        template = pd.read_csv(emissions)
        unsupported = native_coverage(template, pathway["gases"])
        if unsupported:
            failure = {"status": "blocked-native-species-coverage", "unsupportedSpecies": unsupported,
                       "pathwaySource": pathway.get("source"), "inputs": inputs,
                       "pathwaySha256": hashlib.sha256(Path(pathway_file).read_bytes()).hexdigest(),
                       "temperatureProduced": False, "productionEligible": False}
            (root / "failure.json").write_text(json.dumps(failure, indent=2))
            raise ValueError("Unsupported or ambiguous FaIR species: " + ", ".join(unsupported))
        converted = apply_native_pathway(template, pathway, baseline)
        emissions = str(root / "candidate-emissions.csv")
        converted.to_csv(emissions, index=False)
    configs = pd.read_csv(params, index_col=0)
    f = FAIR(ch4_method="Thornhill2021")
    f.define_time(1750, 2101, 1)
    f.define_scenarios(["medium-extension"])
    f.define_configs(configs.index)
    species, properties = read_properties(filename=species_file)
    f.define_species(species, properties)
    f.allocate()
    f.fill_from_csv(emissions_file=emissions, forcing_file=forcing)
    for specie in ("Solar", "Volcanic"):
        fill(f.forcing, f.forcing.sel(specie=specie)
             * configs[f"forcing_scale[{specie}]"].values, specie=specie)
    f.fill_species_configs(species_file)
    f.override_defaults(params)
    initialise(f.concentration, f.species_configs["baseline_concentration"])
    for state in (f.forcing, f.temperature, f.cumulative_emissions,
                  f.airborne_emissions, f.ocean_heat_content_change):
        initialise(state, 0)
    f.run()
    temperature = f.temperature.sel(scenario="medium-extension", layer=0).values
    # Annual means use the two timebounds, including all of calendar year 2100.
    annual = (temperature[:-1] + temperature[1:]) / 2
    years = np.arange(1750, 2101)
    anomaly = annual - annual[(years >= 1850) & (years <= 1900)].mean(axis=0)
    if not np.isfinite(anomaly).all():
        raise RuntimeError("Non-finite reference temperatures")
    # Same ensemble supplies every downstream summary; never add warming offsets.
    ensemble = {"baseline": "1850-1900", "memberIds": [str(x) for x in configs.index],
                "years": years.tolist(), "temperature": anomaly.tolist()}
    (root / "ensemble.json").write_text(json.dumps(ensemble))
    summary = {
        "status": "reference_execution_only_not_validated_for_dashboard",
        "fairVersion": fair.__version__, "upstreamRevision": REVISION,
        "ensembleMembers": len(configs), "inputs": inputs,
        "scenario": pathway["scenario"] if pathway else "medium-extension (upstream draft example, not current policy)",
        "pathwaySource": pathway.get("source") if pathway else None,
        "temperatureBaseline": "1850–1900 annual mean",
        "annual2100P10P50P90C": np.percentile(anomaly[-1], [10, 50, 90]).tolist(),
        "mean2003to2022P05P50P95C": np.percentile(
            anomaly[(years >= 2003) & (years <= 2022)].mean(axis=0),
            [5, 50, 95]).tolist(),
        "promotionBlockedBy": [
            "Independent numerical reference comparison",
            "Native-gas 2024 inventory and historical forcing update through 2025",
            "Human-induced historical validation separate from natural forcing",
            "Evidence-based dashboard pathway coupling and shared metric migration",
        ],
    }
    (root / "result.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--pathway", help="Complete native-gas candidate JSON; unsupported species fail explicitly")
    parser.add_argument("--output-directory", help="New private directory for an isolated candidate run")
    args = parser.parse_args()
    main(args.pathway, args.output_directory)

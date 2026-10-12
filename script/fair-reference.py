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


def main():
    if fair.__version__ != "2.2.4":
        raise RuntimeError("Reference runner requires FaIR 2.2.4")
    ROOT.mkdir(parents=True, exist_ok=True)
    inputs = []
    for name in FILES:
        # Always retrieve the immutable source; never silently trust a stale cache.
        with urlopen(BASE + name, timeout=60) as response:
            data = response.read()
        (ROOT / name).write_bytes(data)
        inputs.append({"file": name, "url": BASE + name,
                       "sha256": hashlib.sha256(data).hexdigest()})
    params, species_file, emissions, forcing = [str(ROOT / x) for x in FILES]
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
    summary = {
        "status": "reference_execution_only_not_validated_for_dashboard",
        "fairVersion": fair.__version__, "upstreamRevision": REVISION,
        "ensembleMembers": len(configs), "inputs": inputs,
        "scenario": "medium-extension (upstream draft example, not current policy)",
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
    (ROOT / "result.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()

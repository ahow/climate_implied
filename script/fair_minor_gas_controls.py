"""Isolated native-gas pulse controls, not historical forcing or climate forecasts."""
import hashlib
import json
import math
from pathlib import Path
import tempfile
import fair
from fair import FAIR
from fair.interface import fill, initialise
from fair.io import read_properties
import numpy as np
import pandas as pd
from fair_additional_species import PARAMETERS, SOURCE, SOURCE_SHA256, extend_species_configs


def run_controls():
    if fair.__version__ != "2.2.4":
        raise ValueError("FaIR 2.2.4 required")
    default = Path(fair.__file__).parent / "defaults/data/ar6/species_configs_properties.csv"
    rows = []
    with tempfile.TemporaryDirectory() as directory:
        config = Path(directory) / "species.csv"
        extend_species_configs(pd.read_csv(default, index_col=0)).to_csv(config)
        _, properties = read_properties(filename=config)
        for gas, params in PARAMETERS.items():
            # Fresh state for each independent pulse; zero initial burden is a
            # declared isolated control, not an assumed real historical record.
            f = FAIR()
            f.define_time(2024, 2125, 1)
            f.define_scenarios(["isolated-pulse"])
            f.define_configs(["engineering-control"])
            f.define_species([gas], {gas: properties[gas]})
            f.allocate()
            f.fill_species_configs(config)
            fill(f.climate_configs["ocean_heat_capacity"], [8, 100, 1000])
            fill(f.climate_configs["ocean_heat_transfer"], [1, 2, 1])
            fill(f.climate_configs["deep_ocean_efficacy"], 1)
            fill(f.climate_configs["stochastic_run"], False)
            fill(f.emissions, 0)
            f.emissions[0, 0, 0, 0] = 1  # one kt over the first year
            for state in (f.concentration, f.forcing, f.temperature, f.cumulative_emissions,
                          f.airborne_emissions, f.ocean_heat_content_change):
                initialise(state, 0)
            f.run(progress=False)
            burden = f.airborne_emissions.values[:, 0, 0, 0]
            observed = float(burden[11] / burden[1])
            expected = math.exp(-10 / params["lifetime"])
            temperature = f.temperature.values[:, 0, 0, 0]
            if not np.isfinite(temperature).all() or max(temperature) <= 0 or abs(observed - expected) > 1e-10:
                raise ValueError("Native-gas pulse sign/decay control failed")
            rows.append({"species": gas, "pulseKt": 1, "tenYearBurdenRatio": observed,
                         "analyticRatio": expected, "absoluteError": abs(observed - expected),
                         "peakForcingWm2": float(f.forcing.max()), "temperaturePositive": True})
    return {"fairVersion": fair.__version__, "source": SOURCE, "sourceSha256": SOURCE_SHA256,
            "controls": rows, "productionEligible": False,
            "claim": "Isolated engineering controls with arbitrary fixed climate response; not historical validation"}


if __name__ == "__main__":
    result = run_controls()
    text = json.dumps(result, indent=2) + "\n"
    root = Path("generated-artifacts/species-research")
    root.mkdir(parents=True, exist_ok=True)
    target = root / ("controls-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if not target.exists():
        with target.open("x") as stream:
            stream.write(text)
    elif target.read_text() != text:
        raise ValueError("Evidence collision")
    print(text)

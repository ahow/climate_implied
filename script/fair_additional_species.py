"""AR6 minor-gas parameters; explicit historical emissions remain mandatory."""
import math
import pandas as pd

SOURCE = "https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_Chapter07_SM.pdf"
SOURCE_SHA256 = "4290518ef9418a4157ddb9481e589131eeb110614c3aa7b62641d3241d39ce58"
# Table 7.SM.7: lifetime years, radiative efficiency W m-2 ppb-1.
# Molecular weights calculated from the stated chemical formulas, rounded g/mol.
PARAMETERS = {
    "HFC-41": {"lifetime": 2.8, "radiativeEfficiency": .025, "molecularWeight": 34.03, "formula": "CH3F"},
    "HFC-134": {"lifetime": 10.0, "radiativeEfficiency": .194, "molecularWeight": 102.03, "formula": "CHF2CHF2"},
    "HFC-143": {"lifetime": 3.6, "radiativeEfficiency": .128, "molecularWeight": 84.04, "formula": "CH2FCHF2"},
}


def extend_species_configs(frame):
    """Use existing f-gas structural conventions, not its physical parameters."""
    result = frame.copy()
    for gas, p in PARAMETERS.items():
        if gas in result.index:
            raise ValueError("Custom species already defined; no silent override")
        row = frame.loc["HFC-134a"].copy()
        tau = p["lifetime"]
        for box in range(4):
            row[f"partition_fraction{box}"] = 1.0 if box == 0 else 0.0
            row[f"unperturbed_lifetime{box}"] = tau
        iirf = tau * (1 - math.exp(-100 / tau))
        g1 = tau * (1 - (1 + 100 / tau) * math.exp(-100 / tau))
        row["iirf_0"], row["g1"], row["g0"] = iirf, g1, math.exp(-iirf / g1)
        row["molecular_weight"] = p["molecularWeight"]
        row["greenhouse_gas_radiative_efficiency"] = p["radiativeEfficiency"]
        # Explicit constant-lifetime minor-gas assumptions, not copied feedbacks.
        for key in ["iirf_airborne", "iirf_uptake", "iirf_temperature",
                    "baseline_concentration", "forcing_reference_concentration", "baseline_emissions",
                    "tropospheric_adjustment", "forcing_temperature_feedback", "h2o_stratospheric_factor",
                    "cl_atoms", "br_atoms", "fractional_release", "ch4_lifetime_chemical_sensitivity"]:
            row[key] = 0.0
        row["forcing_scale"], row["forcing_efficacy"] = 1.0, 1.0
        result.loc[gas] = row
    return result


def add_historical_species(frame, history):
    """History in native Mt/year for 1750–2023; no gaps or implicit zero infill."""
    if history.get("unit") != "Mt gas/year" or history.get("years") != list(range(1750, 2024)):
        raise ValueError("Explicit complete 1750–2023 native-Mt histories required")
    if set(history.get("gases", {})) != set(PARAMETERS):
        raise ValueError("Exactly the three additional species histories required")
    source = history.get("source", {})
    if not isinstance(source.get("url"), str) or not source["url"].startswith("https://") or not source.get("basis"):
        raise ValueError("Historical source URL and measurement/reconstruction basis required")
    # The run ends at 2101; discard unused template future columns rather than
    # invent values for custom gases after 2100.
    columns = ["scenario", "region", "variable", "unit"] + [str(y + .5) for y in range(1750, 2101)]
    result = frame.loc[:, columns].copy()
    for gas, values in history["gases"].items():
        if len(values) != 274 or any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in values):
            raise ValueError("Invalid or incomplete historical emissions")
        if ((result["scenario"] == "medium-extension") & (result["variable"] == gas)).any():
            raise ValueError("Historical species already present")
        row = {"scenario": "medium-extension", "region": "World", "variable": gas, "unit": f"kt {gas}/yr"}
        row.update({str(y + .5): v * 1000 for y, v in zip(history["years"], values)})
        # Future values must be supplied by apply_native_pathway before execution.
        row.update({str(y + .5): float("nan") for y in range(2024, 2101)})
        result = pd.concat([result, pd.DataFrame([row])], ignore_index=True)
    return result

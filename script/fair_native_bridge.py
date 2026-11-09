"""Strict native-Mt pathway insertion into FaIR's versioned CSV template.

Unsupported species/units fail. No aggregate CO2e conversion or zero infilling.
Historical values before 2024 remain untouched. The upstream historical forcing
is still a research reference and does not validate recent human-induced warming.
"""
import re


def normalized(value):
    return re.sub(r"[^a-z0-9]", "", value.lower())


def native_coverage(frame, gases):
    aliases = {"CO2-EIP": "CO2 FFI", "CO2-LULUCF": "CO2 AFOLU"}
    names = frame.loc[frame["scenario"] == "medium-extension", "variable"].map(normalized).tolist()
    return [gas for gas in gases if names.count(normalized(aliases.get(gas, gas))) != 1]


def apply_native_pathway(frame, pathway, baseline):
    if pathway.get("unit") != "Mt gas/year" or pathway.get("years") != list(range(2024, 2101)):
        raise ValueError("Native Mt gas/year and contiguous 2024–2100 years required")
    gases = pathway.get("gases", {})
    if set(gases) != set(baseline):
        raise ValueError("Complete native inventory gas coverage required")
    if pathway.get("scenario") == "announced-commitments" and not pathway.get("source", {}).get("includesLongTermPledges"):
        raise ValueError("NDC-only is not all announced commitments")
    aliases = {"CO2-EIP": "CO2 FFI", "CO2-LULUCF": "CO2 AFOLU"}
    result = frame.copy()
    import math
    for gas, values in gases.items():
        if len(values) != 77 or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in values):
            raise ValueError("Invalid annual gas values")
        if abs(values[0] - baseline[gas]) > max(1e-9, abs(baseline[gas]) * 1e-6):
            raise ValueError("Inventory mismatch")
        if not gas.startswith("CO2-") and min(values) < 0:
            raise ValueError("Negative non-CO2 pathway")
        name = aliases.get(gas, gas)
        mask = ((result["scenario"] == "medium-extension") &
                (result["variable"].map(normalized) == normalized(name)))
        rows = result.loc[mask]
        if len(rows) != 1:
            raise ValueError(f"Unsupported or ambiguous FaIR species: {gas}")
        unit = rows.iloc[0]["unit"]
        match = re.fullmatch(r"(Gt|Mt|kt) (.+)/yr", unit)
        if not match or normalized(match[2]) != normalized("CO2" if gas.startswith("CO2-") else gas):
            raise ValueError(f"Unsupported native unit: {unit}")
        factor = {"Gt": .001, "Mt": 1, "kt": 1000}[match[1]]
        for year, value in zip(pathway["years"], values):
            column = str(year + .5)
            if column not in result:
                raise ValueError(f"Missing FaIR timepoint: {column}")
            result.loc[mask, column] = value * factor
    return result

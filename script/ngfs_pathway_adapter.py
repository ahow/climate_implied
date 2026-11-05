"""Offline NGFS native-gas baseline sensitivity audit, NOT a production forecast.

Reads the reviewed World extract produced by assess-ngfs.py. Keeps raw and
adjusted pathways separate; exports only to ignored research storage. No
aggregate CO2-equivalent series is treated as an individual gas.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

MODEL = "REMIND-MAgPIE 3.3-4.8"
SCENARIOS = {"Current Policies", "Nationally Determined Contributions (NDCs)"}
STAGES = {
    "raw": "",
    "harmonized": "AR6 climate diagnostics|Harmonized|",
    "infilled": "AR6 climate diagnostics|Infilled|",
}
# Variable -> canonical inventory gas, native source unit, conversion to Mt.
SERIES = {
    "Emissions|CO2|Energy and Industrial Processes": ("CO2-EIP", "Mt CO2/yr", 1),
    "Emissions|CO2|AFOLU": ("CO2-LULUCF", "Mt CO2/yr", 1),
    "Emissions|CH4": ("CH4", "Mt CH4/yr", 1),
    "Emissions|N2O": ("N2O", "kt N2O/yr", .001),
    "Emissions|SF6": ("SF6", "kt SF6/yr", .001),
}
for source, gas in [
    ("HFC125", "HFC-125"), ("HFC134a", "HFC-134a"),
    ("HFC143a", "HFC-143a"), ("HFC227ea", "HFC-227ea"),
    ("HFC23", "HFC-23"), ("HFC245fa", "HFC-245fa"),
    ("HFC32", "HFC-32"), ("HFC43-10", "HFC-43-10-mee"),
    ("HFC152a", "HFC-152a"), ("HFC236fa", "HFC-236fa"),
    ("HFC365mfc", "HFC-365mfc"),
]:
    SERIES[f"Emissions|HFC|{source}"] = (gas, f"kt {source}/yr", .001)
for gas in ["CF4", "C2F6", "C3F8", "C4F10", "C5F12", "C6F14"]:
    SERIES[f"Emissions|PFC|{gas}"] = (gas, f"kt {gas}/yr", .001)
SERIES["Emissions|PFC|cC4F8"] = ("c-C4F8", "kt cC4F8/yr", .001)
SERIES["Emissions|NF3"] = ("NF3", "kt NF3/yr", .001)


def finite(value):
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Non-finite source or inventory value")
    return result


def annualize(points, start=2024, end=2100):
    """Linear interpolation only: no extrapolation or horizon-dependent trends."""
    points = sorted((int(year), finite(value)) for year, value in points)
    if len(points) < 2 or len({y for y, _ in points}) != len(points):
        raise ValueError("Need unique source years and at least two observations")
    if start > end or points[0][0] > start or points[-1][0] < end:
        raise ValueError("Requested horizon is not covered by the source")
    result = {}
    segment = 0
    for year in range(start, end + 1):
        while points[segment + 1][0] < year:
            segment += 1
        a, x = points[segment]
        b, y = points[segment + 1]
        result[year] = x + (y - x) * (year - a) / (b - a)
    return result


def reconcile(raw, anchor, gas, convergence_year=2050):
    """Diagnostic sensitivity, not an evidence-selected harmonization method.

    Positive-baseline gases use ratio scaling. Signed land CO2 uses a starting
    offset that converges to the published path in 2050. The convergence date is
    an explicit sensitivity setting, never inferred from desired temperatures.
    """
    anchor = finite(anchor)
    baseline = raw[2024]
    if gas == "CO2-LULUCF":
        if convergence_year <= 2024:
            raise ValueError("Convergence must follow the inventory year")
        return {year: value + (anchor - baseline) *
                max(0, (convergence_year - year) / (convergence_year - 2024))
                for year, value in raw.items()}
    if baseline <= 0 or anchor < 0:
        raise ValueError("Ratio adjustment requires positive source baseline")
    if gas != "CO2-EIP" and any(value < 0 for value in raw.values()):
        raise ValueError("Negative non-CO2 emissions require a separate treatment")
    return {year: value * anchor / baseline for year, value in raw.items()}


def inventory_totals(inventory):
    if inventory["year"] != 2024:
        raise ValueError("Adapter requires the reviewed 2024 inventory")
    totals = {}
    for cell in inventory["cells"]:
        gas = cell["gas"]
        if gas == "CO2":
            gas = "CO2-LULUCF" if cell["sector"] == "LULUCF" else "CO2-EIP"
        totals[gas] = totals.get(gas, 0) + finite(cell["nativeMt"])
    return totals


def build_audit(rows, inventory, model=MODEL, scenario="Current Policies", stage="raw"):
    if scenario not in SCENARIOS or "IntegratedPhysicalDamages" in model:
        raise ValueError("Unreviewed scenario or excluded damages model")
    if stage not in STAGES:
        raise ValueError("Unknown processing stage")
    selected = [row for row in rows if row["Model"] == model
                and row["Scenario"] == scenario and row["Region"] == "World"]
    if not selected:
        raise ValueError("Requested model/scenario missing")
    by_variable = {}
    for row in selected:
        variable = row["Variable"]
        if variable in by_variable:
            raise ValueError(f"Duplicate source variable: {variable}")
        by_variable[variable] = row
    anchors = inventory_totals(inventory)
    output = {}
    missing_variables = []
    for variable, (gas, unit, scale) in SERIES.items():
        variable = STAGES[stage] + variable
        row = by_variable.get(variable)
        if row is None:
            missing_variables.append(variable)
            continue
        # NGFS uses both spellings for the same HFC-43-10-mee mass unit.
        source_unit = row["Unit"]
        normalized_unit = ("kt HFC43-10/yr" if source_unit == "kt HFC4310/yr"
                           and gas == "HFC-43-10-mee" else source_unit)
        if normalized_unit != unit:
            raise ValueError(f"Unexpected units for {variable}: {row['Unit']}")
        if gas not in anchors:
            raise ValueError(f"No compatible inventory anchor for {gas}")
        points = [(int(year), finite(value) * scale) for year, value in row.items()
                  if year.isdigit() and value not in (None, "")]
        raw = annualize(points)
        adjusted = reconcile(raw, anchors[gas], gas)
        output[gas] = {
            "sourceVariable": variable, "sourceUnit": source_unit, "unit": "Mt gas/year",
            "inventory2024": anchors[gas], "sourceInterpolated2024": raw[2024],
            "baselineDifferencePct": 100 * (raw[2024] / anchors[gas] - 1)
            if anchors[gas] else None,
            "method": "offset-converges-2050" if gas == "CO2-LULUCF" else "ratio",
            "raw": raw, "adjustedDiagnostic": adjusted,
            "sumAnnualEmissions2025Through2100Mt": {
                "raw": sum(raw[y] for y in range(2025, 2101)),
                "adjustedDiagnostic": sum(adjusted[y] for y in range(2025, 2101)),
            },
        }
    missing_gases = sorted(set(anchors) - set(output))
    return {
        "status": "diagnostic-only-not-ready-for-promotion",
        "source": "NGFS Phase V 5.1", "model": model, "scenario": scenario,
        "policyCutoff": "2024-03", "processingStage": stage,
        "inventoryVersion": inventory["version"],
        "series": output, "unrepresentedInventoryGases": missing_gases,
        "missingSourceVariables": missing_variables,
        "limitations": [
            "NDCs are not all announced commitments; no replacement of the approved comparison.",
            "Adjustment methods are sensitivities, not empirically selected calibration.",
            "Native gas coverage is incomplete; no total GHG or temperature is claimed.",
            "No sector split within energy/industry is inferred from aggregate CO2.",
            "Aerosols and historical initialization remain outside this baseline sensitivity audit.",
            "Stages are never mixed; a missing species is not borrowed from another stage.",
            "HFC245ca and HFC245fa are distinct species and are not substituted for one another.",
            "Already-modelled policy and technology effects must not be added a second time.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="generated-artifacts/ngfs/world-selected.csv")
    parser.add_argument("--inventory", default="server/calculation/data/inventory2024.json")
    parser.add_argument("--scenario", default="Current Policies", choices=sorted(SCENARIOS))
    parser.add_argument("--model", default=MODEL)
    parser.add_argument("--stage", default="raw", choices=sorted(STAGES))
    args = parser.parse_args()
    source = Path(args.source)
    with source.open() as handle:
        rows = list(csv.DictReader(handle))
    inventory = json.loads(Path(args.inventory).read_text())
    report = build_audit(rows, inventory, args.model, args.scenario, args.stage)
    report["inputSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
    folder = Path("generated-artifacts/ngfs")
    folder.mkdir(parents=True, exist_ok=True)
    filename = "current-policies" if args.scenario == "Current Policies" else "ndc"
    model_slug = "".join(c if c.isalnum() else "-" for c in args.model)
    path = folder / f"native-baseline-audit-{model_slug}-{filename}-{args.stage}.json"
    path.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n")
    print(json.dumps({
        "output": str(path), "status": report["status"],
        "representedSeries": len(report["series"]),
        "unrepresentedInventoryGases": report["unrepresentedInventoryGases"],
    }, indent=2))


if __name__ == "__main__":
    main()

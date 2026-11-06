"""Quantify missing native gases without claiming an infill is calibrated.

No CO2-equivalent totals or temperature conversion. Decline/constant/zero are
explicit stress cases, not published pathways or confidence bounds.
"""
import json
import math
from pathlib import Path
from ngfs_pathway_adapter import inventory_totals


def gap_sensitivity(baseline, represented):
    if not set(represented).issubset(baseline):
        raise ValueError("Unknown represented species")
    result = {}
    for gas in sorted(set(baseline) - set(represented)):
        anchor = baseline[gas]
        if not math.isfinite(anchor) or anchor < 0:
            raise ValueError("Invalid missing-gas anchor")
        cases = {
            "zero-after-2024": [anchor] + [0.0] * 76,
            "constant-2024": [anchor] * 77,
            "linear-zero-2050": [anchor * max(0, (2050 - year) / 26)
                                 for year in range(2024, 2101)],
        }
        result[gas] = {
            "unit": "Mt gas/year",
            "anchor2024": anchor,
            "cases": {name: {
                "annual": dict(zip(range(2024, 2101), values)),
                "sum2025Through2100Mt": sum(values[1:]),
            } for name, values in cases.items()},
        }
    return {"status": "stress-test-only-not-approved-infill",
            "missing": result,
            "limitations": ["These are not statistical bounds or published forecasts.",
                           "Species are not interchangeable; no HFC245ca/fa substitution.",
                           "A complete announced-commitments scenario remains a separate requirement."]}


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("audit")
    args = parser.parse_args()
    report = json.loads(Path(args.audit).read_text())
    inventory = json.loads(Path("server/calculation/data/inventory2024.json").read_text())
    result = gap_sensitivity(inventory_totals(inventory), report["series"])
    target = Path("generated-artifacts/ngfs/gap-sensitivity.json")
    target.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(json.dumps({"path": str(target), "status": result["status"],
                     "missingGasCount": len(result["missing"]),
                     "constantCumulativeMtByGas": {
                         gas: data["cases"]["constant-2024"]["sum2025Through2100Mt"]
                         for gas, data in result["missing"].items()}}, indent=2))

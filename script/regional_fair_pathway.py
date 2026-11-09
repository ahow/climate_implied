"""Strict conversion of one regional member to FaIR's native-gas bridge."""
import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path


def member_pathway(member, inventory):
    baseline = {}
    for cell in inventory["cells"]:
        gas = ("CO2-LULUCF" if cell["sector"] == "LULUCF" else "CO2-EIP") if cell["gas"] == "CO2" else cell["gas"]
        baseline[gas] = baseline.get(gas, 0) + cell["nativeMt"]
    rows = member["global"]
    if [r["year"] for r in rows] != list(range(2024, 2101)):
        raise ValueError("Complete annual member required")
    gases = {gas: [] for gas in baseline}
    expected = (set(baseline) - {"CO2-EIP", "CO2-LULUCF"}) | {"CO2"}
    for row in rows:
        if set(row["nativeMt"]) != expected:
            raise ValueError("Missing or extra native species")
        fossil, land = row["co2FossilMt"], row["co2LandUseMt"]
        if abs(fossil + land - row["nativeMt"]["CO2"]) > max(1, abs(fossil + land)) * 1e-9:
            raise ValueError("CO2 fossil/land split does not reconcile")
        for gas in gases:
            value = fossil if gas == "CO2-EIP" else land if gas == "CO2-LULUCF" else row["nativeMt"][gas]
            if not isinstance(value, (float, int)) or not math.isfinite(value):
                raise ValueError("Nonfinite native emissions")
            if not gas.startswith("CO2-") and value < 0:
                raise ValueError("Negative non-CO2 emissions")
            gases[gas].append(value)
    for gas, value in baseline.items():
        if abs(gases[gas][0] - value) > max(1e-9, abs(value) * 1e-6):
            raise ValueError("Member does not match frozen inventory")
    return {"scenario": "conditional-regional-member", "unit": "Mt gas/year",
            "years": list(range(2024, 2101)), "gases": gases,
            "source": {"memberId": member["memberId"], "inputHash": member["inputHash"],
                       "inventoryId": member["inventoryId"],
                       "claim": "Conditional supplied-parameter member; not calibrated or validated"},
            "productionEligible": False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("members")
    parser.add_argument("member_id")
    parser.add_argument("output")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = Path(args.output).resolve()
    if not output.is_relative_to(root / "generated-artifacts"):
        raise ValueError("Output must remain private under generated-artifacts")
    inventory = json.loads((root / "server/calculation/data/inventory2024.json").read_text())
    selected = None
    digest = hashlib.sha256()
    with gzip.open(args.members, "rb") as stream:
        for line in stream:
            digest.update(line)
            member = json.loads(line)
            if member["memberId"] == args.member_id:
                if selected is not None:
                    raise ValueError("Duplicate member ID")
                selected = member
    if selected is None:
        raise ValueError("Member unavailable")
    manifest = json.loads(Path(args.members).with_name("result.json").read_text())
    if digest.hexdigest() != manifest["membersSha256"] or not manifest["complete"]:
        raise ValueError("Incomplete or altered member stream")
    result = member_pathway(selected, inventory)
    result["source"]["membersSha256"] = digest.hexdigest()
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("x") as file:
        json.dump(result, file)
    print(json.dumps({"file": str(output), "memberId": args.member_id, "species": len(result["gases"])}))


if __name__ == "__main__":
    main()

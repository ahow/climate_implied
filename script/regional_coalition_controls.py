"""Actual six-region removal controls. Conditional attribution, never a forecast."""
import contextlib
import copy
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import sys
from regional_fair_pathway import member_pathway


def coalition_pathway(member, inventory, groups):
    names = [r["region"] for r in member["regions"]]
    if len(set(names)) != len(names) or not set(groups).issubset(names):
        raise ValueError("Invalid region coalition")
    pathway = member_pathway(member, inventory)
    for region in member["regions"]:
        if [r["year"] for r in region["trajectory"]] != pathway["years"]:
            raise ValueError("Incomplete regional trajectory")
    # Verify every native annual regional sum against the retained global member.
    for index, year in enumerate(pathway["years"]):
        full = {gas: 0.0 for gas in pathway["gases"]}
        selected = full.copy()
        for region in member["regions"]:
            row = region["trajectory"][index]
            expected = {cell["gas"] for cell in region["cells"]}
            if not expected.issubset((set(full) - {"CO2-EIP", "CO2-LULUCF"}) | {"CO2"}):
                raise ValueError("Unknown regional inventory species")
            if set(row["nativeMt"]) != expected:
                raise ValueError("Missing or extra regional native species")
            if abs(row["nativeMt"]["CO2"] - row["co2FossilMt"] - row["co2LandUseMt"]) > 1e-7:
                raise ValueError("Regional CO2 split mismatch")
            for gas in full:
                value = row["co2FossilMt"] if gas == "CO2-EIP" else row["co2LandUseMt"] if gas == "CO2-LULUCF" else row["nativeMt"].get(gas, 0)
                if not math.isfinite(value) or (not gas.startswith("CO2-") and value < 0):
                    raise ValueError("Invalid regional gas mass")
                full[gas] += value
                if region["region"] in groups:
                    selected[gas] += value
        for gas, total in full.items():
            original = pathway["gases"][gas][index]
            if abs(total - original) > max(1e-9, abs(original) * 1e-6):
                raise ValueError("Regional/global native accounting mismatch")
            if year > 2024:
                pathway["gases"][gas][index] = selected[gas]
    pathway["source"]["coalition"] = sorted(groups)
    pathway["source"]["claim"] = "Remove excluded regions' inventoried emissions and net land-use flux from 2025; retain all history and 2024 anchor"
    return pathway


def main():
    members, history, output = map(Path, sys.argv[1:])
    if not output.resolve().is_relative_to(Path("generated-artifacts").resolve()):
        raise ValueError("Private output directory required")
    output.mkdir(parents=True, exist_ok=False)
    raw = gzip.decompress(members.read_bytes())
    manifest = json.loads(members.with_name("result.json").read_text())
    if not manifest["complete"] or hashlib.sha256(raw).hexdigest() != manifest["membersSha256"]:
        raise ValueError("Altered or incomplete member stream")
    member = next(m for m in map(json.loads, raw.splitlines()) if m["memberId"] == "m00000")
    inventory = json.loads(Path("server/calculation/data/inventory2024.json").read_text())
    groups = sorted(r["region"] for r in member["regions"])
    if len(groups) != 6:
        raise ValueError("Exactly six benchmark regions required")
    spec = importlib.util.spec_from_file_location("fair_runner", Path(__file__).with_name("fair-reference.py"))
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    provenance = {"membersSha256": manifest["membersSha256"], "historySha256": hashlib.sha256(history.read_bytes()).hexdigest(),
                  "inventoryId": member["inventoryId"], "inputHash": member["inputHash"],
                  "groups": groups, "upstreamHashes": runner.PINNED_HASHES,
                  "definition": "all regions vs zero inventoried regional emissions after 2024; controls, not calibrated policy cases"}
    manifest_id = hashlib.sha256(json.dumps(provenance, sort_keys=True).encode()).hexdigest()
    coalitions, ids = [], None
    for mask in range(2 ** len(groups)):
        included = [g for i, g in enumerate(groups) if mask & (1 << i)]
        path = output / f"pathway-{mask:02d}.json"
        path.write_text(json.dumps(coalition_pathway(member, inventory, included)))
        with (output / f"run-{mask:02d}.log").open("w") as log, contextlib.redirect_stdout(log):
            result = runner.main(path, output / f"run-{mask:02d}", history, "generated-artifacts/fair-reference", retain_ensemble=False)
        if ids is not None and ids != result["memberIds"]:
            raise ValueError("Unpaired climate configurations")
        ids = result["memberIds"]
        coalition = {"groups": included, "values": result["values"]}
        # Preserve each expensive completed computation even if a later run fails.
        (output / f"coalition-{mask:02d}.json").write_text(json.dumps({
            "manifestId": manifest_id, "memberIds": ids, **coalition}))
        coalitions.append(coalition)
        print(f"Completed coalition {mask + 1}/64", flush=True)
    report = {"manifestId": manifest_id, "baselineId": manifest_id + ":none-after-2024",
              "targetId": manifest_id + ":all", "unit": "degC", "memberIds": ids,
              "groups": groups, "coalitions": coalitions}
    (output / "coalitions.json").write_text(json.dumps(report))
    (output / "provenance.json").write_text(json.dumps({**provenance, "complete": True,
                                                       "productionEligible": False}, indent=2))


if __name__ == "__main__":
    main()

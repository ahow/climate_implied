"""Frozen NGFS-derived native-inventory infill comparison, never a forecast."""
import csv
import hashlib
import importlib.util
import itertools
import json
import math
from pathlib import Path

import numpy as np

from compare_fair_histories import compare
from ngfs_pathway_adapter import build_audit, inventory_totals
from pathway_gap_sensitivity import gap_sensitivity

ROOT = Path("generated-artifacts/reference-gas-infill")
PROTOCOL = Path("docs/Reference_Gas_Infill_Protocol.md")
PROTOCOL_SHA = "a0edb772e567d4a477a416dd92fa13392f2659385c4f0717a97dc8a89ac4f139"
SOURCE = Path("generated-artifacts/ngfs/world-selected.csv")
INVENTORY = Path("server/calculation/data/inventory2024.json")
HISTORY = Path("generated-artifacts/species-research/history-carry-forward-"
               "57d21b9cfee3880c123f5816c3abd8ccefe3775b0d42c1774096c41c89cae850.json")
EXPECTED = {
    str(SOURCE): "65a73a469ef668da467af654af14e56f1e7d91b5e28147f592136a1d27881e06",
    str(INVENTORY): "fa5dbe5e8b7c6ab31e8b75805534ad249d5d5056df86f011db34d4038e0a27ea",
    str(HISTORY): "758542f7dae28886ced6c5117f867a05abedd389afcfe9951dd280f0816c5de0",
    "generated-artifacts/ngfs/V5.1_NGFS_Phase_5.zip":
        "acae7160abbd34d10b4eda5226a1fc3ebb5591205203a82c48ab9b5d5ad7c31b",
    "generated-artifacts/species-research/EDGAR_F-gases_1970_2024.xlsx":
        "1109c2459bd95b296ce2797046b72070ff9180ee7a62e72a6e953090a7f0b5c1",
    "generated-artifacts/species-research/ipcc-ar6-ch7-sm.pdf":
        "4290518ef9418a4157ddb9481e589131eeb110614c3aa7b62641d3241d39ce58"}
MISSING = {"HFC-134", "HFC-143", "HFC-245fa", "HFC-41"}
CASES = ("constant-2024", "linear-zero-2050", "zero-after-2024")
SCENARIOS = ("Current Policies", "Nationally Determined Contributions (NDCs)")


def digest(path):
    with Path(path).open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def harmonise(raw, anchor, gas, convergence):
    if convergence not in (2030, 2050) or 2024 not in raw:
        raise ValueError("Frozen convergence and baseline required")
    if not math.isfinite(anchor) or any(not math.isfinite(v) for v in raw.values()):
        raise ValueError("Nonfinite harmonisation")
    if gas != "CO2-LULUCF" and (raw[2024] <= 0 or anchor < 0):
        raise ValueError("Positive ratio baseline required")
    if not gas.startswith("CO2-") and min(raw.values()) < 0:
        raise ValueError("Negative non-CO2 source")
    result = {}
    for year, value in raw.items():
        taper = max(0, (convergence - year) / (convergence - 2024))
        result[year] = (value + (anchor - raw[2024]) * taper if gas == "CO2-LULUCF"
                        else value * (1 + (anchor / raw[2024] - 1) * taper))
        if year >= convergence and abs(result[year] - value) > max(1e-12, abs(value) * 1e-9):
            raise ValueError("Failed reference convergence")
    if abs(result[2024] - anchor) > max(1e-12, abs(anchor) * 1e-6):
        raise ValueError("Failed inventory anchor")
    return result


def summarise_stratum(ensembles):
    names = list(ensembles)
    pairs = {f"{a} vs {b}": compare(ensembles[a], ensembles[b])
             for a, b in itertools.combinations(names, 2)}
    quantiles = {
        name: np.percentile(np.asarray(e["temperature"])[e["years"].index(2100)],
                            [10, 50, 90]).tolist() for name, e in ensembles.items()}
    medians = [q[1] for q in quantiles.values()]
    spread = max(medians) - min(medians)
    return {"annual2100P10P50P90C": quantiles, "medianSpreadC": spread,
            "spreadGate": spread < .01, "pairedComparisons": pairs}


def write_new(path, obj):
    with path.open("x") as stream:
        json.dump(obj, stream, indent=2, allow_nan=False)
        stream.write("\n")


def main():
    if digest(PROTOCOL) != PROTOCOL_SHA:
        raise ValueError("Frozen protocol mismatch")
    for path, sha in EXPECTED.items():
        if digest(path) != sha:
            raise ValueError("Frozen input mismatch: " + path)
    ROOT.mkdir(parents=True, exist_ok=False)
    inventory = json.loads(INVENTORY.read_text())
    anchors = inventory_totals(inventory)
    with SOURCE.open() as stream:
        rows = list(csv.DictReader(stream))
    spec = importlib.util.spec_from_file_location("fair_reference_runner", "script/fair-reference.py")
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    records, ensembles = [], {}
    for si, scenario in enumerate(SCENARIOS):
        audit = build_audit(rows, inventory, scenario=scenario, stage="infilled")
        if set(audit["unrepresentedInventoryGases"]) != MISSING:
            raise ValueError("Unanticipated missing gas set")
        gaps = gap_sensitivity(anchors, audit["series"])["missing"]
        for convergence in (2050, 2030):
            represented = {gas: harmonise(series["raw"], anchors[gas], gas, convergence)
                           for gas, series in audit["series"].items()}
            for case in CASES:
                gases = {gas: [values[y] for y in range(2024, 2101)]
                         for gas, values in represented.items()}
                gases.update({gas: [gaps[gas]["cases"][case]["annual"][y]
                                    for y in range(2024, 2101)] for gas in MISSING})
                if set(gases) != set(anchors):
                    raise ValueError("Incomplete native boundary")
                max_relative = max(abs(gases[g][0] - a) / abs(a) if a else
                                   (0 if gases[g][0] == 0 else math.inf)
                                   for g, a in anchors.items())
                if max_relative > 1e-6:
                    raise ValueError("Inventory threshold failed")
                key = f"s{si}-{convergence}-{case}"
                pathway = {"scenario": "conditional-ngfs-native-inventory-sensitivity",
                           "unit": "Mt gas/year", "years": list(range(2024, 2101)),
                           "gases": gases, "productionEligible": False,
                           "source": {"referenceScenario": scenario, "model": audit["model"],
                                      "processingStage": "infilled", "policyCutoff": "2024-03",
                                      "includesLongTermPledges": False, "convergence": convergence,
                                      "infillCase": case, "ngfsExtractSha256": EXPECTED[str(SOURCE)],
                                      "protocolSha256": PROTOCOL_SHA}}
                path = ROOT / f"{key}.json"
                write_new(path, pathway)
                result = runner.main(pathway_file=path, output_directory=ROOT / key,
                                     species_history_file=HISTORY,
                                     inputs_directory=Path("generated-artifacts/fair-reference"))
                ensemble_path = ROOT / key / "ensemble.json"
                ensemble = json.loads(ensemble_path.read_text())
                if len(ensemble["memberIds"]) != 841:
                    raise ValueError("Expected all 841 constrained members")
                ensembles[(scenario, convergence, case)] = ensemble
                records.append({"scenario": scenario, "convergence": convergence, "case": case,
                                "pathwaySha256": digest(path), "ensembleSha256": digest(ensemble_path),
                                "inventoryMaxRelativeError": max_relative,
                                "members": len(ensemble["memberIds"]),
                                "calibrationInputs": result["summary"]["inputs"],
                                "historySha256": result["summary"]["additionalSpeciesEvidence"]["historySha256"]})
    for record in records:
        for field in ("calibrationInputs", "historySha256"):
            if record[field] != records[0][field]:
                raise ValueError("Unpaired reference configuration/history")
    strata = [{"scenario": s, "convergence": c,
               **summarise_stratum({case: ensembles[(s, c, case)] for case in CASES})}
              for s in SCENARIOS for c in (2050, 2030)]
    convergence_changes = [
        {"scenario": s, "case": case, **compare(ensembles[(s, 2050, case)],
                                                ensembles[(s, 2030, case)])}
        for s in SCENARIOS for case in CASES]
    code_paths = [__file__, "script/ngfs_pathway_adapter.py", "script/pathway_gap_sensitivity.py",
                  "script/fair-reference.py", "script/fair_native_bridge.py",
                  "script/fair_additional_species.py", "script/compare_fair_histories.py"]
    report = {"protocolSha256": PROTOCOL_SHA, "sourceHashes": EXPECTED,
              "codeHashes": {p: digest(p) for p in code_paths}, "records": records,
              "strata": strata, "convergenceChanges": convergence_changes,
              "centralEligible": False, "informationAvailableAt": None,
              "classification": "bounded-conditional-reference-infill-sensitivity",
              "fullNGFSClimateReproduction": False, "allCommitmentsAvailable": False,
              "acceptedInfill": False}
    text = json.dumps(report, indent=2, allow_nan=False) + "\n"
    target = ROOT / ("result-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    with target.open("x") as stream:
        stream.write(text)
    print(json.dumps({"evidence": str(target), "strata": strata,
                      "convergenceChanges": convergence_changes}, indent=2))


if __name__ == "__main__":
    main()

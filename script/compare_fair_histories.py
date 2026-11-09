"""Paired history sensitivities; rejects changed members, pathways or calibration."""
import hashlib
import json
from pathlib import Path
import sys
import numpy as np


def compare(reference, candidate):
    for field in ("baseline", "years", "memberIds"):
        if reference.get(field) != candidate.get(field):
            raise ValueError("Unpaired climate histories: " + field)
    if not reference["years"] or len(set(reference["memberIds"])) != len(reference["memberIds"]):
        raise ValueError("Missing years or duplicate climate members")
    a, b = np.asarray(reference["temperature"]), np.asarray(candidate["temperature"])
    expected = (len(reference["years"]), len(reference["memberIds"]))
    if a.shape != expected or b.shape != expected or not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError("Invalid temperature matrix")
    delta = b - a
    return {"maximumAbsolutePairedDifferenceC": float(np.abs(delta).max()),
            "annual2100PairedDifferenceP10P50P90C": np.percentile(
                delta[reference["years"].index(2100)], [10, 50, 90]).tolist()}


def main(directories):
    if len(directories) != 3:
        raise ValueError("Supply zero, carry and peak-stress output directories")
    results, ensembles = [], []
    for directory in directories:
        root = Path(directory)
        results.append(json.loads((root / "result.json").read_text()))
        ensembles.append(json.loads((root / "ensemble.json").read_text()))
    for candidate in results[1:]:
        for field in ("inputs", "pathwaySource", "fairVersion", "upstreamRevision", "scenario"):
            if candidate[field] != results[0][field]:
                raise ValueError("Different calibration or future pathway: " + field)
        for field in ("parameterSource", "parameterSourceSha256", "parameters", "assumptions"):
            if candidate["additionalSpeciesEvidence"][field] != results[0]["additionalSpeciesEvidence"][field]:
                raise ValueError("Different additional-species configuration: " + field)
    report = {"cases": ["zero-missing", "carry-forward", "historical-peak-stress"],
              "membersPerCase": len(ensembles[0]["memberIds"]),
              "sourceDirectoryHashes": [
                  hashlib.sha256((Path(d) / "ensemble.json").read_bytes()).hexdigest() for d in directories],
              "zeroVsCarry": compare(ensembles[0], ensembles[1]),
              "zeroVsPeakStress": compare(ensembles[0], ensembles[2]),
              "control2100P10P50P90C": results[0]["annual2100P10P50P90C"],
              "productionEligible": False,
              "claim": "Uncalibrated constant-regional-input control with assumed pre-1970 and missing histories; not a dashboard forecast"}
    text = json.dumps(report, indent=2) + "\n"
    path = Path("generated-artifacts/species-research") / ("comparison-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if path.exists():
        if path.read_text() != text:
            raise ValueError("Existing evidence differs")
    else:
        with path.open("x") as stream:
            stream.write(text)
    print(text)


if __name__ == "__main__":
    main(sys.argv[1:])

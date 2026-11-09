"""Training-only predictive uncertainty and fixed-break diagnostics."""
import csv
import hashlib
import json
import math
from pathlib import Path
import random

from driver_calibration import ENTITIES, fit
from electricity_demand_calibration import TRAIN, HOLDOUT, quantile


def residuals(values):
    a, b = fit(list(enumerate(values)))
    return a, b, [v - a - b * i for i, v in enumerate(values)]


def break_statistic(values):
    whole = sum(e * e for e in residuals(values)[2])
    split = sum(e * e for e in residuals(values[:5])[2])
    split += sum(e * e for e in residuals(values[5:])[2])
    return max(0.0, whole - split)


def blocks(rng, errors, count):
    sampled = []
    while len(sampled) < count:
        start = rng.randrange(len(errors))
        sampled.extend(errors[(start + j) % len(errors)] for j in range(3))
    return sampled[:count]


def evaluate(rows):
    if len({y for y, _ in rows}) != len(rows):
        raise ValueError("Duplicate years")
    if any(type(y) is not int or (v is not None and
           (not math.isfinite(v) or v <= 0)) for y, v in rows):
        raise ValueError("Integer years and positive finite demand required")
    data = dict(rows)
    if any(data.get(y) is None for y in TRAIN + HOLDOUT):
        return {"status": "unavailable", "centralModelEligible": False}
    logs = [math.log(data[y]) for y in TRAIN]
    a, b, errors = residuals(logs)
    mean = sum(errors) / len(errors)
    errors = [e - mean for e in errors]
    rng = random.Random(20261110)
    samples = [[] for _ in HOLDOUT]
    null_statistics = []
    for _ in range(1000):
        training_errors = blocks(rng, errors, 9)
        simulated = [a + b * i + e for i, e in enumerate(training_errors)]
        da, db, _ = residuals(simulated)
        null_statistics.append(break_statistic(simulated))
        for j, e in enumerate(blocks(rng, errors, 6)):
            samples[j].append(math.exp(da + db * (9 + j) + e))
    observed_stat = break_statistic(logs)
    holdout = []
    for year, values in zip(HOLDOUT, samples):
        lo, hi = quantile(values, .025), quantile(values, .975)
        observed = data[year]
        score = hi - lo + 40 * (max(lo - observed, 0) + max(observed - hi, 0))
        holdout.append({"year": year, "observedTWh": observed,
                        "predictiveInterval95TWh": [lo, hi],
                        "covered": lo <= observed <= hi, "intervalScoreTWh": score})
    return {"status": "diagnostic", "centralModelEligible": False,
            "breakStatistic": observed_stat,
            "breakPValue": (1 + sum(s >= observed_stat for s in null_statistics)) / 1001,
            "holdout": holdout, "coveredYears": sum(h["covered"] for h in holdout),
            "meanIntervalScoreTWh": sum(h["intervalScoreTWh"] for h in holdout) / 6,
            "meanIntervalWidthTWh": sum(h["predictiveInterval95TWh"][1] -
                                        h["predictiveInterval95TWh"][0] for h in holdout) / 6}


def holm(pvalues):
    if any(not math.isfinite(p) or not 0 <= p <= 1 for p in pvalues):
        raise ValueError("Invalid p value")
    result = [0.0] * len(pvalues)
    previous = 0.0
    for rank, i in enumerate(sorted(range(len(pvalues)), key=lambda i: pvalues[i])):
        previous = max(previous, min(1.0, (len(pvalues) - rank) * pvalues[i]))
        result[i] = previous
    return result


def main():
    root = Path("generated-artifacts/driver-calibration")
    source = root / "owid-energy-data.csv"
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != json.loads((root / "result.json").read_text())["sourceSha256"]:
        raise ValueError("Frozen source hash mismatch")
    data = {entity: [] for entity in ENTITIES}
    with source.open() as stream:
        for row in csv.DictReader(stream):
            if row["country"] in data and 2010 <= int(row["year"]) <= 2024:
                data[row["country"]].append((int(row["year"]),
                    float(row["electricity_demand"]) if row["electricity_demand"] else None))
    results = [{"entity": entity, **evaluate(rows)} for entity, rows in data.items()]
    # Unavailable members retain their place in the prespecified five-test family.
    adjusted = holm([r.get("breakPValue", 1.0) for r in results])
    for r, p in zip(results, adjusted):
        r["holmBreakPValue"] = p if r["status"] == "diagnostic" else None
        r["breakDetected"] = p <= .05 if r["status"] == "diagnostic" else None
    report = {"sourceSha256": digest, "protocolSha256": hashlib.sha256(
        Path("docs/Demand_Predictive_Validation_Protocol.md").read_bytes()).hexdigest(),
        "historyBasis": "revised-history", "productionEligible": False, "results": results}
    encoded = json.dumps(report, indent=2) + "\n"
    target = root / ("demand-predictive-" + hashlib.sha256(encoded.encode()).hexdigest() + ".json")
    if target.exists():
        if target.read_text() != encoded:
            raise ValueError("Existing evidence differs")
    else:
        with target.open("x") as stream:
            stream.write(encoded)
    print(json.dumps({"evidence": str(target), "results": [
        {k: v for k, v in r.items() if k != "holdout"} for r in results]}, indent=2))


if __name__ == "__main__":
    main()

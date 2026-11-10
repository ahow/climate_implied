"""Frozen EIA storage diagnostic. No production promotion or network access."""
import hashlib
import json
import math
from pathlib import Path
import random
import sys
from driver_calibration import fit
from electricity_demand_calibration import quantile


def samples(n, block):
    rng = random.Random(20261110)
    for _ in range(2000):
        sample = []
        while len(sample) < n:
            start = rng.randrange(n)
            sample.extend((start + j) % n for j in range(block))
        yield sample[:n]


def interval(values):
    return [quantile(values, .025), quantile(values, .975)]


def evaluate(rows):
    if len(dict(rows)) != len(rows):
        raise ValueError("Duplicate year")
    if any(type(y) is not int or v is not None and
           (not math.isfinite(v) or v <= 0) for y, v in rows):
        raise ValueError("Positive finite capacity and integer year required")
    data = dict(rows)
    missing = [y for y in range(2010, 2025) if data.get(y) is None]
    if missing:
        return {"status": "unavailable", "missingYears": missing, "centralModelEligible": False}
    train = [(y - 2010, data[y]) for y in range(2010, 2019)]
    a, b = fit([(x, math.log(v)) for x, v in train])
    la, lb = fit(train)
    residual = [math.log(v) - a - b*x for x, v in train]
    mean = sum(residual) / len(residual)
    residual = [r - mean for r in residual]
    draws = [fit([(x, a + b*x + residual[j]) for x, j in enumerate(s)])
             for s in samples(9, 3)]
    errors = {k: [] for k in ["exponential", "persistence", "linear"]}
    holdout = []
    for y in range(2019, 2025):
        x = y - 2010
        predictions = {"exponential": math.exp(a+b*x), "persistence": data[2018],
                       "linear": max(0, la+lb*x)}
        holdout.append({"year": y, "observed": data[y], "predictions": predictions,
                        "parameterInterval95": interval([math.exp(da+db*x) for da, db in draws])})
        for k, v in predictions.items():
            errors[k].append(abs(v-data[y]))
    mae = {k: sum(v)/6 for k, v in errors.items()}
    improvements = {}
    for k in ["persistence", "linear"]:
        delta = [v-c for v, c in zip(errors[k], errors["exponential"])]
        improvements[k] = {"mean": sum(delta)/6,
                           "interval95": interval([sum(delta[i] for i in s)/6 for s in samples(6, 2)])}
    return {"status": "diagnostic-fit", "parameters": {"intercept": a, "slope": b},
            "growthInterval95": interval([math.exp(db)-1 for _, db in draws]),
            "mae": mae, "mape": {k: sum(v/data[y] for y, v in zip(range(2019, 2025), es))/6
                                 for k, es in errors.items()},
            "pairedImprovements": improvements,
            "beatsBothBaselines": mae["exponential"] < min(mae["linear"], mae["persistence"]),
            "centralModelEligible": False, "saturation": "unidentified",
            "classification": "sensitivity-only", "holdout": holdout}


def main(path):
    source = Path(path)
    payload = json.loads(source.read_text())
    report = {"source": payload["source"], "sourceSha256": payload["sourceSha256"],
              "protocolSha256": hashlib.sha256(Path("docs/Storage_Adoption_Protocol.md").read_bytes()).hexdigest(),
              "historyBasis": "revised-history", "results": {
                  unit: evaluate([(row["year"], row[unit]) for row in payload["rows"]])
                  for unit in ["MW", "MWh"]}}
    text = json.dumps(report, indent=2) + "\n"
    target = source.parent / ("storage-result-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if not target.exists():
        target.write_text(text)
    print(json.dumps({"file": str(target), **report}, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])

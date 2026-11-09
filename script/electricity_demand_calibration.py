"""Frozen regional demand study; no automatic central-model promotion."""
import csv
import hashlib
import json
import math
from pathlib import Path
import random
from driver_calibration import fit, ENTITIES

TRAIN = list(range(2010, 2019))
HOLDOUT = list(range(2019, 2025))


def block_indices():
    rng = random.Random(20261109)
    result = []
    for _ in range(1000):
        indexes = []
        for _ in range(3):
            start = rng.randrange(9)
            indexes.extend((start + j) % 9 for j in range(3))
        result.append(indexes)
    return result


def quantile(values, p):
    values = sorted(values)
    x = (len(values) - 1) * p
    lo, hi = math.floor(x), math.ceil(x)
    return values[lo] + (values[hi] - values[lo]) * (x - lo)


def evaluate(rows):
    rows = sorted(rows)
    if len({y for y, _ in rows}) != len(rows):
        raise ValueError("Duplicate years")
    if any(not isinstance(y, int) or (v is not None and (not math.isfinite(v) or v <= 0)) for y, v in rows):
        raise ValueError("Positive finite demand and integer years required")
    by_year = dict(rows)
    if any(by_year.get(y) is None for y in TRAIN + HOLDOUT):
        return {"status": "unavailable", "reason": "Incomplete frozen annual training or holdout window",
                "centralModelEligible": False}
    training = [(y - 2010, by_year[y]) for y in TRAIN]
    a, b = fit([(x, math.log(v)) for x, v in training])
    la, lb = fit(training)
    residuals = [math.log(v) - (a + b * x) for x, v in training]
    mean_residual = sum(residuals) / len(residuals)
    residuals = [v - mean_residual for v in residuals]
    draws = []
    for indices in block_indices():
        intercept, slope = fit([(i, a + b * i + residuals[j]) for i, j in enumerate(indices)])
        draws.append({"intercept": intercept, "slope": slope})
    errors = {"logTrend": [], "persistence": [], "linearTrend": []}
    holdout = []
    for y in HOLDOUT:
        x, observed = y - 2010, by_year[y]
        predictions = {"logTrend": math.exp(a + b * x), "persistence": by_year[2018],
                       "linearTrend": max(0, la + lb * x)}
        samples = [math.exp(d["intercept"] + d["slope"] * x) for d in draws]
        lower, upper = quantile(samples, .025), quantile(samples, .975)
        holdout.append({"year": y, "observedTWh": observed, "predictionsTWh": predictions,
                        "parameterInterval95TWh": [lower, upper], "covered": lower <= observed <= upper})
        for name, value in predictions.items():
            errors[name].append(abs(value - observed))
    mae = {k: sum(v) / len(v) for k, v in errors.items()}
    mean_observed = sum(by_year[y] for y in HOLDOUT) / len(HOLDOUT)
    beats = mae["logTrend"] < min(mae["persistence"], mae["linearTrend"])
    early = fit([(y - 2010, math.log(by_year[y])) for y in range(2010, 2015)])[1]
    late = fit([(y - 2010, math.log(by_year[y])) for y in range(2015, 2019)])[1]
    return {"status": "diagnostic-fit", "parameters": {"intercept": a, "slope": b,
            "annualGrowthFraction": math.exp(b) - 1}, "draws": draws,
            "maeTWh": mae, "relativeMAE": {k: v / mean_observed for k, v in mae.items()},
            "beatsBothBaselines": beats, "role": "candidate-needs-validation" if beats else "sensitivity-only",
            "centralModelEligible": False, "holdout": holdout,
            "parameterIntervalCoveredYears": sum(h["covered"] for h in holdout),
            "stability": {"earlyLogSlope": early, "lateLogSlope": late, "formalBreakTest": False}}


def main():
    root = Path("generated-artifacts/driver-calibration")
    source = root / "owid-energy-data.csv"
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    earlier = json.loads((root / "result.json").read_text())
    if digest != earlier["sourceSha256"]:
        raise ValueError("Frozen source differs from earlier adoption calibration")
    data = {entity: [] for entity in ENTITIES}
    with source.open() as f:
        for row in csv.DictReader(f):
            if row["country"] not in data or not 2010 <= int(row["year"]) <= 2024:
                continue
            value = row["electricity_demand"]
            data[row["country"]].append((int(row["year"]), float(value) if value else None))
    report = {"sourceSha256": digest,
              "protocolSha256": hashlib.sha256(Path("docs/Electricity_Demand_Calibration_Protocol.md").read_bytes()).hexdigest(),
              "unit": "TWh", "sourceRelease": "frozen-legacy-OWID-energy-not-current-feed",
              "historyBasis": "revised-history", "claim": "historical electricity-demand fit; not an emissions forecast",
              "results": [{"entity": entity, **evaluate(rows)} for entity, rows in data.items()]}
    (root / "electricity-demand.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({**report, "results": [{k: v for k, v in r.items() if k not in ("draws", "holdout")}
                                          for r in report["results"]]}, indent=2))


if __name__ == "__main__":
    main()

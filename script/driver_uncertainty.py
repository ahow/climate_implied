"""Frozen supplemental uncertainty study; retains the original eligibility rule."""
import csv
import hashlib
import json
import math
import pathlib
import random
from driver_calibration import ENTITIES, TECHNOLOGIES, evaluate, fit

def quantile(values, probability):
    values = sorted(values)
    index = (len(values) - 1) * probability
    lo, hi = math.floor(index), math.ceil(index)
    return values[lo] + (values[hi] - values[lo]) * (index - lo)

def logistic(value):
    return 1 / (1 + math.exp(max(-700, min(700, -value))))

def uncertainty(rows, seed=20261108, replications=1000):
    original = evaluate(rows)
    if original["status"] != "diagnostic-fit":
        return original
    train = sorted((year - 2010, math.log(value / (1 - value)))
                   for year, value in rows if 2010 <= year <= 2018 and 0 < value < 1)
    a, b = fit(train)
    residuals = [y - a - b*x for x, y in train]
    mean = sum(residuals) / len(residuals)
    residuals = [r - mean for r in residuals]
    rng = random.Random(seed)
    parameters = []
    for _ in range(replications):
        errors = []
        while len(errors) < len(train):
            start = rng.randrange(len(train))
            errors.extend(residuals[(start+i) % len(train)] for i in range(3))
        parameters.append(fit([(x, a+b*x+errors[i]) for i, (x, _) in enumerate(train)]))
    intervals = []
    for year, observed in sorted((y, v) for y, v in rows if 2019 <= y <= 2024):
        predictions = [logistic(aa+bb*(year-2010)) for aa, bb in parameters]
        lower, median, upper = [quantile(predictions, p) for p in [.025, .5, .975]]
        intervals.append({"year": year, "observed": observed, "lower": lower, "median": median,
                          "upper": upper, "covered": lower <= observed <= upper})
    early = [(x,y) for x,y in train if x <= 4]
    late = [(x,y) for x,y in train if x >= 5]
    slopes = {"early": fit(early)[1] if len(early) >= 2 else None,
              "late": fit(late)[1] if len(late) >= 2 else None}
    return {**original, "pairedBootstrapParameters": parameters,
            "parameterIntervals": {name: [quantile([p[i] for p in parameters], q) for q in [.025, .5, .975]]
                                   for i,name in enumerate(["intercept","slope"])},
            "holdoutIntervals": intervals, "parameterIntervalCoverage": sum(r["covered"] for r in intervals)/len(intervals),
            "trainingSlopeStability": slopes, "seed": seed, "replications": replications,
            "centralModelEligible": False,
            "uncertaintyMeaning": "Training residual parameter uncertainty only; not full predictive uncertainty"}

def main():
    directory = pathlib.Path("generated-artifacts/driver-calibration")
    raw = directory / "owid-energy-data.csv"
    data = {(e,t): [] for e in ENTITIES for t in TECHNOLOGIES}
    with raw.open() as f:
        for row in csv.DictReader(f):
            if row["country"] not in ENTITIES or not 2010 <= int(row["year"]) <= 2024:
                continue
            for tech in TECHNOLOGIES:
                if row.get(tech) not in ("", None):
                    data[row["country"],tech].append((int(row["year"]),float(row[tech])/100))
    report = {"sourceSha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
              "protocolHashes": {p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() for p in
                                ["docs/Driver_Calibration_Protocol.md","docs/Driver_Uncertainty_Protocol.md"]},
              "historyBasis": "revised-history", "centralModelEligible": False,
              "results": [{"entity": e,"technology":t,**uncertainty(rows)} for (e,t),rows in data.items()]}
    (directory/"uncertainty.json").write_text(json.dumps(report))
    print(json.dumps([{k:v for k,v in r.items() if k not in ("pairedBootstrapParameters","holdoutIntervals")}
                      for r in report["results"]],indent=2))

if __name__ == "__main__":
    main()

"""Frozen EV adoption diagnostic; no scientific promotion or data ingestion."""
import csv
import hashlib
import json
import math
from pathlib import Path
import random
from driver_calibration import fit
from electricity_demand_calibration import quantile

ENTITIES = ["World", "China", "India", "United States", "European Union (27)", "Rest of World"]
TRAIN, HOLDOUT = list(range(2010, 2019)), list(range(2019, 2025))
SOURCE_HASH = "45969bb5f9a809c45792d8986f53023754d0fa141e74c7e24ad9af6ad041059b"


def indices(length, block):
    rng = random.Random(20261109)
    for _ in range(1000):
        draw = []
        while len(draw) < length:
            start = rng.randrange(length)
            draw.extend((start + k) % length for k in range(block))
        yield draw[:length]


def logistic(value):
    return 1 / (1 + math.exp(max(-700, min(700, -value))))


def evaluate(rows):
    if len({year for year, _ in rows}) != len(rows):
        raise ValueError("Duplicate years")
    if any(type(y) is not int or (v is not None and (type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= 1)) for y, v in rows):
        raise ValueError("Integer years and finite shares in [0,1] required")
    data = dict(rows)
    missing = [y for y in TRAIN + HOLDOUT if data.get(y) is None]
    if missing:
        return {"status": "unavailable", "missingYears": missing, "centralModelEligible": False}
    if any(not 0 < data[y] < 1 for y in TRAIN):
        return {"status": "unavailable", "reason": "Training endpoints cannot be logit-transformed without assumptions",
                "centralModelEligible": False}
    points = [(y - 2010, math.log(data[y] / (1 - data[y]))) for y in TRAIN]
    a, b = fit(points)
    la, lb = fit([(y - 2010, data[y]) for y in TRAIN])
    residuals = [v - a - b * x for x, v in points]
    mean = sum(residuals) / len(residuals)
    residuals = [v - mean for v in residuals]
    draws = [fit([(x, a + b * x + residuals[j]) for x, j in enumerate(sample)])
             for sample in indices(9, 3)]
    errors = {"logistic": [], "persistence": [], "linearTrend": []}
    holdout = []
    for year in HOLDOUT:
        x = year - 2010
        predictions = {"logistic": logistic(a + b * x), "persistence": data[2018],
                       "linearTrend": max(0, min(1, la + lb * x))}
        uncertainty = [logistic(da + db * x) * 100 for da, db in draws]
        interval = [quantile(uncertainty, .025), quantile(uncertainty, .975)]
        holdout.append({"year": year, "observedPercent": data[year] * 100,
                        "predictedPercent": {k: v * 100 for k, v in predictions.items()},
                        "parameterInterval95Percent": interval,
                        "parameterIntervalCoversObservation": interval[0] <= data[year] * 100 <= interval[1]})
        for name, prediction in predictions.items():
            errors[name].append(abs(prediction - data[year]) * 100)
    mae = {k: sum(v) / len(v) for k, v in errors.items()}
    improvements = {}
    for baseline in ("persistence", "linearTrend"):
        delta = [base - candidate for base, candidate in zip(errors[baseline], errors["logistic"])]
        boot = [sum(delta[i] for i in sample) / len(sample) for sample in indices(6, 2)]
        improvements[baseline] = {"meanPercentagePoints": sum(delta) / len(delta),
                                 "interval95": [quantile(boot, .025), quantile(boot, .975)]}
    beats = mae["logistic"] < min(mae["persistence"], mae["linearTrend"])
    return {"status": "diagnostic-fit", "parameters": {"intercept": a, "slope": b, "saturation": 1},
            "parameterDraws": [{"intercept": da, "slope": db} for da, db in draws],
            "maePercentagePoints": mae, "pairedImprovements": improvements,
            "beatsBothBaselines": beats,
            "diagnosticGatePassed": beats and all(v["interval95"][0] > 0 for v in improvements.values()),
            "centralModelEligible": False, "holdout": holdout,
            "stability": {"earlyLogitSlope": fit(points[:5])[1], "lateLogitSlope": fit(points[5:])[1],
                          "formalBreakTest": False}}


def main():
    root = Path("generated-artifacts/driver-calibration")
    source = root / "ev-sales-share.csv"
    if hashlib.sha256(source.read_bytes()).hexdigest() != SOURCE_HASH:
        raise ValueError("Frozen EV source changed")
    metadata_file = root / "ev-sales-share.metadata.json"
    metadata = json.loads(metadata_file.read_text())
    column = "Share of new cars that are electric"
    if metadata["columns"][column]["unit"] != "%":
        raise ValueError("Source unit differs")
    data = {entity: [] for entity in ENTITIES}
    with source.open() as stream:
        reader = csv.DictReader(stream)
        if set(reader.fieldnames) != {"Entity", "Code", "Year", column}:
            raise ValueError("Unexpected CSV schema")
        for row in reader:
            if row["Entity"] in data:
                data[row["Entity"]].append((int(row["Year"]), float(row[column]) / 100 if row[column] else None))
    report = {"source": metadata["chart"]["originalChartUrl"], "sourceSha256": SOURCE_HASH,
              "metadataSha256": hashlib.sha256(metadata_file.read_bytes()).hexdigest(),
              "protocolSha256": hashlib.sha256(Path("docs/EV_Calibration_Protocol.md").read_bytes()).hexdigest(),
              "citations": {"chart": metadata["chart"]["citation"],
                            "column": metadata["columns"][column]["citationShort"],
                            "conflict": "Chart cites 2026; column citation cites 2025; unresolved"},
              "historyBasis": "revised-history", "productionEligible": False,
              "results": [{"entity": entity, **evaluate(rows)} for entity, rows in data.items()]}
    text = json.dumps(report, indent=2) + "\n"
    path = root / ("ev-calibration-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if path.exists():
        if path.read_text() != text:
            raise ValueError("Existing evidence differs")
    else:
        with path.open("x") as stream:
            stream.write(text)
    print(json.dumps({**report, "file": str(path), "results": [
        {k: v for k, v in result.items() if k not in ("parameterDraws", "holdout")}
        for result in report["results"]]}, indent=2))


if __name__ == "__main__":
    main()

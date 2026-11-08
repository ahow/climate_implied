"""Locked regional electricity adoption diagnostic; stdlib only."""
import csv
import hashlib
import json
import math
import pathlib
import sys
import urllib.request

ENTITIES = ["World", "United States", "China", "India", "European Union (27)"]
TECHNOLOGIES = ["solar_share_elec", "wind_share_elec"]
SOURCE = "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv"

def fit(points):
    xs = [x for x, _ in points]
    ys = [y for _, y in points]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    variance = sum((x - mx) ** 2 for x in xs)
    if variance == 0:
        raise ValueError("Insufficient distinct years")
    slope = sum((x - mx) * (y - my) for x, y in points) / variance
    return my - slope * mx, slope

def evaluate(rows):
    training = [(year - 2010, value) for year, value in rows if 2010 <= year <= 2018 and 0 < value < 1]
    evaluation = [(year, value) for year, value in rows if 2019 <= year <= 2024]
    if len(training) < 6 or len(evaluation) != 6 or {year for year, _ in evaluation} != set(range(2019, 2025)):
        return {"status": "unavailable", "reason": "Incomplete frozen training/evaluation window"}
    if any(not math.isfinite(v) or not 0 <= v <= 1 for _, v in rows):
        raise ValueError("Invalid share")
    intercept, slope = fit([(x, math.log(y / (1 - y))) for x, y in training])
    linear_a, linear_b = fit(training)
    persistence = max(training)[1]
    errors = {"logistic": [], "persistence": [], "linearTrend": []}
    for year, observed in evaluation:
        x = year - 2010
        predictions = {"logistic": 1 / (1 + math.exp(max(-700, min(700, -(intercept + slope * x))))),
                       "persistence": persistence, "linearTrend": max(0, min(1, linear_a + linear_b * x))}
        for name, predicted in predictions.items():
            errors[name].append(abs(predicted - observed) * 100)
    mae = {name: sum(values) / len(values) for name, values in errors.items()}
    beats = mae["logistic"] < min(mae["persistence"], mae["linearTrend"])
    return {"status": "diagnostic-fit", "parameters": {"intercept": intercept, "slope": slope, "saturation": 1},
            "maePercentagePoints": mae, "beatsBothBaselines": beats,
            "role": "candidate-needs-uncertainty-validation" if beats else "sensitivity-only",
            "centralModelEligible": False}

def main():
    directory = pathlib.Path("generated-artifacts/driver-calibration")
    directory.mkdir(parents=True, exist_ok=True)
    raw = directory / "owid-energy-data.csv"
    if not raw.exists():
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "ClimateDashboardResearch/1.0"})
        with urllib.request.urlopen(request, timeout=90) as response:
            raw.write_bytes(response.read(60_000_001))
        if raw.stat().st_size > 60_000_000:
            raw.unlink()
            raise ValueError("Source exceeds bounded download")
    data = {(entity, technology): [] for entity in ENTITIES for technology in TECHNOLOGIES}
    with raw.open() as source:
        for row in csv.DictReader(source):
            if row["country"] not in ENTITIES:
                continue
            year = int(row["year"])
            if not 2010 <= year <= 2024:
                continue
            for technology in TECHNOLOGIES:
                if row.get(technology) not in ("", None):
                    data[row["country"], technology].append((year, float(row[technology]) / 100))
    report = {
        "source": SOURCE, "sourceSha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
        "protocolSha256": hashlib.sha256(pathlib.Path("docs/Driver_Calibration_Protocol.md").read_bytes()).hexdigest(),
        "historyBasis": "revised-history", "causalEvidence": False,
        "results": [{"entity": entity, "technology": technology, **evaluate(rows)} for (entity, technology), rows in data.items()],
        "limitations": ["Parameter uncertainty and structural breaks not yet evaluated", "No central-model promotion",
                        "Other drivers remain uncalibrated", "Source extracts remain private pending licence review"],
    }
    (directory / "result.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()

"""Cost/deployment associations, not causal learning or promoted forecasts."""
import csv
import hashlib
import json
import math
from pathlib import Path
from driver_calibration import fit
from ev_sales_calibration import indices, TRAIN, HOLDOUT
from electricity_demand_calibration import quantile

SOURCES = {
    "solar": {"slug": "solar-pv-prices-vs-cumulative-capacity",
              "sha256": "6efdef913762771ab604677e8b1833fd7987863c937367317ca9c9436e036d49",
              "cost": "Solar PV module cost", "deployment": "Cumulative installed solar PV capacity",
              "costMetadata": "Solar photovoltaic module price", "deploymentMetadata": "Solar photovoltaic cumulative capacity",
              "costUnit": "constant 2025 US$ per watt", "deploymentUnit": "megawatts",
              "limitation": "European price benchmarks with 2013/2020 source-definition breaks; global installed capacity is not manufactured output"},
    "battery": {"slug": "battery-price-vs-cumulative-production",
                "sha256": "7c74eac940ca78e8a05bce6c5c2e613f942c1bd0021fca28d8cf9a1dce3e9797",
                "cost": "Price of lithium-ion battery cells", "deployment": "Cumulative production of lithium-ion batteries",
                "costMetadata": "Price of lithium-ion battery cells", "deploymentMetadata": "Cumulative production of lithium-ion batteries",
                "costUnit": "constant 2024 US$ per kilowatt-hour", "deploymentUnit": "gigawatt-hours",
                "limitation": "Cell prices, not pack prices; output covers multiple applications; 2024 output unavailable"}
}


def evaluate(rows):
    if len(set(r[0] for r in rows)) != len(rows):
        raise ValueError("Duplicate years")
    if any(type(y) is not int or any(v is not None and (type(v) not in (int, float) or not math.isfinite(v) or v <= 0)
                                    for v in (cost, deployed)) for y, cost, deployed in rows):
        raise ValueError("Positive finite costs/deployment and integer years required")
    data = {y: (cost, deployed) for y, cost, deployed in rows}
    missing = lambda years: [y for y in years if y not in data or None in data[y]]
    if missing(TRAIN):
        return {"status": "unavailable", "missingTrainingYears": missing(TRAIN), "centralModelEligible": False}
    points = [(math.log(data[y][1]), math.log(data[y][0])) for y in TRAIN]
    a, b = fit(points)
    ta, tb = fit([(y - 2010, math.log(data[y][0])) for y in TRAIN])
    residuals = [v - a - b * x for x, v in points]
    mean = sum(residuals) / 9
    residuals = [v - mean for v in residuals]
    draws = [fit([(points[i][0], a + b * points[i][0] + residuals[j]) for i, j in enumerate(sample)])
             for sample in indices(9, 3)]
    declines = [1 - 2 ** db for _, db in draws]
    result = {"parameters": {"intercept": a, "slope": b},
              "apparentCostDeclinePerDoubling": 1 - 2 ** b,
              "apparentDeclineInterval95": [quantile(declines, .025), quantile(declines, .975)],
              "centralModelEligible": False, "causalLearningRateIdentified": False}
    if missing(HOLDOUT):
        return {**result, "status": "training-fit-holdout-unavailable", "missingHoldoutYears": missing(HOLDOUT)}
    errors = {"costDeployment": [], "persistence": [], "calendarTrend": []}
    holdout = []
    for y in HOLDOUT:
        cost, deployed = data[y]
        predictions = {"costDeployment": math.exp(a + b * math.log(deployed)),
                       "persistence": data[2018][0], "calendarTrend": math.exp(ta + tb * (y - 2010))}
        if not all(math.isfinite(v) for v in predictions.values()):
            raise ValueError("Nonfinite conditional cost prediction")
        for name, prediction in predictions.items():
            errors[name].append(abs(prediction - cost))
        holdout.append({"year": y, "observedCost": cost, "observedDeployment": deployed, "predictions": predictions})
    mae = {k: sum(v) / 6 for k, v in errors.items()}
    return {**result, "status": "conditional-diagnostic-fit", "maeSourceCostUnits": mae,
            "beatsBothBaselines": mae["costDeployment"] < min(mae["persistence"], mae["calendarTrend"]),
            "holdout": holdout}


def main():
    root = Path("generated-artifacts/driver-calibration")
    results = []
    for technology, source in SOURCES.items():
        raw = root / (source["slug"] + ".csv")
        if hashlib.sha256(raw.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError("Frozen source changed")
        metadata_file = raw.with_suffix(".metadata.json")
        metadata = json.loads(metadata_file.read_text())
        for kind in ("cost", "deployment"):
            if metadata["columns"][source[kind + "Metadata"]]["unit"] != source[kind + "Unit"]:
                raise ValueError("Unexpected source unit")
        with raw.open() as stream:
            rows = [(int(r["Year"]), float(r[source["cost"]]) if r[source["cost"]] else None,
                     float(r[source["deployment"]]) if r[source["deployment"]] else None)
                    for r in csv.DictReader(stream) if r["Entity"] == "World"]
        results.append({"technology": technology, "source": source,
                        "metadataSha256": hashlib.sha256(metadata_file.read_bytes()).hexdigest(),
                        **evaluate(rows)})
    report = {"protocolSha256": hashlib.sha256(Path("docs/Cost_Deployment_Protocol.md").read_bytes()).hexdigest(),
              "historyBasis": "revised-history", "productionEligible": False, "results": results}
    text = json.dumps(report, indent=2) + "\n"
    output = root / ("cost-deployment-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if output.exists():
        if output.read_text() != text:
            raise ValueError("Existing evidence differs")
    else:
        with output.open("x") as stream:
            stream.write(text)
    print(json.dumps({**report, "file": str(output)}, indent=2))


if __name__ == "__main__":
    main()

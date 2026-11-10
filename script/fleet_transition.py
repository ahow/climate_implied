"""Frozen stock-share study; no completed sales model is refitted."""
import csv
import hashlib
import json
import math
import random
from pathlib import Path

ENTITIES = ["World", "China", "India", "United States", "European Union (27)", "Rest of World"]
TRAIN, HOLDOUT = list(range(2010, 2019)), list(range(2019, 2025))
PINS = {
    "generated-artifacts/fleet-transition/stocks.csv": "c46953da750b099ac0c9abb9af898dff29a6d15cb6b2b74af70803c18b4728fb",
    "generated-artifacts/fleet-transition/stocks.metadata.json": "c52f9e552e45699ef0cd71fee2c760c09c6f310f0419563e0b0e852f760cfdf8",
    "generated-artifacts/driver-calibration/ev-sales-share.csv": "45969bb5f9a809c45792d8986f53023754d0fa141e74c7e24ad9af6ad041059b",
}

def quantile(values, p):
    values = sorted(values)
    position = (len(values)-1)*p
    low, high = math.floor(position), math.ceil(position)
    return values[low]+(values[high]-values[low])*(position-low)

def fit(x, y):
    denominator = sum(v*v for v in x)
    if denominator <= 0:
        raise ValueError("Unidentified transition coefficient")
    return max(0, min(1, sum(a*b for a,b in zip(x,y))/denominator))

def forecast(initial, sales, tau):
    values = []
    for _ in HOLDOUT:
        initial += tau*(sales-initial)
        values.append(initial)
    return values

def evaluate(stock, sales):
    missing = {"stock": [y for y in TRAIN+HOLDOUT if y not in stock],
               "sales": [y for y in TRAIN if y not in sales]}
    if any(missing.values()):
        return {"status": "unavailable", "missing": missing}
    if any(not math.isfinite(v) or not 0 <= v <= 1 for v in
           [stock[y] for y in TRAIN+HOLDOUT]+[sales[y] for y in TRAIN]):
        return {"status": "unavailable", "reason": "Invalid share"}
    x = [sales[y-1]-stock[y-1] for y in TRAIN[1:]]
    y = [stock[t]-stock[t-1] for t in TRAIN[1:]]
    try:
        tau = fit(x,y)
    except ValueError as error:
        return {"status":"unavailable","reason":str(error)}
    predictions = forecast(stock[2018],sales[2018],tau)
    mean = sum(stock[t] for t in TRAIN)/len(TRAIN)
    slope = sum((t-2014)*(stock[t]-mean) for t in TRAIN)/sum((t-2014)**2 for t in TRAIN)
    baselines = {"persistence":[stock[2018]]*6,
                 "linear":[max(0,min(1,mean+slope*(t-2014))) for t in HOLDOUT]}
    actual = [stock[t] for t in HOLDOUT]
    mae = lambda values: 100*sum(abs(a-b) for a,b in zip(actual,values))/6
    errors = {"transition":mae(predictions),**{k:mae(v) for k,v in baselines.items()}}
    residual = [b-tau*a for a,b in zip(x,y)]
    rng = random.Random(20261109)
    coefficients, paths = [], []
    for _ in range(1000):
        indices = []
        while len(indices) < len(x):
            start = rng.randrange(len(x))
            indices.extend((start+k)%len(x) for k in range(3))
        coefficient = fit(x,[tau*a+residual[j] for a,j in zip(x,indices)])
        coefficients.append(coefficient)
        paths.append(forecast(stock[2018],sales[2018],coefficient))
    intervals = [[quantile([p[i] for p in paths],q) for q in [.025,.5,.975]] for i in range(6)]
    stability = {}
    for name,indices in [("early",range(4)),("late",range(4,8))]:
        try:
            stability[name]=fit([x[i] for i in indices],[y[i] for i in indices])
        except ValueError:
            stability[name]=None
    return {"status":"candidate-requires-independent-validation" if all(errors["transition"]<errors[k] for k in baselines) else "sensitivity-only",
            "tau":tau,"tauQuantiles":[quantile(coefficients,q) for q in [.025,.5,.975]],
            "forecast":predictions,"maePercentagePoints":errors,"parameterIntervals":intervals,
            "parameterIntervalCoverage":sum(lo<=a<=hi for a,(lo,_,hi) in zip(actual,intervals))/6,
            "trainingStability":stability,"productionEligible":False}

def load(path):
    values = {entity:{} for entity in ENTITIES}
    with Path(path).open() as stream:
        reader = csv.DictReader(stream)
        columns = [c for c in reader.fieldnames if c not in ["Entity","Code","Year"]]
        if len(columns)!=1:
            raise ValueError("Unexpected source columns")
        for row in reader:
            if row["Entity"] in values and row[columns[0]]!="":
                year = int(row["Year"])
                target=values[row["Entity"]]
                if year in target:
                    raise ValueError("Duplicate source year")
                target[year]=float(row[columns[0]])/100
    return values

def main():
    for path,digest in PINS.items():
        if hashlib.sha256(Path(path).read_bytes()).hexdigest()!=digest:
            raise ValueError(f"Frozen source mismatch: {path}")
    metadata=json.loads(Path("generated-artifacts/fleet-transition/stocks.metadata.json").read_text())
    if metadata["columns"]["Share of car stocks that are electric"]["unit"]!="%":
        raise ValueError("Unexpected stock unit")
    stocks=load("generated-artifacts/fleet-transition/stocks.csv")
    sales=load("generated-artifacts/driver-calibration/ev-sales-share.csv")
    report={"sourceHashes":PINS,"protocolSha256":hashlib.sha256(Path("docs/Fleet_Transition_Protocol.md").read_bytes()).hexdigest(),
            "implementationSha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            "status":"revised-history diagnostic; no promotion",
            "vintage":"Original publication dates unknown; stock chart2026/column2025 attribution conflict unresolved",
            "uncertainty":"Training-parameter intervals only, not predictive uncertainty",
            "results":[{"entity":e,**evaluate(stocks[e],sales[e])} for e in ENTITIES]}
    Path("docs/fleet_transition_results.json").write_text(json.dumps(report,indent=2)+"\n")
    for r in report["results"]:
        print(r["entity"],r["status"],r.get("maePercentagePoints",r.get("missing")))

if __name__=="__main__":
    main()

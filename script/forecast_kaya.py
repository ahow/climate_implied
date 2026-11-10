"""Frozen real-series forecast diagnostic; no production model changes."""
import csv
import hashlib
import json
import math
from pathlib import Path
import random

from kaya_decomposition import ROOT, HASHES, ENTITIES, FIELDS, FACTORS, factors
from driver_calibration import fit
from electricity_demand_calibration import quantile
from demand_predictive_validation import residuals, break_statistic, blocks, holm

TARGETS = (*FACTORS, "co2")
PROTOCOL = Path("docs/Forecast_Kaya_Protocol.md")
PROTOCOL_HASH = "ab7da56d04fad92c6dab27b3c0f77cfe427518eab87014019105967a12d0a31f"


def prepare(rows):
    by_year = {}
    for r in rows:
        y = r["year"]
        if type(y) is not int or y in by_year:
            raise ValueError("Unique integer years required")
        for k in FIELDS:
            v = r.get(k)
            if v is not None and (type(v) not in (float, int) or
                                  not math.isfinite(v) or v <= 0):
                raise ValueError("Positive finite source values required")
        by_year[y] = r
    missing = [{"year": y, "fields": [k for k in FIELDS
                if by_year.get(y, {}).get(k) is None]} for y in range(2010, 2025)]
    missing = [r for r in missing if r["fields"]]
    if missing:
        return None, missing
    data = {k: [] for k in TARGETS}
    for y in range(2010, 2025):
        row = {**factors(by_year[y]), "co2": by_year[y]["co2"]}
        for k in TARGETS:
            data[k].append(row[k])
    return data, []


def evaluate(rows):
    data, missing = prepare(rows)
    if missing:
        return {"status": "unavailable", "missing": missing, "centralEligible": False}
    logs = {k: [math.log(v) for v in data[k][:9]] for k in FACTORS}
    fitted = {k: residuals(logs[k]) for k in FACTORS}
    params = {k: list(fitted[k][:2]) for k in FACTORS}
    predictions = {k: [math.exp(params[k][0] + params[k][1] * x)
                       for x in range(9, 15)] for k in FACTORS}
    predictions["co2"] = [math.prod(predictions[k][j] for k in FACTORS) for j in range(6)]
    ca, cb = fit(list(enumerate(math.log(v) for v in data["co2"][:9])))
    identity = max(abs(predictions["co2"][j] / math.exp(ca + cb * (9 + j)) - 1)
                   for j in range(6))
    if identity > 1e-9:
        raise ValueError("Factor product fails log-CO2 identity")
    samples = {k: [[] for _ in range(6)] for k in TARGETS}
    nulls = {k: [] for k in FACTORS}
    draws = []
    rng = random.Random(20261110)
    for _ in range(1000):
        ti = blocks(rng, list(range(9)), 9)
        fi = blocks(rng, list(range(9)), 6)
        paths, draw = {}, {}
        for k in FACTORS:
            a, b, errors = fitted[k]
            mean = sum(errors) / 9
            errors = [e - mean for e in errors]
            simulated = [a + b * i + errors[t] for i, t in enumerate(ti)]
            da, db, _ = residuals(simulated)
            draw[k] = [da, db]
            nulls[k].append(break_statistic(simulated))
            paths[k] = [math.exp(da + db * (9 + j) + errors[t]) for j, t in enumerate(fi)]
        paths["co2"] = [math.prod(paths[k][j] for k in FACTORS) for j in range(6)]
        if any(not math.isfinite(v) or v <= 0 for path in paths.values() for v in path):
            raise ValueError("Invalid draw; study aborted without clipping")
        draws.append(draw)
        for k in TARGETS:
            for j, value in enumerate(paths[k]):
                samples[k][j].append(value)
    intervals = {k: [[quantile(s, .025), quantile(s, .975)] for s in samples[k]]
                 for k in TARGETS}
    scoring = {}
    for k in TARGETS:
        actual = data[k][9:]
        la, lb = fit(list(enumerate(data[k][:9])))
        methods = {"candidate": predictions[k], "persistence": [data[k][8]] * 6,
                   "linearTrend": [max(0, la + lb * x) for x in range(9, 15)]}
        errors = {m: [abs(a - p) for a, p in zip(actual, ps)] for m, ps in methods.items()}
        maes = {m: sum(es) / 6 for m, es in errors.items()}
        improvement = {}
        for m in ("persistence", "linearTrend"):
            paired = [e - c for e, c in zip(errors[m], errors["candidate"])]
            rng = random.Random(20261111)
            boot = [sum(blocks(rng, paired, 6)) / 6 for _ in range(2000)]
            improvement[m] = [quantile(boot, .025), quantile(boot, .975)]
        win = all(maes["candidate"] < maes[m] for m in improvement)
        coverage = sum(lo <= v <= hi for v, (lo, hi) in zip(actual, intervals[k]))
        scoring[k] = {
            "mae": maes, "normalizedMAE": {m: v / (sum(actual) / 6) for m, v in maes.items()},
            "baselineGate": win, "pairedImprovement95": improvement,
            "robustGate": win and all(v[0] > 0 for v in improvement.values()),
            "disposition": "sensitivity-only" if win else "reject-forecast-candidate",
            "coveredYears": coverage,
            "meanWidth": sum(hi - lo for lo, hi in intervals[k]) / 6,
            "meanIntervalScore": sum(hi - lo + 40 * (max(lo - v, 0) + max(v - hi, 0))
                                    for v, (lo, hi) in zip(actual, intervals[k])) / 6}
    breaks = {k: {"statistic": break_statistic(logs[k]),
                  "p": (1 + sum(s >= break_statistic(logs[k]) for s in nulls[k])) / 1001}
              for k in FACTORS}
    return {"status": "diagnostic", "centralEligible": False, "parameters": params,
            "parameterDraws": draws, "predictions": predictions, "intervals": intervals,
            "scores": scoring, "breaks": breaks, "identityRelativeError": identity,
            "rejectedDraws": 0}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    if digest(PROTOCOL) != PROTOCOL_HASH:
        raise ValueError("Frozen protocol changed")
    for name, sha in HASHES.items():
        if digest(ROOT / name) != sha:
            raise ValueError(f"Frozen source changed: {name}")
    data = {e: [] for e in ENTITIES}
    with (ROOT / "kaya-co2.csv").open() as stream:
        for row in csv.DictReader(stream):
            if row["country"] in data and 2010 <= int(row["year"]) <= 2024:
                data[row["country"]].append({"year": int(row["year"]), **{
                    k: float(row[k]) if row[k] else None for k in FIELDS}})
    results = [{"entity": e, **evaluate(rows)} for e, rows in data.items()]
    tests = [(r, k) for r in results for k in FACTORS]
    adjusted = holm([r.get("breaks", {}).get(k, {}).get("p", 1) for r, k in tests])
    for (r, k), p in zip(tests, adjusted):
        if "breaks" in r:
            r["breaks"][k].update(holmP=p, detected=p <= .05)
    report = {"study": "forecast-kaya", "sourceHashes": HASHES,
              "sourceRevision": "382ee6c662b0ece26e111f263b44c029afad7787",
              "protocolSha256": PROTOCOL_HASH, "codeSha256": digest(__file__),
              "historyBasis": "revised-history", "informationAvailableAt": None,
              "centralEligible": False, "results": results}
    text = json.dumps(report, indent=2, allow_nan=False) + "\n"
    target = ROOT / ("forecast-kaya-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if target.exists():
        if target.read_text() != text:
            raise ValueError("Immutable evidence changed")
    else:
        with target.open("x") as stream:
            stream.write(text)
    print(json.dumps({"evidence": str(target), "results": [
        {k: v for k, v in r.items() if k not in (
            "parameters", "parameterDraws", "predictions", "intervals")} for r in results]}, indent=2))


if __name__ == "__main__":
    main()

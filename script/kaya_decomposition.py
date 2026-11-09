"""Historical LMDI accounting, not causal attribution or a forecast."""
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path("generated-artifacts/driver-calibration")
HASHES = {
    "kaya-co2.csv": "7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6",
    "kaya-codebook.csv": "33b4f5e00efd58c7b83863f736beba1af4df946b43642b0400c3ec38648e0e8e"}
FIELDS = ("population", "gdp", "primary_energy_consumption", "co2")
FACTORS = ("population", "incomePerPerson", "energyIntensity", "carbonIntensity")
ENTITIES = ("World", "China", "India", "United States", "European Union (27)",
            "Rest of World", "International transport")


def factors(row):
    values = [row.get(k) for k in FIELDS]
    if any(type(v) not in (float, int) or not math.isfinite(v) or v <= 0 for v in values):
        raise ValueError("Positive finite population, GDP, energy and CO2 required")
    p, g, e, c = values
    return dict(zip(FACTORS, (p, g / p, e / g, c / e)))


def decompose(start, end):
    a, b = factors(start), factors(end)
    c0, c1 = start["co2"], end["co2"]
    # Stable logarithmic mean, including equal-emissions offsetting drivers.
    relative = (c1 - c0) / c0
    weight = c0 if c1 == c0 else (c1 - c0) / math.log1p(relative)
    contributions = {k: weight * (math.log(b[k]) - math.log(a[k])) for k in FACTORS}
    delta = c1 - c0
    residual = math.fsum(contributions.values()) - delta
    if abs(residual) > 1e-9 * max(1, abs(c0), abs(c1)):
        raise ValueError("LMDI reconciliation failed")
    return {"changeMtCO2": delta, "contributionsMtCO2": contributions,
            "reconciliationResidualMt": residual}


def evaluate(rows, first=2010, last=2024):
    if type(first) is not int or type(last) is not int or first >= last:
        raise ValueError("Ordered integer window required")
    by_year = {}
    for row in rows:
        year = row["year"]
        if type(year) is not int or year in by_year:
            raise ValueError("Unique integer years required")
        by_year[year] = row
    gaps = [{"year": y, "fields": [k for k in FIELDS if by_year.get(y, {}).get(k) is None]}
            for y in range(first, last + 1)]
    gaps = [g for g in gaps if g["fields"]]
    if gaps:
        return {"status": "unavailable", "missing": gaps, "productionEligible": False}
    annual = [{"year": y, **decompose(by_year[y - 1], by_year[y])}
              for y in range(first + 1, last + 1)]
    chain = {k: math.fsum(r["contributionsMtCO2"][k] for r in annual) for k in FACTORS}
    return {"status": "historical-accounting", "annual": annual,
            "endpoint": decompose(by_year[first], by_year[last]),
            "chainContributionsMtCO2": chain,
            "productionEligible": False}


def main():
    for filename, digest in HASHES.items():
        if hashlib.sha256((ROOT / filename).read_bytes()).hexdigest() != digest:
            raise ValueError(f"Frozen source changed: {filename}")
    data = {entity: [] for entity in ENTITIES}
    with (ROOT / "kaya-co2.csv").open() as stream:
        for row in csv.DictReader(stream):
            if row["country"] in data:
                data[row["country"]].append({"year": int(row["year"]),
                    **{k: float(row[k]) if row[k] else None for k in FIELDS}})
    report = {"sourceRevision": "382ee6c662b0ece26e111f263b44c029afad7787",
              "sourceHashes": HASHES, "historyBasis": "revised-history",
              "protocolSha256": hashlib.sha256(Path("docs/Kaya_Protocol.md").read_bytes()).hexdigest(),
              "productionEligible": False, "results": [
                  {"entity": entity, "start": first, "end": last, **evaluate(rows, first, last)}
                  for entity, rows in data.items() for first, last in ((2010, 2018), (2019, 2024))]}
    text = json.dumps(report, indent=2) + "\n"
    target = ROOT / ("kaya-" + hashlib.sha256(text.encode()).hexdigest() + ".json")
    if not target.exists():
        with target.open("x") as stream:
            stream.write(text)
    elif target.read_text() != text:
        raise ValueError("Immutable evidence differs")
    print(json.dumps({"file": str(target), "results": [
        {k: v for k, v in row.items() if k not in ("annual", "missing")} |
        ({"missing": row["missing"]} if row["status"] == "unavailable" else {})
        for row in report["results"]]}, indent=2))


if __name__ == "__main__":
    main()

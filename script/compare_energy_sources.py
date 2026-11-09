"""Prespecified source-revision assessment; no legacy overwrite or promotion."""
import csv
import hashlib
import json
from pathlib import Path
import urllib.request
from driver_calibration import ENTITIES, evaluate as adoption
from electricity_demand_calibration import evaluate as demand

ROOT = Path("generated-artifacts/driver-calibration")
BASE = "https://catalog.ourworldindata.org/energy/owid_energy/"
FIELDS = {"electricity_demand": "electricity_demand_twh",
          "solar_share_elec": "solar_electricity_share_pct",
          "wind_share_elec": "wind_electricity_share_pct"}


def download(name):
    path = ROOT / ("catalog-" + name)
    if not path.exists():
        with urllib.request.urlopen(BASE + name, timeout=90) as response:
            data = response.read(60_000_001)
        if len(data) > 60_000_000:
            raise ValueError("Download exceeds limit")
        path.write_bytes(data)
    return path


def observations(path, fields):
    result = {(entity, target): {} for entity in ENTITIES for target in fields}
    with path.open() as f:
        for row in csv.DictReader(f):
            if row["country"] not in ENTITIES or not 2010 <= int(row["year"]) <= 2024:
                continue
            for target, field in fields.items():
                value = row[field]
                points = result[row["country"], target]
                year = int(row["year"])
                if year in points:
                    raise ValueError("Duplicate entity/year")
                points[year] = float(value) if value else None
    return result


def main():
    current = download("owid_energy.csv")
    mapping = download("column_mapping.csv")
    download("owid_energy.codebook.csv")
    download("owid_energy.sources.csv")
    with mapping.open() as f:
        mapped = {r["previous_column"]: r["column"] for r in csv.DictReader(f)}
    if any(mapped.get(k) != v for k, v in FIELDS.items()):
        raise ValueError("Publisher column mapping changed")
    old = ROOT / "owid-energy-data.csv"
    old_hash = hashlib.sha256(old.read_bytes()).hexdigest()
    if old_hash != json.loads((ROOT / "result.json").read_text())["sourceSha256"]:
        raise ValueError("Frozen legacy source changed")
    legacy = observations(old, {k: k for k in FIELDS})
    updated = observations(current, FIELDS)
    results = []
    for (entity, target), prior in legacy.items():
        new = updated[entity, target]
        paired = [y for y in range(2010, 2025) if prior.get(y) is not None and new.get(y) is not None]
        rows = sorted(new.items())
        fit = demand(rows) if target == "electricity_demand" else adoption(
            [(y, v / 100) for y, v in rows if v is not None])
        results.append({"entity": entity, "target": target,
                        "unit": "TWh" if target == "electricity_demand" else "percentage points",
                        "pairedObservations": len(paired),
                        "missingPairedYears": [y for y in range(2010, 2025) if y not in paired],
                        "maxAbsoluteRevision": max((abs(new[y] - prior[y]) for y in paired), default=None),
                        "replacementFit": fit})
    report = {"legacySha256": old_hash, "replacementSha256": hashlib.sha256(current.read_bytes()).hexdigest(),
              "protocolSha256": hashlib.sha256(Path("docs/Energy_Source_Compatibility_Protocol.md").read_bytes()).hexdigest(),
              "sourceMetadataHashes": {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in ROOT.glob("catalog-*.csv")},
              "results": results, "centralModelEligible": False,
              "claim": "source revision assessment and locked revised-history evaluation; not forecast validation"}
    (ROOT / "source-compatibility.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({**report, "results": [{**r, "replacementFit":
        {k: v for k, v in r["replacementFit"].items() if k not in ("draws", "holdout")}} for r in results]}, indent=2))


if __name__ == "__main__":
    main()

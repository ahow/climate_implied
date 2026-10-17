"""Read-only compatibility audit of the pinned NGFS 5.1 archive.

Usage: python script/assess-ngfs.py path/to/V5.1_NGFS_Phase_5.zip
Outputs go under ignored generated-artifacts/ngfs, never into application data.
No third-party Python dependencies; no network, credentials or automatic imports.
"""
import csv
import hashlib
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET
import zipfile

EXPECTED_SHA256 = "acae7160abbd34d10b4eda5226a1fc3ebb5591205203a82c48ab9b5d5ad7c31b"
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
SCENARIOS = {"Current Policies", "Nationally Determined Contributions (NDCs)"}

def interpolate(row, year):
    points = sorted((int(k), float(v)) for k, v in row.items()
                    if k.isdigit() and v not in (None, ""))
    if any(not math.isfinite(v) for _, v in points):
        raise ValueError("Nonfinite published value; not an interpolation gap")
    if not points or year < points[0][0] or year > points[-1][0]:
        raise ValueError("Interpolation cannot extrapolate beyond the published horizon")
    for (a, x), (b, y) in zip(points, points[1:]):
        if a <= year <= b:
            return x + (y - x) * (year - a) / (b - a)
    return points[0][1]


def audit(path):
    with open(path, "rb") as handle:
        digest = hashlib.file_digest(handle, "sha256").hexdigest()
    if digest != EXPECTED_SHA256:
        raise ValueError("Archive checksum mismatch; assess the new release before changing the pin")
    out = Path("generated-artifacts/ngfs")
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(path) as archive:
        workbook = out / "IAM_data.xlsx"
        # Stream extraction, rather than loading the large workbook in memory.
        import shutil
        with archive.open("V5.1 NGFS Phase 5/IAM_data.xlsx") as source, workbook.open("wb") as dest:
            shutil.copyfileobj(source, dest)
    rows = []
    models, scenarios, years = set(), set(), []
    with zipfile.ZipFile(workbook) as archive:
        strings = ["".join(node.itertext()) for node in ET.fromstring(archive.read("xl/sharedStrings.xml"))]
        with archive.open("xl/worksheets/sheet1.xml") as source:
            parser = ET.iterparse(source, events=("start", "end"))
            _, root = next(parser)
            header = None
            for event, element in parser:
                if event != "end" or element.tag != NS + "row":
                    continue
                values = {}
                for cell in element:
                    col = "".join(c for c in cell.attrib["r"] if c.isalpha())
                    raw = cell.findtext(NS + "v")
                    values[col] = strings[int(raw)] if cell.attrib.get("t") == "s" else raw
                if header is None:
                    header = values
                    if list(header.values())[:5] != ["Model", "Scenario", "Region", "Variable", "Unit"]:
                        raise ValueError("Unexpected IAM workbook schema")
                    years = [int(v) for v in header.values() if str(v).isdigit()]
                else:
                    models.add(values.get("A"))
                    scenarios.add(values.get("B"))
                    if (values.get("C") == "World" and values.get("B") in SCENARIOS
                            and "IntegratedPhysicalDamages" not in values.get("A", "")):
                        rows.append({header[k]: v for k, v in values.items()})
                element.clear()
                root.clear()
    if not rows or not SCENARIOS.issubset(scenarios):
        raise ValueError("Required World scenarios missing")
    with (out / "world-selected.csv").open("w") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(header.values()))
        writer.writeheader()
        writer.writerows(rows)
    results = {}
    inventory = json.loads(Path("server/calculation/data/inventory2024.json").read_text())
    observed = {}
    for cell in inventory["cells"]:
        key = "CO2|AFOLU" if cell["sector"] == "LULUCF" else (
            "CO2|Energy and Industrial Processes" if cell["gas"] == "CO2" else cell["gas"])
        observed[key] = observed.get(key, 0) + cell["nativeMt"]
    for model in sorted({r["Model"] for r in rows}):
        selected = [r for r in rows if r["Model"] == model]
        emissions = sorted({(r["Variable"], r["Unit"]) for r in selected if r["Variable"].startswith("Emissions|")})
        baseline = {}
        for gas, unit, scale in [
            ("CO2|Energy and Industrial Processes", "Mt CO2/yr", 1),
            ("CO2|AFOLU", "Mt CO2/yr", 1), ("CH4", "Mt CH4/yr", 1),
            ("N2O", "kt N2O/yr", .001),
        ]:
            row, = [r for r in selected if r["Scenario"] == "Current Policies" and r["Variable"] == "Emissions|" + gas]
            if row["Unit"] != unit:
                raise ValueError("Unexpected native gas unit")
            value = interpolate(row, 2024) * scale
            baseline[gas] = {"interpolated2024NativeMt": value, "inventory2024NativeMt": observed[gas],
                             "differencePct": (value / observed[gas] - 1) * 100}
        identity_error = 0
        for scenario in SCENARIOS:
            lookup = {r["Variable"]: r for r in selected if r["Scenario"] == scenario}
            for year in range(2024, 2101):
                error = abs(interpolate(lookup["Emissions|CO2"], year) -
                            interpolate(lookup["Emissions|CO2|AFOLU"], year) -
                            interpolate(lookup["Emissions|CO2|Energy and Industrial Processes"], year))
                identity_error = max(identity_error, error)
        infilled = sorted({r["Variable"].split("|Infilled|Emissions|")[1] for r in selected
                           if "|Infilled|Emissions|" in r["Variable"]})
        results[model] = {
            "rows": len(selected),
            "scenarios": sorted({r["Scenario"] for r in selected}),
            "emissionsVariables": [{"variable": v, "unit": u} for v, u in emissions],
            "infilledSpecies": infilled,
            "baselineComparison": baseline,
            "maxAnnualCO2ReconciliationErrorMt": identity_error,
            "coreCO2PublishedYears": [y for y in years if next(
                r for r in selected if r["Variable"] == "Emissions|CO2" and r["Scenario"] == "Current Policies").get(str(y)) not in (None, "")],
            "missingOrNonfiniteEmissionsCells": sum(
                1 for r in selected if r["Variable"].startswith("Emissions|")
                for y in years if r.get(str(y)) in (None, "") or
                not math.isfinite(float(r[str(y)]))
            ),
        }
    report = {"release": "5.1", "doi": "10.5281/zenodo.17901363", "sha256": digest,
              "years": years, "modelsInArchive": sorted(models),
              "scenariosInArchive": sorted(scenarios), "selectedWorldRows": len(rows), "results": results}
    (out / "assessment.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "results"}, indent=2))
    for model, result in results.items():
        print(model, result["rows"], "rows;", len(result["emissionsVariables"]), "emissions variables;",
              result["missingOrNonfiniteEmissionsCells"], "missing emissions cells")


if __name__ == "__main__":
    audit(sys.argv[1])

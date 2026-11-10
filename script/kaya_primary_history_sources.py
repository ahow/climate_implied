"""Follow discovered primary links; inventory annual independent history, not score it."""
import csv
import io
import json
import math

from kaya_source_assembly import retrieve, save_bytes

IGCC = "852f4f7b0733fa4d573c145cdfaf556da5589231"
BASE = f"https://raw.githubusercontent.com/ClimateIndicator/forcing-timeseries/{IGCC}/"
SOURCES = {
    "maddisonWorkbook": "https://dataverse.nl/api/access/datafile/421302",
    "maddisonStata": "https://dataverse.nl/api/access/datafile/421303",
    "maddisonDatasetMetadata": "https://dataverse.nl/api/datasets/:persistentId/?persistentId=doi:10.34894/INZBF2",
    "fairCalibrationRepository": "https://api.github.com/repos/OMS-NetZero/fair-calibrate",
    "igccReadme": BASE + "README.md",
    "igccLicence": BASE + "LICENSE",
    "igccAnnualForcing": BASE + "output/ERF_best_1750-2024.csv",
    "igccAnnualGMST": BASE + "data/gmst/IGCC_GMST_1850-2024.csv",
}


def annual_inventory(text, first, last, offset=0):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        raise ValueError("Empty annual history")
    header = rows.pop(0)
    years = [float(row[0]) for row in rows]
    if years != [year + offset for year in range(first, last + 1)]:
        raise ValueError("Annual history gaps, duplicates or unexpected range")
    if any(len(row) != len(header) for row in rows):
        raise ValueError("Ragged annual history")
    if any(not math.isfinite(float(v)) for row in rows for v in row[1:]):
        raise ValueError("Nonfinite annual history")
    return {"firstYear": first, "lastYear": last, "annualRows": len(rows),
            "timeCoordinateOffset": offset,
            "columns": header, "finite": True, "completeAnnual": True,
            "independentFaIRNumericalReference": False, "centralEligible": False}


def main():
    from pathlib import Path
    sources = [retrieve(n, u, "Primary-source follow-up; current revision, no numerical comparison or promotion.")
               for n, u in SOURCES.items()]
    annual = {}
    for source in sources:
        name = source["name"]
        if source["status"] != 200:
            continue
        if name in ("igccAnnualForcing", "igccAnnualGMST"):
            try:
                annual[name] = annual_inventory(Path(source["retainedPath"]).read_text(),
                    1750 if name == "igccAnnualForcing" else 1850, 2024,
                    0 if name == "igccAnnualForcing" else .5)
            except ValueError as error:
                annual[name] = {"status": "invalid-or-incompatible", "error": str(error)}
        if name == "fairCalibrationRepository":
            metadata = json.loads(Path(source["retainedPath"]).read_text())
            branch = metadata["default_branch"]
            sources.append(retrieve("fairCalibrationResolvedTree",
                f"https://api.github.com/repos/OMS-NetZero/fair-calibrate/git/trees/{branch}?recursive=1",
                "Resolve default branch after main returned 404; inspect independently published annual outputs."))
    report = {"study": "primary-gdp-and-independent-annual-history-investigation",
              "igccRevision": IGCC, "historyBasis": "current-revision",
              "informationAvailableAt": None, "centralEligible": False,
              "sources": sources, "annualInventories": annual,
              "limitation": "Historical forcing/GMST are independent physical histories, not matched FaIR SSP/member temperature trajectories. No endpoint interpolation, self-comparison, annual tolerance pass or calibration validation."}
    body = (json.dumps(report, indent=2, allow_nan=False) + "\n").encode()
    print(save_bytes(body, ".json"))
    print(json.dumps(annual, indent=2))


if __name__ == "__main__":
    main()

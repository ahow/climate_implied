"""Original primary GDP sidecar and dated high-frequency activity-source bridge.

No old forecast study is rerun. No population, currency base, CO2 scope or
frequency is silently substituted to manufacture a complete emissions model.
"""
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
import math
from pathlib import Path
import posixpath
import re
import xml.etree.ElementTree as ET
import zipfile


ROOT = Path("generated-artifacts/kaya-highfrequency-source")
PRIMARY = Path("generated-artifacts/kaya-source-investigation")
MPD_SHA = "ecc5916ca12789b983fc4be437f8a354bbf4291323605324ac3e0aea4c57cbb6"
META_SHA = "85c46881789c8ad3a89dd4478ac7c7888f50580e9c4e6f290f93e6672a1e3669"
EU27 = tuple("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE".split())
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
RELEASE_PINS = {
    2024: ("047e0f0ef3017fb65f759b43453f883cca4fc5d720b00ef2e9ebb28c4602aba6",
           "97b98debc06c7776b0d270cc884e4b40353ce6df8ecdb18719ff097df2547682",
           "b0288152dd96f0c9216ba8ebd1ec14df8973e2ed9f7997bb3e363365ad547635"),
    2025: ("d3ddadc36458ca5bdbe282ca0f92dc31e3ed499817d951a1e341051511b41dde",
           "ab303ab7f8ce55c77d3c778c028bc4abef56968bfca4bafbbe72c6490fa37e4d",
           "3585cb1870d6f6a132786040b2b5216c90bee26085af6ad73d5d326a08f82823"),
    2026: ("48e2b40ceba0fe92b01b955fb6fc34d65aecb670e7260f275f2f5382155f0c42",
           "7c3fdf64ab82af957f911d308dedab3f7c63f4a1d057697a19a48394f911572d",
           "1508570e74c7df48bae552217d9a3474c4b5a7dd3a90fa57c2ec47e5ed73528b"),
}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def xlsx_rows(body, sheet_name):
    """Read native OOXML cells only; never execute a workbook or fill formulas."""
    z = zipfile.ZipFile(io.BytesIO(body))
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        shared = ["".join(si.itertext()) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    workbook = ET.fromstring(z.read("xl/workbook.xml"))
    sheet = next(s for s in workbook.find("s:sheets", NS) if s.attrib["name"] == sheet_name)
    rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
    relationships = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    target = next(r.attrib["Target"] for r in relationships if r.attrib["Id"] == rid)
    path = target.lstrip("/") if target.startswith("/") else posixpath.normpath("xl/"+target)
    with z.open(path) as stream:
        for _, row in ET.iterparse(stream, events=("end",)):
            if row.tag != "{"+NS["s"]+"}row":
                continue
            result = {}
            for cell in row.findall("s:c", NS):
                if cell.find("s:f", NS) is not None:
                    raise ValueError("Source formulas require separately verified cached values; not evaluated")
                address = re.match(r"([A-Z]+)", cell.attrib["r"]).group(1)
                value = cell.find("s:v", NS)
                kind = cell.attrib.get("t")
                if kind == "inlineStr":
                    parsed = "".join(cell.find("s:is", NS).itertext())
                elif value is None:
                    parsed = None
                elif kind == "s":
                    parsed = shared[int(value.text)]
                else:
                    parsed = float(value.text)
                result[address] = parsed
            yield int(row.attrib["r"]), result
            row.clear()


def assemble_eu27(rows):
    """GDP uses the primary source's OWN population, in thousands."""
    if len(EU27) != 27 or len(set(EU27)) != 27:
        raise ValueError("Exact fixed EU27 membership required")
    indexed = {}
    for row in rows:
        member, year = row["countrycode"], row["year"]
        if member not in EU27 or not 2010 <= year <= 2024:
            continue
        if year != int(year) or (member, year) in indexed:
            raise ValueError("Unique exact member-year identities required")
        for field in ("gdppc", "pop"):
            value = row[field]
            if value is not None and (not math.isfinite(value) or value <= 0):
                raise ValueError("Positive finite supplied primary GDP/population required")
        indexed[member, int(year)] = row
    cells, annual, missing = [], [], []
    for year in range(2010, 2025):
        products = []
        for member in EU27:
            row = indexed.get((member, year), {})
            absent = [field for field in ("gdppc", "pop") if row.get(field) is None]
            value = None if absent else row["gdppc"]*row["pop"]*1000
            cells.append({"member": member, "year": year, "sourceRow": row.get("sourceRow"),
                          "gdppc2011PPP": row.get("gdppc"), "populationThousands": row.get("pop"),
                          "GDP2011InternationalDollars": value, "missingInputs": absent})
            if absent:
                missing.append({"member": member, "year": year, "missingInputs": absent})
            else:
                products.append(value)
        annual.append({"year": year, "membersObserved": len(products),
                       "GDP2011InternationalDollars": math.fsum(products) if len(products) == 27 else None})
    return {"nativeMemberYearCells": cells, "annual": annual, "missingMemberYears": missing,
            "completeFrozenWindow": not missing, "fitExecuted": False,
            "frozenOWIDSourceChanged": False, "centralEligible": False}


def extract_issue_cells(text, year):
    """Exact published narrative numbers, not digitized or backsolved charts."""
    start, end = text.index("Section 5: Electricity"), text.index("Section 6: Renewables")
    section = text[start:end]
    rules = {
        2024: {
            "total_generation": r"saw total electricity generation of\s+([\d.]+)\s+TWh",
            "renewable_generation": r"Renewable electricity generation represented.{0,180}?at\s+([\d.]+)\s+TWh",
            "nuclear_generation": r"Nuclear generation decreased to\s+([\d.]+)\s+TWh",
            "fossil_generation": r"Fossil fuels generated\s+([\d.]+)\s+TWh",
            "gas_generation": r"Gas remained.{0,100}?at\s+([\d.]+)\s+TWh",
            "wind_generation": r"wind generation rose 3\.0 per cent to\s+([\d.]+)\s+TWh",
        },
        2025: {
            "total_generation": r"generation rise by 1\.7 per cent to\s+([\d.]+)\s+TWh",
            "renewable_generation": r"Renewable\s+generation fell by 8\.1 per cent to\s+([\d.]+)\s+TWh",
            "nuclear_generation": r"nuclear generation rose by 15\s+per cent to\s+([\d.]+)\s+TWh",
            "fossil_generation": r"fuels rose by 12 per cent to\s+([\d.]+)\s+TWh",
            "gas_generation": r"comes from gas, which rose by 18 per\s+cent to\s+([\d.]+)\s+TWh",
            "wind_generation": r"Wind generation fell by 13 per cent\s+to\s+([\d.]+)\s+TWh",
        },
        2026: {
            "total_generation": r"generation rise by 1\.3 per cent to\s+([\d.]+)\s+TWh",
            "renewable_generation": r"Total renewable generation increased by 18 per cent\s+to\s+([\d.]+)\s+TWh",
            "nuclear_generation": r"fall in nuclear generation\s+to\s+([\d.]+)\s+TWh",
            "fossil_generation": r"Fossil fuel generation fell 16 per cent to\s+([\d.]+)\s+TWh",
            "gas_generation": r"comes from gas, which fell by 16 per cent to\s+([\d.]+)\s+TWh",
            "wind_generation": r"wind generation up 30 per cent to a quarterly record of\s+([\d.]+)\s+TWh",
        },
    }[year]
    cells = {}
    for name, pattern in rules.items():
        matches = list(re.finditer(pattern, section, flags=re.I | re.S))
        values = {float(m.group(1)) for m in matches}
        if len(values) != 1:
            raise ValueError(f"Unique exact published source value required: {year}/{name}")
        match = matches[0]
        cells[name] = {"value": values.pop(), "unit": "TWh", "period": f"{year}-Q1",
                       "sourcePage": text[:start+match.start()].count("\f")+1,
                       "sourcePrintedNumber": match.group(1),
                       "sourcePrecision": "published rounded narrative, not exact underlying table",
                       "status": "provisional; source says latest periods liable to subsequent revision"}
    return cells


def main():
    protocol_pins = {
        "docs/kaya-highfrequency-source-protocol.json": "d67c812a4b914b8fec77e7986ac792314ef65f42ab490a71b6539ce012a5a692",
        "docs/kaya-highfrequency-independent-fallback.json": "c03fcd69f3fbf4361a14fd0613b44234f03bdb92340370e322691769bc0b5bff",
        "docs/highfrequency-author-identity-correction.json": "da554d5a2ff1e484f7154d7a77f697f955df8e51295731a7646fc5da1e80babc",
        "docs/highfrequency-original-release-freeze.json": "80b69dd4bfa22a7f09c268310e81200d429880860fd77bab5c52278764c5697b",
    }
    for path, sha in protocol_pins.items():
        if digest(path) != sha:
            raise ValueError("Frozen source-selection protocol changed")
    for path, sha in ((PRIMARY/(MPD_SHA+".source"), MPD_SHA),
                      (PRIMARY/(META_SHA+".source"), META_SHA)):
        if digest(path) != sha:
            raise ValueError("Pinned original Maddison source changed")
    body = (PRIMARY/(MPD_SHA+".source")).read_bytes()
    notes = list(xlsx_rows(body, "Notes"))
    note_text = " ".join(str(v) for _, r in notes for v in r.values())
    if "Real GDP per capita in 2011$" not in note_text or "Population, mid-year (thousands)" not in note_text:
        raise ValueError("Native source PPP/population unit proof missing")
    source_rows = []
    for number, cells in xlsx_rows(body, "Full data"):
        if number == 1:
            if [cells.get(c) for c in "ABCDEF"] != ["countrycode", "country", "region", "year", "gdppc", "pop"]:
                raise ValueError("Exact native primary GDP schema required")
        elif cells.get("D") is not None and 2010 <= cells["D"] <= 2024:
            source_rows.append({"countrycode": cells.get("A"), "year": cells["D"],
                                "gdppc": cells.get("E"), "pop": cells.get("F"), "sourceRow": number})
    eu = assemble_eu27(source_rows)
    frozen = Path("generated-artifacts/driver-calibration/kaya-co2.csv")
    if digest(frozen) != "7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6":
        raise ValueError("Frozen source mismatch")
    codebook = Path("generated-artifacts/driver-calibration/kaya-codebook.csv")
    if digest(codebook) != "33b4f5e00efd58c7b83863f736beba1af4df946b43642b0400c3ec38648e0e8e":
        raise ValueError("Frozen GDP definition changed")
    definition = next(r for r in csv.DictReader(codebook.open()) if r["column"] == "gdp")
    if definition["unit"] != "international-$ in 2011 prices ($)" or "Maddison Project Database 2023" not in definition["source"]:
        raise ValueError("Exact source/basis bridge to primary GDP required")
    lookup = {}
    with frozen.open() as f:
        for row in csv.DictReader(f):
            if row["iso_code"] in EU27 and 2010 <= int(row["year"]) <= 2024 and row["gdp"]:
                lookup[row["iso_code"], int(row["year"])] = float(row["gdp"])
    paired = [{"member": c["member"], "year": c["year"],
               "primaryMinusFrozenGDP2011Dollars": c["GDP2011InternationalDollars"]-lookup[c["member"], c["year"]]}
              for c in eu["nativeMemberYearCells"] if c["GDP2011InternationalDollars"] is not None
              and (c["member"], c["year"]) in lookup]
    releases = []
    for year, pins in RELEASE_PINS.items():
        paths = [ROOT/f"desnz-{year}.{suffix}" for suffix in ("json", "pdf", "txt")]
        for path, sha in zip(paths, pins):
            if digest(path) != sha:
                raise ValueError(f"Original issue hash mismatch: {path}")
        meta, text = json.loads(paths[0].read_text()), paths[2].read_text()
        if meta["title"] != f"Energy Trends: June {year}" or not meta["first_published_at"].startswith(f"{year}-06-"):
            raise ValueError("Exact original publisher issue/date required")
        if "Figures for the latest periods are provisional" not in text or "Open Government Licence v3.0" not in text:
            raise ValueError("Source provisional status and dataset-use statement required")
        cells = extract_issue_cells(text, year)
        residual = cells["total_generation"]["value"]-sum(cells[n]["value"] for n in (
            "renewable_generation", "nuclear_generation", "fossil_generation"))
        releases.append({"issue": meta["title"], "publisherFirstPublished": meta["first_published_at"],
                         "publisherPublicUpdated": meta["public_updated_at"],
                         "originalAttachment": meta["details"]["attachments"][0]["url"],
                         "sourcePins": dict(zip(map(str, paths), pins)), "region": "United Kingdom",
                         "frequency": "quarterly", "quarter": f"{year}-Q1",
                         "actualPublishedCells": cells, "unallocatedGenerationResidualTWh": residual,
                         "unallocatedResidualTreatment": "Other source categories/rounding not reconstructed; never forced to zero",
                         "monthlyDataPresentInExtractedSeries": False,
                         "CO2OutcomeAvailable": False, "modelEligible": False})
    result = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "status": "primary-GDP-sidecar-and-three-original-quarterly-power-releases-assembled; full-Kaya-and-emissions-nowcast-still-blocked",
        "implementationSHA256": digest(__file__),
        "sourceProtocolPins": protocol_pins,
        "primaryGDPSource": {"workbookSHA256": MPD_SHA, "metadataSHA256": META_SHA,
                             "version": "MPD2023,Dataverse1.0,released2024-04-26",
                             "unit": "constant2011 international PPP dollars",
                             "formula": "native gdppc * native populationThousands *1000",
                             "frozenSourceSHA256": digest(frozen)},
        "EU27": eu, "GDPPrimaryVersusFrozenMemberComparisons": paired,
        "datedOriginalHighFrequencyReleases": releases,
        "newNetworkRequests": 9, "paidCalls": 0, "forecastFits": 0,
        "holdoutScoring": False, "centralEligible": False,
        "remainingGaps": [
            "Primary2011PPP GDP2023-2024 absent; no compatible full2010-2024 fixed Kaya window",
            "WorldGDP2011-2014 and RoW disjoint partition/bunker reconciliation unresolved",
            "International transport lacks a source-defined population/GDP account",
            "Original quarterly UK power activity is not monthly/daily CO2 or all-region/all-GHG2024-2026 outcomes",
            "Matched original monthly/daily CO2 releases and independently dated compatible outcomes remain missing",
        ],
    }
    path = ROOT/"source-assembly-result.json"
    path.write_text(json.dumps(result, indent=2, allow_nan=False)+"\n")
    print(json.dumps({"result": str(path), "resultSHA256": digest(path),
                      "EU27CompleteAnnualGDPYears": sum(r["GDP2011InternationalDollars"] is not None for r in eu["annual"]),
                      "EU27MissingMemberYears": len(eu["missingMemberYears"]),
                      "originalPowerReleases": len(releases), "status": result["status"]}, indent=2))


if __name__ == "__main__":
    main()

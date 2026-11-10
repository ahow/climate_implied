"""Read-only source investigation; never splice or replace frozen study inputs."""
import csv
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from kaya_decomposition import ENTITIES, FIELDS, HASHES, ROOT
from forecast_kaya import PROTOCOL, PROTOCOL_HASH, digest, prepare

OUT = Path("generated-artifacts/kaya-source-investigation")
# Fixed EU27 composition, not time-varying EU membership.
EU27 = tuple("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE".split())
SOURCES = {
    "maddison2023": ("https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/maddison-project-database-2023",
                     "Primary GDP release; verify endpoint and 2011 PPP basis; underlying terms apply."),
    "maddisonReleases": ("https://www.rug.nl/ggdc/historicaldevelopment/maddison/releases/",
                         "Primary release index; no new vintage inferred from retrieval."),
    "worldBankPPP": ("https://api.worldbank.org/v2/indicator/NY.GDP.MKTP.PP.KD?format=json",
                     "Alternative metadata only: a different PPP benchmark cannot fill frozen 2011-dollar cells."),
    "fairPinnedTree": ("https://api.github.com/repos/OMS-NetZero/FAIR/git/trees/ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79?recursive=1",
                       "Independent reference inventory; code licence does not establish data redistribution rights."),
    "fairCalibrationTree": ("https://api.github.com/repos/OMS-NetZero/fair-calibrate/git/trees/main?recursive=1",
                            "Annual-reference discovery only; calibration/version/coordinates must match before scoring."),
    "igccTree": ("https://api.github.com/repos/ClimateIndicator/forcing-timeseries/git/trees/main?recursive=1",
                 "Independent historical forcing discovery; not an annual FaIR temperature reference."),
}


def save_bytes(body, suffix):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / (hashlib.sha256(body).hexdigest() + suffix)
    if path.exists() and path.read_bytes() != body:
        raise ValueError("Immutable evidence collision")
    if not path.exists():
        with path.open("xb") as stream:
            stream.write(body)
    return str(path)


def retrieve(name, url, purpose):
    receipt = {"name": name, "url": url, "purpose": purpose,
               "retrievedAtUTC": datetime.now(timezone.utc).isoformat(),
               "informationAvailableAt": None, "historyBasis": "current-revision",
               "licence": "Unverified; private retention only, no redistribution approval"}
    try:
        with urlopen(Request(url, headers={"User-Agent": "Climate-source-investigation/1.0"}),
                     timeout=45) as response:
            body = response.read()
            receipt.update(status=response.status, finalURL=response.url,
                           contentType=response.headers.get("Content-Type"),
                           serverLastModified=response.headers.get("Last-Modified"))
    except HTTPError as error:
        body = error.read()
        receipt.update(status=error.code, error=str(error))
    except (URLError, TimeoutError, OSError) as error:
        receipt.update(status="retrieval-failed", error=str(error), sha256=None)
        return receipt
    receipt.update(sha256=hashlib.sha256(body).hexdigest(),
                   retainedPath=save_bytes(body, ".source"))
    if receipt["status"] == 200 and "json" in receipt.get("contentType", ""):
        parsed = json.loads(body)
        if isinstance(parsed, dict) and "tree" in parsed:
            receipt["resolvedRevision"] = parsed.get("sha")
            receipt["treeTruncated"] = parsed.get("truncated")
            receipt["candidatePaths"] = [r["path"] for r in parsed["tree"]
                if any(s in r["path"].lower() for s in
                       ("temperature", "forcing", "histor", "license", "licence", ".nc", "ssp"))]
        elif name == "worldBankPPP":
            receipt["indicatorMetadata"] = parsed
    return receipt


def load_rows(path):
    with path.open() as stream:
        rows = []
        for r in csv.DictReader(stream):
            if 2010 <= int(r["year"]) <= 2024:
                rows.append({"country": r["country"], "iso_code": r.get("iso_code", ""),
                             "year": int(r["year"]), **{
                    k: float(r[k]) if r.get(k) else None for k in FIELDS}})
    return rows


def membership_audit(rows, members):
    """All member/year/field cells required; no partial-sum regional observations."""
    if len(members) != len(set(members)) or not members:
        raise ValueError("Unique nonempty membership required")
    selected = {}
    for row in rows:
        if row["iso_code"] not in members:
            continue
        key = (row["iso_code"], row["year"])
        if key in selected:
            raise ValueError("Duplicate member-year")
        selected[key] = row
    missing, annual = [], []
    for year in range(2010, 2025):
        sums = {}
        for field in FIELDS:
            values = []
            for member in members:
                value = selected.get((member, year), {}).get(field)
                if value is None:
                    missing.append({"member": member, "year": year, "field": field})
                elif not math.isfinite(value) or value <= 0:
                    raise ValueError("Invalid member observation")
                else:
                    values.append(value)
            sums[field] = math.fsum(values) if len(values) == len(members) else None
        annual.append({"year": year, **sums})
    return {"members": list(members), "missingCells": missing, "annual": annual,
            "complete": not missing, "centralEligible": False}


def main():
    if digest(PROTOCOL) != PROTOCOL_HASH:
        raise ValueError("Frozen forecast protocol changed")
    for name, sha in HASHES.items():
        if digest(ROOT / name) != sha:
            raise ValueError("Frozen source changed: " + name)
    rows = load_rows(ROOT / "kaya-co2.csv")
    availability = {}
    for entity in ENTITIES:
        _, missing = prepare([r for r in rows if r["country"] == entity])
        availability[entity] = {"missing": missing, "ready": not missing}
    eu = membership_audit(rows, EU27)
    # An ISO-looking code alone cannot establish a disjoint world partition.
    # Retain an inventory for inspection, never subtract unmatched World totals.
    inventory = sorted({(r["iso_code"], r["country"]) for r in rows
                        if len(r["iso_code"]) == 3})
    retained = {}
    for name in ("owid-energy-data.csv", "catalog-owid_energy.csv"):
        path = ROOT / name
        if path.exists():
            source_rows = load_rows(path)
            retained[name] = {"sha256": digest(path),
                "admissibleForFrozenStudy": False,
                "reason": "Different retained source; unit/coverage inventory is not splice authorization.",
                "entityAvailability": {e: prepare([r for r in source_rows
                    if r["country"] == e])[1] for e in ENTITIES}}
    report = {"study": "forecast-kaya-source-investigation", "centralEligible": False,
              "protocolSha256": PROTOCOL_HASH, "frozenSourceHashes": HASHES,
              "codeSha256": digest(__file__), "historyBasis": "current-revision",
              "informationAvailableAt": None, "availability": availability,
              "EU27FixedMembershipAudit": eu, "countryInventory": inventory,
              "retainedAlternatives": retained,
              "restOfWorld": {"status": "blocked", "reason":
                  "No authorized disjoint fixed country partition with complete cells and reconciled energy/CO2 bunker boundaries."},
              "internationalTransport": {"status": "structurally-unavailable", "reason":
                  "No source-defined population/GDP account; cannot attach World population or GDP."},
              "sources": [retrieve(n, *s) for n, s in SOURCES.items()],
              "execution": "No ready frozen entities: no unchanged forecast or endpoint reruns."}
    if any(r["ready"] for r in availability.values()):
        raise ValueError("Unexpected ready frozen entity: explicitly schedule original gates")
    body = (json.dumps(report, indent=2, allow_nan=False) + "\n").encode()
    print(json.dumps({"report": save_bytes(body, ".json"),
                      "euMissingCells": len(eu["missingCells"]),
                      "sources": [{k: r.get(k) for k in ("name", "status", "sha256")}
                                  for r in report["sources"]]}, indent=2))


if __name__ == "__main__":
    main()

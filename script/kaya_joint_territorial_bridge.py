"""Source-native paired cells and diagnostic territory/bunker accounting,not fits.

Public units use synthetic fixtures. CLI acquisitions and private assembly are
explicit operations; importing this module never reads private source bytes.
"""
import argparse
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, localcontext
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import subprocess


ROOT = Path("generated-artifacts/kaya-joint-territorial")
PLAN = Path("docs/kaya-joint-territorial-source-plan.json")
FOLLOWUP = Path("docs/kaya-joint-wdi-country-census-followup.json")
NATIVE = Path("generated-artifacts/driver-calibration/kaya-co2.csv")
CODEBOOK = NATIVE.with_name("kaya-codebook.csv")
OLD = Path("generated-artifacts/kaya-fullbasis-monthly")
EU27 = tuple("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE".split())
RETAINED_IDS = set(EU27) | {"CHN", "IND", "USA", "WLD"}
YEARS = tuple(range(2010, 2025))
GDP, POP = "NY.GDP.MKTP.PP.KD", "SP.POP.TOTL"
REGIONS = {"World": "WLD", "China": "CHN", "India": "IND", "United States": "USA"}
ENTITIES = tuple(REGIONS) + ("European Union (27)", "Rest of World", "International transport")
FIELDS = ("population", "GDP2021PPP", "primaryEnergyTWh", "CO2Mt")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, obj):
    path.write_text(json.dumps(obj, indent=2, default=str, allow_nan=False) + "\n")


def load_json(path):
    return json.loads(path.read_text(), parse_float=Decimal)


def number(text):
    if text is None or str(text).strip() == "":
        return None
    try:
        value = Decimal(str(text))
    except InvalidOperation as error:
        raise ValueError("Invalid native numeric text") from error
    if not value.is_finite() or value < 0:
        raise ValueError("Nonfinite or negative native quantity")
    return value


def complete_sum(values):
    values = list(values)
    if not values or any(v is None for v in values):
        return None
    with localcontext() as ctx:
        ctx.prec = 100
        return sum(values, Decimal(0))


def displayed_closure(total, components):
    """Do not turn a partial subtotal or roundoff envelope into qualification."""
    components = list(components)
    result = {"componentCount": len(components), "missingComponentCount": sum(v is None for v in components),
              "completeComponentSum": complete_sum(components), "residual": None,
              "displayRoundingEnvelope": None, "insideDisplayRoundingEnvelope": None,
              "scientificBoundaryQualified": False}
    if total is None or result["completeComponentSum"] is None:
        return result
    with localcontext() as ctx:
        ctx.prec = 100
        residual = total - result["completeComponentSum"]
        envelope = sum((Decimal(1).scaleb(v.as_tuple().exponent) / 2
                        for v in [total] + components), Decimal(0))
    result.update(residual=residual, displayRoundingEnvelope=envelope,
                  insideDisplayRoundingEnvelope=residual.copy_abs() <= envelope)
    return result


def native_index(path):
    indexed, identities = {}, {}
    with path.open() as stream:
        for n, row in enumerate(csv.DictReader(stream), 1):
            year = int(row["year"])
            if year not in YEARS:
                continue
            key = (row["country"], year)
            if key in indexed:
                raise ValueError("Duplicate native country-year")
            indexed[key] = {"raw": row, "sourceLogicalRow": n}
            code = row["iso_code"]
            if len(code) == 3:
                if code in identities and identities[code] != row["country"]:
                    raise ValueError("Ambiguous native ISO3")
                identities[code] = row["country"]
    return indexed, identities


def registry(payload):
    meta, rows = payload
    if int(meta["pages"]) != 1 or int(meta["total"]) != len(rows):
        raise ValueError("Incomplete country registry pagination")
    result = {}
    for n, row in enumerate(rows, 1):
        if row["region"]["value"] == "Aggregates":
            continue
        if row["id"] in result:
            raise ValueError("Duplicate source country identity")
        result[row["id"]] = {**row, "sourceLogicalRow": n}
    return result


def select_missing(native_ids, countries):
    return sorted((set(native_ids) | {"XKX"}) & set(countries) - RETAINED_IDS)


def wdi_index(payload, indicator, expected):
    meta, rows = payload
    if (int(meta["pages"]) != 1 or int(meta["total"]) != len(rows)
            or str(meta["sourceid"]) != "2" or not meta.get("lastupdated")):
        raise ValueError("Incomplete/non-source2/unversioned WDI response")
    result = {}
    for n, row in enumerate(rows, 1):
        key = (row["countryiso3code"], int(row["date"]))
        if key[0] not in expected or key[1] not in YEARS or row["indicator"]["id"] != indicator:
            raise ValueError("Unexpected WDI identity/year/indicator")
        if key in result:
            raise ValueError("Duplicate WDI cell")
        value = number(row["value"])
        if value is not None and value <= 0:
            raise ValueError("Nonpositive WDI full-contract cell")
        result[key] = {"value": value, "sourceLogicalRow": n,
                       "sourceCountry": row["country"]["value"], "sourceMetadata": meta}
    return result, meta


def failed_numeric_cell(receipt, code, year):
    if receipt["status"] == "200" and receipt["curlExit"] == 0:
        raise ValueError("Successful source cannot be labelled failed")
    return {"value": None, "source": None, "countryIdentifier": code, "year": year,
            "missingReason": "attempted-numeric-acquisition-failed-not-publisher-data-null",
            "failedRequestName": receipt["name"], "failedHTTPStatus": receipt["status"],
            "failedCurlExit": receipt["curlExit"]}


def wdi_country_census(world, members, field):
    """Never splice a later-release sidecar into a retained World source account."""
    world_meta = world["sourceMetadata"]
    def matching(cell):
        meta = cell.get("sourceMetadata", {})
        return (str(meta.get("sourceid")) == str(world_meta["sourceid"])
                and meta.get("lastupdated") == world_meta["lastupdated"])
    numerical = [r["cell"]["value"] for r in members if r["cell"]["value"] is not None]
    compatible = [r["cell"]["value"] if matching(r["cell"]) else None for r in members]
    subtotal = complete_sum(v for v in compatible if v is not None)
    missing = [r["countryIdentifier"] for r, v in zip(members, compatible) if v is None]
    mismatched = [{"countryIdentifier": r["countryIdentifier"],
                   "sourceLastupdated": r["cell"]["sourceMetadata"]["lastupdated"]}
                  for r in members if r["cell"]["value"] is not None and not matching(r["cell"])]
    return {"field": field, "nativeWorldWDI": world["value"], "worldSourceLastupdated": world_meta["lastupdated"],
            "countryRegisterMembers": len(members), "numericPresentMembersAcrossSourceRevisions": len(numerical),
            "matchingRevisionPresentMembers": sum(v is not None for v in compatible),
            "missingCompatibleMembers": missing, "revisionMismatchedMembers": mismatched,
            "sameRevisionCompleteCountrySum": complete_sum(compatible),
            "matchingRevisionCountrySubtotal": subtotal,
            "nativeWorldMinusMatchingRevisionCountrySubtotal": world["value"] - subtotal,
            "laterRevisionSidecarExcludedFromClosure": bool(mismatched),
            "missingCompatibleCellCauses": [
                {"countryIdentifier": r["countryIdentifier"],
                 "status": ("later-source-revision-not-spliced" if r["cell"]["value"] is not None
                            else r["cell"].get("missingReason", "publisher-returned-null"))}
                for r, v in zip(members, compatible) if v is None],
            "publisherAggregationMethod": "Gap-filled total" if field == "GDP2021PPP" else "Sum",
            "sourceTerritoryCompatibilityWithFrozenCO2Qualified": False}


def inspect_retained():
    plan = load_json(PLAN)
    for path, digest in plan["originalProtocolsReadFirst"].items():
        if sha(path) != digest:
            raise ValueError("Original frozen protocol changed")
    pins = plan["retainedInputsFirst"]
    for path, key in ((NATIVE, "nativeCSV"), (CODEBOOK, "nativeCodebook"),
                      (OLD / "wdi-gdp.body", "GDP465Raw"),
                      (OLD / "wdi-pop.body", "population465Raw"),
                      (OLD / "fullbasis-source-result.json", "WDI2021PPP465GDPPopResult")):
        if sha(path) != pins[key]:
            raise ValueError("Retained source changed:" + str(path))
    original = load_json(OLD / "fullbasis-source-result.json")
    if not original["preservedOriginalMPDEU27Missing54"]:
        raise ValueError("Original missing54 must remain explicit")
    return plan


def request(manifest, name, url, cap, *, maximum_requests=3, total_cap=14000000):
    if len(manifest["requests"]) >= maximum_requests or any(r["name"] == name for r in manifest["requests"]):
        raise ValueError("Bounded acquisition requests,no retries")
    if sum(r["bytes"] for r in manifest["requests"]) + cap > total_cap:
        raise ValueError("Acquisition total cap")
    body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
    started = datetime.now(timezone.utc).isoformat()
    done = subprocess.run(["curl", "-sS", "-L", "--max-redirs", "5", "--max-time", "45",
                           "--max-filesize", str(cap), "-D", str(headers), "-o", str(body),
                           "-w", "%{http_code}\\n%{url_effective}\\n", url],
                          capture_output=True, text=True, timeout=50)
    lines = done.stdout.splitlines()
    entry = {"name": name, "url": url, "startedUTC": started,
             "completedUTC": datetime.now(timezone.utc).isoformat(), "capBytes": cap,
             "status": lines[0] if lines else None, "effectiveURL": lines[1] if len(lines) > 1 else None,
             "curlExit": done.returncode, "stderr": done.stderr,
             "bytes": body.stat().st_size if body.exists() else 0,
             "body": str(body), "bodySHA256": sha(body) if body.exists() else None,
             "headers": str(headers), "headersSHA256": sha(headers) if headers.exists() else None}
    manifest["requests"].append(entry)
    save(ROOT / "requests.json", manifest)
    print(json.dumps(entry), flush=True)
    if entry["status"] != "200" or entry["curlExit"] != 0:
        raise ValueError("Explicit acquisition failure;no retry")
    return load_json(body)


def acquire():
    inspect_retained()
    ROOT.mkdir(parents=True, exist_ok=True)
    if (ROOT / "requests.json").exists():
        raise ValueError("Acquisition exists;no unchanged retrievals or overwrites")
    manifest = {"plan": str(PLAN), "planSHA256": sha(PLAN), "requests": []}
    save(ROOT / "requests.json", manifest)
    countries = registry(request(manifest, "country-registry",
                         "https://api.worldbank.org/v2/country?format=json&per_page=400", 2000000))
    _, native_ids = native_index(NATIVE)
    selected = select_missing(native_ids, countries)
    if not selected or len(selected) > 250 or RETAINED_IDS & set(selected):
        raise ValueError("Only actual missing native territorial country identifiers permitted")
    manifest["requestedNewCountries"] = selected
    manifest["retainedCountriesNotRefetched"] = sorted(RETAINED_IDS)
    save(ROOT / "requests.json", manifest)
    selector = ";".join(selected)
    for name, indicator in (("remaining-gdp", GDP), ("remaining-population", POP)):
        request(manifest, name,
                f"https://api.worldbank.org/v2/country/{selector}/indicator/{indicator}?date=2010:2024&source=2&format=json&per_page=20000",
                6000000)


def acquire_world_census():
    inspect_retained()
    followup = load_json(FOLLOWUP)
    if sha(followup["initialManifest"]) != followup["initialManifestSHA256"]:
        raise ValueError("Initial3 source history changed")
    manifest = load_json(ROOT / "requests.json")
    initial = load_json(Path(followup["initialManifest"]))
    if (len(manifest["requests"]) not in (3, 4)
            or manifest["requests"][:3] != initial["requests"]):
        raise ValueError("Unchanged3 initial acquisitions and at most1 follow-up required;no retries")
    if len(manifest["requests"]) == 3 and manifest != initial:
        raise ValueError("Initial acquisition manifest changed")
    if len(manifest["requests"]) == 4:
        prior = manifest["requests"][3]
        if (manifest.get("followupPlanSHA256") != sha(FOLLOWUP)
                or prior["name"] != "world-census-gdp" or prior["status"] == "200"):
            raise ValueError("Only independent population continuation after explicit GDP failure permitted")
        manifest["independentPopulationContinuationAfterGDPFailure"] = True
    if sha(ROOT / "country-registry.body") != followup["countryRegistrySHA256"]:
        raise ValueError("Source country registry changed")
    countries = registry(load_json(ROOT / "country-registry.body"))
    _, identities = native_index(NATIVE)
    extra = sorted(set(countries) - set(identities) - {"XKX"})
    if extra != followup["additionalSourceCountryIdentifiers"] or set(extra) & RETAINED_IDS:
        raise ValueError("Exact new country-census scope required")
    manifest.update(followupPlan=str(FOLLOWUP), followupPlanSHA256=sha(FOLLOWUP),
                    requestedAdditionalWorldCensusCountries=extra)
    save(ROOT / "requests.json", manifest)
    for name, indicator in (("world-census-gdp", GDP), ("world-census-population", POP)):
        if any(r["name"] == name for r in manifest["requests"]):
            continue  # Existing failed GDP attempt remains failed;NEVER retry it.
        request(manifest, name,
                f"https://api.worldbank.org/v2/country/{';'.join(extra)}/indicator/{indicator}?date=2010:2024&source=2&format=json&per_page=20000",
                1000000, maximum_requests=5, total_cap=16000000)


def glossary_qualification():
    followup = load_json(FOLLOWUP)
    proofs = {}
    for name, digest in followup["retainedGlossaryPins"].items():
        path = OLD / name
        if sha(path) != digest:
            raise ValueError("Retained primary glossary changed")
        text = re.sub(r"<script\b[^>]*>.*?</script>", "", path.read_text(), flags=re.S | re.I)
        text = re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", text))).strip()
        terms = (["Aggregation method Gap-filled total", "Constant 2021 international $"]
                 if name == "wdi-gdp-definitions.body"
                 else ["Aggregation method Sum", "midyear estimates"])
        if any(t not in text for t in terms):
            raise ValueError("Source aggregation/units/frequency definition absent")
        proofs[name] = {"source": str(path), "sha256": digest, "requiredMetadataTerms": terms}
    return proofs


def native_cell(index, country, year, field):
    row = index.get((country, year))
    return {"value": number(row["raw"].get(field)) if row else None,
            "source": str(NATIVE), "sourceLogicalRow": row["sourceLogicalRow"] if row else None,
            "country": country, "nativeField": field}


def sum_cells(cells, purpose):
    return {"value": complete_sum(c["value"] for c in cells), "sourceComponents": cells,
            "construction": purpose, "scientificBoundaryQualified": False}


def contract_gate(regional_rows, *, original_basis, source_boundaries):
    keys = [(r["entity"], r["year"]) for r in regional_rows]
    expected = {(e, y) for e in ENTITIES for y in YEARS}
    if len(keys) != len(set(keys)) or set(keys) - expected:
        raise ValueError("Duplicate or outside-protocol regional account")
    gaps = [{"entity": r["entity"], "year": r["year"], "field": f}
            for r in regional_rows for f in FIELDS if r["cells"][f]["value"] is None]
    gaps.extend({"entity": e, "year": y, "field": f}
                for e, y in sorted(expected - set(keys)) for f in FIELDS)
    failures = []
    if not original_basis:
        failures.append("GDP2021PPP-is-separate-from-original-MPD2011PPP")
    if gaps:
        failures.append("original-seven-entity-full-window-cell-contract-incomplete")
    if not source_boundaries:
        failures.append("territory-primary-energy-and-bunker-boundaries-unqualified")
    if any(r["cells"][f]["value"] is not None and
           (not r["cells"][f]["value"].is_finite() or r["cells"][f]["value"] <= 0)
           for r in regional_rows for f in FIELDS):
        failures.append("nonpositive-or-nonfinite-original-contract-input")
    return {"originalFrozenContractQualified": not failures, "failedGates": failures,
            "missingCells": gaps, "fitExecuted": False, "holdoutScores": 0, "centralEligible": False}


def assemble():
    inspect_retained()
    manifest = load_json(ROOT / "requests.json")
    if (sha(PLAN) != manifest["planSHA256"] or len(manifest["requests"]) != 5
            or sha(FOLLOWUP) != manifest["followupPlanSHA256"]):
        raise ValueError("Frozen acquisition contract changed/incomplete")
    followup = load_json(FOLLOWUP)
    if sha(followup["initialManifest"]) != followup["initialManifestSHA256"]:
        raise ValueError("Initial3 acquisition history changed")
    if manifest["requests"][:3] != load_json(Path(followup["initialManifest"]))["requests"]:
        raise ValueError("Original3 request receipts changed")
    for n, receipt in enumerate(manifest["requests"]):
        for key in ("body", "headers"):
            path, expected_sha = Path(receipt[key]), receipt[key + "SHA256"]
            if expected_sha is None:
                if path.exists():
                    raise ValueError("Unexpected bytes for explicitly absent failed response")
            elif sha(path) != expected_sha:
                raise ValueError("Acquired source bytes changed")
        if n < 3 and (receipt["status"] != "200" or receipt["curlExit"] != 0):
            raise ValueError("Core paired source acquisition unsuccessful")
    source_attempts = {r["name"]: r for r in manifest["requests"]}
    countries = registry(load_json(ROOT / "country-registry.body"))
    native, identities = native_index(NATIVE)
    selected = manifest["requestedNewCountries"]
    if selected != select_missing(identities, countries):
        raise ValueError("Country selection changed")
    wb, revisions = {}, {}
    extra = manifest["requestedAdditionalWorldCensusCountries"]
    if extra != sorted(set(countries) - set(identities) - {"XKX"}):
        raise ValueError("World census country scope changed")
    for field, indicator, oldname, newname in (
            ("GDP2021PPP", GDP, "wdi-gdp", "remaining-gdp"),
            ("population", POP, "wdi-pop", "remaining-population")):
        combined = {}
        for path, expected in ((OLD / (oldname + ".body"), RETAINED_IDS),
                               (ROOT / (newname + ".body"), set(selected)),
                               (ROOT / ("world-census-" + ("gdp" if field == "GDP2021PPP" else "population") + ".body"), set(extra))):
            attempt = source_attempts.get(path.stem)
            if attempt is not None and (attempt["status"] != "200" or attempt["curlExit"] != 0):
                continue  # Explicit failed source,not data null;wcell labels all affected cells below.
            indexed, meta = wdi_index(load_json(path), indicator, expected)
            revisions[str(path)] = meta
            for key, cell in indexed.items():
                if key in combined:
                    raise ValueError("Duplicate/replaced retained source cell")
                combined[key] = {**cell, "source": str(path)}
        wb[field] = combined
    revision_dates = sorted({m["lastupdated"] for m in revisions.values()})
    core_revision_dates = sorted({m["lastupdated"] for path, m in revisions.items() if "world-census-" not in path})
    def wcell(field, code, year):
        name = "world-census-" + ("gdp" if field == "GDP2021PPP" else "population")
        attempt = source_attempts[name]
        if code in extra and (attempt["status"] != "200" or attempt["curlExit"] != 0):
            return failed_numeric_cell(attempt, code, year)
        return wb[field].get((code, year), {"value": None, "source": None,
                     "missingReason": "WDI-identity-or-year-not-returned",
                     "countryIdentifier": code, "year": year})
    def empty(reason):
        return {"value": None, "missingReason": reason}
    metadata_proofs = glossary_qualification()
    regional, eu_checks, unassigned, world_checks, population_deltas = [], [], [], [], []
    national = []
    # Kosovo has blank native ISO;preserve the explicit provisional name bridge.
    prospective = {**identities, "XKX": "Kosovo"}
    for code, name in sorted(prospective.items()):
        for year in YEARS:
            cells = {f: wcell(f, code, year) for f in ("population", "GDP2021PPP")}
            cells.update(primaryEnergyTWh=native_cell(native, name, year, "primary_energy_consumption"),
                         CO2Mt=native_cell(native, name, year, "co2"))
            national.append({"countryIdentifier": code, "nativeCountry": name, "year": year,
                             "provisionalNameBridge": code == "XKX", "cells": cells,
                             "territoryCompatibilityQualified": False})
    for year in YEARS:
        selected_rows = []
        for name in tuple(REGIONS) + ("European Union (27)",):
            if name in REGIONS:
                cells = {f: wcell(f, REGIONS[name], year) for f in ("population", "GDP2021PPP")}
            else:
                cells = {f: sum_cells([wcell(f, code, year) for code in EU27],
                                     "complete-fixed-EU27-WDI-native-member-sum") for f in ("population", "GDP2021PPP")}
            cells.update(primaryEnergyTWh=native_cell(native, name, year, "primary_energy_consumption"),
                         CO2Mt=native_cell(native, name, year, "co2"))
            row = {"entity": name, "year": year, "cells": cells,
                   "basis": "WDI-source2-2021PPP-plus-frozen-native-E-and-CO2-candidate",
                   "territoryCompatibilityQualified": False}
            regional.append(row)
            if name != "World":
                selected_rows.append(row)
            frozen_p = native_cell(native, name, year, "population")["value"]
            if cells["population"]["value"] is not None and frozen_p is not None:
                population_deltas.append({"entity": name, "year": year, "WDI": cells["population"]["value"],
                                          "nativeOWID": frozen_p,
                                          "differencePeople": cells["population"]["value"] - frozen_p})
        bunkers = {f: [native_cell(native, name, year, field)
                      for name in ("International aviation", "International shipping")]
                   for f, field in (("CO2Mt", "co2"), ("primaryEnergyTWh", "primary_energy_consumption"))}
        regional.append({"entity": "International transport", "year": year,
                         "cells": {"population": empty("No natural source-defined transport population account"),
                                   "GDP2021PPP": empty("No natural source-defined transport GDP account"),
                                   "primaryEnergyTWh": sum_cells(bunkers["primaryEnergyTWh"], "native-bunker-energy-missing-not-inferred"),
                                   "CO2Mt": sum_cells(bunkers["CO2Mt"], "explicit-native-aviation-plus-shipping-CO2")},
                         "territoryCompatibilityQualified": False})
        regional.append({"entity": "Rest of World", "year": year, "cells": {
            f: empty("No qualified exhaustive disjoint territorial membership;diagnostic residual is not a native regional observation")
            for f in FIELDS}, "territoryCompatibilityQualified": False})
        world = next(r for r in regional if r["entity"] == "World" and r["year"] == year)
        diagnostic = {"year": year, "notRestOfWorldObservation": True,
                      "interpretation": "World-minus-four-selected-source-account vectors only;subtraction closure is not independent validation",
                      "unassigned": {}}
        for f in FIELDS:
            total = world["cells"][f]["value"]
            subtotal = complete_sum(r["cells"][f]["value"] for r in selected_rows)
            diagnostic["unassigned"][f] = None if total is None or subtotal is None else total - subtotal
        diagnostic["unassignedCO2AfterNativeBunkersMt"] = (
            diagnostic["unassigned"]["CO2Mt"] - complete_sum(c["value"] for c in bunkers["CO2Mt"]))
        diagnostic["unassignedEnergyHasUnknownBunkerAllocation"] = True
        unassigned.append(diagnostic)
        for output, field in (("CO2Mt", "co2"), ("primaryEnergyTWh", "primary_energy_consumption")):
            aggregate = native_cell(native, "European Union (27)", year, field)
            members = [native_cell(native, identities[c], year, field) for c in EU27]
            eu_checks.append({"year": year, "field": output, "nativeAggregate": aggregate,
                              "nativeMemberCells": members,
                              **displayed_closure(aggregate["value"], [c["value"] for c in members])})
            member_rows = [r for r in national if r["year"] == year]
            available = [r["cells"][output]["value"] for r in member_rows
                         if r["cells"][output]["value"] is not None]
            missing = [{"countryIdentifier": r["countryIdentifier"], "country": r["nativeCountry"]}
                       for r in member_rows if r["cells"][output]["value"] is None]
            native_world = world["cells"][output]["value"]
            subtotal = complete_sum(available)
            bunker = complete_sum(c["value"] for c in bunkers[output])
            closure = displayed_closure(native_world, available + [c["value"] for c in bunkers[output]])
            world_checks.append({"year": year, "field": output, "countryCoverage": len(available),
                                 "missingCountryCells": missing, "observedCountrySubtotal": subtotal,
                                 "nativeWorld": native_world, "nativeBunkerTotal": bunker,
                                 "worldMinusObservedCountries": native_world - subtotal,
                                 "worldMinusObservedCountriesAndBunkers": (
                                     None if bunker is None else native_world - subtotal - bunker),
                                 "diagnosticObservedSubtotalClosure": closure,
                                 "nativeMissingNotZeroFilled": True,
                                 "territorialPartitionQualified": False})
    with localcontext() as ctx:
        ctx.prec = 100
        # Above arithmetic is already exact at the native precision;this block
        # also fixes serialization of all prospective full-member sum checks.
        remainder = []
        rest_ids = sorted(set(prospective) - set(EU27) - {"CHN", "IND", "USA"})
        for year in YEARS:
            row = {"year": year, "prospectiveMembers": rest_ids, "notQualifiedRoW": True, "fields": {}}
            for f in FIELDS:
                members = [r for r in national if r["year"] == year and r["countryIdentifier"] in rest_ids]
                vals = [r["cells"][f]["value"] for r in members]
                row["fields"][f] = {
                    "completeSum": complete_sum(vals), "presentMembers": sum(v is not None for v in vals),
                    "observedSubtotalNotFullAccount": complete_sum(v for v in vals if v is not None),
                    "missingMembers": [r["countryIdentifier"] for r in members if r["cells"][f]["value"] is None]}
                diagnostic = next(d for d in unassigned if d["year"] == year)
                target = (diagnostic["unassignedCO2AfterNativeBunkersMt"] if f == "CO2Mt"
                          else diagnostic["unassigned"][f])
                observed = row["fields"][f]["observedSubtotalNotFullAccount"]
                row["fields"][f]["unassignedWorldMinusObservedRestCandidates"] = target - observed
                row["fields"][f]["residualNotMissingCountryEstimate"] = True
            remainder.append(row)
    wdi_world_checks = []
    wdi_country_cells = [{"countryIdentifier": code, "sourceCountry": countries[code]["name"],
                          "year": year, "cells": {f: wcell(f, code, year) for f in ("population", "GDP2021PPP")}}
                         for code in sorted(countries) for year in YEARS]
    for year in YEARS:
        for field in ("population", "GDP2021PPP"):
            members = [{"countryIdentifier": r["countryIdentifier"], "cell": r["cells"][field]}
                       for r in wdi_country_cells if r["year"] == year]
            wdi_world_checks.append({"year": year, **wdi_country_census(wcell(field, "WLD", year), members, field)})
    paired = {"regional": regional, "nationalCandidateCells": national, "prospectiveRoW": remainder,
              "EU27NativeAggregateReconciliation": eu_checks,
              "worldCountryBunkerReconciliation": world_checks,
              "diagnosticUnassignedWorldVectorsNotRoW": unassigned,
              "WDIvsNativePopulation": population_deltas, "completeWDICountryRegisterCells": wdi_country_cells,
              "WDIWorldCountryRegisterReconciliation": wdi_world_checks}
    save(ROOT / "paired-native-source-cells.json", paired)
    gate = contract_gate(regional, original_basis=False, source_boundaries=False)
    unmatched_native = [{"nativeIdentifier": c, "nativeCountry": name,
                         "status": "not-in-publisher-nonaggregate-WDI-country-registry;numeric-query-not-attempted"}
                        for c, name in sorted(prospective.items()) if c not in countries]
    missing_national = [{"countryIdentifier": r["countryIdentifier"], "nativeCountry": r["nativeCountry"],
                         "year": r["year"], "field": f,
                         "status": ("native-empty-energy-or-CO2-cell" if f in ("CO2Mt", "primaryEnergyTWh")
                                    else "numeric-query-unattempted-no-publisher-WDI-country-identity"
                                    if r["countryIdentifier"] not in countries
                                    else "publisher-returned-null" if r["cells"][f].get("sourceLogicalRow") is not None
                                    else "publisher-cell-unreturned-despite-request")}
                        for r in national for f in FIELDS if r["cells"][f]["value"] is None]
    result = {"assembledUTC": datetime.now(timezone.utc).isoformat(), "moduleSHA256": sha(__file__),
              "planSHA256": sha(PLAN), "requestManifestSHA256": sha(ROOT / "requests.json"),
              "followupPlanSHA256": sha(FOLLOWUP), "sourceGlossaryQualification": metadata_proofs,
              "pairedSourceTable": str(ROOT / "paired-native-source-cells.json"),
              "pairedSourceTableSHA256": sha(ROOT / "paired-native-source-cells.json"),
              "originalMPD2011PPPChanged": False, "original54MissingCellsPreserved": True,
              "candidateGDPBasis": "WDI-source2-constant2021internationalPPP;not-a-conversion-of-MPD2011PPP",
              "sourceRevisions": revisions, "WDILastupdatedValues": revision_dates,
              "jointWDISourceRevisionMatched": len(revision_dates) == 1,
              "coreNationalRegionalWDILastupdatedValues": core_revision_dates,
              "coreNationalRegionalWDISourceRevisionMatched": len(core_revision_dates) == 1,
              "laterRevisionPopulationSidecarNotSplicedIntoWorldClosure": any(
                  r["revisionMismatchedMembers"] for r in wdi_world_checks),
              "informationAvailableAtHistoricalOrigins": None, "historyBasis": "explicit-revised-history",
              "newCountryIdentifiersRequested": selected, "retained31NotRefetched": sorted(RETAINED_IDS),
              "additionalWDICountriesOutsideNativeCarbonCensus": [
                  {"countryIdentifier": c, "sourceCountry": countries[c]["name"],
                   "numericAcquisitionStatus": {
                       name: {"attempted": True, "status": source_attempts[name]["status"],
                              "curlExit": source_attempts[name]["curlExit"]}
                       for name in ("world-census-gdp", "world-census-population")},
                   "nativeEnergyCO2Geography": "No exact native-country-ISO3 counterpart;no parent/territory mapping invented"}
                  for c in extra],
              "completeWDICountryRegisterRows": len(wdi_country_cells),
              "WDICountryRegisterDomainComplete": True,
              "WDICountryNumericCellsComplete": all(r["cells"][f]["value"] is not None
                                                   for r in wdi_country_cells for f in ("GDP2021PPP", "population")),
              "acquisitionFailures": [r for r in manifest["requests"] if r["status"] != "200" or r["curlExit"] != 0],
              "WDIWorldCountryRegisterReconciliation": wdi_world_checks,
              "nationalCandidateRows": len(national),
              "nationalCompleteNumericFourCellRows": sum(all(r["cells"][f]["value"] is not None for f in FIELDS) for r in national),
              "originalRegionalRows": len(regional),
              "completeNumericRegionalRows": sum(all(r["cells"][f]["value"] is not None for f in FIELDS) for r in regional),
              "missingNationalSourceCells": missing_national, "unmatchedNativeTerritoriesInWDI": unmatched_native,
              "EU27Residuals": [{"year": r["year"], "field": r["field"], "residual": r["residual"],
                                "displayRoundingEnvelope": r["displayRoundingEnvelope"],
                                "insideDisplayRoundingEnvelope": r["insideDisplayRoundingEnvelope"]} for r in eu_checks],
              "worldCountryBunkerResiduals": world_checks, "prospectiveRoWCoverage": remainder,
              "unassignedVectorsNotRoW": unassigned, "populationSourceDifferences": population_deltas,
              "contractAdmission": gate,
              "territoryLimits": ["ISO identity alone does not establish equal GDP/population/energy/CO2 territorial extent",
                                  "Native EU27 energy versus exact27 member sum is measured,not forced equal",
                                  "WDI unavailable territories and native missing energy/CO2 remain absent",
                                  "Source-defined international transport energy/population/GDP absent;no CO2-to-energy conversion",
                                  "World-minus-selected vector is not an invented source-native Rest-of-World observation",
                                  "Original2011PPP-basis protocol cannot be refrozen to fit2021PPP data"],
              "networkRequests": 5, "paidCalls": 0, "fits": 0, "holdoutScores": 0, "centralEligible": False}
    save(ROOT / "joint-territorial-source-result.json", result)
    print(json.dumps({k: result[k] for k in ("nationalCandidateRows", "nationalCompleteNumericFourCellRows",
          "originalRegionalRows", "completeNumericRegionalRows", "WDILastupdatedValues",
          "EU27Residuals", "unmatchedNativeTerritoriesInWDI")}, indent=2, default=str))
    print("missing-national-cells", len(missing_national), "resultSHA256", sha(ROOT / "joint-territorial-source-result.json"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=("acquire", "acquire-world-census", "assemble"))
    args = parser.parse_args()
    # Explicit high precision for every source subtraction as well as sums.
    with localcontext() as context:
        context.prec = 100
        {"acquire": acquire, "acquire-world-census": acquire_world_census, "assemble": assemble}[args.command]()

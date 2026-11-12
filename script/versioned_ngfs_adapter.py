"""Strict, offline native-species CSV boundary; not a scientific acceptance gate.

A new release needs a separately reviewed ReleaseProfile and artifact digest.
Profiles are supplied by trusted code, never inferred from a CSV or its manifest.
No production pathways, missing gases, or inventory adjustments are manufactured.
"""
import csv
from dataclasses import dataclass
import hashlib
import io
import json
import re

from ngfs_pathway_adapter import SERIES, STAGES, annualize, finite

SCHEMA_VERSION = "ngfs-native-csv-v1"
IDENTITY_COLUMNS = ("Model", "Scenario", "Region", "Variable", "Unit")
LICENCE_URL = "https://data.ene.iiasa.ac.at/ngfs/static/License/Legal.html"
PHASE_V_ARCHIVE_SHA256 = "acae7160abbd34d10b4eda5226a1fc3ebb5591205203a82c48ab9b5d5ad7c31b"


@dataclass(frozen=True)
class ReleaseProfile:
    source_version: str
    source_url: str
    release_sha256: str
    artifact_sha256: str
    licence_id: str
    licence_url: str
    attribution: str
    models: tuple[str, ...]
    scenarios: tuple[str, ...]
    regions: tuple[str, ...]
    years: tuple[int, ...]
    synthetic: bool = False


def phase_v_fixture_profile():
    """Only the tiny attributed three-row CH4 extract is pinned here."""
    return ReleaseProfile(
        source_version="NGFS Phase V 5.1",
        source_url="https://doi.org/10.5281/zenodo.17901363",
        release_sha256=PHASE_V_ARCHIVE_SHA256,
        artifact_sha256="6e605952b05152a9c99c0eb0b19a272d86592d7ff4ba259068e1325a1b803232",
        licence_id="NGFS-adapted-licence",
        licence_url=LICENCE_URL,
        attribution="NGFS Phase V 5.1; REMIND-MAgPIE 3.3-4.8; IIASA scenario database",
        models=("REMIND-MAgPIE 3.3-4.8",),
        scenarios=("Current Policies",),
        regions=("World",),
        years=tuple(range(2020, 2101, 5)),
    )


def manifest_for_profile(profile):
    """Serialize reviewed expectations; does not verify a new release."""
    return {
        "schemaVersion": SCHEMA_VERSION,
        "sourceVersion": profile.source_version,
        "sourceUrl": profile.source_url,
        "releaseSha256": profile.release_sha256,
        "contentSha256": profile.artifact_sha256,
        "licence": {
            "id": profile.licence_id, "url": profile.licence_url,
            "attribution": profile.attribution,
            "redistribution": "insubstantial-attributed-test-extract-only",
        },
        "synthetic": profile.synthetic,
    }


def parse_versioned_csv(payload, manifest, profile):
    """Verify pinned provenance and every native row before returning source data."""
    if not isinstance(profile, ReleaseProfile):
        raise ValueError("A trusted reviewed release profile is required")
    if (not profile.source_version or not profile.attribution or
            not profile.licence_id or not profile.models or not profile.scenarios or
            not profile.regions or len(profile.years) < 2 or
            tuple(sorted(set(profile.years))) != profile.years or
            any(type(year) is not int or not 1750 <= year <= 2500 for year in profile.years) or
            not profile.source_url.startswith("https://") or
            not profile.licence_url.startswith("https://")):
        raise ValueError("Invalid reviewed release profile")
    for digest in (profile.release_sha256, profile.artifact_sha256):
        if not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError("Reviewed SHA256 pins are required")
    if json.dumps(manifest, sort_keys=True, allow_nan=False) != json.dumps(
            manifest_for_profile(profile), sort_keys=True, allow_nan=False):
        raise ValueError("Source version/schema/hash/licence manifest differs from reviewed profile")
    if not isinstance(payload, bytes) or hashlib.sha256(payload).hexdigest() != profile.artifact_sha256:
        raise ValueError("Source content SHA256 mismatch")
    try:
        text = payload.decode("utf-8-sig")
        reader = csv.reader(io.StringIO(text, newline=""), strict=True)
        header = next(reader)
        expected = [*IDENTITY_COLUMNS, *(str(y) for y in profile.years)]
        if header != expected:
            raise ValueError("Unexpected CSV schema, duplicate columns or source years")
        rows, seen = [], set()
        for cells in reader:
            if len(cells) != len(header):
                raise ValueError("CSV row width differs from schema")
            row = dict(zip(header, cells))
            if (row["Model"] not in profile.models or
                    "IntegratedPhysicalDamages" in row["Model"] or
                    row["Scenario"] not in profile.scenarios or row["Region"] not in profile.regions):
                raise ValueError("Unreviewed model, scenario or region")
            stage, variable = "raw", row["Variable"]
            for candidate in ("harmonized", "infilled"):
                if variable.startswith(STAGES[candidate]):
                    stage, variable = candidate, variable[len(STAGES[candidate]):]
                    break
            if variable not in SERIES:
                raise ValueError(f"Unknown native species or aggregate variable: {variable}")
            gas, unit, scale = SERIES[variable]
            normalized_unit = ("kt HFC43-10/yr" if gas == "HFC-43-10-mee"
                               and row["Unit"] == "kt HFC4310/yr" else row["Unit"])
            if normalized_unit != unit:
                raise ValueError(f"Unexpected native units for {gas}")
            key = (row["Model"], row["Scenario"], row["Region"], stage, gas)
            if key in seen:
                raise ValueError("Duplicate source species in processing stage")
            seen.add(key)
            points = [(y, finite(row[str(y)]) * scale) for y in profile.years if row[str(y)] != ""]
            if not gas.startswith("CO2-") and any(v < 0 for _, v in points):
                raise ValueError("Negative non-CO2 emissions")
            # Validate horizon even for unselected stages; empty cells remain explicit.
            annual = annualize(points)
            for value in annual.values():
                finite(value)
            rows.append({
                "model": row["Model"], "scenario": row["Scenario"], "region": row["Region"],
                "stage": stage, "gas": gas, "sourceVariable": row["Variable"],
                "sourceUnit": row["Unit"], "unit": "Mt gas/year",
                "published": {y: (finite(row[str(y)]) if row[str(y)] != "" else None)
                              for y in profile.years},
                "annualNativeMt": annual,
                "interpolation": "piecewise-linear-between-published-points; no extrapolation",
            })
        if not rows:
            raise ValueError("No native source rows")
        return rows
    except (UnicodeError, csv.Error, StopIteration) as exc:
        raise ValueError("Malformed UTF-8 CSV") from exc


def adapt_versioned_csv(payload, manifest, profile, *, model, scenario, region,
                        requested_stage, required_species):
    """Preserve all stages, but refuse an incomplete selected-stage contract."""
    if requested_stage not in STAGES:
        raise ValueError("Unknown requested processing stage")
    known_species = {spec[0] for spec in SERIES.values()}
    if (not required_species or len(set(required_species)) != len(required_species) or
            not set(required_species) <= known_species):
        raise ValueError("Explicit unique known native species are required")
    rows = parse_versioned_csv(payload, manifest, profile)
    selected = [r for r in rows if (r["model"], r["scenario"], r["region"]) ==
                (model, scenario, region)]
    if not selected:
        raise ValueError("Requested model/scenario/region missing; no fallback")
    stages = {stage: {r["gas"]: r for r in selected if r["stage"] == stage} for stage in STAGES}
    missing = {stage: sorted(set(required_species) - set(series)) for stage, series in stages.items()}
    if missing[requested_stage]:
        raise ValueError(f"Missing native species in {requested_stage}; no stage borrowing: {missing[requested_stage]}")
    return {
        "status": "synthetic-structural-test-only" if profile.synthetic else "validated-source-structure-only",
        "scientificAcceptance": "not-promoted", "productionPairAccepted": False,
        "provenance": manifest_for_profile(profile),
        "model": model, "scenario": scenario, "region": region,
        "requestedStage": requested_stage, "stages": stages, "missingSpeciesByStage": missing,
        "limitations": [
            "Native source structure is not inventory harmonization or scientific validation.",
            "Published harmonized/infilled series are kept separate; no species is invented.",
            "NDCs cannot stand for all announced commitments or long-term pledges.",
            "No actual Phase VI release, licence review, or acceptance is demonstrated.",
        ],
    }

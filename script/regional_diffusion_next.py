"""S04-001 source-readiness audit; its audit entry point never calls fitting.

Run with uv run python script/regional_diffusion_next.py.
Private source rows remain in generated-artifacts; only aggregate audit receipts
are publishable. A ceiling is not inferred from observed maxima or scenarios.
"""
import csv
import hashlib
import json
import math
from pathlib import Path
from driver_calibration import fit

ROOT = Path("generated-artifacts/driver-calibration")
ENTITIES = ("World", "United States", "China", "India", "European Union (27)")
TECHNOLOGIES = ("solar_share_elec", "wind_share_elec")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def qualify_prior(prior, entity, technology):
    """Reject unavailable/incompatible K evidence, never invent a fallback."""
    problems = []
    for key in ("url", "sourceVersion", "publicationDate", "locator", "sha256",
                "rights", "empiricalIdentification", "independenceFromHoldout"):
        if not prior.get(key):
            problems.append("missing:" + key)
    if prior.get("entity") != entity:
        problems.append("geography-mismatch")
    if prior.get("technology") != technology:
        problems.append("technology-mismatch")
    if prior.get("unit") != "fraction-of-total-electricity-generation":
        problems.append("not-generation-share")
    if prior.get("kind") != "independently-identified-long-run-saturation":
        problems.append("not-identified-saturation")
    k = prior.get("saturation")
    if isinstance(k, bool) or not isinstance(k, (int, float)) or not math.isfinite(k) or not 0 < k <= 1:
        problems.append("invalid-or-unavailable-K")
    # Original protocol explicitly permits revised-history diagnostics.
    # Publication after the training cutoff must not masquerade as vintage evidence.
    return {"eligible": not problems, "reasons": problems,
            "originalVintageEligible": not problems and prior["publicationDate"] <= "2018-12-31"}


def assemble(rows, entity, technology):
    selected = {}
    for row in rows:
        if row["country"] != entity:
            continue
        year = int(row["year"])
        if year not in range(2010, 2025):
            continue
        if year in selected:
            raise ValueError(f"Duplicate entity/year: {entity}/{year}")
        selected[year] = row
    available, invalid, denominator_missing, deltas = [], [], [], []
    generation = technology.replace("_share_elec", "_electricity")
    for year, row in sorted(selected.items()):
        if row.get(technology) in ("", None):
            continue
        share = float(row[technology]) / 100
        if not math.isfinite(share) or not 0 <= share <= 1:
            invalid.append(year)
            continue
        available.append((year, share))
        if not row.get("electricity_generation") or not row.get(generation):
            denominator_missing.append(year)
            continue
        total, numerator = float(row["electricity_generation"]), float(row[generation])
        if not math.isfinite(total) or total <= 0 or not math.isfinite(numerator) or numerator < 0:
            invalid.append(year)
        else:
            deltas.append(abs(100 * share - 100 * numerator / total))
    training = [(y, v) for y, v in available if y <= 2018 and 0 < v < 1]
    evaluation = [y for y, _ in available if y >= 2019]
    complete = len(training) >= 6 and set(evaluation) == set(range(2019, 2025)) and not invalid
    return {
        "entity": entity, "technology": technology, "unit": "fraction-of-total-electricity-generation",
        "trainingCountStrictInterior": len(training), "evaluationCount": len(evaluation),
        "missingYears": sorted(set(range(2010, 2025)) - {y for y, _ in available}),
        "invalidYears": invalid, "denominatorMissingYears": denominator_missing,
        "maxDenominatorReconstructionDifferencePercentagePoints": max(deltas) if deltas else None,
        "fullWindowRowsQualified": complete,
    }


def evaluate_qualified(rows, prior, entity, technology, specification):
    """Optional future sourced-K diagnostic, blocked in this increment.

    Requires a distinct pre-fit specification receipt; never chooses K by heldout
    error. Source-gate eligibility is not scientific acceptance or owner approval.
    Training-only transformation is log(y/(K-y)); predictions are K*expit(a+bt).
    No new bootstrap distribution is asserted by this point diagnostic.
    """
    gate = qualify_prior(prior, entity, technology)
    if not gate["eligible"]:
        return {"status": "blocked-source", "gate": gate, "fitExecuted": False}
    if (not specification.get("frozenBeforeFitting")
            or specification.get("sourceSha256") != prior["sha256"]
            or specification.get("training") != [2010, 2018]
            or specification.get("evaluation") != [2019, 2024]
            or specification.get("saturation") != prior["saturation"]):
        return {"status": "blocked-prefit-specification", "fitExecuted": False}
    years = [y for y, _ in rows]
    if len(years) != len(set(years)):
        raise ValueError("Duplicate annual observations")
    if any(not math.isfinite(v) or not 0 <= v <= 1 for _, v in rows):
        raise ValueError("Nonfinite/out-of-range generation share")
    k = prior["saturation"]
    training = sorted((y - 2010, v) for y, v in rows if 2010 <= y <= 2018 and 0 < v < 1)
    heldout = sorted((y - 2010, v) for y, v in rows if 2019 <= y <= 2024)
    if len(training) < 6 or {x for x, _ in heldout} != set(range(9, 15)):
        return {"status": "unavailable-full-window", "fitExecuted": False}
    if any(v >= k for _, v in training):
        return {"status": "blocked-training-share-exceeds-sourced-K", "fitExecuted": False}
    # No inspection of heldout maxima to tune or select saturation.
    a, b = fit([(x, math.log(v / (k - v))) for x, v in training])
    linear_a, linear_b = fit(training)
    errors = {"logistic": [], "persistence": [], "linearTrend": []}
    for x, observed in heldout:
        predictions = {
            "logistic": k / (1 + math.exp(max(-700, min(700, -(a + b * x))))),
            "persistence": training[-1][1],
            "linearTrend": max(0, min(1, linear_a + linear_b * x)),
        }
        for name, prediction in predictions.items():
            errors[name].append(100 * abs(prediction - observed))
    mae = {name: sum(values) / 6 for name, values in errors.items()}
    return {"status": "revised-history-point-diagnostic", "fitExecuted": True,
            "parameters": {"intercept": a, "slope": b, "saturation": k},
            "maePercentagePoints": mae,
            "beatsBothBaselines": mae["logistic"] < min(mae["persistence"], mae["linearTrend"]),
            "centralEligible": False,
            "limitations": ["Point fit only; source/structural/dependence uncertainty still required",
                            "No source-gate or metric result grants scientific acceptance"]}


def audit():
    with (ROOT / "owid-energy-data.csv").open() as source:
        rows = list(csv.DictReader(source))
    with (ROOT / "catalog-owid_energy.codebook.csv").open() as source:
        codebook = {r["column"]: r for r in csv.DictReader(source)}
    with (ROOT / "catalog-owid_energy.sources.csv").open() as source:
        source_metadata = list(csv.DictReader(source))
    with (ROOT / "catalog-column_mapping.csv").open() as source:
        mapping = {r["previous_column"]: r["column"] for r in csv.DictReader(source)}
    with (ROOT / "catalog-owid_energy.csv").open() as source:
        replacement_rows = list(csv.DictReader(source))
    # Publisher-supplied name mapping only. Never splice the two releases.
    normalized_replacement = []
    for row in replacement_rows:
        if row["country"] not in ENTITIES or int(row["year"]) not in range(2010, 2025):
            continue
        converted = dict(row)
        for old in (*TECHNOLOGIES, "solar_electricity", "wind_electricity", "electricity_generation"):
            if old not in mapping:
                raise ValueError("Publisher mapping missing required column: " + old)
            converted[old] = row[mapping[old]]
        normalized_replacement.append(converted)
    retained = json.loads((ROOT / "result.json").read_text())
    if digest(ROOT / "owid-energy-data.csv") != retained["sourceSha256"]:
        raise ValueError("Retained source hash mismatch; no audit admitted")
    candidates = []
    for entity in ENTITIES:
        for tech in TECHNOLOGIES:
            result = assemble(rows, entity, tech)
            revised = assemble(normalized_replacement, entity, tech)
            original_values = {int(r["year"]): float(r[tech]) for r in rows
                               if r["country"] == entity and r.get(tech) not in ("", None)
                               and int(r["year"]) in range(2010, 2025)}
            revised_values = {int(r["year"]): float(r[tech]) for r in normalized_replacement
                              if r["country"] == entity and r.get(tech) not in ("", None)}
            common = sorted(original_values.keys() & revised_values.keys())
            old = next(r for r in retained["results"] if r["entity"] == entity and r["technology"] == tech)
            result.update({
                "retainedBeatsBothBaselines": old["beatsBothBaselines"],
                "retainedMAEPercentagePoints": old["maePercentagePoints"],
                "newFitExecuted": False, "centralEligible": False,
                "decision": "Do not rerun unchanged known study; independently sourced regional saturation remains missing",
                "saturationGate": qualify_prior({}, entity, tech),
                "separateReplacementAudit": revised,
                "pairedReleaseObservations": len(common),
                "maxAbsoluteReleaseRevisionPercentagePoints": max(
                    (abs(original_values[y] - revised_values[y]) for y in common), default=None),
            })
            candidates.append(result)
    return {
        "version": "regional-diffusion-readiness-1",
        "sourceHash": retained["sourceSha256"],
        "sourceVersion": "Exact retained OWID legacy snapshot identified by hash; immutable publisher commit/date not established",
        "publicationDate": None,
        "catalogWarning": "Catalog is a separately hashed 2026 replacement; its source dates are NOT imputed to legacy bytes",
        "catalogCodebook": {k: codebook[mapping[k]] for k in TECHNOLOGIES},
        "publisherColumnMapping": {k: mapping[k] for k in TECHNOLOGIES},
        "privateInventoryHashes": {name: digest(ROOT / name) for name in (
            "owid-energy-data.csv", "catalog-owid_energy.csv", "catalog-column_mapping.csv",
            "catalog-owid_energy.codebook.csv", "catalog-owid_energy.sources.csv",
            "result.json", "uncertainty.json")},
        "catalogSourceMetadata": [s for s in source_metadata if "Ember" in s["label"]],
        "catalogRightsDecision": "No underlying-series redistribution licence authenticated here; no raw rows exported",
        "window": {"training": [2010, 2018], "evaluation": [2019, 2024]},
        "threshold": "Original logistic MAE strictly below persistence AND bounded linear trend over six complete years",
        "bootstrap": {"replications": 1000, "blockLength": 3, "seed": 20261108,
                      "decision": "Retained paired uncertainty untouched; no bootstrap rerun"},
        "candidates": candidates,
        "fitCount": 0,
    }


if __name__ == "__main__":
    print(json.dumps(audit(), indent=2))

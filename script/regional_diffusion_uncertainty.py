"""Prospective S04-001 uncertainty engine, not a new efficacy execution.

Default CLI emits blocked readiness only. No source acquisition or private writes.
The original point evaluator and retained K=1 results are not changed or rerun.
"""
import hashlib
import json
import math
import random
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

from driver_calibration import fit
from driver_uncertainty import logistic, quantile
from regional_diffusion_next import ENTITIES, TECHNOLOGIES, evaluate_qualified, qualify_prior

EVIDENCE = Path("docs/regional-diffusion-uncertainty-evidence.json")
FAMILY = tuple((entity, technology) for entity in ENTITIES for technology in TECHNOLOGIES)
TRAIN = tuple(range(2010, 2019))
HOLDOUT = tuple(range(2019, 2025))
REPLICATIONS, BLOCK, SEED = 1000, 3, 20261108


def fingerprint(value):
    """Canonical JSON input binding; never hash only mutable source URLs."""
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"),
                                     allow_nan=False).encode()).hexdigest()


def cell_id(entity, technology):
    return entity + "|" + technology


def finite(value):
    return not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value)


def full_window(rows):
    """Stricter prospective complete-nine-year gate, not an old eligibility edit."""
    years = [year for year, _ in rows]
    if len(years) != len(set(years)):
        raise ValueError("Duplicate annual observations")
    if any(not isinstance(year, int) or isinstance(year, bool) or not finite(value)
           or not 0 <= value <= 1 for year, value in rows):
        raise ValueError("Invalid year or nonfinite/out-of-range share")
    selected = dict(rows)
    return (all(year in selected and 0 < selected[year] < 1 for year in TRAIN)
            and all(year in selected for year in HOLDOUT))


def qualified_record(record, engineering=False):
    """Validate explicit reviewed evidence and authenticate privately retained bytes.

    This is a fail-closed evidence contract, not automated scientific peer review.
    A populated manifest alone is not proof of independence or identification.
    """
    reasons = []
    for key in ("url", "sourceVersion", "publicationDate", "locator", "sha256", "rights",
                "empiricalIdentification", "independenceFromHoldout", "artifactPath",
                "reviewer", "reviewReceipt"):
        if not record.get(key):
            reasons.append("missing:" + key)
    if record.get("qualification") != "independently-reviewed-qualified":
        reasons.append("independent-review-not-qualified")
    try:
        date.fromisoformat(record.get("publicationDate", ""))
    except (TypeError, ValueError):
        reasons.append("invalid-publication-date")
    parsed = urlparse(record.get("url", ""))
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        reasons.append("invalid-source-url")
    if not engineering and (record.get("engineeringFixture")
                            or (parsed.hostname or "").endswith((".invalid", ".example"))):
        reasons.append("engineering-source-forbidden")
    sha = record.get("sha256", "")
    if not isinstance(sha, str) or len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
        reasons.append("invalid-source-hash")
    path = Path(record.get("artifactPath") or "__absent_source__")
    if not path.is_file():
        reasons.append("source-bytes-unavailable")
    elif hashlib.sha256(path.read_bytes()).hexdigest() != sha:
        reasons.append("source-hash-mismatch")
    return reasons


def input_binding(data, priors, bundle, retained_results):
    return fingerprint({"data": data, "priors": priors, "bundle": bundle,
                        "originalFailureHistory": retained_results})


def frozen_specification(specification, data, priors, bundle, retained_results):
    freeze = json.loads(EVIDENCE.read_text())["operationalFreeze"]
    return (specification.get("frozenBeforeFitting") is True
            and specification.get("operationalFreezeSha256") == fingerprint(freeze)
            and specification.get("inputsSha256") == input_binding(data, priors, bundle, retained_results)
            and specification.get("training") == [2010, 2018]
            and specification.get("evaluation") == [2019, 2024]
            and bool(specification.get("freezeReceipt")))


def joint_source_gate(bundle, priors, ids, engineering=False):
    """Require complete authored joint draws, not assembled marginal intervals.

    Training-share revisions, saturation and future structural offsets remain
    inseparable within each source draw. No heldout share is a draw input.
    """
    problems = qualified_record(bundle, engineering)
    for key in ("jointDependenceIdentification", "sourceRevisionIdentification",
                "structuralIdentification", "samplingLawIdentification"):
        if not bundle.get(key):
            problems.append("missing:" + key)
    if bundle.get("samplingLaw") != "uniform-authored-empirical-joint-draws":
        problems.append("unsupported-or-unidentified-sampling-law")
    if bundle.get("trainingYears") != list(TRAIN) or bundle.get("predictionYears") != list(HOLDOUT):
        problems.append("joint-source-period-mismatch")
    # Numeric joint draws must themselves occur in authenticated retained bytes.
    # A hash of an unrelated paper is not provenance for invented draw arrays.
    payload = {key: bundle.get(key) for key in
               ("trainingYears", "predictionYears", "samplingLaw", "draws")}
    try:
        authenticated = json.loads(Path(bundle["artifactPath"]).read_text())
        if any(authenticated.get(key) != value for key, value in payload.items()):
            problems.append("joint-draws-not-in-authenticated-source")
    except (KeyError, OSError, ValueError, UnicodeError, AttributeError):
        problems.append("authenticated-machine-readable-joint-draws-unavailable")
    draws = bundle.get("draws")
    if not isinstance(draws, list) or len(draws) < 2:
        return problems + ["joint-draws-unavailable"]
    draw_ids = []
    for draw in draws:
        draw_ids.append(draw.get("drawId"))
        cells = draw.get("cells", {})
        if set(cells) != set(ids):
            problems.append("joint-draw-family-mismatch")
            continue
        for key in ids:
            cell = cells[key]
            k = cell.get("saturation")
            shares = cell.get("trainingShares", [])
            offsets = cell.get("structuralLogitOffsets", [])
            if (not finite(k) or not 0 < k <= 1 or len(shares) != 9
                    or any(not finite(v) or not 0 < v < k for v in shares)):
                problems.append("invalid-joint-training-or-saturation:" + key)
            if len(offsets) != 6 or any(not finite(v) for v in offsets):
                problems.append("missing-or-invalid-structural-path:" + key)
            if cell.get("priorSha256") != priors[key]["sha256"]:
                problems.append("joint-prior-binding-mismatch:" + key)
    if any(not value for value in draw_ids) or len(set(draw_ids)) != len(draw_ids):
        problems.append("missing-or-duplicate-joint-draw-id")
    return sorted(set(problems))


def circular_indices(rng, length):
    indices = []
    while len(indices) < length:
        start = rng.randrange(length)
        indices.extend((start + offset) % length for offset in range(BLOCK))
    return indices[:length]


def residual_fit(shares, saturation):
    train = [(i, math.log(value / (saturation - value))) for i, value in enumerate(shares)]
    a, b = fit(train)
    residuals = [value - a - b * x for x, value in train]
    center = sum(residuals) / len(residuals)
    return a, b, [value - center for value in residuals], train


def refit_block(model, indices):
    a, b, residuals, _ = model
    return fit([(i, a + b * i + residuals[j]) for i, j in enumerate(indices)])


def paired_errors(rows, point):
    values = dict(rows)
    train = [(year - 2010, values[year]) for year in TRAIN]
    la, lb = fit(train)
    a = point["parameters"]["intercept"]
    b = point["parameters"]["slope"]
    k = point["parameters"]["saturation"]
    return {name: [
        100 * (abs(k * logistic(a + b * (year - 2010)) - values[year])
               - abs((values[2018] if name == "persistence"
                      else max(0, min(1, la + lb * (year - 2010)))) - values[year]))
        for year in HOLDOUT] for name in ("persistence", "linearTrend")}


def paired_null_p(differences, indices):
    """Approximate centered paired-loss block test, H1 mean difference < 0."""
    observed = sum(differences) / 6
    centered = [value - observed for value in differences]
    return (1 + sum(sum(centered[j] for j in sample) / 6 <= observed
                    for sample in indices)) / (len(indices) + 1)


def fixed_family(results):
    """Intersection-union across two baselines, then Holm across ALL ten cells."""
    entries = []
    for entity, technology in FAMILY:
        key = cell_id(entity, technology)
        result = results.get(key, {})
        pvalues = result.get("baselinePValues", {})
        if (not set(pvalues) <= {"persistence", "linearTrend"}
                or any(not finite(p) or not 0 <= p <= 1 for p in pvalues.values())):
            raise ValueError("Invalid baseline p-values")
        available = (set(pvalues) == {"persistence", "linearTrend"}
                     and all(finite(p) and 0 <= p <= 1 for p in pvalues.values()))
        entries.append({"id": key, "available": available,
                        "p": max(pvalues.values()) if available else 1.0})
    running = 0.0
    for rank, entry in enumerate(sorted(entries, key=lambda item: (item["p"], item["id"]))):
        running = max(running, min(1, (10 - rank) * entry["p"]))
        entry["holmAdjustedP"] = running
        entry["supplementalReject"] = bool(entry["available"] and running <= .05)
    return entries


def intervals(paths, observed):
    output = []
    for i, year in enumerate(HOLDOUT):
        lower, median, upper = [quantile([path[i] for path in paths], p)
                                for p in (.025, .5, .975)]
        output.append({"year": year, "lower": lower, "median": median, "upper": upper,
                       "covered": lower <= observed[year] <= upper})
    return output


def evaluate_joint(data, priors, bundle, specification, retained_results, engineering=False):
    """Source-gated future execution. Does not mutate or promote original results.

    Inputs keyed by cell_id. Qualified subsets allowed, but the family stays ten.
    Private paired draws are returned to the caller, not printed by this CLI.
    """
    report = {"status": "UNEXECUTED", "fitCount": 0, "bootstrapReplications": 0,
              "centralEligible": False, "scientificAccepted": False,
              "ownerApproved": False, "engineeringOnly": engineering, "results": {},
              "gates": {}, "family": fixed_family({})}
    if not frozen_specification(specification, data, priors, bundle, retained_results):
        report["block"] = "missing-or-mismatched-prefit-input-freeze"
        return report
    valid_ids = {cell_id(e, t) for e, t in FAMILY}
    if (not set(data) <= valid_ids or not set(priors) <= valid_ids
            or not set(retained_results) <= valid_ids):
        raise ValueError("Unknown entity/technology; frozen family cannot expand")
    qualified = []
    for entity, technology in FAMILY:
        key = cell_id(entity, technology)
        prior = priors.get(key, {})
        reasons = qualify_prior(prior, entity, technology)["reasons"]
        reasons += qualified_record(prior, engineering)
        if not full_window(data.get(key, [])):
            reasons.append("unavailable-full-nine-train-six-holdout")
        elif prior.get("saturation") is not None and finite(prior["saturation"]):
            if any(value >= prior["saturation"] for year, value in data[key] if year in TRAIN):
                reasons.append("training-share-exceeds-sourced-K")
        old = retained_results.get(key)
        if not isinstance(old, dict) or not isinstance(old.get("beatsBothBaselines"), bool):
            reasons.append("missing-original-failure-history")
        elif not engineering and old["beatsBothBaselines"] != (
                entity == "European Union (27)" and technology == "solar_share_elec"):
            reasons.append("original-nine-failures-EU-solar-point-win-must-remain")
        report["gates"][key] = {"eligible": not reasons, "reasons": sorted(set(reasons))}
        if not reasons:
            qualified.append(key)
    if not qualified:
        report["block"] = "no-qualified-regional-saturation-and-full-window"
        return report
    joint_problems = joint_source_gate(bundle, priors, qualified, engineering)
    if joint_problems:
        report["block"] = "unqualified-joint-source-structural-dependence"
        report["jointReasons"] = joint_problems
        return report
    # Separate deterministic streams avoid accidental marginal parameter pairing.
    rng = random.Random(SEED)
    schedules = [(circular_indices(rng, 9), rng.randrange(len(bundle["draws"])))
                 for _ in range(REPLICATIONS)]
    loss_rng = random.Random(SEED)
    loss_indices = [circular_indices(loss_rng, 6) for _ in range(REPLICATIONS)]
    for entity, technology in FAMILY:
        key = cell_id(entity, technology)
        if key not in qualified:
            continue
        rows, prior = data[key], priors[key]
        point = evaluate_qualified(rows, prior, entity, technology, {
            "frozenBeforeFitting": True, "sourceSha256": prior["sha256"],
            "training": [2010, 2018], "evaluation": [2019, 2024],
            "saturation": prior["saturation"]})
        if not point["fitExecuted"]:
            raise ValueError("Qualified point fit unexpectedly blocked")
        values = dict(rows)
        base = residual_fit([values[year] for year in TRAIN], prior["saturation"])
        source_models = [
            residual_fit(draw["cells"][key]["trainingShares"], draw["cells"][key]["saturation"])
            for draw in bundle["draws"]]
        parameters, joint_parameters, parameter_paths, joint_paths = [], [], [], []
        for indices, source_index in schedules:
            aa, bb = refit_block(base, indices)
            parameters.append([aa, bb])
            parameter_paths.append([prior["saturation"] * logistic(aa + bb * (year - 2010))
                                    for year in HOLDOUT])
            source = bundle["draws"][source_index]["cells"][key]
            sa, sb = refit_block(source_models[source_index], indices)
            joint_parameters.append({"intercept": sa, "slope": sb,
                                     "saturation": source["saturation"],
                                     "sourceDrawId": bundle["draws"][source_index]["drawId"]})
            joint_paths.append([source["saturation"] * logistic(sa + sb * (year - 2010) + offset)
                                for year, offset in zip(HOLDOUT, source["structuralLogitOffsets"])])
        early, late = fit(base[3][:5])[1], fit(base[3][5:])[1]
        differences = paired_errors(rows, point)
        pvalues = {name: paired_null_p(values_, loss_indices)
                   for name, values_ in differences.items()}
        pi, ji = intervals(parameter_paths, values), intervals(joint_paths, values)
        report["results"][key] = {
            "point": point, "originalBeatsBothBaselines": retained_results[key]["beatsBothBaselines"],
            "originalFailureRetained": not retained_results[key]["beatsBothBaselines"],
            "pairedBootstrapParameters": parameters, "jointParameterDraws": joint_parameters,
            "parameterIntervals": {name: [quantile([p[i] for p in parameters], q)
                                          for q in (.025, .5, .975)]
                                   for i, name in enumerate(("intercept", "slope"))},
            "parameterOnlyIntervals": pi, "jointSourceStructuralIntervals": ji,
            "parameterIntervalCoverage": sum(x["covered"] for x in pi) / 6,
            "jointIntervalCoverage": sum(x["covered"] for x in ji) / 6,
            "trainingSlopeStability": {"early": early, "late": late, "difference": late - early},
            "baselinePValues": pvalues, "centralEligible": False,
            "originalVintageEligible": qualify_prior(prior, entity, technology)["originalVintageEligible"]
                                      and bundle["publicationDate"] <= "2018-12-31",
        }
        report["fitCount"] += 1
    report.update(status="engineering-fixtures-only" if engineering else "source-qualified-revised-history-diagnostic",
                  bootstrapReplications=REPLICATIONS, blockLength=BLOCK, seed=SEED,
                  family=fixed_family(report["results"]),
                  uncertaintyMeaning="Source-qualified conditional joint uncertainty, not full process-noise prediction",
                  limitations=["Source qualification requires independent substantive review, not just schema validity",
                               "Six heldout years imply low-power approximate block inference",
                               "Neither new diagnostics nor a former point win erase original failures or grant promotion"])
    return report


def readiness():
    """No actual rows, refits, bootstraps or heldout scores read/executed."""
    return {"status": "UNEXECUTED", "fitCount": 0, "bootstrapReplications": 0,
            "qualifiedSaturationPriors": 0, "qualifiedJointSources": 0,
            "block": "No authenticated regional saturation or joint source/structural/dependence bundle supplied",
            "operationalFreezeSha256": fingerprint(json.loads(EVIDENCE.read_text())["operationalFreeze"]),
            "family": fixed_family({}), "centralEligible": False, "ownerApproved": False}


if __name__ == "__main__":
    print(json.dumps(readiness(), indent=2))

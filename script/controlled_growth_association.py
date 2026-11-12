"""S13-006 prospective conditional association. No private files, provider or DB access.

The locked protocol plus frozen sample are required inputs. No automatic model selection,
imputation, winsorization, refit of existing studies, or causal interpretation.
"""
import hashlib
import json
import re
import sys
import copy
from datetime import datetime
from pathlib import Path
import numpy as np
import scipy
from scipy.stats import t as student_t

PROTOCOL_PATH = Path(__file__).resolve().parents[1] / "docs/controlled-association-protocol-v2.json"
MODEL_SHA256 = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
LOCK_SHA256 = hashlib.sha256((Path(__file__).resolve().parents[1] / "uv.lock").read_bytes()).hexdigest()
CONTROLS = ("logMarketCapUsd", "operatingProfitOverAssets", "capexOverRevenue",
            "commodityRevenueShare", "netDebtOverAssets", "pastThreeYearRevenueCagr")


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def instant(value):
    result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if result.tzinfo is None:
        raise ValueError("Timezone required")
    return result


def estimate(manifest, records):
    manifest, records = copy.deepcopy(manifest), copy.deepcopy(records)
    protocol = json.loads(PROTOCOL_PATH.read_text())
    if manifest["protocolHash"] != digest(protocol):
        raise ValueError("Protocol hash mismatch")
    if manifest["definitions"] != protocol["definitions"]:
        raise ValueError("Dependent/exposure/control definitions differ from frozen protocol")
    if instant(manifest["frozenAt"]) < instant(protocol["declaredAt"]):
        raise ValueError("Backdated specification")
    if instant(manifest["frozenAt"]) > instant(manifest["estimationAt"]):
        raise ValueError("Specification not frozen before estimation")
    cutoff = instant(manifest["cutoff"])
    ids = manifest["issuerIds"]
    if not ids or len(set(ids)) != len(ids):
        raise ValueError("Empty/duplicate frozen population")
    if len({r["issuerId"] for r in records}) != len(records) or any(r["issuerId"] not in ids for r in records):
        raise ValueError("Duplicate/unexpected observation")
    for category in ("sector", "operatingRegion"):
        levels = manifest["levels"][category]
        if not levels or len(set(levels)) != len(levels):
            raise ValueError("Invalid fixed category levels")
    cols = ["intercept", "transitionExposure", *CONTROLS]
    cols += [f"{cat}:{level}" for cat in ("sector", "operatingRegion") for level in manifest["levels"][cat][1:]]
    by_id = {r["issuerId"]: r for r in records}
    included, excluded, x, y = [], [], [], []
    numeric = ("impliedGrowth", "transitionExposure", *CONTROLS)
    for issuer in ids:
        r = by_id.get(issuer)
        reasons = []
        if r is None:
            excluded.append({"issuerId": issuer, "reasons": ["missing retained observation"]})
            continue
        if r.get("identityStatus") != "accepted":
            reasons.append("exact identity not accepted")
        if r.get("basis") != "steady-state-earnings-Gordon-annual-fraction" or r.get("solverSettingsId") != manifest["solverSettingsId"]:
            reasons.append("dependent-variable basis/settings mismatch")
        if r.get("originalRestated") not in ("original", "restated-disclosed"):
            reasons.append("unknown filing provenance")
        if r.get("observationAt") != manifest["cutoff"]:
            reasons.append("observation cutoff mismatch")
        for field in numeric:
            cell = r.get("fields", {}).get(field)
            if not isinstance(cell, dict) or not isinstance(cell.get("value"), (int, float)) or isinstance(cell.get("value"),bool) or not np.isfinite(cell["value"]):
                reasons.append(f"{field}: missing/nonfinite value")
                continue
            try:
                if instant(cell["publishedAt"]) > cutoff:
                    reasons.append(f"{field}: future source")
                if instant(cell["periodEnd"]) > cutoff:
                    reasons.append(f"{field}: future period")
                if cell["definition"] != manifest["definitions"][field] or not re.fullmatch(r"[0-9a-f]{64}",cell["sourceHash"]) or not cell["locator"]:
                    reasons.append(f"{field}: unbound definition/source")
            except (KeyError, ValueError, TypeError):
                reasons.append(f"{field}: unknown source/period")
        for cat in ("sector", "operatingRegion"):
            if r.get(cat) not in manifest["levels"][cat]:
                reasons.append(f"{cat}: missing/outside frozen levels")
            evidence = r.get("categoryEvidence", {}).get(cat, {})
            try:
                if instant(evidence["publishedAt"]) > cutoff or not re.fullmatch(r"[0-9a-f]{64}",evidence["sourceHash"]) or not evidence["locator"]:
                    reasons.append(f"{cat}: invalid evidence")
            except (KeyError, TypeError, ValueError):
                reasons.append(f"{cat}: missing dated evidence")
        if not reasons:
            vals = r["fields"]
            if vals["transitionExposure"]["value"] < 0 or not 0 <= vals["commodityRevenueShare"]["value"] <= 1 or vals["capexOverRevenue"]["value"] < 0 or vals["pastThreeYearRevenueCagr"]["value"] <= -1:
                reasons.append("invalid physical/share/capex domain")
            periods = {vals[k]["periodEnd"] for k in numeric if k not in ("impliedGrowth", "logMarketCapUsd")}
            if len(periods) != 1:
                reasons.append("incompatible fiscal periods")
        if reasons:
            excluded.append({"issuerId": issuer, "reasons": reasons})
            continue
        vals = r["fields"]
        row = [1., vals["transitionExposure"]["value"], *(vals[k]["value"] for k in CONTROLS)]
        row += [float(r[cat] == level) for cat in ("sector", "operatingRegion") for level in manifest["levels"][cat][1:]]
        x.append(row); y.append(vals["impliedGrowth"]["value"]); included.append(issuer)
    n, p = len(y), len(cols)
    result = {"claim": protocol["association"]["claim"], "manifestHash": digest(manifest),
              "modelCodeSha256": MODEL_SHA256, "dependencyLockSha256": LOCK_SHA256,
              "runtime": {"python": sys.version, "numpy": np.__version__, "scipy": scipy.__version__},
              "freezeMeaning": "Declared snapshot and protocol, not independently authenticated historical timestamp or review",
              "inputHash": digest(records), "protocolHash": digest(protocol),
              "population": len(ids), "included": included, "excluded": excluded,
              "n": n, "p": p, "coverage": n/len(ids), "coefficients": None}
    if n < max(30, 3*p):
        return {**result, "status": "unavailable", "reason": "insufficient complete frozen observations"}
    X, Y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
    means, scales = X[:, 1:].mean(axis=0), X[:, 1:].std(axis=0)
    if np.any(scales == 0):
        return {**result, "status": "unavailable", "reason": "constant control/exposure/category"}
    Z = X.copy(); Z[:, 1:] = (X[:, 1:] - means)/scales
    rank, condition = int(np.linalg.matrix_rank(Z)), float(np.linalg.cond(Z))
    result.update(rank=rank, conditionNumber=condition)
    if rank != p or condition > 1e8:
        return {**result, "status": "unavailable", "reason": "rank deficient or ill-conditioned design"}
    inv = np.linalg.inv(Z.T @ Z)
    b = np.linalg.lstsq(Z, Y, rcond=None)[0]
    residual = Y - Z @ b
    leverage = np.einsum("ij,jk,ik->i", Z, inv, Z)
    if np.any(leverage >= 1-1e-10):
        return {**result, "status": "unavailable", "reason": "HC3 leverage singularity"}
    meat = Z.T @ (Z * (residual/(1-leverage))[:, None]**2)
    covariance = inv @ meat @ inv
    transform = np.diag(np.r_[1., 1/scales]); transform[0, 1:] = -means/scales
    beta = transform @ b; covariance = transform @ covariance @ transform.T
    se = np.sqrt(np.maximum(0, np.diag(covariance)))
    df = n-p; critical = float(student_t.ppf(.975, df))
    sse, sst = float(residual @ residual), float(np.sum((Y-Y.mean())**2))
    r2 = None if sst == 0 else 1-sse/sst
    return {**result, "status": "conditional-association", "df": df,
            "coefficients": [{"name": name, "estimate": float(beta[i]), "hc3SE": float(se[i]),
                              "lower95": float(beta[i]-critical*se[i]), "upper95": float(beta[i]+critical*se[i])}
                             for i, name in enumerate(cols)],
            "covariance": covariance.tolist(), "residuals": residual.tolist(),
            "leverage": leverage.tolist(), "r2": r2,
            "adjustedR2": None if r2 is None else 1-(1-r2)*(n-1)/df,
            "intervalMeaning": "Approximate HC3 Student-t conditional intervals, not causal or predictive acceptance"}

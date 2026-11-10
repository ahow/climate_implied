"""Supplementary forcing bookkeeping; never changes the frozen history protocol."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
import xarray as xr
from reconcile_igcc_history import ERF, GMST, digest


def human_warming_reference_contract():
    """Fixed actual-source contract; callers cannot redefine GMST as GSAT."""
    return {"annualYear": 2025, "annualHumanWarmingC": 1.37,
            "annualDefinition": "SR1.5",
            "distinctAnnualDefinitionHumanWarmingC": 1.38,
            "meanYears": [2016, 2025], "meanHumanWarmingC": 1.24,
            "meanRangeC": [1.0, 1.5],
            "referenceObservable": "human-induced GMST",
            "baseline": "1850-1900 inclusive", "unit": "degC anomaly",
            "source": {
                "repository": "ClimateIndicator/data",
                "revision": "d9726573dccd9381652432b58b38f670af493c1c",
                "version": "IGCC-2025a",
                "path": "data/base/anthropogenic_warming/Assessment-Update-2025_GMST_headlines.csv",
                "sha256": "d419c3f7d513b42052f5635454853610739d8b5f1749f55b5df03862dfe28879",
                "standardizedSha256": "da1641bc9d57b7129c1c7742935c646754ec250632f9d291c5287d4b2a9bc9fc",
                "metadataSha256": "875c60fa3609ff1e1af6964fd3061d0bb69cea927cc97fa9576f79263dec75da",
                "metadataDateCreated": "2026-07-22T10:13:14Z",
                "retrievedAtUTC": "2026-11-10T12:09:00.306870+00:00",
                "license": "CC-BY-4.0",
                "reference": "Forster et al. (2026), section 8, doi:10.5194/essd-18-3889-2026",
                "annualRowNotes": "SR15 definition",
                "annualTimeBoundsHalfOpen": [2025, 2026],
                "meanTimeBoundsHalfOpen": [2016, 2026]}}


def human_warming_check(annual=None, observable=None, baseline=None, reference_observable=None):
    """No verified attributed-model artifact is available to this adapter.

    Raw arrays plus caller-supplied observable labels cannot establish attribution,
    the GMST observable, or the SR1.5 definition. Keep the actual model comparison
    unavailable even when both caller strings claim GMST (or claim matching GSAT).
    """
    references = human_warming_reference_contract()
    unavailable = {"references": references, "status": "unavailable",
                   "shareMeanMembersInRange": None, "centralEligible": False,
                   "actualMemberComparisonPerformed": False,
                   "callerObservableClaimsAreIndependentVerification": False}
    if observable not in (None, references["referenceObservable"]) or reference_observable not in (None, references["referenceObservable"]):
        return {**unavailable, "reason": "Pinned actual reference is human-induced GMST with the SR1.5 annual definition, not GSAT or total temperature; caller reference labels cannot override it and no conversion is assumed"}
    if baseline not in (None, references["baseline"]):
        return {**unavailable, "reason": "Pinned reference baseline is 1850-1900 inclusive; caller labels do not verify a model baseline"}
    if annual is None or any(y not in annual for y in range(2016, 2026)):
        return {**unavailable, "reason": "Actual 2016-2025 coordinates required; publication year is not observation year"}
    return {**unavailable, "reason": "No independently verified attributed-GMST model member artifact, SR1.5-definition reconciliation or memberwise baseline provenance exists in this adapter; caller strings and arrays are not evidence"}


def _conditional_human_warming_math(annual):
    """Fixture-only conditional arithmetic, never actual member acceptance.

    This helper is deliberately not called by human_warming_check. It tests the
    frozen interval arithmetic without implying that synthetic vectors establish
    attributed GMST, matched definitions, member provenance or calibrated odds.
    """
    if any(y not in annual for y in range(2016, 2026)):
        raise ValueError("Conditional arithmetic requires every 2016-2025 year")
    arrays = [np.asarray(annual[y], dtype=float) for y in range(2016, 2026)]
    if any(a.ndim != 1 or a.shape != arrays[0].shape or not a.size or not np.isfinite(a).all() for a in arrays):
        raise ValueError("Aligned finite conditional fixture vectors required")
    mean = np.mean(arrays, axis=0)
    lower, upper = human_warming_reference_contract()["meanRangeC"]
    return {"status": "conditional-math-only",
            "conditionalMedian2025C": float(np.median(arrays[-1])),
            "conditionalMedianMean2016to2025C": float(np.median(mean)),
            "conditionalShareMeanMembersInRange": float(np.mean((mean >= lower) & (mean <= upper))),
            "shareMeanMembersInRange": None, "actualMemberComparisonPerformed": False,
            "pointReferenceIsNotAcceptanceThreshold": True, "centralEligible": False}


def compare_forcing(data, reference):
    years = np.arange(1750, 2015)  # Preserve historical/SSP cutoff; no post-2014 history claim.
    if set(reference) != set(range(1750, 2025)):
        raise ValueError("Pinned 275-row ERF 1750-2024 history required")
    columns = set(reference[1750])
    if not {"solar", "volcanic", "aerosol-radiation_interactions", "aerosol-cloud_interactions"} <= columns:
        raise ValueError("Explicit IGCC natural and aerosol components required")
    observed = {}
    for year in reference:
        row = reference[year]
        if set(row) != columns or not np.isfinite(list(row.values())).all():
            raise ValueError("Invalid ERF components")
        natural = row["solar"] + row["volcanic"]
        observed[year] = {"total": sum(row.values()), "natural": natural,
                          "anthropogenic": sum(row.values())-natural,
                          "aerosol": row["aerosol-radiation_interactions"]+row["aerosol-cloud_interactions"]}
    results = {}
    for component in ("total", "natural", "anthropogenic", "aerosol"):
        actual = data[f"forcing_{component}_annual"].sel(year=years).transpose("year", "scenario", "config")
        if not np.isfinite(actual).all():
            raise ValueError("Nonfinite retained forcing")
        target = np.array([observed[int(y)][component] for y in years])
        median = actual.median("config").values
        delta = median-target[:, None]
        results[component] = {
            "unit": "W m-2", "years": [1750, 2014],
            "comparisonType": "raw aligned annual component difference, not an acceptance score",
            "scenarios": [{"scenario": str(s), "bias": float(delta[:, i].mean()),
                           "rmse": float(np.sqrt(np.mean(delta[:, i]**2))),
                           "maximumAbsoluteDifference": float(np.abs(delta[:, i]).max())}
                          for i, s in enumerate(actual.scenario.values)],
            "maximumScenarioMedianSpread": float(np.ptp(median, axis=1).max()),
            "igcc1750AsDelivered": observed[1750][component],
            "model1750AnnualMedianByScenario": median[0].tolist()}
    return {"components": results, "igccRows": len(reference),
            "timeConvention": "IGCC integer-labelled annual ERF versus FaIR boundary-pair annual mean",
            "baselineCompatibility": "Not established for natural terms; as-delivered references retained, no forced 1750 zero",
            "decomposition": "Natural=solar+volcanic; anthropogenic=all remaining terms; aerosol=ARI+ACI subset, not additive to anthropogenic",
            "speciesCompatibility": "Aggregate component classes only; species-by-species mapping, precursor chemistry and source-reference conventions remain unreconciled",
            "emissionsComparison": "Unavailable: pinned IGCC inputs here contain ERF and GMST, not compatible native-gas historical emissions",
            "gmstRows": 175,
            "humanWarming": human_warming_check(),
            "centralEligible": False, "annualReferenceGatePassed": False,
            "threshold": None, "frozenHistoryProtocolUnchanged": True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("manifest", help="Private physical-retention manifest")
    args = parser.parse_args()
    manifest = json.loads(Path(args.manifest).read_text())
    if digest(manifest["file"]) != manifest["sha256"]:
        raise ValueError("Retained physics hash mismatch")
    for path in (ERF, GMST):
        if digest(path) != path.stem:
            raise ValueError("Pinned IGCC source hash mismatch")
    with ERF.open(encoding="utf-8-sig") as stream:
        reference = {}
        for row in csv.DictReader(stream):
            year = int(row.pop(""))
            if year in reference:
                raise ValueError("Duplicate ERF year")
            reference[year] = {k: float(v) for k, v in row.items()}
    with GMST.open(encoding="utf-8-sig") as stream:
        gmst = list(csv.DictReader(stream))
    if [float(row["year"]) for row in gmst] != [y+.5 for y in range(1850, 2025)]:
        raise ValueError("Pinned 175-row GMST coordinates required")
    with xr.open_dataset(manifest["file"]) as data:
        result = compare_forcing(data, reference)
    result.update(sourceHashes={str(p): digest(p) for p in (ERF, GMST, Path(args.manifest))},
                  physicalSha256=manifest["sha256"], codeSha256=digest(__file__),
                  frozenProtocolSha256=digest("docs/IGCC_History_Reconciliation_Protocol.md"),
                  historyBasis="current-revision; original publication vintage not established")
    text = json.dumps(result, indent=2, allow_nan=False)+"\n"
    target = Path("generated-artifacts/igcc-history-reconciliation") / (hashlib.sha256(text.encode()).hexdigest()+".json")
    if not target.exists():
        target.write_text(text)
    print(text)
    print(target)


if __name__ == "__main__":
    main()

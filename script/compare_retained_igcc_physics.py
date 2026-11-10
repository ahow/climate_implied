"""Supplementary forcing bookkeeping; never changes the frozen history protocol."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
import xarray as xr
from reconcile_igcc_history import ERF, GMST, digest


def human_warming_check(annual=None, observable=None, baseline=None, reference_observable=None):
    references = {"annualYear": 2025, "annualHumanWarmingC": 1.37,
                  "meanYears": [2016, 2025], "meanHumanWarmingC": 1.24,
                  "meanRangeC": [1.0, 1.5],
                  "referenceObservable": reference_observable or "not independently reconciled"}
    unavailable = {"references": references, "status": "unavailable",
                   "shareMeanMembersInRange": None, "centralEligible": False}
    if (reference_observable not in ("human-induced GMST", "human-induced GSAT")
            or observable != reference_observable or baseline != "1850-1900 inclusive"):
        return {**unavailable, "reason": "No attributable members and independently reconciled matching reference observable/baseline; total FaIR surface temperature is not a substitute and GSAT/GMST equivalence is not assumed"}
    if annual is None or any(y not in annual for y in range(2016, 2026)):
        return {**unavailable, "reason": "Actual 2016-2025 coordinates required; publication year is not observation year"}
    arrays = [np.asarray(annual[y], dtype=float) for y in range(2016, 2026)]
    if any(a.ndim != 1 or a.shape != arrays[0].shape or not a.size or not np.isfinite(a).all() for a in arrays):
        raise ValueError("Aligned finite human-attribution member vectors required")
    mean = np.mean(arrays, axis=0)
    return {"references": references, "status": "descriptive-only",
            "median2025C": float(np.median(arrays[-1])),
            "medianMean2016to2025C": float(np.median(mean)),
            "shareMeanMembersInRange": float(np.mean((mean >= 1) & (mean <= 1.5))),
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

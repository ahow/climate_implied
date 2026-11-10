"""Apply the published IGCC SR1.5 temporal operator to existing paired members.

This postprocesses conditional FaIR surface responses, NOT certified GMST.
No FaIR run, target fit, spatial conversion or historical relabelling occurs.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np
import xarray as xr

from independent_fair_benchmark import digest


SUPPLEMENT_SHA = "c533320e534438ef760ac494d2eef030e2b9714d197557a9d6ec4c0d627ecd1d"
DEFINITIONS_SHA = "e51f99bcb46afb153b19549b1d97822255371da72702338570d3aaf2146b4a8b"
SOURCE_DIRECTORY = Path("generated-artifacts/physical-attribution")


def temporal_member_statistics(series, end_year=2025):
    """Fixed source 15-year OLS trend endpoint, annual value and 10-year mean.

    Supplement S8.1.1 and Fig. S12 require the last 15 annual means, fitted
    separately for each member, evaluated in the final year. Upstream
    src/definitions.py:final_value_of_trend corroborates unweighted degree-1
    numpy.polyfit on indices 0..14, evaluated at 14. Future SSP years are NOT
    used to replace the prescribed trend extrapolation.
    """
    if set(series.dims) != {"year", "scenario", "config"}:
        raise ValueError("Annual paired year/scenario/config member array required")
    for name in series.dims:
        values = series[name].values.tolist()
        if not values or len(values) != len(set(values)):
            raise ValueError(f"Unique {name} coordinates required")
    years = np.arange(end_year-14, end_year+1)
    if not np.isin(years, series.year).all():
        raise ValueError("Every annual coordinate in fixed 15-year source window required")
    selected = series.sel(year=years).transpose("year", "scenario", "config")
    if not np.isfinite(selected).all():
        raise ValueError("Finite members across complete fixed source window required")
    values = selected.values
    # Match official helper member by member; neither ensemble medians nor
    # percentiles may be fitted in place of the joint member trajectories.
    def endpoint(temp):
        fit = np.poly1d(np.polyfit(np.arange(temp.shape[0]), temp, 1))
        return fit(np.arange(temp.shape[0]))[-1]

    trend = np.apply_along_axis(endpoint, 0, values)
    result = xr.Dataset({
        "sr15_trend_endpoint": (("scenario", "config"), trend),
        "annual_mean": selected.sel(year=end_year, drop=True),
        "lagged_decade_mean": selected.sel(year=np.arange(end_year-9, end_year+1)).mean("year")},
        coords={"scenario": series.scenario, "config": series.config})
    result.attrs.update(
        temporalSource="Forster et al. 2026 supplement S8.1.1 and Fig. S12",
        trendWindowStart=end_year-14, trendWindowEnd=end_year, trendYearCount=15,
        evaluationAnnualYear=end_year, evaluationTimeMidpoint=end_year+.5,
        olsCoordinates="indices 0..14, evaluated at 14; equivalent to annual midpoints with endpoint year+0.5",
        decadeWindowStart=end_year-9, decadeWindowEnd=end_year, decadeYearCount=10,
        statisticOrder="Apply each temporal statistic to each paired, member-baselined trajectory before ensemble summaries",
        scope="Conditional emissions-intervention FaIR surface response, not verified human-induced GMST",
        centralEligible="false")
    for variable in result:
        result[variable].attrs.update(units="degC anomaly", baseline="Memberwise 1850-1900 inclusive")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("experiment")
    args = parser.parse_args()
    experiment = json.loads(Path(args.experiment).read_text())
    if digest(experiment["artifact"]) != experiment["artifactSha256"]:
        raise ValueError("Actual paired artifact hash mismatch")
    supplement = SOURCE_DIRECTORY / (SUPPLEMENT_SHA+".source")
    definitions = SOURCE_DIRECTORY / (DEFINITIONS_SHA+".source")
    if digest(supplement) != SUPPLEMENT_SHA or digest(definitions) != DEFINITIONS_SHA:
        raise ValueError("Exact inspected temporal definition sources required")
    with xr.open_dataset(experiment["artifact"]) as artifact:
        result = temporal_member_statistics(artifact.attributed_surface_annual.load())
    residual = experiment["compatibility"]
    residual["referenceDefinition"] = {
        "temporalDefinitionResolved": True,
        "remaining": "Reference-state emissions intervention still needs independent compatibility with the source multi-method human-induced attribution convention; spatial GMST and actual 2015-2025 history also remain unresolved",
        "contract": residual["referenceDefinition"]["contract"]}
    report = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "experiment": args.experiment, "experimentSha256": digest(args.experiment),
        "pairedArtifactSha256": experiment["artifactSha256"],
        "codeSha256": digest(__file__), "modelsRun": 0,
        "source": {
            "primary": "Forster et al. (2026), doi:10.5194/essd-18-3889-2026-supplement, S8.1.1 and Fig. S12 (PDF pages 29-30 and 43)",
            "supplementSha256": SUPPLEMENT_SHA,
            "corroboratingImplementation": "ClimateIndicator/anthropogenic-warming-assessment@9633fb45f9bf82b47492f969614568c43f3e5a6f/src/definitions.py:282-301",
            "implementationSha256": DEFINITIONS_SHA,
            "versionCaveat": "Corroborating code revision is from the older 2024 assessment. Actual 2025 published supplement independently specifies the same 15-year linear-trend endpoint and memberwise order; old code is not substituted for actual 2025 headline data.",
            "receipt": str(SOURCE_DIRECTORY / "temporal-source-receipt.json"),
            "license": "Published supplement CC-BY-4.0; corroborating source code retained privately, no licence inferred"},
        "temporalDefinition": dict(result.attrs),
        "configurations": result.sizes["config"], "scenarios": result.sizes["scenario"],
        "conditionalSurfaceStatisticsNotGMST": [
            {"scenario": str(s),
             "medianSR15TrendEndpoint2025C": float(result.sr15_trend_endpoint.sel(scenario=s).median("config")),
             "medianAnnualMean2025C": float(result.annual_mean.sel(scenario=s).median("config")),
             "medianLaggedDecadeMean2016to2025C": float(result.lagged_decade_mean.sel(scenario=s).median("config"))}
            for s in result.scenario.values],
        "targetFitPerformed": False,
        "annualModelValueComparedToSR15Headline": False,
        "referenceDefinitions": "1.37 is SR1.5 trend endpoint; 1.38 is the distinct annual-mean headline. Neither is used as a fitting target or subtracted to create an offset.",
        "residualRequirements": residual,
        "temporalDefinitionGapResolved": True,
        "spatialOperatorHistoricalInputsAndAttributionConventionResolved": False,
        "actualGMSTMemberComparisonPerformed": False,
        "shareMeanMembersInRange": None, "centralEligible": False}
    identity = hashlib.sha256(json.dumps(report, sort_keys=True).encode()).hexdigest()
    out = SOURCE_DIRECTORY / ("temporal-statistics-"+identity+".nc")
    result.to_netcdf(out, engine="h5netcdf")
    report.update(memberStatisticsArtifact=str(out), memberStatisticsArtifactSha256=digest(out))
    text = json.dumps(report, indent=2, allow_nan=False)+"\n"
    target = out.with_suffix(".json")
    target.write_text(text)
    print(target)


if __name__ == "__main__":
    main()

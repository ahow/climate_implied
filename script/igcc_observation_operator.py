"""Source-defined GWI observational constraint, not a GSAT-to-GMST factor.

Implements the IGCC-2025 three-fingerprint, no-intercept regression kernel.
It is dependency-ready mathematics, not an accepted physical ensemble: callers
must independently establish input histories, source terms and joint provenance.
No point-headline target is an input to this calculation.
"""
import numpy as np
import xarray as xr


COMPONENTS = ("GHG", "Nat", "OHF")
YEARS = np.arange(1850, 2026)


def _annual(array, dimensions):
    if set(array.dims) != set(dimensions):
        raise ValueError("Exact source dimension names required")
    for name in dimensions:
        values = array[name].values.tolist()
        if not values or len(values) != len(set(values)):
            raise ValueError(f"Unique {name} identities required")
    if not np.array_equal(array.year.values, YEARS):
        raise ValueError("Complete fixed source regression years 1850-2025 required")
    if not np.isfinite(array).all():
        raise ValueError("Finite complete annual source inputs required")


def common_observation_baseline(array, member_dimension):
    """Official observations helper: one mean-of-median PI offset.

    Unlike model fingerprints, observations are NOT individually member-rebased:
    doing that would erase the observational baseline uncertainty.
    """
    _annual(array, ("year", member_dimension))
    offset = array.sel(year=slice(1850, 1900)).median(member_dimension).mean("year")
    return array-offset, offset


def prepare_gwi_controls(controls):
    """IGCC-2025 executable piControl slice offset and variability filter.

    Source load_PiC_CMIP6 uses temp_s[:end_pi-start_pi], i.e. the first
    50 positions for nominal 1850-1900, NOT the observation helper's 51-year
    mean-of-median. This executable distinction is retained, not corrected.
    Raw control slices must already have the source's overlapping slice IDs.
    """
    _annual(controls, ("year", "control_member"))
    offsets = controls.isel(year=slice(0, 50)).mean("year")
    centered = (controls-offsets).transpose("year", "control_member")
    keep = []
    for i, name in enumerate(centered.control_member.values):
        values = centered.values[:, i]
        ma3 = np.convolve(values, np.ones(3)/3, "valid")
        ma30 = np.convolve(values, np.ones(30)/30, "valid")
        if ma3.max() < .3 and ma3.min() > -.3 and np.ptp(ma3) > .06 and ma30.max() < .1 and ma30.min() > -.1:
            keep.append(name)
    if not keep:
        raise ValueError("No piControl slices pass exact source variability filter")
    return centered.sel(control_member=keep), offsets.sel(control_member=keep)


def gwi_observational_constraint(fingerprints, observations, controls):
    """Exact IGCC-2025 aggregate GWI regression kernel for supplied joint inputs.

    Model inputs are three SEPARATELY simulated forcing response fingerprints,
    not total temperature or the existing paired emissions-intervention response.
    Every model fingerprint is separately 1850-1900 rebased. Observations and
    piControl uses source first-50-position slice rebasing and filtering. For each
    fingerprint/observation/control combination:
      beta = lstsq(X, observation) + lstsq(X, control)
      attributed_component = X_component * beta_component
      human = GHG + OHF; total = human + Nat
    This maps model fingerprints to observed GMST through attribution regression,
    not through a universal spatial scalar. It does not independently supply
    omitted source ensembles, validate piControl filtering, or create histories.
    """
    _annual(fingerprints, ("year", "fingerprint_member", "component"))
    if fingerprints.component.values.tolist() != list(COMPONENTS):
        raise ValueError("Separate ordered GHG/Nat/OHF fingerprints required; total proxy rejected")
    obs, obs_offset = common_observation_baseline(observations, "observation_member")
    pic, pic_offset = prepare_gwi_controls(controls)
    model_baseline = fingerprints.sel(year=slice(1850, 1900)).mean("year")
    model = (fingerprints-model_baseline).transpose("year", "fingerprint_member", "component")
    obs = obs.transpose("year", "observation_member")
    pic = pic.transpose("year", "control_member")
    shape = (model.sizes["fingerprint_member"], obs.sizes["observation_member"], pic.sizes["control_member"], 3)
    if np.prod(shape[:-1]) > 100000:
        raise ValueError("Explicit batched source ensemble execution required above 100000 joint combinations")
    coefficients = np.empty(shape)
    attributed = np.empty((len(YEARS),)+shape)
    for i in range(shape[0]):
        design = model.values[:, i, :]
        if np.linalg.matrix_rank(design) != 3:
            raise ValueError("Nonidentifiable or duplicated source forcing fingerprints")
        beta_obs = np.linalg.lstsq(design, obs.values, rcond=None)[0]
        beta_pic = np.linalg.lstsq(design, pic.values, rcond=None)[0]
        coefficients[i] = (beta_obs[:, :, None]+beta_pic[:, None, :]).transpose(1, 2, 0)
        attributed[:, i] = design[:, None, None, :]*coefficients[i][None, ...]
    dims = ("fingerprint_member", "observation_member", "control_member", "component")
    coords = {"year": YEARS, **{name: array[name] for name, array in
              (("fingerprint_member", model), ("observation_member", obs),
               ("control_member", pic), ("component", model))}}
    result = xr.Dataset({
        "attributed_component": (("year",)+dims, attributed),
        "regression_coefficient": (dims, coefficients),
        "fingerprint_baseline": model_baseline,
        "observation_common_baseline": obs_offset,
        "control_slice_baseline": pic_offset}, coords=coords)
    result["human_induced"] = result.attributed_component.sel(component=["GHG", "OHF"]).sum("component")
    result["natural"] = result.attributed_component.sel(component="Nat", drop=True)
    result["total_forced"] = result.human_induced+result.natural
    result.attrs.update(
        method="IGCC-2025 GWI source kernel: three forcing fingerprints, full 1850-2025, no intercept",
        operator="Observation-constrained attribution regression, NOT a spatial GSAT-to-GMST conversion",
        scope="Mathematical kernel only; source ensembles/history/licence/provenance must be independently validated",
        centralEligible="false", actualQualifiedMemberComparisonPerformed="false")
    return result

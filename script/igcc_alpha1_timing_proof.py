"""Exact licensed alpha1 source contract and dependency-ready thermal adapter.

Leach & Jenkins (2021), doi:10.5281/zenodo.4774994. The archive is Apache2.0;
the runner additionally carries a CC-BY4.0 author notice. Both remain intact
in the privately retained archive. No publisher downloader/module is imported.
"""
import argparse
import ast
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import zipfile

import numpy as np
import pandas as pd
import xarray as xr


ROOT = Path("generated-artifacts/igcc-alpha1-proof")
ARCHIVE_SHA = "8fef0d4651d81faa54137c54ebeea375b4ede16adf745f3351346d98a81a58ce"
RUNNER_SHA = "098c29699593c2a7831ea26a7874ac554d2b88845ef25dbece99b0f8b67d043d"
INIT_SHA = "51c614b6d0a120fcb49bd56c8a149077a6da052ad3af8adfb32536c4a8d38041"
GWI_SHA = "0fb7c34020f4f8ad9a03186ebcf42008f8d862baf4e4f61f7e9220045bcfb6a4"
PARAM_SHA = "25cc0a669ca02ae44c6d862905c2de3e1d8c9d4d465b5c65b9089d02203e5391"
PATCHED_SHA = "c6c9345902794a93e63b500551eee98b6145d4f816c9c0c8c4637624a0dde246"
NATIVE_FORCING_SHA = "26ce5f1a21cc6ee163d361043c4a65830a73cc1aaa8dbec222b546f9ac11a850"
PREFIX = "FaIRv2.0.0-alpha1/"
EXPRESSIONS = (
    "exp(-dt/d)",
    "q * F * (1 - decay_factor) + S_old * decay_factor",
    "sum( (S_old + S_new)/2, axis=3 )",
)


def digest(body):
    return hashlib.sha256(body).hexdigest()


def emulate_gwi_first_download_patch(runner, init):
    """Preserve source r+ read-then-write-at-EOF behavior, not an imagined fix."""
    if digest(runner) != RUNNER_SHA or digest(init) != INIT_SHA:
        raise ValueError("Exact original downloader and alpha1 runner bytes required")
    source = init.decode()
    if "filedata = file.read()" not in source or "file.write(filedata)" not in source:
        raise ValueError("Original read/write patch contract absent")
    if "file.seek(" in source or "file.truncate(" in source:
        raise ValueError("Source patch unexpectedly seeks/truncates")
    needle = "tqdm(np.arange(1,n_year),unit=' timestep')"
    text = io.StringIO(runner.decode())
    modified = text.read().replace(needle, "np.arange(1,n_year)")
    text.write(modified)
    patched = text.getvalue().encode()
    if digest(patched) != PATCHED_SHA:
        raise ValueError("Exact source first-download patch bytes differ")
    return patched


def verify_source_contract(runner, gwi):
    """Check exact source AST control flow; do not infer timing from a filename."""
    if digest(runner) != RUNNER_SHA or digest(gwi) != GWI_SHA:
        raise ValueError("Exact operative source hashes required")
    tree = ast.parse(runner)
    functions = {n.name: n for n in tree.body if isinstance(n, ast.FunctionDef)}
    step = functions["step_temperature"]
    expressions = [n.args[0].value for n in ast.walk(step)
                   if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
                   and n.func.attr == "evaluate"]
    if expressions != list(EXPRESSIONS):
        raise ValueError("Source thermal expressions changed")
    run = functions["run_FaIR"]
    emissions = next(n for n in run.body
                     if isinstance(n, ast.If) and ast.unparse(n.test) == "not concentration_driven")
    calls = [n for n in ast.walk(emissions) if isinstance(n, ast.Call)
             and isinstance(n.func, ast.Name) and n.func.id == "step_temperature"]
    contracts = [{kw.arg: ast.unparse(kw.value) for kw in n.keywords} for n in calls]
    if (len(contracts) != 2 or contracts[0]["S_old"] != "0"
            or contracts[0]["dt"] != "timestep[0]"
            or contracts[1]["S_old"] != "S" or contracts[1]["dt"] != "timestep[t]"
            or any(c["q"] != "q" or c["d"] != "d" for c in contracts)):
        raise ValueError("Exact zero-initial full-first-step source flow required")
    normalized = ast.unparse(run)
    for text in (
        "timestep = np.append(np.diff(time_index), np.diff(time_index)[-1])",
        "for t in tqdm(np.arange(1, n_year), unit=' timestep'):",
        "T_out = pd.DataFrame(",
        "index=time_index",
        "therm_shape + [-1]",
    ):
        if text not in normalized:
            raise ValueError("Source terminal-step/output-label/full-mode contract absent")
    gwi_tree = ast.parse(gwi)
    gwi_run = next(n for n in gwi_tree.body if isinstance(n, ast.FunctionDef) and n.name == "GWI_faster")
    external_calls = [n for n in ast.walk(gwi_run) if isinstance(n, ast.Call)
                      and isinstance(n.func, ast.Attribute) and n.func.attr == "run_FaIR"]
    if len(external_calls) != 1:
        raise ValueError("Exactly one operative GWI thermal invocation required")
    keywords = {kw.arg: ast.unparse(kw.value) for kw in external_calls[0].keywords}
    if keywords != {"emissions_in": "emis_FAIR", "forcing_in": "forc_FaIR",
                    "thermal_parameters": "params_FaIR", "show_run_info": "False"}:
        raise ValueError("Unexpected source GWI initialization override")
    return {
        "initialState": "S_old=0 before first forcing interval",
        "firstAndLastLabelsBothStepped": True,
        "terminalDt": "repeat last difference of source input labels",
        "returnedT": "sum((S_old+S_new)/2), trapezoidal boundary-state average",
        "notExactContinuousAnnualMean": True,
        "notSiblingMidpointImpulse": True,
        "labels": "T_out retains source input year label; annual y represents full step from y to y+1",
        "modeHandling": "All passed thermal terms via reshape(...,-1), no term truncation",
        "zeroEmissionsScope": "GWI supplies source return_empty_emissions zeros; zero gas emissions preserve PI concentrations and zero internal gas RF, leaving the externally supplied forcing response",
        "thermalCallContracts": contracts,
    }


def extracted_numpy_thermal_step(runner):
    """Source AST with only its three exact NumExpr expressions lowered to NumPy.

    This is an algebraic source check, NOT binary NumExpr-runtime reproduction.
    """
    if digest(runner) != RUNNER_SHA:
        raise ValueError("Exact licensed source required before AST extraction")
    function = next(n for n in ast.parse(runner).body
                    if isinstance(n, ast.FunctionDef) and n.name == "step_temperature")

    class Lower(ast.NodeTransformer):
        def visit_Call(self, node):
            if isinstance(node.func, ast.Attribute) and node.func.attr == "evaluate":
                expression = node.args[0].value
                if expression not in EXPRESSIONS:
                    raise ValueError("Unapproved source evaluation expression")
                return self.visit(ast.parse(expression, mode="eval").body)
            node = self.generic_visit(node)
            if isinstance(node.func, ast.Name) and node.func.id in ("sum", "exp"):
                node.func = ast.Attribute(value=ast.Name(id="np", ctx=ast.Load()),
                                          attr=node.func.id, ctx=ast.Load())
            return node
    function = Lower().visit(function)
    module = ast.fix_missing_locations(ast.Module(body=[function], type_ignores=[]))
    namespace = {"np": np}
    exec(compile(module, "<pinned alpha1 thermal AST; NumPy backend>", "exec"), namespace)
    return namespace["step_temperature"]


def alpha1_interval_bridge(forcing, q, d):
    """Source-faithful three-mode external-forcing update, not exact annual integral."""
    forcing, q, d = np.asarray(forcing, float), np.asarray(q, float), np.asarray(d, float)
    if (forcing.ndim != 1 or not len(forcing) or q.shape != (3,) or d.shape != (3,)
            or not np.isfinite(forcing).all() or not np.isfinite(q).all()
            or not np.isfinite(d).all() or (d <= 0).any() or (q < 0).any()):
        raise ValueError("Complete finite annual forcing, three native q/d terms required")
    decay = np.exp(-1/d)
    old = np.zeros(3)
    states, returned = [], []
    for value in forcing:
        new = q*value*(1-decay)+old*decay
        returned.append(((old+new)/2).sum())
        states.append(new.copy())
        old = new
    return np.asarray(returned), np.asarray(states)


def load_proof_sources():
    pins = {
        ROOT/"FaIRv2.0.0-alpha1.zip": ARCHIVE_SHA,
        ROOT/"models-init.py.source": INIT_SHA,
        ROOT/"operative-tree.json": "a1f02c6ccce6f9e751781ffc18bf7e8835b3183ed77fa27f9ef2d7cc81060a5e",
        ROOT/"zenodo-metadata.json": "5e151afe33ddb5b5bb55064f20b498a143fd8be5317cddf38545d8e567144f28",
        ROOT/"environment.yml": "c23dfb8c706d5be75ebcdf82161ea59ecbcdf008a444547084a4c600a15e5623",
        Path("docs/igcc-alpha1-proof-protocol.json"): "5f46de8560221e75fab44169ad2961e4cacb4547a7e6bf3378dec1f4b854b5c1",
        Path("docs/igcc-alpha1-timing-operational-freeze.json"): "7ccfb6726faf4083496bd3b595e938b9ee4a94ffda5ed7e477d757c6c0d5ca80",
    }
    for p, sha in pins.items():
        if digest(p.read_bytes()) != sha:
            raise ValueError(f"Pinned dependency/source proof hash mismatch: {p}")
    metadata = json.loads((ROOT/"zenodo-metadata.json").read_text())
    if metadata["metadata"]["license"]["id"] != "apache2.0":
        raise ValueError("Specific source archive rights not established")
    archive = (ROOT/"FaIRv2.0.0-alpha1.zip").read_bytes()
    file = metadata["files"][0]
    if len(archive) != file["size"] or "md5:"+hashlib.md5(archive).hexdigest() != file["checksum"]:
        raise ValueError("Publisher dependency size/checksum mismatch")
    z = zipfile.ZipFile(io.BytesIO(archive))
    license_body = z.read(PREFIX+"LICENSE")
    if b"Apache License" not in license_body:
        raise ValueError("Archive-specific license text missing")
    runner = z.read(PREFIX+"fair/fair_runner.py")
    gwi = (Path("generated-artifacts/physical-attribution")/(GWI_SHA+".source")).read_bytes()
    contract = verify_source_contract(runner, gwi)
    patched = emulate_gwi_first_download_patch(runner, (ROOT/"models-init.py.source").read_bytes())
    definitions = [n for n in ast.parse(patched).body
                   if isinstance(n, ast.FunctionDef) and n.name == "step_temperature"]
    if len(definitions) != 2 or ast.dump(definitions[0]) != ast.dump(definitions[1]):
        raise ValueError("GWI appended-module patch changes active thermal definition")
    return runner, contract, pins


def qualified_actual_forcing_bridge(source_path, rights_path, manifest, thermal_model):
    """Dependency-ready bridge; no actual ensemble is supplied by this module.

    Requires native source variables wmghg/natural/other_ant, explicit years and
    ensemble identities, matching actual data-specific rights and exact hashes.
    A caller cannot qualify a summary quantile CSV or SSP substitute by renaming.
    The result is unregressed source-method temperature, never attributed GMST.
    """
    _, _, _ = load_proof_sources()
    source, rights = Path(source_path).read_bytes(), Path(rights_path).read_bytes()
    if (digest(source) != NATIVE_FORCING_SHA
            or manifest.get("source_sha256") != NATIVE_FORCING_SHA
            or digest(rights) != manifest.get("rights_sha256")
            or manifest.get("history_basis") != "actual-observed-1750-2025"):
        raise ValueError("Pinned actual-history forcing source and independent rights evidence required")
    allowed = ("https://creativecommons.org/licenses/by/4.0/",
               "https://creativecommons.org/licenses/by-sa/4.0/")
    license_text = manifest.get("license_text", "")
    if not license_text or not any(u in license_text for u in allowed) or license_text not in rights.decode():
        raise ValueError("Dataset-specific compatible forcing rights required")
    with xr.open_dataset(source_path) as ds:
        if ds.attrs.get("license") != license_text:
            raise ValueError("Actual native forcing metadata must confirm exact license")
        years = ds.year.values
        ids = ds.ensemble.values.tolist()
        if (not np.array_equal(years, np.arange(1750, 2026)) or not ids
                or len(ids) != len(set(ids))):
            raise ValueError("Full actual 1750-2025 source years and unique forcing-member IDs required")
        variables = ("wmghg", "natural", "other_ant")
        for name in variables:
            a = ds[name]
            if (set(a.dims) != {"year", "ensemble"} or a.attrs.get("units") != "W m-2"
                    or not np.isfinite(a).all()):
                raise ValueError("Finite complete native source fingerprints in W m-2 required")
        forcing = np.stack([ds[n].transpose("year", "ensemble").values for n in variables], axis=-1)
    parameter_file = Path("generated-artifacts/physical-attribution")/(PARAM_SHA+".source")
    if digest(parameter_file.read_bytes()) != PARAM_SHA:
        raise ValueError("Pinned original thermal parameters required")
    p = pd.read_csv(parameter_file, header=[0, 1], index_col=0)[thermal_model]
    if p.columns.tolist() != ["1", "2", "3"]:
        raise ValueError("All three original thermal terms required")
    output = np.empty_like(forcing)
    for i in range(len(ids)):
        for j in range(3):
            output[:, i, j], _ = alpha1_interval_bridge(forcing[:, i, j], p.loc["q"], p.loc["d"])
    return xr.DataArray(
        output, dims=("year", "forcing_member", "component"),
        coords={"year": years, "forcing_member": ids, "component": ["GHG", "Nat", "OHF"]},
        attrs={"units": "degC", "thermal_model": thermal_model, "source_sha256": digest(source),
               "rights_sha256": digest(rights), "runner_sha256": RUNNER_SHA,
               "output_convention": "alpha1 trapezoidal average of boundary states",
               "initialization": "zero modes immediately before first1750 interval",
               "qualification": "Unregressed source-method response, not native-emissions or attributed GMST acceptance"})


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    runner, contract, pins = load_proof_sources()
    step = extracted_numpy_thermal_step(runner)
    q, d = np.array([.2, .3, .4]), np.array([.5, 5., 50.])
    cases = {
        "zero": np.zeros(8), "constant": np.ones(8),
        "first_impulse": np.r_[1., np.zeros(7)],
        "last_impulse": np.r_[np.zeros(7), 1.],
        "alternating_signed": np.array([1., -1.]*4),
    }
    checks = []
    for name, forcing in cases.items():
        returned, boundaries = alpha1_interval_bridge(forcing, q, d)
        state, expected, states = 0, [], []
        for value in forcing:
            state, temp = step(state, value, q.reshape(1, 1, 1, 3), d.reshape(1, 1, 1, 3))
            expected.append(temp.item())
            states.append(state.ravel())
        delta = returned-np.array(expected)
        np.testing.assert_allclose(returned, expected, rtol=0, atol=1e-14)
        np.testing.assert_allclose(boundaries, states, rtol=0, atol=1e-14)
        # Separate independent analytic interval integral, never a replacement.
        old = np.zeros(3)
        exact_means, sibling = [], []
        mid = np.zeros(3)
        for value in forcing:
            gain = -np.expm1(-1/d)
            exact_means.append((q*value+(old-q*value)*d*gain).sum())
            old = np.exp(-1/d)*old+q*gain*value
            mid = np.exp(-1/d)*mid+q/d*np.exp(-.5/d)*value
            sibling.append(mid.sum())
        checks.append({
            "case": name, "sourceExpressionVsBridgeMaxAbsC": float(np.abs(delta).max()),
            "sourceVsExactAnnualMeanMaxAbsC": float(np.max(np.abs(returned-exact_means))),
            "sourceVsSiblingMidpointMaxAbsC": float(np.max(np.abs(returned-sibling))),
            "returnedFirstC": float(returned[0]), "returnedLastC": float(returned[-1]),
        })
    result = {
        "executedAtUTC": datetime.now(timezone.utc).isoformat(),
        "status": "exact-alpha1-source-initialization-and-trapezoidal-return-proved; actual-forcing-and-controls-still-required",
        "sourcePins": {str(p): sha for p, sha in pins.items()},
        "implementationSHA256": digest(Path(__file__).read_bytes()),
        "runnerSHA256": RUNNER_SHA, "emulatedFirstDownloadPatchedRunnerSHA256": PATCHED_SHA,
        "patchDuplicatesModule": True, "activeThermalDefinitionUnchanged": True,
        "sourceContract": contract,
        "engineeringToleranceC": 1e-14, "engineeringVectors": checks,
        "arithmeticBackend": "Exact source thermal AST with fixed NumExpr expressions lowered to NumPy; not NumExpr binary-runtime/full-gas-cycle proof",
        "historicalOr84ComparisonReruns": 0, "observationAssemblyReruns": 0,
        "actualEnsembleOrControlDownloads": 0, "newAttributionRuns": 0,
        "headlineScoring": False, "shareMembersInRange": None, "centralEligible": False,
    }
    path = ROOT/"alpha1-source-proof-result.json"
    path.write_text(json.dumps(result, indent=2)+"\n")
    print(json.dumps({"result": str(path), "resultSHA256": digest(path.read_bytes()),
                      "engineeringCases": len(checks), "status": result["status"]}, indent=2))


if __name__ == "__main__":
    main()

"""Read-only complete species/prescription audit of an executed paired experiment.

No model is run here. Calculated forcing is distinguished from prescribed
forcing, and the reference-emissions experiment is never certified as full
human-induced warming.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import fair
from fair.io import read_properties
import numpy as np
import pandas as pd
import xarray as xr

from independent_fair_benchmark import digest


CALCULATED = {
    "co2": ("CO2 FFI + CO2 AFOLU gas cycling", "Reference concentrations and forcing-reference concentrations retained"),
    "ari": ("FaIR calculate_erfari_forcing; native precursor emissions/concentrations", "Source baseline emissions/concentrations subtracted"),
    "aci": ("FaIR logsum; native aerosol precursor emissions/concentrations", "Source baseline emissions/concentrations subtracted"),
    "ozone": ("FaIR thornhill2021; precursor emissions, gas concentrations, EESC and temperature feedback", "Source baseline emissions/concentrations; source temperature feedback retained"),
    "contrails": ("FaIR calculate_linear_forcing from source-weighted emissions; default nonzero coefficient is NOx aviation, not total NOx", "Source uses zero forcing-input baseline; default NOx aviation reference rate is zero, so this intervention removes contrails forcing"),
    "lapsi": ("FaIR calculate_linear_forcing from BC/OC emissions", "Source baseline emissions subtracted"),
    "h2o stratospheric": ("FaIR calculate_linear_forcing from methane concentration", "Source baseline concentrations subtracted"),
    "land use": ("FaIR calculate_linear_forcing from cumulative CO2 AFOLU emissions", "Zero cumulative-emissions reference; zero initial cumulative emissions, baseline CO2 AFOLU emissions = 0"),
    "eesc": ("FaIR calculate_eesc from halogen concentrations", "Source fractional release, chlorine/bromine atoms and gas concentrations retained; not a separate forcing input"),
}


def species_prescriptions(data, artifact, properties):
    """Verify and classify every actual species; fail closed on mode/type drift."""
    rows = []
    for name in data.specie.values.tolist():
        mode = str(data.species_input_mode.sel(specie=name).item())
        kind = str(data.species_type.sel(specie=name).item())
        if name not in properties or properties[name]["input_mode"] != mode or properties[name]["type"] != kind:
            raise ValueError(f"Actual retained mode/type differs from audited FaIR defaults: {name}")
        row = {"species": name, "inputMode": mode, "type": kind,
               "source": "Hashed FaIR 2.2.4 species_configs_properties.csv and fair.py; original experiment prescription"}
        if mode == "emissions":
            baseline = data.baseline_emissions.sel(specie=name)
            actual = artifact.counterfactual_native_emissions.sel(specie=name)
            if not np.isfinite(baseline).all() or not np.isfinite(actual).all():
                raise ValueError(f"Finite actual emissions prescription required: {name}")
            if not np.array_equal(actual, baseline.broadcast_like(actual)):
                raise ValueError(f"Counterfactual baseline prescription mismatch: {name}")
            row.update(
                classification="Anthropogenic emission bookkeeping" if kind in ("co2 ffi", "co2 afolu") else
                "Anthropogenic deviation removed relative to source reference rate; possible natural/background component retained",
                baselineSource="Retained per-member FaIR baseline_emissions, checked against actual counterfactual arrays",
                baselineNativeRatesUnique=np.unique(baseline).tolist(),
                nativeUnit=str(data.native_emissions_unit.sel(specie=name).item()),
                counterfactualPrescription="Set all 350 annual inputs, all scenario/config identities, to the species/member reference rate",
                actualPrescriptionArray="counterfactual_native_emissions",
                heldFactual=False)
        elif mode == "forcing":
            if kind not in ("solar", "volcanic"):
                raise ValueError(f"Unimplemented directly prescribed anthropogenic forcing: {name}")
            actual = artifact.counterfactual_natural_forcing_bounds.sel(natural_specie=name)
            factual = artifact.factual_natural_forcing_bounds.sel(natural_specie=name)
            expected = data.forcing_species_bounds.sel(specie=name)
            # The species coordinate has a different name in the private artifact.
            for a in (factual, expected):
                if not np.array_equal(actual.values, a.values):
                    raise ValueError(f"Natural forcing preservation mismatch: {name}")
            row.update(
                classification="Natural externally prescribed forcing",
                baselineSource="Original RCMIP boundary series and zero initialized first boundary; no re-zeroing",
                counterfactualPrescription="Identical factual natural forcing boundary array at all 351 timebounds",
                actualPrescriptionArray="counterfactual_natural_forcing_bounds",
                heldFactual=True)
        elif mode == "calculated":
            if kind not in CALCULATED:
                raise ValueError(f"Unclassified calculated mechanism: {name}")
            mechanism, baseline = CALCULATED[kind]
            row.update(
                classification="Calculated gas-cycle response with natural/background and anthropogenic components" if kind == "co2" else
                "Calculated chemistry diagnostic, not independent forcing" if kind == "eesc" else
                "Calculated anthropogenic forcing class; reference-state/background response can remain",
                baselineSource=baseline,
                counterfactualPrescription="Recompute within fresh counterfactual FaIR; never copy factual forcing",
                calculation=mechanism,
                actualPrescriptionArray="No external forcing prescription: input_mode=calculated",
                heldFactual=False)
        else:
            raise ValueError(f"Unimplemented prescribed input mode: {name}/{mode}")
        rows.append(row)
    return rows


def audit(manifest_path, experiment_path):
    manifest = json.loads(Path(manifest_path).read_text())
    experiment = json.loads(Path(experiment_path).read_text())
    if digest(manifest["file"]) != manifest["sha256"] or digest(experiment["artifact"]) != experiment["artifactSha256"]:
        raise ValueError("Source or experiment artifact hash mismatch")
    if manifest["sha256"] != experiment["physicalSha256"]:
        raise ValueError("Experiment/source provenance mismatch")
    species, properties = read_properties()
    with xr.open_dataset(manifest["file"]) as data, xr.open_dataset(experiment["artifact"]) as artifact:
        if data.specie.values.tolist() != species:
            raise ValueError("Complete ordered source species inventory required")
        for coordinate in ("year", "scenario", "config"):
            if not data[coordinate].equals(artifact[coordinate]):
                raise ValueError(f"Actual prescription coordinate mismatch: {coordinate}")
        rows = species_prescriptions(data, artifact, properties)
    defaults = Path(fair.__file__).parent / "defaults/data/ar6/species_configs_properties.csv"
    params = pd.read_csv(defaults).set_index("name")
    # Audit every nonzero coefficient, not a guessed total-NOx proxy.
    components = []
    for row in rows:
        efficiency = float(params.loc[row["species"], "contrails_radiative_efficiency"])
        if np.isfinite(efficiency) and efficiency != 0:
            if row["inputMode"] != "emissions":
                raise ValueError("Contrails source coefficient requires native emissions")
            components.append({
                "species": row["species"],
                "baselineNativeRatesUnique": row["baselineNativeRatesUnique"],
                "radiativeEfficiency": efficiency,
                "referenceRateContributionWm2Unique": [rate*efficiency for rate in row["baselineNativeRatesUnique"]]})
    contrail = {
        "equation": "Sum native species emissions * source contrails radiative efficiency, with zero forcing-input baseline",
        "nonzeroCoefficientComponents": components,
        "referenceRateContrailsForcingIsZero": all(
            all(value == 0 for value in c["referenceRateContributionWm2Unique"]) for c in components),
        "interpretation": "Default nonzero coefficient applies to NOx aviation, whose actual reference-rate prescription is zero. Contrails therefore recomputes to zero, not factual forcing; total background NOx is not conflated with aviation."}
    return {
        "auditedAtUTC": datetime.now(timezone.utc).isoformat(),
        "scope": "EMISSIONS-INTERVENTION ONLY; qualified partial science, not full human warming or GMST acceptance",
        "additionalModelsRun": 0,
        "prescriptionChanged": False,
        "reasonNoRerun": "Actual retained defaults prescribe only Solar and Volcanic forcing. Land use/albedo, Contrails, aerosols, ozone, LAPSI and stratospheric water vapour are calculated inside each model, not copied factual or omitted direct forcing inputs.",
        "speciesCount": len(rows), "inputModeCounts": dict(Counter(r["inputMode"] for r in rows)),
        "directlyPrescribedAnthropogenicForcingSpecies": [],
        "anthropogenicForcingHeldFactual": [],
        "speciesPrescriptions": rows, "contrailsReferenceResidual": contrail,
        "actualPrescriptionArtifact": experiment["artifact"], "actualPrescriptionArtifactSha256": experiment["artifactSha256"],
        "originalExperiment": str(experiment_path), "originalExperimentSha256": digest(experiment_path),
        "originalExecutedCodeSha256": experiment["codeSha256"],
        "auditCodeSha256": digest(__file__),
        "fairDefaultPropertiesSha256": digest(defaults),
        "fairImplementationSha256": digest(Path(fair.__file__).with_name("fair.py")),
        "sourceMechanisms": "FaIR 2.2.4 fair.py sections 6-14: ARI/ACI, EESC, ozone, contrails, LAPSI, stratospheric water vapour, cumulative-AFOLU land use, temperature forcing feedback",
        "residualRequirements": experiment["compatibility"],
        "fullHumanCounterfactualValidated": False, "centralEligible": False,
        "actualGMSTMemberComparisonPerformed": False, "shareMeanMembersInRange": None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("experiment")
    args = parser.parse_args()
    report = audit(args.manifest, args.experiment)
    text = json.dumps(report, indent=2, allow_nan=False)+"\n"
    target = Path(args.experiment).parent / ("prescription-audit-"+hashlib.sha256(text.encode()).hexdigest()+".json")
    target.write_text(text)
    print(target)


if __name__ == "__main__":
    main()

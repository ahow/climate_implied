"""Real calibrated FaIR pulse diagnostics, not independent model validation."""
import hashlib
import json
import math
from pathlib import Path
import fair
import numpy as np
import pandas as pd
from fair import FAIR
from fair.interface import fill, initialise
from fair.io import read_properties

ROOT = Path("generated-artifacts/fair-reference")

def main():
    if fair.__version__ != "2.2.4":
        raise ValueError("FaIR 2.2.4 required")
    reference = json.loads((ROOT/"result.json").read_text())
    for item in reference["inputs"]:
        if hashlib.sha256((ROOT/item["file"]).read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError("Pinned reference input hash mismatch")
    params = ROOT/"calibrated_constrained_parameters_calibration1.4.1.csv"
    species_file = ROOT/"species_configs_properties_calibration1.4.1.csv"
    configs = pd.read_csv(params,index_col=0)
    results={}
    for label,gas,pulse in [("baseline",None,0),("co2","CO2 FFI",100),("ch4","CH4",100)]:
        # FaIR mutates internal response state/configuration during execution.
        # Reinitialising output arrays alone does not create an independent run.
        f=FAIR(ch4_method="Thornhill2021")
        f.define_time(1750,2101,1)
        f.define_scenarios(["medium-extension"])
        f.define_configs(configs.index)
        species,properties=read_properties(filename=species_file)
        f.define_species(species,properties)
        f.allocate()
        f.fill_from_csv(emissions_file=str(ROOT/"extensions_1750-2500.csv"),
                        forcing_file=str(ROOT/"volcanic_solar.csv"))
        for specie in ("Solar","Volcanic"):
            fill(f.forcing,f.forcing.sel(specie=specie)*configs[f"forcing_scale[{specie}]"].values,specie=specie)
        f.fill_species_configs(species_file)
        f.override_defaults(params)
        if gas:
            f.emissions.loc[dict(timepoints=2025.5,specie=gas)] += pulse
        initialise(f.concentration,f.species_configs["baseline_concentration"])
        for state in (f.forcing,f.temperature,f.cumulative_emissions,
                      f.airborne_emissions,f.ocean_heat_content_change):
            initialise(state,0)
        f.run(progress=False)
        temp=f.temperature.sel(scenario="medium-extension",layer=0).values.copy()
        methane=f.concentration.sel(scenario="medium-extension",specie="CH4").values.copy()
        if not np.isfinite(temp).all() or not np.isfinite(methane).all():
            raise ValueError("Nonfinite pulse result")
        results[label]=(temp,methane)
    co2=results["co2"][0]-results["baseline"][0]
    ch4=results["ch4"][1]-results["baseline"][1]
    excess=np.median(ch4,axis=1)
    start=2026-1750
    crossings=np.where(excess[start:] <= excess[start]/math.e)[0]
    temp_metrics={str(year):float(np.median(co2[year-1750])) for year in [2035,2050,2100]}
    concentration={str(year):float(excess[year-1750]) for year in [2026,2036,2056]}
    checks={"positiveCo2Warming2035":temp_metrics["2035"]>0,
            "positiveCo2Warming2100":temp_metrics["2100"]>0,
            "positiveMethanePulse":concentration["2026"]>0,
            "methaneExcessDecays":0<concentration["2056"]<concentration["2036"]<concentration["2026"]}
    report={"status":"pulse-diagnostic-not-independent-validation","members":len(configs),
            "protocolHash":hashlib.sha256(Path("docs/Climate_Pulse_Protocol.md").read_bytes()).hexdigest(),
            "inputs":reference["inputs"],"co2PulseGtCO2":100,"ch4PulseMtCH4":100,
            "medianCo2WarmingResponseC":temp_metrics,"medianMethaneExcessPpb":concentration,
            "medianMethaneExcessEFoldingYears":int(crossings[0]) if len(crossings) else None,
            "checks":checks,"passed":all(checks.values()),"modelPromoted":False,
            "remaining":["Independent reference/TCRE comparison","Historical forcing reconciliation","Candidate emissions coupling"]}
    (ROOT/"pulse-checks.json").write_text(json.dumps(report,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!="inputs"},indent=2))
    if not report["passed"]: raise ValueError("Pulse checks failed; report retained")

if __name__=="__main__": main()

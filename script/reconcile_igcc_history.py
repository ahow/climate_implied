"""Read retained physical histories; no model fit, rerun, provider, or promotion."""
import csv
import hashlib
import json
from pathlib import Path
import numpy as np
import xarray as xr

ROOT = Path("generated-artifacts/kaya-source-investigation")
GMST = ROOT / "94cbfe9c7a6024412aeba8e0be934417bc9ca78cf0a73bcd12a2261a6138e7f0.source"
ERF = ROOT / "be4020f78361563fc215cc71d169e3d3800d0cf677c5d1174653098c82618331.source"
MODEL = Path("generated-artifacts/independent-fair-benchmark/result-120b305e686161e327b619ed1c293547ada46d7d407aa2ecdf14d8315012efa9-temperature.nc")

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def reconcile(model, observed):
    years = np.arange(1850, 2015)
    if any(float(y)+.5 not in observed for y in years):
        raise ValueError("Missing observed midpoint")
    a = (model.sel(timebounds=years, layer=0).values +
         model.sel(timebounds=years+1, layer=0).values)/2
    b = np.array([observed[float(y)+.5] for y in years])
    if not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError("Nonfinite history")
    a = a-a[:51].mean(axis=0)
    b = b-b[:51].mean()
    median = np.median(a, axis=2)
    delta = median-b[:,None]
    return {"years":[1850,2014],"baseline":"1850-1900 inclusive",
            "unit":"degC","scenarios":[
                {"scenario":str(s),"bias":float(delta[:,i].mean()),
                 "rmse":float(np.sqrt(np.mean(delta[:,i]**2))),
                 "maximumAbsoluteDifference":float(np.abs(delta[:,i]).max())}
                for i,s in enumerate(model.scenario.values)],
            "maximumScenarioMedianSpread":float(np.ptp(median,axis=1).max()),
            "centralEligible":False,"independentAnnualReferencePassed":False}

def main():
    if digest(MODEL)!="bbb0b84db4050fa619dcddb413ff91d9d9aaa1fa37d8e72b2ffe6d257e8f5b1d":
        raise ValueError("Retained model trajectory hash mismatch")
    for p in (GMST,ERF):
        if digest(p)!=p.stem:
            raise ValueError("Primary source hash mismatch")
    with GMST.open(encoding="utf-8-sig") as f:
        observed={float(r["year"]):float(r["gmst"]) for r in csv.DictReader(f)}
    with xr.open_dataarray(MODEL) as model:
        result=reconcile(model,observed)
    with ERF.open(encoding="utf-8-sig") as f:
        forcing={}
        for r in csv.DictReader(f):
            y=int(r.pop(""))
            vals={k:float(v) for k,v in r.items()}
            if not all(np.isfinite(v) for v in vals.values()):
                raise ValueError("Nonfinite ERF")
            if y in (1750,2014,2024):
                natural=vals["solar"]+vals["volcanic"]
                forcing[y]={"allComponentsWm2":sum(vals.values()),"naturalWm2":natural,
                            "anthropogenicComponentSumWm2":sum(vals.values())-natural}
    result.update({"forcing":forcing,"modelForcingComparison":"unavailable: annual model forcing/emissions not retained",
                   "sourceHashes":{str(p):digest(p) for p in (GMST,ERF,MODEL)},
                   "protocolHash":digest("docs/IGCC_History_Reconciliation_Protocol.md"),
                   "codeHash":digest(__file__),"informationAvailableAt":None,
                   "historyBasis":"current-revision; not original publication vintage"})
    out=Path("generated-artifacts/igcc-history-reconciliation");out.mkdir(parents=True,exist_ok=True)
    body=json.dumps(result,indent=2,allow_nan=False)+"\n"
    target=out/(hashlib.sha256(body.encode()).hexdigest()+".json")
    target.write_text(body)
    print(body);print(target)

if __name__=="__main__":
    main()

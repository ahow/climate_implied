"""Targeted source-representation proof,not a numerical repair."""
import argparse
import ast
import csv
import hashlib
import json
import math
import re
import struct
from decimal import Decimal, ROUND_HALF_EVEN, localcontext
from pathlib import Path

ROOT=Path("generated-artifacts/kaya-precision-territory")
PLAN=Path("docs/kaya-precision-territory-acquisition-plan.json")


def binary32(value):
    if not math.isfinite(value):
        raise ValueError("Finite source value required")
    return struct.unpack("!f",struct.pack("!f",value))[0]


def literal_assignment(source,name):
    for node in ast.parse(source).body:
        if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in node.targets):
            if isinstance(node.value,ast.Constant) and type(node.value.value) in (int,float):
                return Decimal(str(node.value.value))
    raise ValueError("Source literal constant not established")


def strict_display_gate(raw,native):
    return abs(Decimal(native)-Decimal(raw))<=Decimal("0.0005")


def representation_proof(raw,native,observed,outward,inward,csv_format):
    if outward!=Decimal("1e6") or inward!=Decimal("1e-6") or csv_format!="%.3f":
        raise ValueError("Only source-declared Mt/tonnes/CSV contract admitted")
    if set(observed)!={"meadow","gcb_garden","co2_garden"}:
        raise ValueError("Exactly all three source stages required")
    first=binary32(float(Decimal(raw)))
    tonnes=binary32(first*binary32(float(outward)))
    back=binary32(tonnes*binary32(float(inward)))
    values={"meadow":first,"gcb_garden":tonnes,"co2_garden":back}
    for stage,value in values.items():
        row=observed[stage]
        if row["dtype"]!="FLOAT" or float(row["value"])!=value:
            raise ValueError("Observed stage does not match source binary32 path")
    exported=csv_format % back
    if exported!=native:
        raise ValueError("Source CSV formatter does not reproduce native value")
    with localcontext() as context:
        context.prec=100
        original=Decimal(raw)
        m=Decimal.from_float(first)
        t=Decimal.from_float(tonnes)/outward
        end=Decimal.from_float(back)
        losses={"rawToMeadowMtCO2":m-original,"outwardFloat32MtCO2":t-m,
                "inwardFloat32MtCO2":end-t,"CSVDisplayMtCO2":Decimal(native)-end}
        direct=Decimal(native)-original
        closure=sum(losses.values(),Decimal(0))-direct
        reference=(original*outward*inward).quantize(Decimal(".001"),rounding=ROUND_HALF_EVEN)
    if closure!=0:
        raise ValueError("Representation accounting does not close exactly")
    return {"rawMtCO2":original,"nativeCSVString":native,
            "stagesExactBinary32":{k:Decimal.from_float(v) for k,v in values.items()},
            "stageBinary32Bits":{k:struct.pack("!f",v).hex() for k,v in values.items()},
            "sourceFactorInwardBinary32":Decimal.from_float(binary32(float(inward))),
            "representationContributionsMtCO2":losses,"accountingResidualMtCO2":closure,
            "emulatedExportMinusNativeMtCO2":Decimal(exported)-Decimal(native),
            "nativeMinusRawMtCO2":direct,"strictDisplayOnlyEnvelopeMtCO2":Decimal(".0005"),
            "strictDisplayOnlyPass":strict_display_gate(raw,native),
            "losslessReferenceOnlyCSVString":str(reference),
            "referenceReplacesNative":False,"sourcePathReproduced":True}


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def line_proof(path,terms):
    text=Path(path).read_text()
    result={}
    for term in terms:
        hits=[i for i,line in enumerate(text.split("\n"),1) if term in line]
        if not hits:
            raise ValueError("Required exact source operation missing: "+term)
        result[term]=hits
    return result


def assemble():
    receipts=[]
    for folder,plan in ((ROOT,PLAN),(ROOT/"packing-followup",Path("docs/kaya-precision-packing-followup.json"))):
        manifest=json.loads((folder/"requests.json").read_text())
        if manifest["planSHA256"]!=digest(plan):
            raise ValueError("Frozen acquisition plan changed")
        receipts.extend(manifest["requests"])
        for row in manifest["requests"]:
            for part in ("body","headers"):
                if digest(row[part])!=row[part+"SHA256"]:
                    raise ValueError("Source receipt bytes changed")
    old=Path("generated-artifacts/kaya-samerelease-upstream")
    native_path=Path("generated-artifacts/driver-calibration/kaya-co2.csv")
    pins={str(native_path):"7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6",
          str(old/"gcb-v15-flat.body"):"20650c19b394d91b6b31cddff2fbc9508bcdbbed7c3f93660336f2f655f367ff",
          str(old/"provider-label-projection.body"):"b0c96dfa6337f072581c7821be0dc7fc509a185751ac90b99f9efd42b5306dad",
          str(old/"eia-only-primary-energy.body"):"21d89a809215793e0fc3d8ea63e08cb748aa478fbb6c1f72025159de2b2edb7f",
          str(old/"same-release-source-assembly.json"):"4ceea428dd7f2cac95081384942e4c4be5fafa80cdcccba4b0ace052500b2883",
          "generated-artifacts/kaya-eu-energy-definition/gcb-method.body":"3b6192f08ade1dde982957cfc0298657c55154f06ba914ee1ee8b5292b2980d9",
          "generated-artifacts/kaya-eu-energy-definition/gcb-metadata.body":"6e03d52ff82c037798f42f3a56a45a285b583204490ac8876bb78feeeda1c2a4"}
    for path,expected in pins.items():
        if digest(path)!=expected:
            raise ValueError("Retained original/alternative input changed")
    with (old/"gcb-v15-flat.body").open() as stream:
        raw=next(r["Total"] for r in csv.DictReader(stream) if r["Country"]=="France" and r["Year"]=="2020")
    with native_path.open() as stream:
        native=next(r["co2"] for r in csv.DictReader(stream) if r["country"]=="France" and r["year"]=="2020")
    with (ROOT/"france2020-stage-values.body").open() as stream:
        rows=list(csv.DictReader(stream))
    if len(rows)!=3 or any(r["country"]!="France" or r["year"]!="2020" for r in rows):
        raise ValueError("Unexpected numerical projection domain")
    gcb=Path("generated-artifacts/kaya-eu-energy-definition/gcb-method.body")
    gcb_metadata=Path("generated-artifacts/kaya-eu-energy-definition/gcb-metadata.body")
    if not re.search(r'(?m)^      emissions_total:\n        title:.*\n        unit: "tonnes"',gcb_metadata.read_text()):
        raise ValueError("Exact source emissions_total metadata unit not established")
    outward=literal_assignment(gcb.read_text(),"MILLION_TONNES_OF_CO2_TO_TONNES_OF_CO2")
    inward=literal_assignment((ROOT/"co2-garden-method.body").read_text(),"TONNES_TO_MILLION_TONNES")
    export_tree=ast.parse((ROOT/"co2-export-method.body").read_text())
    formats=[kw.value.value for node in ast.walk(export_tree) if isinstance(node,ast.Call)
             for kw in node.keywords if kw.arg=="float_format" and isinstance(kw.value,ast.Constant)]
    if formats!=["%.3f"]:
        raise ValueError("Unambiguous original exporter precision required")
    proof=representation_proof(raw,native,{r["stage"]:r for r in rows},outward,inward,formats[0])
    operations={
        "GCBGarden":line_proof(gcb,["safe_types=False","tb_co2[EMISSION_SOURCES] *= MILLION_TONNES_OF_CO2_TO_TONNES_OF_CO2"]),
        "OWIDGarden":line_proof(ROOT/"co2-garden-method.body",['"emissions_total": "co2"',
                                                                    'tb_gcp = ds_gcp["global_carbon_budget"]',
                                                                    'table[column] *= UNITS[unit]["conversion"]']),
        "DatasetReader":line_proof(ROOT/"catalog-datasets-method.body",["return self.read(name, reset_index=False, safe_types=False)"]),
        "ExporterSafePromotion":line_proof(ROOT/"catalog-datasets-method.body",["safe_types: bool = True",
                                                                               "t = cast(tables.Table, to_safe_types(t))"]),
        "TableSerialization":line_proof(ROOT/"catalog-core-tables.body",["def to_parquet(self, path: Any, repack: bool = True)","df = repack_frame(df)"]),
        "Packing":line_proof(ROOT/"packing-followup/repack-method.body",
                            ['options = ["Float32", "Float64"]',"v = s.astype(dtype)",
                             "rtol: float = 1e-5, atol: float = 1e-8","return np.allclose"]),
        "CSVExport":line_proof(ROOT/"co2-export-method.body",['float_format="%.3f"'])}
    unsd=(ROOT/"unsd-2023-country-metadata.txt").read_text()
    cdiac=(ROOT/"cdiac-primary-method.body").read_text()
    challenge=(ROOT/"sanmarino-primary-documents.body").read_text()
    gcb_notes=(old/"gcb-v15-notes.txt").read_text()
    territory={"UNFCCCSearchHTTP200IsDocument":not("Incapsula" in challenge or "Request unsuccessful" in challenge),
               "UNFCCCOutcome":"Semantic access challenge,no national document admitted,no bypass/retry",
               "UNSDYearbookVersion":2023,"UNSDMetadataSanMarinoMentions":len(re.findall(r"San\s+Marino",unsd,re.I)),
               "UNSDItalySection":line_proof(ROOT/"unsd-2023-country-metadata.txt",["Italy [382]"]),
               "UNSDOutcome":"Actual country metadata acquired;Italy entry identifies EU/OECD membership and sources,not SanMarino parent inclusion. Not spliced into GCB2025.",
               "CDIACMethodVersion":2021,"CDIACSanMarinoMentions":len(re.findall(r"San\s+Marino",cdiac,re.I)),
               "GCB2025GeographyPolicy":line_proof(old/"gcb-v15-notes.txt",[
                   "geographies of countries included beyond a name and a three-letter ISO code.",
                   "geographies is something we intend to look at in future.",
                   "transpire, for example, that cement emissions for one country have a different geographical boundary"]),
               "GCB2025SanMarinoMentions":len(re.findall(r"San\s+Marino",gcb_notes,re.I)),
               "SanMarinoParentQualified":False,"assignedParent":None,"missingCountryCO2IsZero":False}
    result={"schemaVersion":1,"methodSHA256":digest(__file__),"preservedSourcePins":pins,
            "France2020Representation":proof,"observedStageRows":rows,"exactSourceOperations":operations,
            "packingPolicyIsOurScientificTolerance":False,"SanMarinoTerritory":territory,
            "sourceVersionFamily":"Original dated namespaces and original pinned ETLcode;current stage artifacts not independently certified original worker artifacts",
            "dependencyVersionsOriginalWorkerCertified":False,
            "originalFullWindowQualifiedEntities":[],"fits":0,"holdoutScores":0,
            "unavailableCasesAreStatisticalRejections":False,"nativeCSVChanged":False,
            "oldAuditsReplayed":False,"EI403Requests":0}
    out=ROOT/"precision-territory-result.json"
    out.write_text(json.dumps(result,indent=2,default=str)+"\n")
    print(json.dumps({"originalStrictDisplayOnlyPass":proof["strictDisplayOnlyPass"],
                      "unchangedRawResidualMtCO2":str(proof["nativeMinusRawMtCO2"]),
                      "sourceRepresentationAccountingResidualMtCO2":str(proof["accountingResidualMtCO2"]),
                      "sourcePathReproduced":proof["sourcePathReproduced"],
                      "SanMarinoParentQualified":False,"fits":0,"resultSHA256":digest(out)},indent=2))


def validate_private():
    import unittest
    t=unittest.TestCase()
    result=json.loads((ROOT/"precision-territory-result.json").read_text())
    t.assertEqual(result["methodSHA256"],digest(__file__))
    for path,expected in result["preservedSourcePins"].items():
        t.assertEqual(digest(path),expected)
    count=0
    for folder,plan,size in ((ROOT,PLAN,18),
                            (ROOT/"packing-followup",Path("docs/kaya-precision-packing-followup.json"),1)):
        manifest=json.loads((folder/"requests.json").read_text())
        t.assertEqual(manifest["planSHA256"],digest(plan))
        t.assertEqual(len(manifest["requests"]),size)
        for row in manifest["requests"]:
            for key in ("body","headers"):
                t.assertEqual(digest(row[key]),row[key+"SHA256"])
                count+=1
    p=result["France2020Representation"]
    t.assertFalse(p["strictDisplayOnlyPass"])
    t.assertEqual(p["strictDisplayOnlyEnvelopeMtCO2"],"0.0005")
    t.assertEqual(p["nativeMinusRawMtCO2"],"-0.000507")
    t.assertEqual(Decimal(p["accountingResidualMtCO2"]),0)
    t.assertEqual(Decimal(p["emulatedExportMinusNativeMtCO2"]),0)
    t.assertEqual(p["nativeCSVString"],"281.515")
    t.assertEqual(p["losslessReferenceOnlyCSVString"],"281.516")
    t.assertFalse(p["referenceReplacesNative"])
    t.assertTrue(p["sourcePathReproduced"])
    t.assertFalse(result["SanMarinoTerritory"]["SanMarinoParentQualified"])
    t.assertFalse(result["SanMarinoTerritory"]["UNFCCCSearchHTTP200IsDocument"])
    t.assertEqual(result["SanMarinoTerritory"]["UNSDMetadataSanMarinoMentions"],0)
    t.assertEqual(result["originalFullWindowQualifiedEntities"],[])
    t.assertEqual(result["fits"],0)
    print(json.dumps({"requiredPrivateAssertions":"passed","responseHashesVerified":count,
                      "retainedSourcePinsVerified":len(result["preservedSourcePins"]),
                      "strictOriginalFailurePreserved":True,"sourceEquationClosure":"exactzero",
                      "nativeDataReplaced":False,"fits":0}))


def retrieve(name,url,cap=2000000):
    # Reuse bounded transport,with a disjoint receipt store/frozen plan.
    import kaya_samerelease_upstream_sources as transport
    transport.ROOT=ROOT
    transport.PLAN=PLAN
    transport.retrieve(name,url,cap)


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("url",nargs="?")
    parser.add_argument("--cap",type=int,default=2000000)
    args=parser.parse_args()
    if args.name=="assemble":
        assemble()
    elif args.name=="validate-private":
        validate_private()
    elif args.url:
        retrieve(args.name,args.url,args.cap)
    else:
        parser.error("Publisher source URL required")

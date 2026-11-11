"""Focused source-definition acquisition;retained EU rows only,not census rebuild."""
import argparse
import ast
from collections import Counter
import csv
from datetime import datetime, timezone
from decimal import Decimal, localcontext
import hashlib
from fractions import Fraction
import json
from pathlib import Path
import subprocess

ROOT = Path("generated-artifacts/kaya-eu-energy-definition")
PLAN = Path("docs/kaya-eu-energy-definition-source-plan.json")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, data):
    path.write_text(json.dumps(data, indent=2, default=str) + "\n")


def get(name, url, cap):
    plan = json.loads(PLAN.read_text())
    ROOT.mkdir(parents=True, exist_ok=True)
    path = ROOT / "requests.json"
    manifest = json.loads(path.read_text()) if path.exists() else {"planSHA256":sha(PLAN),"requests":[]}
    if manifest["planSHA256"] != sha(PLAN) or len(manifest["requests"]) >= plan["maximumRequests"]:
        raise ValueError("Frozen bounded acquisition contract")
    if any(r["name"] == name or r["url"] == url for r in manifest["requests"]):
        raise ValueError("No retries/duplicate retrieval")
    if cap > plan["maximumEachBodyBytes"] or sum(r["bytes"] for r in manifest["requests"]) + cap > plan["maximumTotalBodyBytes"]:
        raise ValueError("Acquisition cap")
    body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
    start = datetime.now(timezone.utc).isoformat()
    run = subprocess.run(["curl","-sS","-L","--max-redirs","5","--max-time","45",
                          "--max-filesize",str(cap),"-D",str(headers),"-o",str(body),
                          "-w","%{http_code}\\n%{url_effective}\\n",url],
                         capture_output=True,text=True,timeout=50)
    lines = run.stdout.splitlines()
    receipt = {"name":name,"url":url,"startedUTC":start,"completedUTC":datetime.now(timezone.utc).isoformat(),
               "capBytes":cap,"status":lines[0] if lines else None,"curlExit":run.returncode,
               "effectiveURL":lines[1] if len(lines)>1 else None,"stderr":run.stderr,
               "bytes":body.stat().st_size if body.exists() else 0,
               "body":str(body),"bodySHA256":sha(body) if body.exists() else None,
               "headers":str(headers),"headersSHA256":sha(headers) if headers.exists() else None}
    manifest["requests"].append(receipt)
    save(path,manifest)
    print(json.dumps(receipt),flush=True)
    if receipt["status"] != "200" or receipt["curlExit"] != 0:
        raise ValueError("Explicit retrieval failure;no retry")


def isolate_member(aggregate, member_values, member):
    """Source accounting identity,NOT an observed value for missing upstream member."""
    if member not in member_values or len(member_values) != 27:
        raise ValueError("Exact27 member cells including named isolated member required")
    if (aggregate is None or not aggregate.is_finite() or aggregate < 0
            or any(v is None or not v.is_finite() or v < 0 for v in member_values.values())):
        raise ValueError("Complete finite native energy required")
    with localcontext() as context:
        context.prec = 100
        others = sum((v for key,v in member_values.items() if key != member),Decimal(0))
        implied = aggregate - others
        residual = implied - member_values[member]
    return {"other26NativeSumTWh":others,"nativeNamedMemberTWh":member_values[member],
            "aggregateMinusOther26TWh":implied,"aggregateMinusAll27TWh":residual,
            "impliedMemberIsObservedUpstreamValue":False,"scientificBoundaryQualified":False}


def revision_accounting(new_aggregate, old_aggregate, new_members, old_members):
    """Attribute changes in arithmetic residuals,not physical causation."""
    if set(new_members)!=set(old_members) or len(new_members)!=27:
        raise ValueError("Identical27 member domains required")
    if old_aggregate is None or any(v is None for v in old_members.values()):
        return {"legacyCompleteResidualTWh":None,"residualChangeTWh":None,
                "missingLegacyMembers":[k for k,v in old_members.items() if v is None],
                "noMissingLegacyZeroFill":True}
    with localcontext() as context:
        context.prec=100
        current=new_aggregate-sum(new_members.values(),Decimal(0))
        prior=old_aggregate-sum(old_members.values(),Decimal(0))
        aggregate_change=new_aggregate-old_aggregate
        changes={k:new_members[k]-old_members[k] for k in new_members if new_members[k]!=old_members[k]}
        change=current-prior
        remainder=change-(aggregate_change-sum(changes.values(),Decimal(0)))
    if remainder != 0:
        raise ValueError("Exact revision accounting failed")
    return {"legacyCompleteResidualTWh":prior,"residualChangeTWh":change,
            "regionalAggregateRevisionTWh":aggregate_change,"nativeMemberRevisionsTWh":changes,
            "revisionAccountingResidualTWh":remainder,"physicalCausationClaim":False}


def conversion_fraction(source, variable):
    """Read only a literal published division;never execute publisher code."""
    tree = ast.parse(source)
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == variable for t in node.targets):
            value = node.value
            if (not isinstance(value, ast.BinOp) or not isinstance(value.op, ast.Div)
                    or not isinstance(value.left, ast.Constant) or not isinstance(value.right, ast.Constant)
                    or type(value.left.value) not in (int,float) or type(value.right.value) not in (int,float)):
                raise ValueError("Only literal published unit division permitted")
            return Fraction(str(value.left.value)) / Fraction(str(value.right.value))
    raise ValueError("Published unit conversion absent")


def require_terms(source, terms):
    found = {}
    for term in terms:
        lines = [n for n,line in enumerate(source.splitlines(),1) if term in line]
        if not lines:
            raise ValueError("Required publisher method absent:" + term)
        found[term] = lines
    return found


def assemble():
    plan = json.loads(PLAN.read_text())
    base = Path("generated-artifacts/kaya-joint-territorial")
    if (sha(base / "joint-territorial-source-result.json") != plan["retainedJointResultSHA256"]
            or sha(base / "paired-native-source-cells.json") != plan["retainedPairedCellsSHA256"]):
        raise ValueError("Retained census changed")
    manifest = json.loads((ROOT / "requests.json").read_text())
    if manifest["planSHA256"] != sha(PLAN) or len(manifest["requests"]) != 10:
        raise ValueError("Frozen10-request acquisition contract")
    for receipt in manifest["requests"]:
        if receipt["status"] != "200" or receipt["curlExit"] != 0:
            raise ValueError("Source retrieval unsuccessful")
        for key in ("body","headers"):
            if sha(receipt[key]) != receipt[key+"SHA256"]:
                raise ValueError("Source bytes changed")
    paired = json.loads((base / "paired-native-source-cells.json").read_text())
    retained_result = json.loads((base / "joint-territorial-source-result.json").read_text())
    ei = (ROOT / "ei-method.body").read_text()
    eia = (ROOT / "eia-method.body").read_text()
    primary = (ROOT / "primary-energy-method.body").read_text()
    gcb = (ROOT / "gcb-method.body").read_text()
    meta = (ROOT / "gcb-metadata.body").read_text()
    aliases = json.loads((ROOT / "gcb-country-map.body").read_text())
    method_proofs = {
        "primary": require_terms(primary, ['"primary_energy_consumption_equivalent_twh"', '"total_energy_consumption"',
                    'prioritize Statistical Review data', 'keep="last"', 'OUTLIERS = ["Gibraltar"]']),
        "EI": require_terms(ei, ['"primary_ej": "primary_energy_consumption_equivalent_ej"',
                    'For now, we are ignoring TES', 'EJ_TO_TWH = 1e6 / 3600',
                    'tb = create_region_aggregates', 'tb = create_primary_energy_in_input_equivalents']),
        "EIA": require_terms(eia, ['TJ_TO_TWH = 1 / 3600','"Total energy consumption"', '"terajoules"']),
        "CO2": require_terms(meta, ["territorial emissions",
                    "They are only counted in the global total."]),
        "CO2_region": require_terms(gcb, ['"European Union (27)": {}'])}
    conversions = {"EI_EJ_to_TWh":str(conversion_fraction(ei,"EJ_TO_TWH")),
                   "EIA_TJ_to_TWh":str(conversion_fraction(eia,"TJ_TO_TWH")),
                   "appliedToChangeAnyNativeValue":False}
    # Inspect source AST names,not arbitrary imported source execution.
    region_node = next(n.value for n in ast.parse(ei).body if isinstance(n,ast.Assign)
                       and any(isinstance(t,ast.Name) and t.id=="REGIONS" for t in n.targets))
    ei_reaggregated_regions = [k.value for k in region_node.keys]
    checks = [r for r in paired["EU27NativeAggregateReconciliation"] if r["field"]=="primaryEnergyTWh"]
    rows = []
    for check in checks:
        members = {c["country"]:Decimal(c["value"]) for c in check["nativeMemberCells"]}
        rows.append({"year":check["year"],"nativeEU27TWh":check["nativeAggregate"]["value"],
                     **isolate_member(Decimal(check["nativeAggregate"]["value"]),members,"Malta"),
                     "meaning":"Residual accounting isolation only. Aggregate-minus-other26 is NOT independently observed EI Malta and cannot prove the entire discrepancy is Malta.",
                     "source":check["nativeAggregate"]["source"],
                     "memberSourceLogicalRows":{c["country"]:c["sourceLogicalRow"] for c in check["nativeMemberCells"]}})
    # Read the already-retained legacy energy file only for these28 entities.
    # This is a focused source overlap test,not rebuilding any national census.
    legacy = Path("generated-artifacts/driver-calibration/owid-energy-data.csv")
    if sha(legacy) != "266f2e2baad7975351bc9bb4aa061d22b1da9fe4c47d51d2ac6071e01e171f76":
        raise ValueError("Retained legacy energy source changed")
    names = {c["country"] for c in checks[0]["nativeMemberCells"]} | {"European Union (27)"}
    lookup = {}
    with legacy.open() as stream:
        for n,r in enumerate(csv.DictReader(stream),1):
            if r["country"] in names and 2010<=int(r["year"])<=2024:
                key=(r["country"],int(r["year"]))
                if key in lookup:
                    raise ValueError("Duplicate focused legacy energy row")
                lookup[key]={"value":Decimal(r["primary_energy_consumption"]) if r["primary_energy_consumption"] else None,
                             "sourceLogicalRow":n}
    overlap = []
    for check in checks:
        for cell in [check["nativeAggregate"]]+check["nativeMemberCells"]:
            old=lookup.get((cell["country"],check["year"]),{"value":None,"sourceLogicalRow":None})
            overlap.append({"country":cell["country"],"year":check["year"],
                            "nativeCO2EnergyTWh":cell["value"],"legacyEnergyTWh":old["value"],
                            "differenceTWh":None if old["value"] is None else Decimal(cell["value"])-old["value"],
                            "legacySourceLogicalRow":old["sourceLogicalRow"]})
    for row,check in zip(rows,checks):
        new_members={c["country"]:Decimal(c["value"]) for c in check["nativeMemberCells"]}
        old_members={name:lookup.get((name,check["year"]),{"value":None})["value"] for name in new_members}
        row["retainedLegacyRevisionAccounting"]=revision_accounting(
            Decimal(check["nativeAggregate"]["value"]),lookup[("European Union (27)",check["year"])]["value"],
            new_members,old_members)
    nulls = []
    for code,raw,canonical in [("MCO","Monaco","Monaco"),("SMR","San Marino","San Marino"),
                               ("VAT","Vatican City","Vatican"),("XKX","Kosovo","Kosovo")]:
        if aliases.get(raw)!=canonical:
            raise ValueError("Publisher canonical identity differs")
        selected=[r for r in paired["nationalCandidateCells"] if r["countryIdentifier"]==code]
        nulls.append({"countryIdentifier":code,"sourceRawLabel":raw,"publisherCanonicalLabel":canonical,
                      "sourceAliasMapsToParentCountry":False,
                      "rows":len(selected),
                      "emptyNativeCO2Cells":sum(r["cells"]["CO2Mt"]["value"] is None for r in selected),
                      "emptyNativeEnergyCells":sum(r["cells"]["primaryEnergyTWh"]["value"] is None for r in selected),
                      "emptyWDIGDP2021Cells":sum(r["cells"]["GDP2021PPP"]["value"] is None for r in selected),
                      "WDIGDPGapStatuses":dict(Counter(r["status"] for r in retained_result["missingNationalSourceCells"]
                                                      if r["countryIdentifier"]==code and r["field"]=="GDP2021PPP")),
                      "scope":"Canonical name now publisher-qualified. Does NOT establish shared GDP/population/energy territorial scope or source-parent emission inclusion."})
    # Original,not WDI,entity qualification remains a separate full-window gate.
    native = Path("generated-artifacts/driver-calibration/kaya-co2.csv")
    if sha(native)!="7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6":
        raise ValueError("Original source changed")
    original = {name:[] for name in ["World","China","India","United States","European Union (27)"]}
    with native.open() as stream:
        for r in csv.DictReader(stream):
            if r["country"] in original and 2010<=int(r["year"])<=2024 and not r["gdp"]:
                original[r["country"]].append(int(r["year"]))
    result={"assembledUTC":datetime.now(timezone.utc).isoformat(),"methodSHA256":sha(__file__),
            "planSHA256":sha(PLAN),"requestManifestSHA256":sha(ROOT/"requests.json"),
            "retainedCensusRebuilt":False,"focusedEnergyCells":len(overlap),
            "sourceMethodLineProofs":method_proofs,"sourceUnitConversions":conversions,
            "EIReaggregatedRegionKeys":ei_reaggregated_regions,
            "EIReaggregatesEU27InThisMethod":"European Union (27)" in ei_reaggregated_regions,
            "regionalAndMemberSourcePolicy":"Primary bridge prioritizes EI per country/year;does not recompute EU27 after EIA fallback. Units normalized,but provider/method/territory uniformity does not follow.",
            "EU27FocusedAccounting":rows,"retainedEnergyOverlap":overlap,
            "overlapExactlyEqualCells":sum(r["differenceTWh"]==0 for r in overlap if r["differenceTWh"] is not None),
            "overlapUnavailableCells":[r for r in overlap if r["legacyEnergyTWh"] is None],
            "overlapNonzeroCells":[r for r in overlap if r["differenceTWh"] not in (None,0)],
            "canonicalCO2IdentityAudit":nulls,
            "sourceCO2Scope":"Publisher says territorial production CO2;international aviation/shipping excluded from every individual country/region and included only in World. This is now source-defined,not inferred from residual closure.",
            "sourceDefinedGibraltarPrimaryEnergyExclusion":True,
            "WorldEnergyResidualIsBunkerEnergy":False,
            "originalEntityGDPGapYears":original,
            "originalFullWindowQualifiedEntities":[],
            "unavailableCasesAreStatisticalRejections":False,
            "remainingSourceInputs":["Same-release primary dataset country/year provider flags to certify which EI/EIA observations form420selected cells",
               "EI2025 source Definitions sheet and full-precision regional/member legacy primary energy to separate provider-revision/territory effects;do not attribute residual uniquely to Malta",
               "Upstream GCB2025 national-country reporting/parent-territory notes for MCO/SMR/VAT;self-alias mapping is not proof parent emissions include them",
               "Original2011PPP2023/24GDP and World2011-14/EU27full frozen GDP gaps;WDI2021PPP cannot qualify original holdouts"],
            "originalDataVintagesCertified":False,"WDI2021PPPSensitivityOnly":True,
            "fits":0,"breakTests":0,"holdoutScores":0,"centralEligible":False}
    save(ROOT/"focused-definition-result.json",result)
    print(json.dumps({"energyCells":len(overlap),"exactOverlap":result["overlapExactlyEqualCells"],
                     "nonzeroOverlap":len(result["overlapNonzeroCells"]),"unavailableOverlap":len(result["overlapUnavailableCells"]),
                     "canonicalIdentities":nulls,"originalGDPGaps":original,"resultSHA256":sha(ROOT/"focused-definition-result.json")},indent=2))


def validate_private():
    """Required retained-byte validator;missing private files fail,never skip."""
    import unittest
    check=unittest.TestCase()
    plan=json.loads(PLAN.read_text())
    base=Path("generated-artifacts/kaya-joint-territorial")
    check.assertEqual(sha(base/"joint-territorial-source-result.json"),plan["retainedJointResultSHA256"])
    check.assertEqual(sha(base/"paired-native-source-cells.json"),plan["retainedPairedCellsSHA256"])
    manifest=json.loads((ROOT/"requests.json").read_text())
    check.assertEqual(len(manifest["requests"]),10)
    for receipt in manifest["requests"]:
        check.assertEqual(receipt["status"],"200")
        check.assertEqual(receipt["curlExit"],0)
        for key in ("body","headers"):
            check.assertEqual(sha(receipt[key]),receipt[key+"SHA256"])
    # Native Git object verification for all3 discovered GCB source files.
    directory=json.loads((ROOT/"gcb-directory.body").read_text())
    for name,filename in [("gcb-method","global_carbon_budget.py"),
                           ("gcb-metadata","global_carbon_budget.meta.yml"),
                           ("gcb-country-map","global_carbon_budget.countries.json")]:
        entry=next(x for x in directory if x["name"]==filename)
        raw=(ROOT/(name+".body")).read_bytes()
        check.assertEqual(len(raw),entry["size"])
        check.assertEqual(hashlib.sha1(b"blob "+str(len(raw)).encode()+b"\0"+raw).hexdigest(),entry["sha"])
    result=json.loads((ROOT/"focused-definition-result.json").read_text())
    check.assertEqual(result["methodSHA256"],sha(__file__))
    check.assertEqual(result["focusedEnergyCells"],420)
    check.assertEqual(result["overlapExactlyEqualCells"],417)
    check.assertEqual([(r["country"],r["year"],r["differenceTWh"]) for r in result["overlapNonzeroCells"]],
                      [("Malta",2022,"0.010"),("Malta",2023,"2.457")])
    check.assertEqual([(r["country"],r["year"]) for r in result["overlapUnavailableCells"]],[("Malta",2024)])
    for row in result["EU27FocusedAccounting"]:
        check.assertFalse(row["impliedMemberIsObservedUpstreamValue"])
        check.assertFalse(row["scientificBoundaryQualified"])
        rev=row["retainedLegacyRevisionAccounting"]
        if row["year"]==2024:
            check.assertIsNone(rev["legacyCompleteResidualTWh"])
            check.assertEqual(rev["missingLegacyMembers"],["Malta"])
        else:
            check.assertEqual(Decimal(rev["revisionAccountingResidualTWh"]),0)
    row=next(r for r in result["EU27FocusedAccounting"] if r["year"]==2023)
    check.assertEqual(row["retainedLegacyRevisionAccounting"]["legacyCompleteResidualTWh"],"2.130")
    check.assertEqual(row["aggregateMinusAll27TWh"],"-0.327")
    check.assertEqual(row["retainedLegacyRevisionAccounting"]["residualChangeTWh"],"-2.457")
    check.assertFalse(result["EIReaggregatesEU27InThisMethod"])
    check.assertTrue(result["sourceDefinedGibraltarPrimaryEnergyExclusion"])
    check.assertFalse(result["WorldEnergyResidualIsBunkerEnergy"])
    check.assertEqual(result["originalFullWindowQualifiedEntities"],[])
    check.assertFalse(result["unavailableCasesAreStatisticalRejections"])
    check.assertEqual(result["fits"],0)
    check.assertEqual(result["holdoutScores"],0)
    print(json.dumps({"privateResponseHashesVerified":20,"publisherGitBlobsVerified":3,
                      "retainedCensusHashesVerified":2,"focusedEnergyCells":420,
                      "exactSourceOverlapCells":417,"missingFilesSkipped":0,
                      "censusRebuilds":0,"sourceOrForecastReruns":0,"fits":0}))


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("url",nargs="?")
    parser.add_argument("--cap",type=int,default=1000000)
    args=parser.parse_args()
    if args.name=="assemble":
        assemble()
    elif args.name=="validate-private":
        validate_private()
    elif args.url:
        get(args.name,args.url,args.cap)
    else:
        parser.error("Acquisition requires exact source URL")

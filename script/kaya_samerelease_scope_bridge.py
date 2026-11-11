"""Rights-gated source assembly,not forecasting or numerical source replacement."""
import csv
import hashlib
import io
import json
import re
from collections import Counter
from decimal import Decimal, localcontext
from pathlib import Path

ROOT=Path("generated-artifacts/kaya-samerelease-upstream")
YEARS=tuple(range(2010,2025))
MISSING=("", "[NONE]")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def exact_source_binding(raw,expected_md5,expected_size):
    if len(raw)!=expected_size or hashlib.md5(raw).hexdigest()!=expected_md5:
        raise ValueError("Publisher release/snapshot byte identity failed")


def source_specific_rights(license_name,terms_status=None):
    # Public access/copyright-only/non_redistributable=False are NOT permission.
    if license_name in ("CC BY 4.0","Public domain"):
        return {"numericUseAdmitted":True,"basis":license_name}
    return {"numericUseAdmitted":False,"basis":"Source-specific permission unverified",
            "termsHTTPStatus":terms_status,"publicDownloadURLIsPermission":False}


def numeric_cell(text):
    if text in MISSING or text is None:
        return None
    value=Decimal(text)
    if not value.is_finite() or value<0:
        raise ValueError("Nonfinite/negative source observation")
    return value


def display_rounding_only_compatible(primary,native):
    """Fixed three-decimal nearest-display envelope,not a relaxed source-fit gate."""
    if primary is None or native is None:
        return None
    return abs(native-primary)<=Decimal("0.0005")


def unique_grid(rows,field_names,countries,years):
    """Reject incomplete/foreign domains and duplicate or extra-column payloads."""
    result={}
    for row in rows:
        if set(row)!=set(field_names):
            raise ValueError("Unexpected projected columns")
        year=int(row["year"])
        key=(row["country"],year)
        if key in result or key[0] not in countries or year not in years:
            raise ValueError("Duplicate/foreign source identity")
        result[key]=row
    expected={(name,year) for name in countries for year in years}
    if set(result)!=expected:
        raise ValueError("Full original country/year domain required")
    return result


def provider_grid(text,countries,years=YEARS):
    rows=unique_grid(csv.DictReader(io.StringIO(text)),("country","year","source"),countries,years)
    if any(r["source"] not in ("ei","eia") for r in rows.values()):
        raise ValueError("Unknown source provider")
    return rows


def complete_regional_sum(values,expected_members):
    if len(expected_members)!=27 or len(values)!=27 or set(values)!=set(expected_members):
        raise ValueError("Exact fixed27 members required")
    if any(v is None for v in values.values()):
        raise ValueError("No partial regional sum or missing-zero fill")
    if any(not v.is_finite() or v<=0 for v in values.values()):
        raise ValueError("Positive finite energy required")
    with localcontext() as context:
        context.prec=100
        return sum(values.values(),Decimal(0))


def table_eia_rights(metadata):
    dataset=metadata["dataset"]
    if (dataset["namespace"],dataset["version"],dataset["short_name"])!=("eia","2026-05-05","international_energy"):
        raise ValueError("Wrong EIA version family")
    field=metadata["fields"]["total_energy_consumption"]
    if field["unit"]!="terawatt-hours" or not field["origins"]:
        raise ValueError("Source field unit/origin missing")
    if any(o["producer"]!="U.S. Energy Information Administration"
           or not source_specific_rights(o["license"]["name"])["numericUseAdmitted"]
           for o in field["origins"]):
        raise ValueError("Mixed/unqualified source rights")
    return field


def retain_targets(path,targets):
    """No national census rebuild:only explicitly requested source rows retained."""
    selected={}
    with Path(path).open() as stream:
        for logical_row,row in enumerate(csv.DictReader(stream),2):
            year=int(row["Year"])
            if row["ISO 3166-1 alpha-3"] in ("MCO","SMR","VAT") and row["Country"] not in targets:
                raise ValueError("Target source code exists under unexpected alias;explicit bridge required")
            if row["Country"] not in targets or year not in YEARS:
                continue
            key=(row["Country"],year)
            if key in selected:
                raise ValueError("Duplicate primary source row")
            selected[key]={**row,"sourceLogicalRow":logical_row}
    return selected


def assemble():
    manifest=json.loads((ROOT/"requests.json").read_text())
    if manifest["planSHA256"]!=digest("docs/kaya-samerelease-upstream-acquisition-plan.json"):
        raise ValueError("Acquisition plan changed")
    for request in manifest["requests"]:
        for part in ("body","headers"):
            if digest(request[part])!=request[part+"SHA256"]:
                raise ValueError("Retained request bytes changed")
    query=json.loads((ROOT/"provider-query.json").read_text())
    names=query["names"]
    flags=provider_grid((ROOT/"provider-label-projection.body").read_text(),names)
    meta=json.loads((ROOT/"primary-table-metadata-probe.body").read_text())
    if (meta["dataset"]["namespace"],meta["dataset"]["version"],meta["dataset"]["short_name"])!=(
            "energy","2026-05-05","primary_energy_consumption"):
        raise ValueError("Unexpected primary provider metadata version")
    origins=meta["fields"]["source"]["origins"]
    version_origins=[{k:o.get(k) for k in ("producer","date_accessed","date_published","citation_full","license")}
                     for o in origins]
    if {o["date_accessed"] for o in origins}!={"2025-06-27","2026-05-05"}:
        raise ValueError("Source origin version family changed")
    ei_rights=source_specific_rights(next(o["license"]["name"] for o in origins if o["producer"]=="Energy Institute"),"403")
    ei_metadata=(ROOT/"ei-metadata.body").read_text()
    ei_terms=("Comprises commercially-traded fuels, including modern renewables used to generate electricity.",
              "Includes inland demand plus international aviation and marine bunkers and refinery fuel and loss.")
    ei_definition_lines={}
    for term in ei_terms:
        hits=[n for n,line in enumerate(ei_metadata.split("\n"),1) if term in line]
        if not hits:
            raise ValueError("Exact EI source definition metadata missing")
        ei_definition_lines[term]=hits
    members=[n for n in names if n!="European Union (27)"]
    eia_meta=json.loads((ROOT/"eia-table-metadata.body").read_text())
    table_eia_rights(eia_meta)
    eia_names=json.loads((ROOT/"eia-only-query.json").read_text())["names"]
    energy=unique_grid(csv.DictReader((ROOT/"eia-only-primary-energy.body").open()),
                       ("country","year","total_energy_consumption"),eia_names,YEARS)
    eia_region=[]
    for year in YEARS:
        member_values={name:numeric_cell(energy[name,year]["total_energy_consumption"]) for name in members}
        total=complete_regional_sum(member_values,members)
        native=numeric_cell(energy["European Union (27)",year]["total_energy_consumption"])
        with localcontext() as context:
            context.prec=100
            residual=native-total if native is not None else None
        eia_region.append({"year":year,"completeMembers":27,"EIAOnlySum27TWh":total,
                           "publisherEIAEU27TWh":native,"nativeMinusCompleteMembersTWh":residual,
                           "nativeRegionalValueReplaced":False,"scientificCompatibilityQualified":False})
    # Exact version-specific GCB bytes also match the original pinned OWID input snapshot.
    route=json.loads(Path("docs/kaya-samerelease-gcb-numeric-route.json").read_text())
    record=json.loads((ROOT/"gcb-v15-record.body").read_text())
    if str(record["id"])!="17417124" or record["metadata"]["license"]["id"]!="cc-by-4.0":
        raise ValueError("Exact GCB version-specific data rights not admitted")
    for name,f in zip(("gcb-v15-notes","gcb-v15-flat-metadata","gcb-v15-flat","gcb-v15-source-flags"),route["files"]):
        exact_source_binding((ROOT/(name+".body")).read_bytes(),f["md5"],f["size"])
    if "md5: 3008e30d913af5926a83d0d0775fb72e" not in (ROOT/"gcb-fossil-dvc.body").read_text():
        raise ValueError("Original fossil snapshot does not bind this numerical file")
    gcb_meta=json.loads((ROOT/"gcb-v15-flat-metadata.body").read_text())
    if next(f for f in gcb_meta["fields"] if f["name"]=="Total")["units"]!="millions of tonnes of CO2":
        raise ValueError("Native gas/unit mismatch")
    targets=("France","Italy","Kosovo","Monaco","San Marino","Vatican City")
    primary=retain_targets(ROOT/"gcb-v15-flat.body",targets)
    source_flags=retain_targets(ROOT/"gcb-v15-source-flags.body",targets)
    if set(primary)!=set(source_flags):
        raise ValueError("GCB numerical/source flag country-year domains differ")
    raw_native=Path("generated-artifacts/driver-calibration/kaya-co2.csv")
    if digest(raw_native)!="7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6":
        raise ValueError("Original native source changed")
    native={(r["country"],int(r["year"])):r for r in csv.DictReader(raw_native.open())
            if r["country"] in (*targets,"Vatican") and int(r["year"]) in YEARS}
    carbon=[]
    for name in targets:
        canonical="Vatican" if name=="Vatican City" else name
        for year in YEARS:
            row=primary.get((name,year))
            old=native[canonical,year]
            old_value=numeric_cell(old["co2"])
            value=numeric_cell(row["Total"]) if row else None
            if row and row["ISO 3166-1 alpha-3"]!=source_flags[name,year]["ISO 3166-1 alpha-3"]:
                raise ValueError("Primary source-flag code mismatch")
            carbon.append({"country":canonical,"year":year,"primaryCountryRowExists":row is not None,
                           "primaryCode":row["ISO 3166-1 alpha-3"] if row else None,
                           "originalNativeISO":old["iso_code"],"primaryTotalMtCO2":value,
                           "nativeTotalMtCO2":old_value,
                           "nativeMinusPrimaryMtCO2":old_value-value if old_value is not None and value is not None else None,
                           "displayRoundingOnlyCompatible":display_rounding_only_compatible(value,old_value),
                           "sourceFlags":source_flags.get((name,year)),
                           "sourceLogicalRow":row["sourceLogicalRow"] if row else None,
                           "missingPrimaryCountryRowIsZero":False})
    text=(ROOT/"gcb-v15-notes.txt").read_text()
    terms=("we maintain the traditional","grouping of combining Monaco and France",
           "Monaco’s official emissions estimates","Holy See (Vatican City) are included in Italy.",
           "NOTE: In this 2024 release")
    note_lines={}
    for term in terms:
        hits=[i for i,line in enumerate(text.split("\n"),1) if term in line]
        if not hits:
            raise ValueError("Required parent-territory source note missing")
        note_lines[term]=hits
    previous=Path("generated-artifacts/kaya-eu-energy-definition/focused-definition-result.json")
    if digest(previous)!="251b54d9c40d7e7969f791db7cb3c26c5aacd0d479c2d4aa0cf800affe837264":
        raise ValueError("Retained original-contract gap evidence changed")
    gaps=json.loads(previous.read_text())["originalEntityGDPGapYears"]
    result={"schemaVersion":1,"methodSHA256":digest(__file__),
            "providerLabels":{"count":len(flags),"counts":dict(Counter(r["source"] for r in flags.values())),
                              "observedRows":list(flags.values()),"fieldOrigins":version_origins,
                              "sourceChecksumOpaque":meta["dataset"]["source_checksum"],
                              "metadataInheritedDatasetTitle":meta["dataset"]["title"],
                              "originalArtifactAtomicBindingCertified":False,
                              "sameDatedSourceVersionFamilyQualified":True},
            "EINumericRights":ei_rights,
            "EIAvailableDefinitionMetadata":{"sourceSHA256":digest(ROOT/"ei-metadata.body"),
                                             "linePointers":ei_definition_lines,
                                             "primaryDefinition":"Commercially traded fuels,including modern renewables;non-fossil electricity input-equivalent basis",
                                             "oilBoundary":"Published oil-consumption definition includes international aviation/marine bunkers,refinery fuel/loss",
                                             "limit":"Oil-component definition is NOT an observed primary-total bunker-energy allocation or full EI regional/territory Definitions sheet. Do not infer a bunker quantity from World residual."},
            "EIAOnlySeparateBasis":{"sourceFieldUnit":"terawatt-hours","additionalConversionApplied":False,
                                    "sourceChecksumOpaque":eia_meta["dataset"]["source_checksum"],
                                    "sourceFieldOrigins":eia_meta["fields"]["total_energy_consumption"]["origins"],
                                    "nativeCells":len(energy),"nativePositiveFiniteCells":sum(
                                        numeric_cell(r["total_energy_consumption"]) is not None
                                        and numeric_cell(r["total_energy_consumption"])>0 for r in energy.values()),
                                    "regionalAccounting":eia_region,
                                    "nativeRows":list(energy.values()),
                                    "largestAbsoluteRegionalResidualTWh":max(abs(r["nativeMinusCompleteMembersTWh"]) for r in eia_region),
                                    "precision":"Publisher CSV representation of stored Parquet values,not asserted original producer unrounded precision",
                                    "independentSourceAssemblyReady":True,"originalEnergyBasisReplacement":False,
                                    "WorldCompleteTerritoriesCertified":False,"WorldResidualIsBunkerEnergy":False},
            "GCB2025ExactRelease":{"rights":"CC BY 4.0","flatSHA256":digest(ROOT/"gcb-v15-flat.body"),
                                   "originalSnapshotMD5ExactlyMatched":True,"pairedCells":carbon,
                                   "requestedCountryYears":90,"matchedNumericalCountryYears":len(primary),
                                   "missingPrimaryCountryYears":90-len(primary),"parentNotesLinePointers":note_lines,
                                   "linePointerConvention":"Newline-based,pdftotext-layout text;form-feed pagination not counted as an extra line",
                                   "SanMarinoMentions":len(re.findall(r"San\s+Marino",text,re.I)),
                                   "VaticanMentions":len(re.findall(r"Vatican",text,re.I)),
                                   "MonacoGroupingPolicy":"Source2025v15p20 explicitly groups Monaco with France and adds official Monaco NGHGI from1990;no stand-alone Monaco country rows. This is a declared grouping policy,not numerical deconsolidation proof for each year.",
                                   "VaticanGroupingPolicy":"Source2025v15p28 explicitly includes Holy See(VaticanCity)inItaly. Stand-alone source rows absent;no independent numerical Vatican series fabricated.",
                                   "displayRoundingOnlyAllCompatible":all(r["displayRoundingOnlyCompatible"]
                                       for r in carbon if r["primaryCountryRowExists"]),
                                   "displayRoundingOnlyExceptions":[r for r in carbon
                                       if r["displayRoundingOnlyCompatible"] is False],
                                   "FrenchOverseasCaveat":"Exact2025v15PDF retains a2024release unresolved-overseas warning onp21;do not infer2025territory correction.",
                                   "sourceTermsAppliedToNativeValues":False},
            "originalGDPGapYearsRetained":gaps,"newlyQualifiedOriginalEntities":[],
            "fits":0,"holdoutScores":0,"unavailableCasesAreStatisticalRejections":False,
            "old420NumericAuditReplayed":False,"MaltaRevisionAuditReplayed":False,"census3285Rebuilt":False}
    out=ROOT/"same-release-source-assembly.json"
    out.write_text(json.dumps(result,indent=2,default=str)+"\n")
    print(json.dumps({"providerLabels":len(flags),"providerCounts":result["providerLabels"]["counts"],
                      "EIAOnlyNativeEnergyCells":len(energy),"completeEIAOnlyEUYears":len(eia_region),
                      "maximumEIARegionalResidualTWh":str(result["EIAOnlySeparateBasis"]["largestAbsoluteRegionalResidualTWh"]),
                      "GCBMatchedPrimaryCountryYears":len(primary),"GCBPrimaryCountryYearsAbsent":90-len(primary),
                      "originalEntitiesNewlyQualified":0,"fits":0,"resultSHA256":digest(out)},indent=2))


def validate_private():
    import unittest
    check=unittest.TestCase()
    manifest=json.loads((ROOT/"requests.json").read_text())
    check.assertEqual(len(manifest["requests"]),24)
    for row in manifest["requests"]:
        for key in ("body","headers"):
            check.assertEqual(digest(row[key]),row[key+"SHA256"])
    result=json.loads((ROOT/"same-release-source-assembly.json").read_text())
    check.assertEqual(result["methodSHA256"],digest(__file__))
    check.assertEqual(result["providerLabels"]["counts"],{"ei":405,"eia":15})
    check.assertEqual({r["country"] for r in result["providerLabels"]["observedRows"] if r["source"]=="eia"},{"Malta"})
    check.assertFalse(result["providerLabels"]["originalArtifactAtomicBindingCertified"])
    check.assertFalse(result["EINumericRights"]["numericUseAdmitted"])
    check.assertEqual(result["EINumericRights"]["termsHTTPStatus"],"403")
    definition=result["EIAvailableDefinitionMetadata"]
    check.assertTrue(all(definition["linePointers"].values()))
    check.assertIn(496,definition["linePointers"][
        "Comprises commercially-traded fuels, including modern renewables used to generate electricity."])
    check.assertIn(393,definition["linePointers"][
        "Includes inland demand plus international aviation and marine bunkers and refinery fuel and loss."])
    energy=result["EIAOnlySeparateBasis"]
    check.assertEqual(energy["nativeCells"],480)
    check.assertEqual(energy["nativePositiveFiniteCells"],480)
    check.assertEqual(len(energy["regionalAccounting"]),15)
    check.assertEqual(energy["largestAbsoluteRegionalResidualTWh"],"0.001045227050729")
    for row in energy["regionalAccounting"]:
        check.assertEqual(row["completeMembers"],27)
        with localcontext() as context:
            context.prec=100
            check.assertEqual(Decimal(row["publisherEIAEU27TWh"])-Decimal(row["EIAOnlySum27TWh"]),
                              Decimal(row["nativeMinusCompleteMembersTWh"]))
        check.assertFalse(row["nativeRegionalValueReplaced"])
    carbon=result["GCB2025ExactRelease"]
    check.assertTrue(carbon["originalSnapshotMD5ExactlyMatched"])
    check.assertEqual(carbon["matchedNumericalCountryYears"],45)
    check.assertEqual(carbon["missingPrimaryCountryYears"],45)
    check.assertEqual(carbon["SanMarinoMentions"],0)
    check.assertEqual(carbon["VaticanMentions"],1)
    check.assertEqual(carbon["parentNotesLinePointers"]["Holy See (Vatican City) are included in Italy."],[1122])
    check.assertFalse(carbon["displayRoundingOnlyAllCompatible"])
    check.assertEqual([(r["country"],r["year"],r["nativeMinusPrimaryMtCO2"])
                       for r in carbon["displayRoundingOnlyExceptions"]],[("France",2020,"-0.000507")])
    for row in carbon["pairedCells"]:
        if row["country"] in ("Monaco","San Marino","Vatican"):
            check.assertFalse(row["primaryCountryRowExists"])
            check.assertIsNone(row["nativeTotalMtCO2"])
        else:
            check.assertEqual(row["displayRoundingOnlyCompatible"],
                              abs(Decimal(row["nativeMinusPrimaryMtCO2"]))<=Decimal("0.0005"))
            check.assertTrue(row["sourceFlags"]["Total"])
        if row["country"]=="Kosovo":
            check.assertEqual(row["primaryCode"],"KSV")
            check.assertEqual(row["originalNativeISO"],"")
    check.assertEqual(result["newlyQualifiedOriginalEntities"],[])
    for field in ("fits","holdoutScores"):
        check.assertEqual(result[field],0)
    for field in ("unavailableCasesAreStatisticalRejections","old420NumericAuditReplayed",
                  "MaltaRevisionAuditReplayed","census3285Rebuilt"):
        check.assertFalse(result[field])
    print(json.dumps({"requiredPrivateCheck":"passed","responseHashesVerified":48,
                      "nativeEnergyCells":480,"providerLabels":420,
                      "sourceCO2Pairs":45,"absentPrimaryCountryRows":45,
                      "displayRoundingOnlyGatePassCells":44,"displayRoundingOnlyGateFailCells":1,
                      "privateFilesSkipped":0,"fits":0}))


if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument("action",choices=("assemble","validate-private"),nargs="?",default="assemble")
    args=parser.parse_args()
    assemble() if args.action=="assemble" else validate_private()

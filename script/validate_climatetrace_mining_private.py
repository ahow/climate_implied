"""Required retained-source validation; missing private bytes FAIL, never skip.

Run explicitly in the authorized workspace, outside public unittest discovery:
python script/validate_climatetrace_mining_private.py
"""
import hashlib
import json
from pathlib import Path
import unittest


def validate():
    a = unittest.TestCase()
    root = Path("generated-artifacts/climatetrace-mining-method")
    evidence_path = Path("docs/climatetrace-mining-method-source-evidence.json")
    evidence = json.loads(evidence_path.read_text())
    implementation = evidence["implementationAndExecution"]
    pairs = []
    for entry in evidence["frozenBeforeRequests"]:
        json.loads(Path(entry["path"]).read_text())
        pairs.append((entry["path"], entry["sha256"]))
    for name in ("module", "tests", "assemblyLog", "testsLog", "result"):
        pairs.append((implementation[name], implementation[name + "SHA256"]))
    pairs.append(("script/climatetrace_monthly_archive_bridge.py",
                  implementation["readOnlyZipDependencySHA256"]))
    acquisition = evidence["newPrimarySourceAcquisition"]
    for name in ("manifest", "discovery"):
        pairs.append((acquisition[name], acquisition[name + "SHA256"]))
    manifest = json.loads(Path(acquisition["manifest"]).read_text())
    a.assertEqual(len(manifest["requests"]), 7)
    a.assertEqual(sum(r["bytes"] for r in manifest["requests"]), 3802548)
    for request in manifest["requests"]:
        a.assertEqual(request["status"], "200")
        a.assertEqual(request["curlExit"], 0)
        for name in ("body", "headers"):
            pairs.append((request[name], request[name + "SHA256"]))
    for document in evidence["publisherDocuments"]:
        body_path = root / (document["name"] + ".body")
        text_path = root / (document["name"] + ".txt")
        pairs.extend(((body_path, document["bodySHA256"]),
                      (text_path, document["textSHA256"])))
        body = body_path.read_bytes()
        a.assertEqual(len(body), document["bytes"])
        blob = hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest()
        a.assertEqual(blob, document["sourceGitBlobSHA1"])
    native = evidence["newNativeInputAssembly"]
    pairs.append((native["privateNativeInputTrace"], native["privateNativeInputTraceSHA256"]))
    retained = evidence["routeDecision"]
    for path, key in (
        ("kaya-fullbasis-monthly/fullbasis-source-result.json", "retainedWDIResultSHA256"),
        ("climatetrace-monthly-100mb/monthly-source-result.json", "retainedMonthlyResultSHA256"),
        ("climatetrace-monthly-100mb/mineral-extraction-archive.body", "retainedArchiveSHA256"),
    ):
        pairs.append((Path("generated-artifacts") / path, retained[key]))
    a.assertEqual(len(pairs), 36)
    for path, digest in pairs:
        a.assertEqual(hashlib.sha256(Path(path).read_bytes()).hexdigest(), digest, str(path))
    result = json.loads(Path(implementation["result"]).read_text())
    a.assertEqual(result["nativeInputAuditTrace"]["rows"], 118279)
    a.assertFalse(result["missingOrUnqualifiedNativeInputCells"])
    a.assertEqual(result["factorConstancyWithinNativeAssetYear"]["singleFactorPanels"], 11634)
    for comparison in result["newActivityFactorPeriodComparisons"]:
        a.assertIs(comparison["CO2QuantityRepetitionAuditRerun"], False)
        for field in ("activity", "factor"):
            a.assertEqual(comparison["newNativeInputFieldComparisons"][field]["maxAbsDifference"], "0")
    a.assertEqual(len(result["newNativeInputAssemblies"]),
                  len(native["nativeArithmeticAudit"]["perSubsector"]))
    for source, record in zip(result["newNativeInputAssemblies"],
                              native["nativeArithmeticAudit"]["perSubsector"]):
        a.assertEqual(source["subsector"], record["subsector"])
        a.assertEqual(source["maxAbsReportedMinusNativeProductTonnes"],
                      record["maxAbsReportedMinusProductTonnes"])
    a.assertFalse(result["sourceAdmission"]["independentRealizedMonthly2025Or2026OutcomeAdmitted"])
    a.assertFalse(result["fitExecuted"])
    print(json.dumps({"privateSourceHashesVerified": len(pairs), "publisherGitBlobsVerified": 4,
                      "nativeInputRows": 118279, "missingFilesSkipped": 0,
                      "fits": 0, "sourceOrForecastReruns": 0}))


if __name__ == "__main__":
    validate()

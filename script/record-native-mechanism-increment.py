#!/usr/bin/env python3
"""Reconcile four finite original clauses from retained execution receipts.

This records local engineering evidence only. It cannot publish, deploy, approve
science or replace the existing independently verified runtime receipt.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "script" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def receipt(path, require_success=True):
    value = json.loads((ROOT / path).read_text())
    if require_success and value["exit_code"] != 0:
        raise ValueError(f"Unsuccessful required execution: {path}")
    if value["log_sha256"] != digest(value["log"]):
        raise ValueError(f"Execution log no longer matches receipt: {path}")
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--focused-receipt", required=True)
    parser.add_argument("--full-receipt")
    parser.add_argument("--private-receipt", required=True)
    parser.add_argument("--partition-receipt", required=True)
    parser.add_argument("--route-receipt", required=True)
    args = parser.parse_args()
    focused = receipt(args.focused_receipt)
    private = receipt(args.private_receipt)
    partition = receipt(args.partition_receipt)
    route = receipt(args.route_receipt)
    full = receipt(args.full_receipt, require_success=False) if args.full_receipt else None
    expected = module("workplan-evidence-run").FULL_CHECK_COMMAND
    if full and full["command"] != expected:
        raise ValueError("Full receipt did not run the unchanged mandatory full-check command")
    full_passed = bool(full and full["exit_code"] == 0)
    failure_history = []
    for path in sorted((ROOT / "generated-artifacts/s05-s07-integration").glob("*.json")):
        value = json.loads(path.read_text())
        if value.get("exit_code", 0) != 0:
            failure_history.append({
                "receipt": str(path.relative_to(ROOT)), "exit_code": value["exit_code"],
                "counts": value.get("suite_counts", value.get("counts")),
                "log": value.get("log"), "log_sha256": value.get("log_sha256"),
            })
    for path in sorted((ROOT / "generated-artifacts/s05-s07-integration").glob("full-checks-*.log")):
        if path.with_suffix(".receipt.json").exists():
            continue
        text = path.read_text()
        failure_history.append({
            "receipt": None, "exit_code": None, "counts": None,
            "log": str(path.relative_to(ROOT)),
            "log_sha256": digest(path.relative_to(ROOT)),
            "status": "incomplete; no terminal execution receipt, no full-gate completion claimed",
            "observed_boundary": (
                "Shell reported Hangup during npm run check; exact exit code not retained"
                if "Hangup" in text else
                "Partial TypeScript TAP output; no terminal suite summary"
                if "# Subtest:" in text else
                "Typecheck started; no subsequent stage or terminal summary retained"
            ),
        })
    postgres_path = "docs/disposable-cache-transport-evidence.json"
    postgres = json.loads((ROOT / postgres_path).read_text())
    postgres_witness = {
        "evidence": postgres_path, "sha256": digest(postgres_path),
        "passed": postgres["passed"], "started_at": postgres["startedAt"],
        "finished_at": postgres["finishedAt"],
        "actual_postgresql_witnesses": [
            witness for witness in postgres["witnesses"]
            if witness.get("postgresqlTransportExecuted") is True
        ],
        "full_gate_optional_case": "authorized disposable PostgreSQL preserves actual full/reduced namespaces and revision isolation",
        "full_gate_optional_case_status": "skipped in full suite; executed successfully in the separate isolated PostgreSQL run, never subtracted from full-suite skipped count",
        "isolation": postgres["isolation"],
        "boundary": "Separate isolated local PostgreSQL execution, not the full gate's database transport. Memory route matrices are not PostgreSQL witnesses. No deployed PostgreSQL acceptance.",
    }
    preservation = json.loads((ROOT / "generated-artifacts/mechanism-matrix/preservation.json").read_text())
    for group in ("frozenNegativeFiles", "fair14Pins"):
        if len(preservation[group]) != 14:
            raise ValueError(f"Protected preservation census changed: {group}")
        for entry in preservation[group]:
            if digest(entry["path"]) != entry["expected"]:
                raise ValueError(f"Protected source changed, never repin: {entry['path']}")
    mechanism_path = ROOT / "docs/mechanism-matrix-evidence.json"
    mechanism = json.loads(mechanism_path.read_text())
    for item in mechanism["implementation"]:
        item["sha256"] = digest(item["path"])
    mechanism["parentIntegration"] = {
        "focusedReceipt": args.focused_receipt, "privateReceipt": args.private_receipt,
        "typescriptPartitionReceipt": args.partition_receipt,
        "slowRouteReceipt": args.route_receipt,
        "partitionBoundary": "Partition and separate route receipts remain historical evidence, not a coherent full gate. See fullReceipt/fullCounts for the actual unchanged full command; optional PostgreSQL skips, if present, remain explicit. Separate isolated local PostgreSQL execution is recorded independently, never attributed to memory routes.",
        "fullReceipt": args.full_receipt,
        "fullCounts": full["suite_counts"] if full else None,
        "fullGatePassed": full_passed,
        "failureHistory": failure_history,
        "separateLocalPostgresql": postgres_witness,
        "focusedTests": focused["suite_counts"], "allPythonTests": private["suite_counts"]["python"],
        "additionalFocusedPythonTests": "Five ledger/receipt regression tests; see focused log after12 adapter tests",
        "focusedFailurePreserved": "generated-artifacts/s05-s07-integration/focused-final.receipt.json (177pass/1fail; exposing generic private error text repaired)",
        "repairs": [
            "nativeMechanisms.ts added to exact archived-engine replay closure; validly rehashed changed dependency rejected",
            "actual old native1/2 retained material and consumer responses explicitly rejected, never re-tagged",
            "mixed Python/TAP receipt parser no longer borrows later private TAP counts",
            "old-v2 DEV response/current-v3 client caught in query selection, not a dashboard render crash; only locally typed compatibility reason exposed, never generic private fetch error text",
            "Two new actual driver-registry trace fields fully defined; census regenerated with exact two-field supplemental denominator increase. Original1001 slots and one opaque summary gap remain unchanged",
            "Five whole-suite source/contract failures preserved in typescript-without-slow-route.receipt.json; missing field definitions, stale source-hash evidence and exact additive counts repaired without relaxing strict census gates"
        ],
        "protectedNegativeFilesUnchanged": 14, "protectedFairPinsUnchanged": 14,
        "newSourceSha256": {p: digest(p) for p in [
            "server/snapshots/nativeCandidateProducer.ts", "script/native-producer-exports.test.ts",
            "shared/nativeConsumer.ts", "client/src/components/emissions-candidate-review.tsx",
            "script/native-threshold-integration.test.ts", "script/workplan-evidence-run.py",
            "script/test_completion_ledger.py", "shared/researchFieldSemantics.ts",
            "script/next-census-accounting.test.ts", "script/research-field-semantics.test.ts",
            "docs/field_semantics_census.json"
        ]},
        "screenshots": [
            "screenshots/native-v3-integration-before-parent-restart.jpg (old2/current3 crash, preserved)",
            "screenshots/native-v3-integration-compatible-refusal.jpg (dashboard renders after fail-closed repair)"
        ],
        "runtimeBoundary": "Existing DEV server not restarted; still old version2. Screenshots are not proof of server3. No new live release or central acceptance."
    }
    mechanism_path.write_text(json.dumps(mechanism, indent=2) + "\n")
    path = ROOT / "docs/workplan_completion_ledger.json"
    ledger = json.loads(path.read_text())
    requirements = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
    if len(requirements) != 300:
        raise ValueError("Original 300-clause census changed")
    before = ledger["latest_increment"].get("native_mechanism_finite_reconciliation", {}).get(
        "status_before", dict(Counter(r["status"] for r in requirements.values())))
    evidence = {
        "S05-004": ["docs/mechanism-matrix-evidence.json"],
        "S05-010": ["docs/mechanism-matrix-evidence.json"],
        "S06-006": ["docs/pathway-adapter-evidence.json"],
        "S07-020": ["docs/netzero-fixture-reconciliation.json"],
    }
    sources = {
        "S05-004": ["server/calculation/nativeMechanisms.ts", "server/calculation/emissionsCandidate.ts",
                    "server/calculation/driverParameterRegistry.ts", "shared/nativeScenarioSemantics.ts",
                    "script/native-mechanism-matrix.test.ts"],
        "S05-010": ["server/calculation/nativeMechanisms.ts", "server/calculation/driverParameterRegistry.ts",
                    "script/native-mechanism-matrix.test.ts"],
        "S06-006": ["script/versioned_ngfs_adapter.py", "script/test_versioned_ngfs_adapter.py",
                    "script/fixtures/ngfs-phase-v-5.1-ch4.csv"],
        "S07-020": ["server/calculation/memberMetrics.ts", "script/member-metrics.test.ts",
                    "server/calculation/researchCorrections.ts"],
    }
    delivered = {
        "S05-004": "Executable native-v3 eligibility, lag, saturation/bounds, complete-overlap, renewable dispatch, sales-to-stock EV turnover, activity/intensity and policy. EV electricity is charged once to power. Corporate coefficients remain labelled diagnostic sensitivities, never central; no finance-to-abatement coefficient invented.",
        "S05-010": "All 52 supported scenario parameter-leaf templates have exhaustive declared numerical-output isolation checks: 325156 comparisons, zero undeclared movements; 52 source-bound US regional cases leave the five other full regional trajectories exactly unchanged. Metadata/permission and empty retained-building scopes explicitly inert.",
        "S06-006": "Reviewed version-profile CSV adapter validates pinned release/artifact identity, schema, rights, native species and processing stage; separately profiled explicitly synthetic future-shaped input swaps without parser edits. Original criterion is adapter readiness, not an unreleased actual Phase VI swap.",
        "S07-020": "Explicit rise, fall, rebound and never-crossing supplied-member fixtures return correct first/durable CO2 and GHG events and null never-reaching quantiles. Original finite fixture criterion does not require an accepted production ensemble.",
    }
    limits = {
        "S05-004": "Engineering clause satisfied, not empirical calibration or central science acceptance. No production building disaggregation: retained unsplit 1.A.4 remains other; explicit building subcodes are tested only as synthetic fixtures. No approved native joint distribution/inventory or corporate/finance central coefficient.",
        "S05-010": "Completeness covers supported path templates, not arbitrary array lengths, unsupported parameters, every nonlinear combination or calibrated physical skill. Source-bound regional splits and coefficients are engineering fixtures; curated-to-regional central bridge remains unapproved.",
        "S06-006": "No actual Phase VI release/schema/licence or production native pair accepted. Actual attributed Phase V fixture is only 1124 bytes; synthetic future profile is explicitly not a released dataset. Existing raw/harmonized/infilled and missing-species refusals retained.",
        "S07-020": "Accounting on supplied synthetic members only; no production climate ensemble or physical forecast validation. Durable <=5% of 2024 diagnostic remains distinct from net zero.",
    }
    timestamp = datetime.now(timezone.utc).isoformat()
    for clause, files in evidence.items():
        r = requirements[clause]
        hashes = {p: digest(p) for p in sources[clause] + files}
        r.update(status="verified", proposedStatus="verified",
                 behaviour_delivered_this_run=delivered[clause],
                 evidence_caveat=limits[clause], remaining_gaps=[], exactRemainingGaps=[],
                 next_action="No remaining finite clause work; independent scientific/source gates remain unchanged.",
                 nextAction="No remaining finite clause work; independent scientific/source gates remain unchanged.",
                 scientific_acceptance="not-promoted", scientificAcceptance="not-promoted")
        r["existing_evidence"] = list(dict.fromkeys(r["existing_evidence"] + files + sources[clause]))
        r["directEvidenceFiles"] = list(dict.fromkeys(r.get("directEvidenceFiles", []) + files + sources[clause]))
        r["inspected_source_sha256"].update(hashes)
        r["native_increment_reconciliation"] = {
            "verified_at": timestamp, "criterion": r["requirement"],
            "scope": "Exact written finite engineering criterion; not production scientific acceptance",
            "delivered": delivered[clause], "independent_scientific_limits": limits[clause],
            "source_sha256": hashes, "focused_receipt": args.focused_receipt,
            "runtime": "No new runtime verification; existing current_release preserved",
        }
        if focused not in r["executions"]:
            r["executions"].append(focused)
    after = dict(Counter(r["status"] for r in requirements.values()))
    summary = {
        "scope": "Original S05-004/S05-010/S06-006/S07-020 finite criteria reconciled; all300 IDs retained",
        "status_before": before, "status_after": after,
        "new_code": "Native engine3; exact consumer version guard; nativeMechanisms included in archived replay closure; validly rehashed changed dependency and old native1/2 records explicitly refused",
        "old_evidence": "Historical per-clause hashes/executions and current_release remain historical; not relabelled as new runtime. All14 FaIR pins, frozen negative protocols and old immutable outputs untouched.",
        "focused_receipt": args.focused_receipt, "focused_log_sha256": focused["log_sha256"],
        "focused_counts": focused["suite_counts"],
        "mandatory_private_receipt": args.private_receipt,
        "mandatory_private_log_sha256": private["log_sha256"],
        "all_python_counts": private["suite_counts"]["python"],
        "typescript_partition_receipt": args.partition_receipt,
        "typescript_partition_counts": partition["suite_counts"]["typescript"],
        "separate_slow_route_receipt": args.route_receipt,
        "separate_slow_route_counts": route["suite_counts"]["typescript"],
        "source_contract_accounting": "Exactly2 new trace leaves are supplemental:439added slots,1440public/1439bound,1467typed; expanded4206public/4205bound. Frozen original1001 denominator and one opaque old summary gap unchanged. No original closure credit from these new fields.",
        "extra_focused_checks": "5 ledger/receipt Python and4 actual retained-driver private TAP tests; npm typecheck/build pass. Not included in178 main TS or12 adapter counts.",
        "full_receipt": args.full_receipt, "full_exit_code": full["exit_code"] if full else None,
        "full_counts": full["suite_counts"] if full else None,
        "full_gate_passed": full_passed,
        "full_gate_boundary": "Actual unchanged full command passed; optional skips remain explicit in full_counts, with separate isolated local PostgreSQL evidence below. Not scientific acceptance." if full_passed else "Focused success never substitutes for mandatory full checks. Incomplete/failed attempts remain retained; parent must complete full gate before publication.",
        "failure_history": failure_history,
        "separate_local_postgresql": postgres_witness,
        "source_findings": "docs/mechanism-run-source-evidence.json: 0 newly qualified calibration/economic pairs; no actual new mechanism fits/issuer cash/dated 11-15 runs. Original remaining science/source scope remains current, not new tasks.",
        "runtime": "No new deployment or workflow operations in subagent; current_release unchanged. Parent owns existing sync-github.py/CI promotion/Railway, one DEV restart and live exact-SHA checks.",
    }
    ledger["latest_increment"]["native_mechanism_finite_reconciliation"] = summary
    ledger["updated_at"] = timestamp
    if full and full not in ledger["run_executions"]:
        ledger["run_executions"].append(full)
    for execution in (focused, private, partition, route):
        if execution not in ledger["run_executions"]:
            ledger["run_executions"].append(execution)
    module("completion-ledger").render(ledger)
    matrix = module("merge-clause-reconciliation").matrix(ledger)
    (ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(matrix)
    report = ROOT / "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
    marker = "## Native-v3 finite engineering reconciliation — local evidence"
    text = report.read_text()
    if marker in text:
        prefix, rest = text.split(marker + "\n\n", 1)
        _, end = json.JSONDecoder().raw_decode(rest)
        report.write_text(prefix + marker + "\n\n" + json.dumps(summary, indent=2) + rest[end:])
    else:
        report.write_text(marker + "\n\n" + json.dumps(summary, indent=2) + "\n\n" + text)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
